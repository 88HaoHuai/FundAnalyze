import Foundation

// MARK: - 市场风向标基金模型（全局配置，无需用户登录）
struct MarketFundItem: Codable, Identifiable {
    let id: Int
    let fund_code: String
    let fund_name: String
    let category: String?
    let sort_order: Int
}
