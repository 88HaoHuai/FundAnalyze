import Foundation
import Combine

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: UserInfo?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    init() {
        // 初始化时检查是否已有 token，尝试获取用户信息
        if APIClient.shared.token != nil {
            Task {
                await fetchCurrentUser()
            }
        }
        
        // 监听 Token 失效通知
        NotificationCenter.default.addObserver(forName: NSNotification.Name("AuthExpired"), object: nil, queue: .main) { [weak self] _ in
            self?.isAuthenticated = false
            self?.currentUser = nil
        }
    }
    
    func fetchCurrentUser() async {
        do {
            let user: UserInfo = try await APIClient.shared.request(endpoint: "/auth/me")
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            self.isAuthenticated = false
            self.currentUser = nil
            APIClient.shared.token = nil
        }
    }
    
    func login(email: String, password: String) async {
        self.isLoading = true
        self.errorMessage = nil
        
        do {
            // Form Data 编码
            var components = URLComponents()
            components.queryItems = [
                URLQueryItem(name: "username", value: email),
                URLQueryItem(name: "password", value: password)
            ]
            
            let bodyData = components.query?.data(using: .utf8)
            
            // 注意：APIClient 默认 Content-Type 是 application/json，
            // OAuth2 规范要求 application/x-www-form-urlencoded。
            // 简单起见，这里复用 request，但需要在 APIClient 稍加改动或者直接发基础 Request。
            // 为了兼顾这里我们重写一个专用的 login 请求。
            guard let url = URL(string: APIClient.shared.baseURL + "/auth/token") else { return }
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            req.httpBody = bodyData
            
            let (data, response) = try await URLSession.shared.data(for: req)
            
            guard let httpRes = response as? HTTPURLResponse, (200...299).contains(httpRes.statusCode) else {
                if let errJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let detail = errJson["detail"] as? String {
                    throw APIClient.APIError.requestFailed(detail)
                }
                throw APIClient.APIError.requestFailed("登录失败")
            }
            
            let tokenRes = try JSONDecoder().decode(TokenResponse.self, from: data)
            APIClient.shared.token = tokenRes.access_token
            
            await fetchCurrentUser()
            
        } catch APIClient.APIError.requestFailed(let msg) {
            self.errorMessage = msg
        } catch {
            self.errorMessage = error.localizedDescription
        }
        
        self.isLoading = false
    }
    
    func register(email: String, password: String) async {
        self.isLoading = true
        self.errorMessage = nil
        
        do {
            let bodyDict = ["email": email, "password": password]
            let bodyData = try JSONSerialization.data(withJSONObject: bodyDict)
            
            let _: UserInfo = try await APIClient.shared.request(endpoint: "/auth/register", method: "POST", body: bodyData)
            
            // 注册成功自动登录
            await login(email: email, password: password)
            
        } catch APIClient.APIError.requestFailed(let msg) {
            self.errorMessage = msg
        } catch {
            self.errorMessage = error.localizedDescription
        }
        
        self.isLoading = false
    }
    
    func logout() {
        APIClient.shared.token = nil
        self.isAuthenticated = false
        self.currentUser = nil
    }
}
