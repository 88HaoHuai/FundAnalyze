import Foundation
import SwiftUI
import Combine

@MainActor
class FundAnalysisViewModel: ObservableObject {
    @Published var realTimeData: RealTimeFund?
    @Published var trendPoints: [FundTrendPoint] = []
    @Published var relatedNews: [NewsItem] = []
    @Published var policyNews: [NewsItem] = []
    @Published var aiAnalysis: FundAIAnalysis?
    @Published var isLoading = false
    @Published var isGeneratingAI = false
    @Published var errorMessage: String?
    @Published var aiErrorMessage: String?
    @Published var resolvedKeywords: [String] = []

    let context: FundAnalysisContext
    let themeKeyword: String
    let searchKeywords: [String]

    private let policyKeywords = ["政策", "监管", "国务院", "发改委", "工信部", "财政", "央行", "证监会", "支持", "指导意见", "办法", "规划"]
    private let newsRecencyDays = 15
    private var lastRefreshAt: Date?

    init(context: FundAnalysisContext) {
        self.context = context
        self.realTimeData = context.realTimeData
        let dbKeywords = (context.position?.keywords ?? []).filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        let derivedKeywords = Self.buildSearchKeywords(from: context.fundName)
        let mergedKeywords = dbKeywords.isEmpty ? derivedKeywords : Self.mergeKeywords(primary: dbKeywords, fallback: derivedKeywords)
        self.searchKeywords = mergedKeywords
        self.resolvedKeywords = mergedKeywords
        self.themeKeyword = mergedKeywords.first ?? Self.normalizedFundKeyword(from: context.fundName)
    }

    func loadIfNeeded() async {
        let needsRefresh = realTimeData == nil || trendPoints.isEmpty || relatedNews.isEmpty
        let isStale = lastRefreshAt.map { Date().timeIntervalSince($0) > 180 } ?? true
        guard needsRefresh || isStale else { return }
        await refreshAll()
    }

    func refreshAll() async {
        isLoading = true
        errorMessage = nil
        aiErrorMessage = nil
        aiAnalysis = nil

        await resolveKeywordsIfNeeded()

        async let realtimeTask = FundRealtimeLoader.shared.fetchRealTimeFund(code: context.fundCode)
        async let trendTask = FundRealtimeLoader.shared.fetchTrendPoints(code: context.fundCode, pageSize: 900)
        async let newsTask = loadNews()

        let realtime = await realtimeTask
        let trend = await trendTask
        let news = await newsTask

        realTimeData = realtime ?? context.realTimeData
        trendPoints = trend
        let extractedPolicyNews = buildPolicyNews(from: news)
        let policyIDs = Set(extractedPolicyNews.map(\.id))
        policyNews = extractedPolicyNews
        relatedNews = Array(news.filter { !policyIDs.contains($0.id) }.prefix(5))

        if relatedNews.isEmpty {
            errorMessage = policyNews.isEmpty ? "当前基金暂时没有可展示的分析数据。" : nil
        }

        lastRefreshAt = Date()
        isLoading = false
    }

    func generateAIAnalysis() async {
        guard !isGeneratingAI else { return }
        let apiKey = DeepSeekConfigStore.shared.loadAPIKey()
        guard !apiKey.isEmpty else {
            aiErrorMessage = "请先在“分组配置 -> AI 解读配置”里填写 DeepSeek API Key。"
            return
        }

        isGeneratingAI = true
        aiErrorMessage = nil
        defer { isGeneratingAI = false }

        do {
            let analysis = try await APIClient.shared.fetchDeepSeekFundAnalysis(
                apiKey: apiKey,
                model: DeepSeekConfigStore.shared.configuredModel,
                context: context,
                realTimeData: realTimeData,
                themeKeyword: themeKeyword,
                marketSummary: "本页已移除市场行情模块，请聚焦基金主题、政策与资讯。",
                relatedNews: Array(relatedNews.prefix(3)),
                policyNews: Array(policyNews.prefix(3))
            )
            aiAnalysis = analysis
        } catch {
            aiErrorMessage = "AI 分析失败：\(error.localizedDescription)"
        }
    }

    var displayedFundName: String {
        context.position?.fund_name ?? realTimeData?.name ?? context.fundName
    }

    private func loadNews() async -> [NewsItem] {
        let keywords = resolvedKeywords.isEmpty ? searchKeywords : resolvedKeywords
        let effectiveKeywords = keywords.isEmpty ? [displayedFundName] : keywords
        var allItems: [NewsItem] = []

        for keyword in effectiveKeywords {
            async let emTask = APIClient.shared.fetchNews(source: .em, keyword: keyword)
            async let clsTask = APIClient.shared.fetchNews(source: .cls, keyword: keyword)
            let emNews = (try? await emTask) ?? []
            let clsNews = (try? await clsTask) ?? []
            allItems.append(contentsOf: emNews)
            allItems.append(contentsOf: clsNews)
        }

        let recentItems = mergeAndDeduplicate(allItems).filter { isRecentNewsTime($0.time) }
        let ranked = rankNews(recentItems, keywords: effectiveKeywords)
        let strictMatches = ranked.filter { !$0.matchedKeywords.isEmpty }
        if !strictMatches.isEmpty {
            return strictMatches
        }

        return ranked.filter { item in
            let text = item.title + "\n" + item.content
            return effectiveKeywords.contains(where: { keyword in
                keyword.count >= 2 && text.localizedCaseInsensitiveContains(keyword)
            })
        }
    }

    private func resolveKeywordsIfNeeded() async {
        if !resolvedKeywords.isEmpty {
            return
        }

        do {
            let metadata = try await APIClient.shared.fetchFundMetadata(code: context.fundCode)
            let merged = Self.mergeKeywords(primary: metadata.keywords, fallback: searchKeywords)
            if !merged.isEmpty {
                resolvedKeywords = merged
            }
        } catch {
            resolvedKeywords = searchKeywords
        }
    }

    private func mergeAndDeduplicate(_ items: [NewsItem]) -> [NewsItem] {
        var map: [String: NewsItem] = [:]
        for item in items {
            let key = item.title
                .replacingOccurrences(of: " ", with: "")
                .replacingOccurrences(of: "\n", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
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

    private func rankNews(_ items: [NewsItem], keywords: [String]) -> [NewsItem] {
        items.map { item in
            var mutable = item
            let matched = matchedKeywords(for: item, keywords: keywords)
            mutable.matchedKeywords = matched
            mutable.impactLevel = matched.count >= 2 ? .high : (matched.isEmpty ? .low : .medium)
            mutable.relevanceScore = score(for: item, keywords: keywords, matches: matched)
            return mutable
        }
        .sorted { lhs, rhs in
            if lhs.relevanceScore != rhs.relevanceScore {
                return lhs.relevanceScore > rhs.relevanceScore
            }
            return lhs.time > rhs.time
        }
    }

    private func buildPolicyNews(from items: [NewsItem]) -> [NewsItem] {
        let matched = items.filter { item in
            let text = item.title + "\n" + item.content
            return policyKeywords.contains(where: { text.localizedCaseInsensitiveContains($0) })
        }
        return Array(mergeAndDeduplicate(matched).prefix(4))
    }

    private func matchedKeywords(for item: NewsItem, keywords: [String]) -> [String] {
        let text = item.title + "\n" + item.content
        return keywords.filter { keyword in
            keyword.count >= 2 && text.localizedCaseInsensitiveContains(keyword)
        }
    }

    private func score(for item: NewsItem, keywords: [String], matches: [String]) -> Int {
        var score = 10
        let text = item.title + "\n" + item.content
        score += min(matches.count * 30, 60)
        if policyKeywords.contains(where: { text.localizedCaseInsensitiveContains($0) }) {
            score += 20
        }
        if item.source == .cls {
            score += 12
        }
        if item.time.contains(":") {
            score += 6
        }
        if keywords.contains(where: { keyword in
            keyword.count >= 2 && item.title.localizedCaseInsensitiveContains(keyword)
        }) {
            score += 16
        }
        return score
    }

    private func isRecentNewsTime(_ raw: String) -> Bool {
        guard let date = parseNewsDate(raw) else { return true }
        let threshold = Calendar.current.date(byAdding: .day, value: -newsRecencyDays, to: Date()) ?? Date.distantPast
        return date >= threshold
    }

    private func parseNewsDate(_ raw: String) -> Date? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let formatters = Self.newsDateFormatters
        for formatter in formatters {
            if let date = formatter.date(from: trimmed) {
                return date
            }
        }
        return nil
    }

    private static let newsDateFormatters: [DateFormatter] = {
        let formats = [
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd HH:mm",
            "yyyy/MM/dd HH:mm:ss",
            "yyyy/MM/dd HH:mm",
            "MM-dd HH:mm"
        ]

        return formats.map { format in
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "zh_CN")
            formatter.timeZone = .current
            formatter.dateFormat = format
            return formatter
        }
    }()

    static func normalizedFundKeyword(from raw: String) -> String {
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

        for prefix in managerPrefixes where text.hasPrefix(prefix) {
            text.removeFirst(prefix.count)
            break
        }

        let replacements = ["人民币": "", "份额": "", "（": "", "）": "", "(": "", ")": "", "【": "", "】": "", "A": "", "C": "", "I": "", "Y": ""]
        for (target, replacement) in replacements {
            text = text.replacingOccurrences(of: target, with: replacement)
        }

        let chineseOnlyScalars = text.unicodeScalars.filter { scalar in
            (0x4E00...0x9FFF).contains(scalar.value)
        }
        text = String(String.UnicodeScalarView(chineseOnlyScalars))

        let indexPrefixes = ["中证", "国证", "沪深", "上证", "深证", "创业板", "科创"]
        for prefix in indexPrefixes where text.hasPrefix(prefix) && text.count > prefix.count + 1 {
            let candidate = String(text.dropFirst(prefix.count))
            if !candidate.contains(where: { $0.isNumber }) {
                text = candidate
            }
            break
        }

        let genericTokens = [
            "证券投资基金", "发起式", "发起", "联接基金", "联接", "基金", "指数型", "指数",
            "主题型", "主题", "增强", "分级", "型", "人民币", "份额", "煤炭等权"
        ]
        for token in genericTokens {
            text = text.replacingOccurrences(of: token, with: "")
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

    static func buildSearchKeywords(from raw: String) -> [String] {
        let primary = normalizedFundKeyword(from: raw)
        guard !primary.isEmpty else { return [] }

        var keywords: [String] = [primary]
        let broadSuffixes = ["主题", "行业", "龙头", "价值", "成长", "精选", "优选", "红利", "低波"]
        for suffix in broadSuffixes where primary.hasSuffix(suffix) && primary.count > suffix.count + 1 {
            let candidate = String(primary.dropLast(suffix.count))
            if candidate.count >= 2 && !keywords.contains(candidate) {
                keywords.append(candidate)
            }
        }

        if primary.contains("煤炭"), !keywords.contains("煤炭") {
            keywords.append("煤炭")
        }
        if primary.contains("传媒"), !keywords.contains("传媒") {
            keywords.append("传媒")
        }
        if primary.contains("影视"), !keywords.contains("影视") {
            keywords.append("影视")
        }

        return keywords
    }

    static func mergeKeywords(primary: [String], fallback: [String]) -> [String] {
        var merged: [String] = []
        for keyword in primary + fallback {
            let cleaned = keyword.trimmingCharacters(in: .whitespacesAndNewlines)
            guard cleaned.count >= 2 else { continue }
            if !merged.contains(cleaned) {
                merged.append(cleaned)
            }
        }
        return merged
    }
}
