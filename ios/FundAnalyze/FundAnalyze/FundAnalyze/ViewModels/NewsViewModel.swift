import Foundation
import SwiftUI
import Combine

@MainActor
class NewsViewModel: ObservableObject {
    @Published var digest: NewsDigest?
    @Published var marketSnapshots: [NewsMarketSnapshot] = []
    @Published var headlineNews: [NewsItem] = []
    @Published var relatedNews: [NewsItem] = []
    @Published var aiHighlights: [NewsAIHighlight] = []
    @Published var keywordChips: [String] = ["A股"]
    @Published var selectedKeyword: String = "A股"
    @Published var isLoading = false
    @Published var isGeneratingAI = false
    @Published var errorMessage: String?
    @Published var aiErrorMessage: String?

    private var latestNewsPool: [NewsItem] = []
    private var lastRefreshAt: Date?

    func loadIfNeeded() async {
        let shouldRefreshBecauseEmpty = marketSnapshots.isEmpty || headlineNews.isEmpty || relatedNews.isEmpty
        let shouldRefreshBecauseStale: Bool
        if let lastRefreshAt {
            shouldRefreshBecauseStale = Date().timeIntervalSince(lastRefreshAt) > 180
        } else {
            shouldRefreshBecauseStale = true
        }

        guard shouldRefreshBecauseEmpty || shouldRefreshBecauseStale else { return }
        await refreshAll()
    }

    func refreshAll() async {
        if digest == nil && headlineNews.isEmpty && relatedNews.isEmpty {
            isLoading = true
        }
        errorMessage = nil

        let groupsResult = await loadGroups()
        let keywords = buildKeywordChips(from: groupsResult ?? [])
        keywordChips = keywords
        if !keywords.contains(selectedKeyword) {
            selectedKeyword = keywords.first ?? "A股"
        }

        async let emTask = loadNews(source: .em, keyword: selectedKeyword)
        async let clsTask = loadNews(source: .cls, keyword: selectedKeyword)
        async let marketTask = loadMarketSnapshots()

        let emNews = await emTask
        let clsNews = await clsTask
        let market = await marketTask

        marketSnapshots = market
        latestNewsPool = rankNews(mergeAndDeduplicate(emNews + clsNews), keywords: keywords, selectedKeyword: selectedKeyword)
        headlineNews = Array(latestNewsPool.prefix(5))
        relatedNews = buildRelatedNews(from: latestNewsPool, keywords: keywords, selectedKeyword: selectedKeyword)
        digest = buildDigest(market: market, headlines: headlineNews, related: relatedNews)
        aiHighlights = []
        aiErrorMessage = nil

        if latestNewsPool.isEmpty {
            errorMessage = "暂时没有可展示的资讯，稍后再试。"
        }

        lastRefreshAt = Date()
        isLoading = false
    }

    func selectKeyword(_ keyword: String) async {
        guard keyword != selectedKeyword else { return }
        selectedKeyword = keyword
        await refreshAll()
    }

    func generateAIHighlights() async {
        guard !isGeneratingAI else { return }

        let apiKey = DeepSeekConfigStore.shared.loadAPIKey()
        guard !apiKey.isEmpty else {
            aiErrorMessage = "请先在“分组配置 -> AI 解读配置”里填写 DeepSeek API Key。"
            return
        }

        let candidates = Array(headlineNews.prefix(2))
        guard !candidates.isEmpty else {
            aiErrorMessage = "当前没有可用于解读的重点资讯。"
            return
        }

        isGeneratingAI = true
        aiErrorMessage = nil
        defer { isGeneratingAI = false }

        let fundSectors = keywordChips.filter { $0 != "A股" }.joined(separator: "、")
        let model = DeepSeekConfigStore.shared.configuredModel
        var highlights: [NewsAIHighlight] = []
        var failures: [String] = []

        for item in candidates {
            do {
                let analysis = try await APIClient.shared.fetchDeepSeekNewsAI(
                    apiKey: apiKey,
                    model: model,
                    title: item.title,
                    content: item.content,
                    fundSectors: fundSectors.isEmpty ? "A股、红利、半导体、医药、新能源、消费" : fundSectors
                )
                highlights.append(NewsAIHighlight(id: item.id, news: item, analysis: analysis))
            } catch {
                failures.append("\(item.title)：\(error.localizedDescription)")
            }
        }

        aiHighlights = highlights
        if highlights.isEmpty && !failures.isEmpty {
            aiErrorMessage = "AI 解读失败：\(failures[0])"
        } else if !highlights.isEmpty && !failures.isEmpty {
            aiErrorMessage = "部分解读生成失败：\(failures[0])"
        } else if highlights.isEmpty && aiErrorMessage == nil {
            aiErrorMessage = "本次没有生成可用的 AI 解读结果。"
        }
    }

    private func loadGroups() async -> [FundGroup]? {
        do {
            return try await APIClient.shared.request(endpoint: "/groups/")
        } catch {
            return nil
        }
    }

    private func loadNews(source: NewsSource, keyword: String) async -> [NewsItem] {
        do {
            return try await APIClient.shared.fetchNews(source: source, keyword: keyword)
        } catch {
            return []
        }
    }

    private func loadMarketSnapshots() async -> [NewsMarketSnapshot] {
        do {
            let items = try await APIClient.shared.fetchMarketCompassItems()
            let focusItems = Array(items.prefix(4))
            return await withTaskGroup(of: NewsMarketSnapshot?.self) { group in
                for item in focusItems {
                    group.addTask { [weak self] in
                        await self?.loadMarketSnapshot(item: item)
                    }
                }

                var snapshots: [NewsMarketSnapshot] = []
                for await snapshot in group {
                    if let snapshot {
                        snapshots.append(snapshot)
                    }
                }
                return snapshots
            }
        } catch {
            return []
        }
    }

    private func loadMarketSnapshot(item: MarketFundItem) async -> NewsMarketSnapshot? {
        guard let rt = await fetchSingleFundRT(code: item.fund_code) else { return nil }

        let changeValue = rt.estChangeDouble != 0 ? rt.estChangeDouble : (Double(rt.yesterdayChange ?? "0") ?? 0)
        let sign = changeValue > 0 ? "+" : ""
        let updateTime = rt.estTime ?? rt.navDate ?? "刚刚"

        return NewsMarketSnapshot(
            id: item.fund_code,
            name: item.fund_name,
            code: item.fund_code,
            changeText: "\(sign)\(String(format: "%.2f", changeValue))%",
            changeValue: changeValue,
            updateTime: updateTime
        )
    }

    private func buildKeywordChips(from groups: [FundGroup]) -> [String] {
        var ordered: [String] = ["A股"]
        var amountByKeyword: [String: Double] = [:]
        var firstSeenIndex: [String: Int] = [:]
        var seenOrder = 0

        for group in groups where !group.is_market {
            for code in group.codes {
                let rawName = group.positions[code]?.fund_name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                let keyword = normalizedFundKeyword(from: rawName)
                guard !keyword.isEmpty else { continue }

                let amount = group.positions[code]?.amount ?? 0
                amountByKeyword[keyword, default: 0] += amount
                if firstSeenIndex[keyword] == nil {
                    firstSeenIndex[keyword] = seenOrder
                    seenOrder += 1
                }
            }
        }

        let sortedByAmount = amountByKeyword.keys.sorted { lhs, rhs in
            let lhsAmount = amountByKeyword[lhs, default: 0]
            let rhsAmount = amountByKeyword[rhs, default: 0]
            if lhsAmount != rhsAmount {
                return lhsAmount > rhsAmount
            }
            return firstSeenIndex[lhs, default: .max] < firstSeenIndex[rhs, default: .max]
        }

        for keyword in sortedByAmount {
            if ordered.contains(keyword) { continue }
            ordered.append(keyword)
            if ordered.count >= 6 { break }
        }

        if ordered.count < 6 {
            for group in groups where !group.is_market {
                let fallback = normalizedFundKeyword(from: group.name)
                if fallback.isEmpty || ordered.contains(fallback) { continue }
                ordered.append(fallback)
                if ordered.count >= 6 { break }
            }
        }

        if ordered.count < 6 {
            for group in groups where group.is_market {
                for code in group.codes {
                    let rawName = group.positions[code]?.fund_name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    let fallback = normalizedFundKeyword(from: rawName)
                    if fallback.isEmpty || ordered.contains(fallback) { continue }
                    ordered.append(fallback)
                    if ordered.count >= 6 { break }
                }
                if ordered.count >= 6 { break }
            }
        }

        return Array(ordered.prefix(6))
    }

    private func normalizedFundKeyword(from raw: String) -> String {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return "" }

        let blockedExactNames: Set<String> = ["支付宝", "京东", "天天基金", "蚂蚁财富"]
        if blockedExactNames.contains(text) {
            return ""
        }

        let managerPrefixes = [
            "易方达", "华夏", "广发", "富国", "招商", "天弘", "南方", "嘉实", "汇添富", "景顺长城",
            "工银瑞信", "中欧", "华安", "银华", "鹏华", "兴证全球", "兴全", "交银施罗德", "博时", "万家",
            "国泰", "平安", "建信", "永赢", "华泰柏瑞", "鹏扬", "信澳", "摩根", "诺安", "创金合信",
            "大成", "农银汇理", "国联安", "中庚", "前海开源", "东方红", "华宝", "长城", "中邮", "国投瑞银"
        ]

        for prefix in managerPrefixes {
            if text.hasPrefix(prefix) {
                text.removeFirst(prefix.count)
                break
            }
        }

        let suffixes = [
            "证券投资基金", "发起式", "发起", "联接基金", "ETF联接", "联接", "ETF", "LOF",
            "QDII", "FOF", "混合型", "混合", "指数型", "指数", "增强", "基金"
        ]

        var trimmed = true
        while trimmed {
            trimmed = false
            for suffix in suffixes {
                if text.hasSuffix(suffix), text.count > suffix.count + 1 {
                    text.removeLast(suffix.count)
                    trimmed = true
                    break
                }
            }
        }

        let replacements = [
            "人民币": "",
            "份额": "",
            "（": "",
            "）": "",
            "(": "",
            ")": "",
            "【": "",
            "】": ""
        ]

        for (target, replacement) in replacements {
            text = text.replacingOccurrences(of: target, with: replacement)
        }

        let indexPrefixes = ["中证", "国证", "沪深", "上证", "深证", "创业板", "科创"]
        for prefix in indexPrefixes {
            if text.hasPrefix(prefix), text.count > prefix.count + 1 {
                let candidate = String(text.dropFirst(prefix.count))
                if !candidate.contains(where: { $0.isNumber }) {
                    text = candidate
                }
                break
            }
        }

        while let last = text.last, last.isNumber || last == "A" || last == "C" || last == "I" || last == "Y" {
            text.removeLast()
        }

        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.count > 8 {
            text = String(text.prefix(8))
        }

        if text.count < 2 || blockedExactNames.contains(text) {
            return ""
        }

        return text
    }

    private func mergeAndDeduplicate(_ items: [NewsItem]) -> [NewsItem] {
        var map: [String: NewsItem] = [:]
        for item in items {
            let key = normalizedKey(for: item.title)
            guard !key.isEmpty else { continue }

            if let existing = map[key] {
                let shouldReplace = item.content.count > existing.content.count || (existing.url == nil && item.url != nil)
                if shouldReplace {
                    map[key] = item
                }
            } else {
                map[key] = item
            }
        }
        return Array(map.values)
    }

    private func rankNews(_ items: [NewsItem], keywords: [String], selectedKeyword: String) -> [NewsItem] {
        items.map { item in
            var mutable = item
            let matches = matchedKeywords(for: item, keywords: keywords)
            mutable.matchedKeywords = matches
            mutable.impactLevel = impactLevel(for: matches.count)
            mutable.relevanceScore = score(for: item, matches: matches, selectedKeyword: selectedKeyword)
            return mutable
        }
        .sorted { lhs, rhs in
            if lhs.relevanceScore != rhs.relevanceScore {
                return lhs.relevanceScore > rhs.relevanceScore
            }
            return lhs.time > rhs.time
        }
    }

    private func buildRelatedNews(from items: [NewsItem], keywords: [String], selectedKeyword: String) -> [NewsItem] {
        let chosen = items.filter { item in
            if selectedKeyword == "A股" {
                return !item.matchedKeywords.isEmpty || item.title.contains("A股") || item.content.contains("A股")
            }
            return item.matchedKeywords.contains(selectedKeyword)
        }

        if !chosen.isEmpty {
            return Array(chosen.prefix(5))
        }

        let fallback = items.filter { !$0.matchedKeywords.isEmpty }
        return Array(fallback.prefix(5))
    }

    private func buildDigest(market: [NewsMarketSnapshot], headlines: [NewsItem], related: [NewsItem]) -> NewsDigest {
        let rising = market.filter { $0.changeValue > 0 }.count
        let falling = market.filter { $0.changeValue < 0 }.count
        let mood: String
        if market.isEmpty {
            mood = "暂无行情更新"
        } else if rising > falling {
            mood = "市场情绪偏暖，题材活跃度回升"
        } else if rising < falling {
            mood = "市场情绪偏谨慎，先看防守方向"
        } else {
            mood = "市场分化明显，节奏偏轮动"
        }

        let focus = headlines.first?.title ?? "今日暂无重点资讯，先关注市场波动。"
        let relatedCount = related.filter { !$0.matchedKeywords.isEmpty }.count
        let impact = relatedCount > 0
            ? "已有 \(relatedCount) 条资讯命中你的主题词"
            : "暂未发现明显命中持仓主题的资讯"

        let updatedAt = market.first?.updateTime ?? headlines.first?.time ?? "刚刚"
        return NewsDigest(marketMood: mood, focusSummary: focus, impactSummary: impact, updatedAt: updatedAt)
    }

    private func matchedKeywords(for item: NewsItem, keywords: [String]) -> [String] {
        let haystack = item.title + "\n" + item.content
        return keywords.filter { keyword in
            keyword != "A股" && haystack.localizedCaseInsensitiveContains(keyword)
        }
    }

    private func impactLevel(for matchCount: Int) -> NewsImpactLevel {
        switch matchCount {
        case 2...:
            return .high
        case 1:
            return .medium
        default:
            return .low
        }
    }

    private func score(for item: NewsItem, matches: [String], selectedKeyword: String) -> Int {
        var score = 10
        let haystack = item.title + "\n" + item.content

        if haystack.localizedCaseInsensitiveContains(selectedKeyword) {
            score += 35
        }
        score += min(matches.count * 16, 32)

        if item.source == .cls {
            score += 12
        }

        if item.title.count >= 18 {
            score += 8
        }

        if item.time.contains(":") {
            score += 6
        }

        return score
    }

    private func normalizedKey(for title: String) -> String {
        title
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\n", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    // MARK: - Market data helpers
    private func fetchSingleFundRT(code: String) async -> RealTimeFund? {
        async let lsjzTask = fetchLSJZ(code: code)
        async let searchTask = fetchFundName(code: code)
        async let gzTask = fetchFundGZ(code: code)
        let (lsjzRes, searchRes, gzRes) = await (lsjzTask, searchTask, gzTask)

        let yesterdayChange = lsjzRes?.change
        let fallbackNav = lsjzRes?.nav
        let fallbackDate = lsjzRes?.date
        let fallbackName = searchRes

        if let gz = gzRes {
            return RealTimeFund(
                code: gz.code,
                name: fallbackName ?? gz.name,
                nav: freshestValue(gzValue: gz.nav, gzDate: gz.navDate, historyValue: fallbackNav, historyDate: fallbackDate),
                navDate: freshestDate(gzDate: gz.navDate, historyDate: fallbackDate),
                estChange: gz.estChange,
                estTime: gz.estTime,
                valuation: gz.valuation,
                yesterdayChange: yesterdayChange
            )
        }

        if fallbackNav != nil {
            return RealTimeFund(
                code: code,
                name: fallbackName ?? "基金 \(code)",
                nav: fallbackNav,
                navDate: fallbackDate,
                estChange: "0.00",
                estTime: fallbackDate,
                valuation: fallbackNav,
                yesterdayChange: yesterdayChange
            )
        }

        return nil
    }

    private func fetchLSJZ(code: String) async -> (nav: String?, date: String?, change: String?)? {
        if let mobileResult = await fetchMobileHistory(code: code) {
            return mobileResult
        }

        return await fetchWebHistory(code: code)
    }

    private func fetchMobileHistory(code: String) async -> (nav: String?, date: String?, change: String?)? {
        guard let url = URL(string: APIClient.shared.baseURL + "/fund/history?code=\(code)&pageSize=1") else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 20
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else { return nil }

            if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let datas = dict["Datas"] as? [[String: Any]],
               let first = datas.first {
                let change = first["JZZZL"] as? String
                return (first["DWJZ"] as? String, first["FSRQ"] as? String, (change == "" ? nil : change))
            }
        } catch {}
        return nil
    }

    private func fetchWebHistory(code: String) async -> (nav: String?, date: String?, change: String?)? {
        guard let url = URL(string: APIClient.shared.baseURL + "/f10/lsjz?fundCode=\(code)&pageIndex=1&pageSize=1") else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 20
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else { return nil }

            if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let dataDict = dict["Data"] as? [String: Any],
               let list = dataDict["LSJZList"] as? [[String: Any]],
               let first = list.first {
                let change = first["JZZZL"] as? String
                return (first["DWJZ"] as? String, first["FSRQ"] as? String, (change == "" ? nil : change))
            }
        } catch {}
        return nil
    }

    private func freshestDate(gzDate: String?, historyDate: String?) -> String? {
        guard let gzDate else { return historyDate }
        guard let historyDate else { return gzDate }
        return historyDate >= gzDate ? historyDate : gzDate
    }

    private func freshestValue(gzValue: String?, gzDate: String?, historyValue: String?, historyDate: String?) -> String? {
        guard let gzDate, let historyDate else { return gzValue ?? historyValue }
        return historyDate >= gzDate ? (historyValue ?? gzValue) : (gzValue ?? historyValue)
    }

    private func fetchFundName(code: String) async -> String? {
        guard let url = URL(string: "http://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=\(code)") else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 30
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let datas = dict["Datas"] as? [[String: Any]],
               let first = datas.first {
                return first["NAME"] as? String
            }
        } catch {}
        return nil
    }

    private func fetchFundGZ(code: String) async -> RealTimeFund? {
        guard let url = URL(string: APIClient.shared.baseURL + "/fund/\(code).js") else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 30
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let text = String(data: data, encoding: .utf8),
               let start = text.range(of: "jsonpgz("),
               let end = text.range(of: ");", options: .backwards) {
                let jsonStr = String(text[start.upperBound..<end.lowerBound])
                if let jsonData = jsonStr.data(using: .utf8),
                   let dict = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                    func stringValue(_ key: String) -> String? {
                        guard let value = dict[key], !(value is NSNull) else { return nil }
                        return value as? String ?? String(describing: value)
                    }

                    return RealTimeFund(
                        code: stringValue("fundcode") ?? code,
                        name: stringValue("name") ?? "",
                        nav: stringValue("dwjz"),
                        navDate: stringValue("jzrq"),
                        estChange: stringValue("gszzl"),
                        estTime: stringValue("gztime"),
                        valuation: stringValue("gsz"),
                        yesterdayChange: nil
                    )
                }
            }
        } catch {}
        return nil
    }
}
