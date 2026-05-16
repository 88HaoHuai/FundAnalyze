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
                    if let rt = await self.fetchSingleFundRT(code: code) {
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
    
    private func fetchSingleFundRT(code: String) async -> RealTimeFund? {
        var yesterdayChange: String? = nil
        var fallbackName: String? = nil
        var fallbackNav: String? = nil
        var fallbackDate: String? = nil
        
        // 并发三个查询：历史净值(拿昨日涨跌)、基金名称(QDII使用)、盘中估值
        async let lsjzTask = fetchLSJZ(code: code)
        async let searchTask = fetchFundName(code: code)
        async let gzTask = fetchFundGZ(code: code)
        
        // 拿历史净值和名称，它们即使失败也不抛错，返回 nil
        let (lsjzRes, searchRes, gzRes) = await (lsjzTask, searchTask, gzTask)
        
        if let lsjz = lsjzRes {
            yesterdayChange = lsjz.change
            fallbackNav = lsjz.nav
            fallbackDate = lsjz.date
        }
        fallbackName = searchRes
        
        if let gz = gzRes {
            // 如果估值接口有结果，我们就优先用它，并且把昨日涨跌幅带入
            return RealTimeFund(
                code: gz.code,
                name: fallbackName ?? gz.name, // 如果能搜索到名字，优先用搜索结果的名字
                nav: gz.nav ?? fallbackNav,
                navDate: gz.navDate ?? fallbackDate,
                estChange: gz.estChange,
                estTime: gz.estTime,
                valuation: gz.valuation,
                yesterdayChange: yesterdayChange
            )
        }
        
        // 如果估值接口失败（如 QDII，不提供盘中），但我们有历史净值兜底
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
    
    // 拉取历史净值 (使用更及时的移动端接口代理)
    private func fetchLSJZ(code: String) async -> (nav: String?, date: String?, change: String?)? {
        guard let historyUrl = URL(string: APIClient.shared.baseURL + "/fund/history?code=\(code)&pageSize=1") else { return nil }
        var req = URLRequest(url: historyUrl)
        req.timeoutInterval = 20
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let datas = dict["Datas"] as? [[String: Any]],
               let firstItem = datas.first {
                
                let nav = firstItem["DWJZ"] as? String
                let date = firstItem["FSRQ"] as? String
                let changeStr = firstItem["JZZZL"] as? String
                
                return (nav, date, (changeStr == "" ? nil : changeStr))
            }
        } catch {
            print("Fetch History Error for \(code): \(error)")
        }
        return nil
    }
    
    // 拉取基金搜索接口（直接访问东方财富，无 CORS 限制，仅限 iOS 端）
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
    
    // 拉取盘中极速估值
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
                        guard let val = dict[key], !(val is NSNull) else { return nil }
                        return val as? String ?? String(describing: val)
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
