import Foundation

struct FundAnalysisContext {
    let fundCode: String
    let fundName: String
    let position: FundPosition?
    let realTimeData: RealTimeFund?
}

struct FundPolicyHighlight: Identifiable, Hashable {
    let id: String
    let title: String
    let summary: String
}

struct FundAIAnalysis: Codable, Hashable {
    let summary: String
    let marketView: String
    let policyView: String
    let fundView: String
    let sentiment: String
    let score: Int
}
