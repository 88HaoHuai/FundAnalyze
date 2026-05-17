import Foundation

struct FundRealtimeLoader {
    static let shared = FundRealtimeLoader()

    func fetchRealTimeFund(code: String) async -> RealTimeFund? {
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

    func fetchMarketSnapshots(limit: Int = 4) async -> [NewsMarketSnapshot] {
        do {
            let items = try await APIClient.shared.fetchMarketCompassItems()
            let focusItems = Array(items.prefix(limit))
            return await withTaskGroup(of: NewsMarketSnapshot?.self) { group in
                for item in focusItems {
                    group.addTask {
                        guard let rt = await fetchRealTimeFund(code: item.fund_code) else { return nil }
                        let estimatedChange = Double(rt.estChange ?? "0") ?? 0
                        let changeValue = estimatedChange != 0 ? estimatedChange : (Double(rt.yesterdayChange ?? "0") ?? 0)
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

    func fetchTrendPoints(code: String, pageSize: Int = 20) async -> [FundTrendPoint] {
        if let pingzhongPoints = await fetchPingzhongTrendPoints(code: code), !pingzhongPoints.isEmpty {
            return Array(pingzhongPoints.suffix(pageSize))
        }

        let mobilePageSize = min(pageSize, 20)
        if let mobilePoints = await fetchMobileTrendPoints(code: code, pageSize: mobilePageSize), !mobilePoints.isEmpty {
            return mobilePoints
        }
        return await fetchWebTrendPoints(code: code, targetCount: pageSize) ?? []
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

    private func fetchMobileTrendPoints(code: String, pageSize: Int) async -> [FundTrendPoint]? {
        guard let url = URL(string: APIClient.shared.baseURL + "/fund/history?code=\(code)&pageSize=\(pageSize)") else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 20
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else { return nil }

            if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let datas = dict["Datas"] as? [[String: Any]] {
                return datas.compactMap { item in
                    guard let date = item["FSRQ"] as? String,
                          let navString = item["DWJZ"] as? String,
                          let nav = Double(navString) else { return nil }
                    let changePercent = Double((item["JZZZL"] as? String) ?? "")
                    return FundTrendPoint(
                        id: "\(code)-\(date)",
                        date: date,
                        nav: nav,
                        changePercent: changePercent
                    )
                }
                .sorted { $0.date < $1.date }
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

    private func fetchWebTrendPoints(code: String, targetCount: Int) async -> [FundTrendPoint]? {
        let pageSize = 20
        let maxPages = max(1, Int(ceil(Double(max(targetCount, pageSize)) / Double(pageSize))))
        var allPoints: [FundTrendPoint] = []

        for pageIndex in 1...maxPages {
            guard let url = URL(string: APIClient.shared.baseURL + "/f10/lsjz?fundCode=\(code)&pageSize=\(pageSize)&pageIndex=\(pageIndex)") else {
                break
            }
            var req = URLRequest(url: url)
            req.timeoutInterval = 20

            do {
                let (data, response) = try await URLSession.shared.data(for: req)
                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode) else { break }

                guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let dataDict = dict["Data"] as? [String: Any],
                      let list = dataDict["LSJZList"] as? [[String: Any]],
                      !list.isEmpty else { break }

                let points: [FundTrendPoint] = list.compactMap { item in
                    guard let date = item["FSRQ"] as? String,
                          let navString = item["DWJZ"] as? String,
                          let nav = Double(navString) else { return nil }
                    let changePercent = Double((item["JZZZL"] as? String) ?? "")
                    return FundTrendPoint(
                        id: "\(code)-\(date)",
                        date: date,
                        nav: nav,
                        changePercent: changePercent
                    )
                }
                allPoints.append(contentsOf: points)

                if list.count < pageSize || allPoints.count >= targetCount {
                    break
                }
            } catch {
                break
            }
        }

        guard !allPoints.isEmpty else { return nil }
        let deduplicated = Dictionary(grouping: allPoints, by: \.id).compactMap { $0.value.first }
        return deduplicated.sorted { $0.date < $1.date }
    }

    private func fetchPingzhongTrendPoints(code: String) async -> [FundTrendPoint]? {
        guard let url = URL(string: APIClient.shared.baseURL + "/pingzhong/\(code).js?rt=\(Int(Date().timeIntervalSince1970 * 1000))") else {
            return nil
        }
        var req = URLRequest(url: url)
        req.timeoutInterval = 30

        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode),
                  let text = String(data: data, encoding: .utf8) else { return nil }

            guard let acTrendJSONString = extractJavaScriptArray(named: "Data_ACWorthTrend", from: text),
                  let jsonData = acTrendJSONString.data(using: .utf8),
                  let rawPoints = try JSONSerialization.jsonObject(with: jsonData) as? [[Any]] else {
                return nil
            }

            let formatter = Self.dayFormatter
            return rawPoints.compactMap { rawPoint in
                guard rawPoint.count >= 2,
                      let timestamp = rawPoint[0] as? Double,
                      let value = rawPoint[1] as? Double else { return nil }
                let date = Date(timeIntervalSince1970: timestamp / 1000)
                let dateString = formatter.string(from: date)
                return FundTrendPoint(
                    id: "\(code)-\(dateString)",
                    date: dateString,
                    nav: value,
                    changePercent: nil
                )
            }
        } catch {
            return nil
        }
    }

    private func extractJavaScriptArray(named variableName: String, from text: String) -> String? {
        let pattern = "var\\s+\(NSRegularExpression.escapedPattern(for: variableName))\\s*=\\s*(\\[.*?\\]);"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) else {
            return nil
        }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range),
              match.numberOfRanges > 1,
              let valueRange = Range(match.range(at: 1), in: text) else {
            return nil
        }
        return String(text[valueRange])
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

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
