import Foundation

// MARK: - API 基础配置与客户端
class APIClient {
    static let shared = APIClient()
    
    // 请替换为您服务器的实际 IP 或域名
    let baseURL = "http://120.26.86.92:8000/api"
    
    private init() {}
    
    enum APIError: Error {
        case invalidURL
        case requestFailed(String)
        case decodingFailed
        case unauthorized
    }
    
    // MARK: - Token 管理
    var token: String? {
        get { UserDefaults.standard.string(forKey: "fund_token") }
        set {
            if let newValue = newValue {
                UserDefaults.standard.set(newValue, forKey: "fund_token")
            } else {
                UserDefaults.standard.removeObject(forKey: "fund_token")
            }
        }
    }
    
    // MARK: - 核心请求方法 (Async/Await)
    func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 注入 JWT Token
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = body
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed("Invalid response type")
        }
        
        if httpResponse.statusCode == 401 {
            self.token = nil // Token 失效，清除
            NotificationCenter.default.post(name: NSNotification.Name("AuthExpired"), object: nil)
            throw APIError.unauthorized
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            // 尝试解析错误详情
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let detail = errorJson["detail"] as? String {
                throw APIError.requestFailed(detail)
            }
            throw APIError.requestFailed("Server error: \(httpResponse.statusCode)")
        }
        
        do {
            let decoder = JSONDecoder()
            // 处理后端可能的日期格式
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            print("Decoding Error: \(error)")
            throw APIError.decodingFailed
        }
    }
}

extension APIClient.APIError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "请求地址无效"
        case .requestFailed(let message):
            return message
        case .decodingFailed:
            return "数据解析失败"
        case .unauthorized:
            return "登录已失效，请重新登录"
        }
    }
}

// MARK: - News & Market
extension APIClient {
    func fetchNews(source: NewsSource, keyword: String) async throws -> [NewsItem] {
        let endpoint = source == .cls ? "/news_cls" : "/news"
        guard var components = URLComponents(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        components.queryItems = [URLQueryItem(name: "keyword", value: keyword)]
        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 15
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed("Invalid response type")
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed("Server error: \(httpResponse.statusCode)")
        }

        let envelope = try JSONDecoder().decode(NewsEnvelope.self, from: data)
        guard envelope.success else {
            throw APIError.requestFailed(envelope.error ?? "News request failed")
        }

        return (envelope.data ?? []).compactMap { record in
            let title = record.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let content = record.content?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !title.isEmpty || !content.isEmpty else { return nil }

            let safeTitle = title.isEmpty ? "市场快讯" : title
            let safeTime = (record.time?.isEmpty == false ? record.time : "刚刚") ?? "刚刚"
            let id = "\(source.rawValue)-\(safeTitle)-\(safeTime)"

            return NewsItem(
                id: id,
                time: safeTime,
                title: safeTitle,
                content: content.isEmpty ? safeTitle : content,
                url: record.url,
                source: source
            )
        }
    }

    func fetchDeepSeekNewsAI(apiKey: String, model: String, title: String, content: String, fundSectors: String) async throws -> NewsAIData {
        guard let url = URL(string: "https://api.deepseek.com/chat/completions") else {
            throw APIError.invalidURL
        }

        let systemPrompt = """
        你是专业基金资讯分析助手。请基于用户提供的新闻内容，严格输出 json 对象，格式如下：
        {
          "sentiment": "利好",
          "score": 80,
          "summary": "一句话总结对基金投资的意义",
          "impact": ["主题1", "主题2"]
        }

        规则：
        1. sentiment 只能是“利好”“利空”“中性”。
        2. score 是 0 到 100 的整数。
        3. summary 控制在 35 字以内，必须直指投资含义。
        4. impact 只从以下主题中选择，若没有明确映射则返回空数组：\(fundSectors)。
        5. 必须返回合法 json，不要附加任何解释。
        """

        let req = DeepSeekChatCompletionRequest(
            model: model,
            messages: [
                DeepSeekChatMessage(role: "system", content: systemPrompt),
                DeepSeekChatMessage(role: "user", content: "请分析这条资讯并输出 json。\n标题：\(title)\n内容：\(content)")
            ],
            thinking: DeepSeekThinkingConfig(type: "enabled"),
            reasoning_effort: "medium",
            response_format: DeepSeekResponseFormat(type: "json_object"),
            max_tokens: 512,
            stream: false
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(req)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed("Invalid response type")
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            if let message = String(data: data, encoding: .utf8), !message.isEmpty {
                throw APIError.requestFailed("DeepSeek error: \(message)")
            }
            throw APIError.requestFailed("DeepSeek error: \(httpResponse.statusCode)")
        }

        let completion = try JSONDecoder().decode(DeepSeekChatCompletionResponse.self, from: data)
        guard let rawContent = completion.choices.first?.message.content,
              !rawContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw APIError.requestFailed("AI response empty")
        }

        let normalizedContent = normalizedDeepSeekJSONContent(from: rawContent)
        guard let contentData = normalizedContent.data(using: .utf8) else {
            throw APIError.requestFailed("AI 返回内容为空")
        }

        do {
            return try JSONDecoder().decode(NewsAIData.self, from: contentData)
        } catch {
            let preview = String(normalizedContent.prefix(160))
            throw APIError.requestFailed("AI 返回格式无法解析：\(preview)")
        }
    }

    func fetchDeepSeekFundAnalysis(
        apiKey: String,
        model: String,
        context: FundAnalysisContext,
        realTimeData: RealTimeFund?,
        themeKeyword: String,
        marketSummary: String,
        relatedNews: [NewsItem],
        policyNews: [NewsItem]
    ) async throws -> FundAIAnalysis {
        guard let url = URL(string: "https://api.deepseek.com/chat/completions") else {
            throw APIError.invalidURL
        }

        let position = context.position
        let newsText = relatedNews.isEmpty
            ? "暂无明显相关资讯"
            : relatedNews.map { "- [\($0.source.displayName)] \($0.title)：\($0.excerpt)" }.joined(separator: "\n")
        let policyText = policyNews.isEmpty
            ? "暂无明显政策资讯"
            : policyNews.map { "- \($0.title)：\($0.excerpt)" }.joined(separator: "\n")

        let systemPrompt = """
        你是一位专业基金研究助手。请结合基金本身、市场环境、相关新闻和政策信号，输出严格合法的 json 对象，格式如下：
        {
          "summary": "一句话总体判断",
          "marketView": "市场环境怎么看",
          "policyView": "政策面对该基金主题的影响",
          "fundView": "对当前基金的核心影响点",
          "sentiment": "偏正面",
          "score": 78
        }

        规则：
        1. sentiment 只能是“偏正面”“偏中性”“偏谨慎”。
        2. score 是 0 到 100 的整数。
        3. summary 控制在 35 字以内。
        4. marketView、policyView、fundView 都控制在 60 字以内。
        5. 必须返回合法 json，不要附加解释。
        """

        let userPrompt = """
        基金名称：\(context.fundName)
        基金代码：\(context.fundCode)
        基金主题词：\(themeKeyword.isEmpty ? context.fundName : themeKeyword)
        持仓金额：\(String(format: "%.2f", position?.amount ?? 0))
        是否定投：\((position?.isAutoInvest ?? false) ? "是" : "否")
        当日预估涨跌：\(String(format: "%.2f", realTimeData?.estChangeDouble ?? 0))%
        昨日涨跌：\(realTimeData?.yesterdayChange ?? "0")%
        市场概览：\(marketSummary)

        相关资讯：
        \(newsText)

        政策资讯：
        \(policyText)
        """

        let req = DeepSeekFundAnalysisRequest(
            model: model,
            messages: [
                DeepSeekChatMessage(role: "system", content: systemPrompt),
                DeepSeekChatMessage(role: "user", content: userPrompt)
            ],
            response_format: DeepSeekResponseFormat(type: "json_object"),
            max_tokens: 700,
            stream: false
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(req)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed("Invalid response type")
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            if let message = String(data: data, encoding: .utf8), !message.isEmpty {
                throw APIError.requestFailed("DeepSeek error: \(message)")
            }
            throw APIError.requestFailed("DeepSeek error: \(httpResponse.statusCode)")
        }

        let completion = try JSONDecoder().decode(DeepSeekChatCompletionResponse.self, from: data)
        guard let rawContent = completion.choices.first?.message.content,
              !rawContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw APIError.requestFailed("AI response empty")
        }

        let normalizedContent = normalizedDeepSeekJSONContent(from: rawContent)
        guard let contentData = normalizedContent.data(using: .utf8) else {
            throw APIError.requestFailed("AI 返回内容为空")
        }

        do {
            return try JSONDecoder().decode(FundAIAnalysis.self, from: contentData)
        } catch {
            let preview = String(normalizedContent.prefix(160))
            throw APIError.requestFailed("AI 返回格式无法解析：\(preview)")
        }
    }

    func fetchMarketCompassItems() async throws -> [MarketFundItem] {
        guard let url = URL(string: baseURL + "/groups/market-compass") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 15
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed("Invalid response type")
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed("Server error: \(httpResponse.statusCode)")
        }

        return try JSONDecoder().decode([MarketFundItem].self, from: data)
    }

    func fetchFundMetadata(code: String) async throws -> FundMetadata {
        return try await request(endpoint: "/fund/meta/\(code)")
    }

    private func normalizedDeepSeekJSONContent(from rawContent: String) -> String {
        let trimmed = rawContent.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("{"), trimmed.hasSuffix("}") {
            return trimmed
        }

        let withoutCodeFence = trimmed
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if withoutCodeFence.hasPrefix("{"), withoutCodeFence.hasSuffix("}") {
            return withoutCodeFence
        }

        guard let start = withoutCodeFence.firstIndex(of: "{"),
              let end = withoutCodeFence.lastIndex(of: "}") else {
            return withoutCodeFence
        }

        return String(withoutCodeFence[start...end])
    }
}
