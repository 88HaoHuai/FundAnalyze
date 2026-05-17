import Foundation

enum NewsSource: String, Codable {
    case em
    case cls

    var displayName: String {
        switch self {
        case .em:
            return "东方财富"
        case .cls:
            return "财联社"
        }
    }
}

enum NewsImpactLevel: String, Codable {
    case high
    case medium
    case low

    var displayText: String {
        switch self {
        case .high:
            return "高影响"
        case .medium:
            return "中影响"
        case .low:
            return "低影响"
        }
    }
}

struct NewsItem: Identifiable, Hashable {
    let id: String
    let time: String
    let title: String
    let content: String
    let url: String?
    let source: NewsSource
    var matchedKeywords: [String] = []
    var impactLevel: NewsImpactLevel = .low
    var relevanceScore: Int = 0

    var excerpt: String {
        let raw = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.count <= 90 {
            return raw
        }
        return String(raw.prefix(90)) + "..."
    }
}

struct NewsRecord: Codable {
    let time: String?
    let title: String?
    let content: String?
    let url: String?
}

struct NewsEnvelope: Codable {
    let success: Bool
    let data: [NewsRecord]?
    let error: String?
}

struct NewsAIRequest: Codable {
    let title: String
    let content: String
    let fundSectors: String
}

struct NewsAIResponse: Codable {
    let success: Bool
    let data: NewsAIData?
    let error: String?
}

struct NewsAIData: Codable, Hashable {
    let sentiment: String
    let score: Int
    let summary: String
    let impact: [String]
}

struct DeepSeekChatMessage: Codable {
    let role: String
    let content: String
}

struct DeepSeekThinkingConfig: Codable {
    let type: String
}

struct DeepSeekResponseFormat: Codable {
    let type: String
}

struct DeepSeekChatCompletionRequest: Codable {
    let model: String
    let messages: [DeepSeekChatMessage]
    let thinking: DeepSeekThinkingConfig
    let reasoning_effort: String
    let response_format: DeepSeekResponseFormat
    let max_tokens: Int
    let stream: Bool
}

struct DeepSeekChatCompletionResponse: Codable {
    let choices: [DeepSeekChoice]
}

struct DeepSeekChoice: Codable {
    let message: DeepSeekChoiceMessage
}

struct DeepSeekChoiceMessage: Codable {
    let content: String?
    let reasoning_content: String?
}

struct NewsDigest {
    let marketMood: String
    let focusSummary: String
    let impactSummary: String
    let updatedAt: String
}

struct NewsMarketSnapshot: Identifiable, Hashable {
    let id: String
    let name: String
    let code: String
    let changeText: String
    let changeValue: Double
    let updateTime: String
}

struct NewsAIHighlight: Identifiable, Hashable {
    let id: String
    let news: NewsItem
    let analysis: NewsAIData
}

struct DeepSeekFundAnalysisRequest: Codable {
    let model: String
    let messages: [DeepSeekChatMessage]
    let response_format: DeepSeekResponseFormat
    let max_tokens: Int
    let stream: Bool
}
