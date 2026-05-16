import Foundation
import SwiftUI
import Combine

// MARK: - 市场风向标 ViewModel
@MainActor
class MarketCompassViewModel: ObservableObject {
    @Published var items: [MarketFundItem] = []
    @Published var realTimeData: [String: RealTimeFund] = [:]
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    // 按分类分组，保留 sort_order 内的分类顺序
    var groupedByCategory: [(category: String, funds: [MarketFundItem])] {
        var dict: [String: [MarketFundItem]] = [:]
        var seenCategories: [String] = []
        for item in items {
            let cat = item.category ?? "其他"
            if !seenCategories.contains(cat) { seenCategories.append(cat) }
            dict[cat, default: []].append(item)
        }
        return seenCategories.map { cat in (category: cat, funds: dict[cat] ?? []) }
    }

    // MARK: - 拉取风向标列表（公开接口）
    func fetchMarketCompass() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil

        guard let url = URL(string: "\(APIClient.shared.baseURL)/groups/market-compass") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            self.items = try JSONDecoder().decode([MarketFundItem].self, from: data)
            // 加载完列表后异步拉取行情，不阻塞主界面显示
            Task { await fetchRealTimeData() }
        } catch {
            self.errorMessage = "加载失败: \(error.localizedDescription)"
        }
    }

    // 下拉刷新
    func refresh() async {
        await fetchMarketCompass()
    }

    // MARK: - 并发拉取所有基金实时行情
    private func fetchRealTimeData() async {
        let codes = items.map { $0.fund_code }
        await withTaskGroup(of: (String, RealTimeFund?).self) { group in
            for code in codes {
                group.addTask { [weak self] in
                    let rt = await self?.fetchSingleFundRT(code: code)
                    return (code, rt)
                }
            }
            for await (code, rt) in group {
                if let rt = rt { self.realTimeData[code] = rt }
            }
        }
    }

    // MARK: - 单只基金行情拉取（复用 HomeViewModel 相同逻辑）
    private func fetchSingleFundRT(code: String) async -> RealTimeFund? {
        async let lsjzTask = fetchLSJZ(code: code)
        async let searchTask = fetchFundName(code: code)
        async let gzTask    = fetchFundGZ(code: code)
        let (lsjzRes, searchRes, gzRes) = await (lsjzTask, searchTask, gzTask)

        let yesterdayChange = lsjzRes?.change
        let fallbackNav     = lsjzRes?.nav
        let fallbackDate    = lsjzRes?.date
        let fallbackName    = searchRes

        if let gz = gzRes {
            return RealTimeFund(
                code: gz.code,
                name: fallbackName ?? gz.name,
                nav: gz.nav ?? fallbackNav,
                navDate: gz.navDate ?? fallbackDate,
                estChange: gz.estChange,
                estTime: gz.estTime,
                valuation: gz.valuation,
                yesterdayChange: yesterdayChange
            )
        }
        if fallbackNav != nil {
            return RealTimeFund(
                code: code, name: fallbackName ?? "基金 \(code)",
                nav: fallbackNav, navDate: fallbackDate,
                estChange: "0.00", estTime: fallbackDate,
                valuation: fallbackNav, yesterdayChange: yesterdayChange
            )
        }
        return nil
    }

    private func fetchLSJZ(code: String) async -> (nav: String?, date: String?, change: String?)? {
        guard let url = URL(string: APIClient.shared.baseURL + "/f10/lsjz?fundCode=\(code)&pageIndex=1&pageSize=1") else { return nil }
        var req = URLRequest(url: url); req.timeoutInterval = 30
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let dataDict = dict["Data"] as? [String: Any],
               let list = dataDict["LSJZList"] as? [[String: Any]],
               let first = list.first {
                let ch = first["JZZZL"] as? String
                return (first["DWJZ"] as? String, first["FSRQ"] as? String, (ch == "" ? nil : ch))
            }
        } catch {}
        return nil
    }

    private func fetchFundName(code: String) async -> String? {
        guard let url = URL(string: "http://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=\(code)") else { return nil }
        var req = URLRequest(url: url); req.timeoutInterval = 30
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
        var req = URLRequest(url: url); req.timeoutInterval = 30
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let text = String(data: data, encoding: .utf8),
               let start = text.range(of: "jsonpgz("),
               let end   = text.range(of: ");", options: .backwards) {
                let jsonStr = String(text[start.upperBound..<end.lowerBound])
                if let jsonData = jsonStr.data(using: .utf8),
                   let dict = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                    func sv(_ k: String) -> String? {
                        guard let v = dict[k], !(v is NSNull) else { return nil }
                        return v as? String ?? String(describing: v)
                    }
                    return RealTimeFund(
                        code: sv("fundcode") ?? code, name: sv("name") ?? "",
                        nav: sv("dwjz"), navDate: sv("jzrq"),
                        estChange: sv("gszzl"), estTime: sv("gztime"),
                        valuation: sv("gsz"), yesterdayChange: nil
                    )
                }
            }
        } catch {}
        return nil
    }
}
