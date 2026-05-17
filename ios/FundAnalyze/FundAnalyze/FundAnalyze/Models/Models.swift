import Foundation

// MARK: - 认证模型
struct TokenResponse: Codable {
    let access_token: String
    let token_type: String
}

struct UserInfo: Codable {
    let id: String
    let email: String
}

// MARK: - 基金分组与持仓模型
struct FundGroup: Codable, Identifiable {
    let id: Int
    let name: String
    let is_market: Bool
    let sort_order: Int
    let codes: [String]
    let positions: [String: FundPosition]
}

struct FundPosition: Codable {
    let amount: Double
    let isAutoInvest: Bool
    let autoInvestAmount: Double
    let lastAutoInvestDate: String?
    let fund_name: String?  // 基金显示名称（后端已返回）
    let keywords: [String]?
}

struct FundMetadata: Codable {
    let fund_code: String
    let fund_name: String
    let fund_type: String?
    let keywords: [String]
}

// MARK: - 基金行情代理模型 (东方财富)
struct RealTimeFund: Codable, Identifiable {
    var id: String { code }
    let code: String
    let name: String
    let nav: String?
    let navDate: String?
    let estChange: String?
    let estTime: String?
    let valuation: String?
    let yesterdayChange: String? // 新增昨日涨跌幅
    
    var estChangeDouble: Double {
        Double(estChange ?? "0") ?? 0.0
    }
}

struct FundTrendPoint: Identifiable, Hashable {
    let id: String
    let date: String
    let nav: Double
    let changePercent: Double?
}

// MARK: - AI 诊断模型
struct AIAdviceRequest: Codable {
    let fund_name: String
    let amount: Double
    let est_change: Double
    let drawdown: Double
    let rsi: Double
    let is_auto_invest: Bool
}

struct AIAdviceResponse: Codable {
    let success: Bool
    let data: AIAdviceData?
    let error: String?
}

struct AIAdviceData: Codable {
    let action: String
    let confidence: Int
    let reasoning: String
}

// MARK: - 请求和基础返回模型
struct SuccessResponse: Codable {
    let success: Bool
}

struct FundGroupCreate: Codable {
    let name: String
    let is_market: Bool
    let sort_order: Int
}

struct FundGroupUpdate: Codable {
    let name: String
}

struct GroupFundCreate: Codable {
    let fund_code: String
    let sort_order: Int
    let amount: Double
    let is_auto_invest: Bool
    let auto_invest_amount: Double
}

struct GroupFundUpdate: Codable {
    let amount: Double
    let is_auto_invest: Bool
    let auto_invest_amount: Double
}
