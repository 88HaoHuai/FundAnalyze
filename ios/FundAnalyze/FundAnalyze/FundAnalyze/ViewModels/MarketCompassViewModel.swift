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
                group.addTask {
                    let rt = await FundRealtimeLoader.shared.fetchRealTimeFund(code: code)
                    return (code, rt)
                }
            }
            for await (code, rt) in group {
                if let rt = rt { self.realTimeData[code] = rt }
            }
        }
    }
}
