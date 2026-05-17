import Foundation
import Combine

@MainActor
class HomeViewModel: ObservableObject {
    @Published var groups: [FundGroup] = []
    @Published var realTimeData: [String: RealTimeFund] = [:]
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // 计算属性：当日总收益预估
    var totalEstProfit: Double {
        let uniqueCodes = Set(groups.flatMap { $0.codes })
        var total = 0.0
        for code in uniqueCodes {
            if let pos = groups.compactMap({ $0.positions[code] }).first,
               let rt = realTimeData[code] {
                total += pos.amount * (rt.estChangeDouble / 100.0)
            }
        }
        return total
    }
    
    // 计算属性：总持仓市值
    var totalAmount: Double {
        let uniqueCodes = Set(groups.flatMap { $0.codes })
        var total = 0.0
        for code in uniqueCodes {
            if let pos = groups.compactMap({ $0.positions[code] }).first {
                total += pos.amount
            }
        }
        return total
    }
    
    func fetchGroups() async {
        self.isLoading = true
        self.errorMessage = nil
        do {
            let fetchedGroups: [FundGroup] = try await APIClient.shared.request(endpoint: "/groups/")
            self.groups = fetchedGroups
            // 拿到分组后立刻关闭 Loading，展示列表骨架，防止阻塞
            self.isLoading = false
            
            var codesToFetch = Set<String>()
            for g in fetchedGroups {
                for c in g.codes { codesToFetch.insert(c) }
            }
            
            // 开辟后台任务拉取实时数据，个别基金延迟不会卡住整个界面
            Task {
                await fetchRealTimeData(codes: Array(codesToFetch))
            }
            
        } catch {
            self.errorMessage = "加载失败: \(error.localizedDescription)"
            self.isLoading = false
        }
    }
    
    func fetchRealTimeData(codes: [String]) async {
        await withTaskGroup(of: Void.self) { group in
            for code in codes {
                group.addTask {
                    if let rt = await FundRealtimeLoader.shared.fetchRealTimeFund(code: code) {
                        await MainActor.run {
                            self.realTimeData[code] = rt
                        }
                    }
                }
            }
        }
    }
    
    func refreshData() async {
        do {
            let fetchedGroups: [FundGroup] = try await APIClient.shared.request(endpoint: "/groups/")
            self.groups = fetchedGroups
            
            var codesToFetch = Set<String>()
            for g in fetchedGroups {
                for c in g.codes { codesToFetch.insert(c) }
            }
            
            // 下拉刷新时等待所有实时数据加载完毕，这样刷新控件才会一直转圈
            await fetchRealTimeData(codes: Array(codesToFetch))
            
        } catch {
            self.errorMessage = "加载失败: \(error.localizedDescription)"
        }
    }
    
}
