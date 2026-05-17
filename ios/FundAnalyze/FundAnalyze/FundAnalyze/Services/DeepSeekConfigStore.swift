import Foundation
import Security

final class DeepSeekConfigStore {
    static let shared = DeepSeekConfigStore()

    private let service = "com.hh.FundAnalyze.DeepSeek"
    private let account = "api-key"
    private let modelKey = "deepseek_model_name"
    private let defaultModel = "deepseek-v4-pro"

    private init() {}

    var configuredModel: String {
        get {
            UserDefaults.standard.string(forKey: modelKey) ?? defaultModel
        }
        set {
            UserDefaults.standard.set(newValue, forKey: modelKey)
        }
    }

    func loadAPIKey() -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let key = String(data: data, encoding: .utf8) else {
            return ""
        }
        return key
    }

    func saveAPIKey(_ apiKey: String) -> Bool {
        let trimmed = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = trimmed.data(using: .utf8) else { return false }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return true
        }

        var createQuery = query
        createQuery[kSecValueData as String] = data
        let addStatus = SecItemAdd(createQuery as CFDictionary, nil)
        return addStatus == errSecSuccess
    }

    func clearAPIKey() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    func hasConfiguredAPIKey() -> Bool {
        !loadAPIKey().isEmpty
    }

    func maskedAPIKey() -> String {
        let key = loadAPIKey()
        guard key.count > 10 else { return key.isEmpty ? "未配置" : key }
        let prefix = key.prefix(6)
        let suffix = key.suffix(4)
        return "\(prefix)••••••\(suffix)"
    }
}
