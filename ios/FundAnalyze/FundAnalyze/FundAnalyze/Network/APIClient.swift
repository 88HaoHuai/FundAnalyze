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
