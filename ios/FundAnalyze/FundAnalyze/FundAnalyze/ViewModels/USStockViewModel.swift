import Foundation
import Combine

// MARK: - Yahoo Finance 接口响应模型
private struct YFQuoteResponse: Codable {
    let quoteResponse: YFQuoteBody
}
private struct YFQuoteBody: Codable {
    let result: [YFQuote]?
    let error: String?
}
private struct YFQuote: Codable {
    let symbol: String
    let shortName: String?
    let regularMarketPrice: Double?
    let regularMarketChange: Double?
    let regularMarketChangePercent: Double?
    let regularMarketOpen: Double?
    let regularMarketPreviousClose: Double?
    let regularMarketDayHigh: Double?
    let regularMarketDayLow: Double?
    let regularMarketTime: Int?     // Unix timestamp
}

@MainActor
class USStockViewModel: ObservableObject {
    @Published var indices: [USStockIndex] = []
    @Published var isLoading = false
    @Published var errorMessage: String? = nil
    @Published var lastUpdateTime: String = "--"

    // 监听的指数：纳指、标普、道指
    private let symbols = ["^IXIC", "^GSPC", "^DJI"]
    private let displayNames: [String: String] = [
        "^IXIC": "纳斯达克指数",
        "^GSPC": "标普500指数",
        "^DJI":  "道琼斯指数"
    ]
    private let shortNames: [String: String] = [
        "^IXIC": "NASDAQ",
        "^GSPC": "S&P 500",
        "^DJI":  "DOW"
    ]

    private var refreshTask: Task<Void, Never>?

    func startAutoRefresh() {
        Task { await fetchIndices() }
        // 每 60 秒刷新（避免频繁请求被限流）
        refreshTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000)
                if !Task.isCancelled {
                    await fetchIndices()
                }
            }
        }
    }

    func stopAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = nil
    }

    func fetchIndices() async {
        self.isLoading = true
        self.errorMessage = nil

        let encodedSymbols = symbols
            .map { $0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0 }
            .joined(separator: ",")

        let urlStr = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=\(encodedSymbols)&fields=shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketOpen,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,regularMarketTime"

        guard let url = URL(string: urlStr) else {
            self.isLoading = false
            self.errorMessage = "URL 构建失败"
            return
        }

        var request = URLRequest(url: url, timeoutInterval: 10)
        // Yahoo Finance 需要 User-Agent，否则 429
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", forHTTPHeaderField: "User-Agent")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            if let http = response as? HTTPURLResponse, http.statusCode != 200 {
                self.isLoading = false
                self.errorMessage = "请求失败 HTTP \(http.statusCode)"
                // 如果没有数据则用 mock
                if self.indices.isEmpty { self.loadMockData() }
                return
            }

            let decoded = try JSONDecoder().decode(YFQuoteResponse.self, from: data)
            let quotes = decoded.quoteResponse.result ?? []

            let result: [USStockIndex] = quotes.compactMap { q in
                guard
                    let price = q.regularMarketPrice,
                    let change = q.regularMarketChange,
                    let changePct = q.regularMarketChangePercent
                else { return nil }

                var timeStr = "--"
                if let ts = q.regularMarketTime {
                    let date = Date(timeIntervalSince1970: TimeInterval(ts))
                    // 转换为北京时间
                    let fmt = DateFormatter()
                    fmt.timeZone = TimeZone(identifier: "Asia/Shanghai")
                    fmt.dateFormat = "MM-dd HH:mm"
                    timeStr = fmt.string(from: date)
                }

                return USStockIndex(
                    name: self.displayNames[q.symbol] ?? q.shortName ?? q.symbol,
                    symbol: self.shortNames[q.symbol] ?? q.symbol,
                    price: price,
                    change: change,
                    changePct: changePct,
                    open: q.regularMarketOpen ?? 0,
                    preClose: q.regularMarketPreviousClose ?? 0,
                    high: q.regularMarketDayHigh ?? 0,
                    low: q.regularMarketDayLow ?? 0,
                    time: timeStr
                )
            }

            // 按 NASDAQ, S&P, DOW 排序
            self.indices = result.sorted { a, _ in a.symbol == "NASDAQ" }
            let fmt = DateFormatter()
            fmt.timeZone = TimeZone(identifier: "Asia/Shanghai")
            fmt.dateFormat = "HH:mm:ss"
            self.lastUpdateTime = fmt.string(from: Date())
            self.isLoading = false

        } catch {
            print("[USStock] 请求失败: \(error)")
            self.isLoading = false
            self.errorMessage = "数据获取失败，已显示模拟数据"
            if self.indices.isEmpty { self.loadMockData() }
        }
    }

    // 降级 Mock 数据（接口不可用时展示示例）
    private func loadMockData() {
        self.indices = [
            USStockIndex(name: "纳斯达克指数", symbol: "NASDAQ",
                         price: 18654.32, change: 145.67, changePct: 0.79,
                         open: 18508.65, preClose: 18508.65, high: 18720.11, low: 18490.23, time: "--"),
            USStockIndex(name: "标普500指数", symbol: "S&P 500",
                         price: 5308.15, change: 28.40, changePct: 0.54,
                         open: 5279.75, preClose: 5279.75, high: 5315.80, low: 5270.10, time: "--"),
            USStockIndex(name: "道琼斯指数", symbol: "DOW",
                         price: 39512.84, change: -55.21, changePct: -0.14,
                         open: 39568.05, preClose: 39568.05, high: 39660.22, low: 39450.44, time: "--"),
        ]
    }
}
