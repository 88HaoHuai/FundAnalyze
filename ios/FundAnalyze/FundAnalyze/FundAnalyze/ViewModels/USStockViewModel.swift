import Foundation
import Combine

@MainActor
class USStockViewModel: ObservableObject {
    @Published var indices: [USStockIndex] = []
    @Published var isLoading = false
    @Published var errorMessage: String? = nil
    @Published var lastUpdateTime: String = "--"

    // 监听的指数：纳斯达克100、标普500、道指。走服务端腾讯行情代理，避免 Yahoo quote 401 后回退到旧 mock。
    private let symbols = ["usNDX", "usINX", "usDJI"]
    private let displayNames: [String: String] = [
        "usNDX": "纳斯达克100",
        "usINX": "标普500指数",
        "usDJI": "道琼斯指数"
    ]
    private let shortNames: [String: String] = [
        "usNDX": "NASDAQ 100",
        "usINX": "S&P 500",
        "usDJI": "DOW"
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

        var components = URLComponents(string: "\(APIClient.shared.baseURL)/funds/stock")
        components?.queryItems = [
            URLQueryItem(name: "q", value: symbols.joined(separator: ","))
        ]

        guard let url = components?.url else {
            self.isLoading = false
            self.errorMessage = "URL 构建失败"
            return
        }

        var request = URLRequest(url: url, timeoutInterval: 10)
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

            guard let text = String(data: data, encoding: .utf8) else {
                throw URLError(.cannotDecodeContentData)
            }

            let result = parseTencentQuotes(text)

            // 按 NASDAQ, S&P, DOW 排序
            let order = ["NASDAQ 100": 0, "S&P 500": 1, "DOW": 2]
            self.indices = result.sorted { (order[$0.symbol] ?? 99) < (order[$1.symbol] ?? 99) }
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

    private func parseTencentQuotes(_ text: String) -> [USStockIndex] {
        text
            .components(separatedBy: ";")
            .compactMap { rawLine -> USStockIndex? in
                let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !line.isEmpty else { return nil }
                guard let equalIndex = line.firstIndex(of: "=") else { return nil }

                let variableName = String(line[..<equalIndex])
                    .replacingOccurrences(of: "v_", with: "")
                let quoteBody = line[line.index(after: equalIndex)...]
                    .trimmingCharacters(in: CharacterSet(charactersIn: "\" \n\r"))
                let fields = quoteBody.split(separator: "~", omittingEmptySubsequences: false).map(String.init)

                guard fields.count > 34,
                      fields[0] == "200",
                      let price = Double(fields[3]),
                      let previousClose = Double(fields[4]),
                      let open = Double(fields[5]),
                      let change = Double(fields[31]),
                      let changePct = Double(fields[32]),
                      let high = Double(fields[33]),
                      let low = Double(fields[34]) else {
                    return nil
                }

                let rawTime = fields[30]
                let time = rawTime.count >= 16 ? String(rawTime.dropFirst(5).prefix(11)) : "--"

                return USStockIndex(
                    name: self.displayNames[variableName] ?? fields[1],
                    symbol: self.shortNames[variableName] ?? fields[2],
                    price: price,
                    change: change,
                    changePct: changePct,
                    open: open,
                    preClose: previousClose,
                    high: high,
                    low: low,
                    time: time
                )
            }
    }

    // 降级 Mock 数据（接口不可用时展示示例）
    private func loadMockData() {
        self.indices = [
            USStockIndex(name: "纳斯达克100", symbol: "NASDAQ 100",
                         price: 29125.20, change: -455.10, changePct: -1.54,
                         open: 29191.36, preClose: 29580.30, high: 29387.44, low: 28991.42, time: "05-15 17:15"),
            USStockIndex(name: "标普500指数", symbol: "S&P 500",
                         price: 7408.50, change: -92.74, changePct: -1.24,
                         open: 7445.11, preClose: 7501.24, high: 7454.85, low: 7397.50, time: "05-15 16:46"),
            USStockIndex(name: "道琼斯指数", symbol: "DOW",
                         price: 49526.17, change: -537.29, changePct: -1.07,
                         open: 49930.26, preClose: 50063.46, high: 49930.26, low: 49503.57, time: "05-15 16:46"),
        ]
    }
}
