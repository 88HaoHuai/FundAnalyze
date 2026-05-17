import SwiftUI

struct NewsView: View {
    @StateObject private var vm = NewsViewModel()

    var body: some View {
        ZStack {
            Color(red: 245/255, green: 245/255, blue: 250/255).ignoresSafeArea()

            if vm.isLoading && vm.digest == nil {
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("正在整理今日资讯...")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                }
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        if let digest = vm.digest {
                            NewsDigestCard(digest: digest)
                        }

                        NewsSectionContainer(title: "市场行情", subtitle: "先看今天市场大概怎么样") {
                            if vm.marketSnapshots.isEmpty {
                                EmptySectionView(text: "暂无更新")
                            } else {
                                VStack(spacing: 10) {
                                    ForEach(vm.marketSnapshots) { item in
                                        MarketSnapshotRow(item: item)
                                    }
                                }
                            }
                        }

                        NewsSectionContainer(title: "今日重点资讯", subtitle: "筛出最值得先看的 3-5 条") {
                            if vm.headlineNews.isEmpty {
                                EmptySectionView(text: "暂时没有重点资讯")
                            } else {
                                VStack(spacing: 12) {
                                    ForEach(vm.headlineNews) { item in
                                        NewsCard(item: item, showMatchTags: true)
                                    }
                                }
                            }
                        }

                        NewsSectionContainer(title: "持仓 / 主题相关资讯", subtitle: "和你组合更相关的消息") {
                            KeywordChipsRow(keywords: vm.keywordChips, selectedKeyword: vm.selectedKeyword) { keyword in
                                Task { await vm.selectKeyword(keyword) }
                            }

                            if vm.relatedNews.isEmpty {
                                EmptySectionView(text: "暂未发现和当前主题强相关的资讯")
                            } else {
                                VStack(spacing: 12) {
                                    ForEach(vm.relatedNews) { item in
                                        NewsCard(item: item, showMatchTags: true)
                                    }
                                }
                            }
                        }

                        NewsSectionContainer(title: "AI 解读精选", subtitle: "只挑最重要的资讯做增强解读") {
                            if DeepSeekConfigStore.shared.hasConfiguredAPIKey() {
                                HStack {
                                    Text("使用 \(DeepSeekConfigStore.shared.configuredModel) 解析前 2 条重点资讯")
                                        .font(.system(size: 12))
                                        .foregroundColor(.gray)
                                    Spacer()
                                    Button(action: {
                                        Task { await vm.generateAIHighlights() }
                                    }) {
                                        HStack(spacing: 6) {
                                            if vm.isGeneratingAI {
                                                ProgressView()
                                                    .controlSize(.small)
                                            } else {
                                                Image(systemName: "sparkles")
                                            }
                                            Text(vm.aiHighlights.isEmpty ? "生成解读" : "重新解析")
                                        }
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(.purple)
                                    }
                                    .disabled(vm.isGeneratingAI || vm.headlineNews.isEmpty)
                                }

                                if let aiErrorMessage = vm.aiErrorMessage {
                                    Text(aiErrorMessage)
                                        .font(.system(size: 12))
                                        .foregroundColor(.red)
                                }

                                if vm.aiHighlights.isEmpty {
                                    EmptySectionView(text: vm.isGeneratingAI ? "正在生成 AI 解读..." : "点击按钮生成 AI 解读")
                                } else {
                                    VStack(spacing: 12) {
                                        ForEach(vm.aiHighlights) { item in
                                            AIHighlightCard(item: item)
                                        }
                                    }
                                }
                            } else {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("还没有配置 DeepSeek API Key。")
                                        .font(.system(size: 13))
                                        .foregroundColor(.secondary)
                                    NavigationLink(destination: AISettingsView()) {
                                        Text("去配置 AI 解读")
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundColor(.purple)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .refreshable {
                    await vm.refreshAll()
                }
            }
        }
        .navigationTitle("资讯")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await vm.loadIfNeeded()
        }
        .onAppear {
            Task {
                await vm.loadIfNeeded()
            }
        }
        .overlay(alignment: .top) {
            if let errorMessage = vm.errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundColor(.red)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .cornerRadius(12)
                    .padding(.top, 8)
            }
        }
    }
}

private struct NewsDigestCard: View {
    let digest: NewsDigest

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("今日关注")
                        .font(.system(size: 22, weight: .bold))
                    Text(digest.marketMood)
                        .font(.system(size: 14))
                        .foregroundColor(.white.opacity(0.88))
                }
                Spacer()
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 26))
                    .foregroundColor(.white.opacity(0.85))
            }

            Text(digest.focusSummary)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.white)
                .lineLimit(2)

            HStack {
                Label(digest.impactSummary, systemImage: "target")
                Spacer()
                Label(digest.updatedAt, systemImage: "clock")
            }
            .font(.system(size: 12))
            .foregroundColor(.white.opacity(0.85))
        }
        .padding(18)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color(red: 0.33, green: 0.25, blue: 0.83), Color(red: 0.11, green: 0.40, blue: 0.89)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(22)
        .shadow(color: Color.blue.opacity(0.16), radius: 14, x: 0, y: 8)
    }
}

private struct NewsSectionContainer<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 18, weight: .bold))
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }

            content
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(18)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}

private struct MarketSnapshotRow: View {
    let item: NewsMarketSnapshot

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.system(size: 15, weight: .semibold))
                Text(item.code)
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(item.changeText)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(item.changeValue > 0 ? .red : (item.changeValue < 0 ? .green : .gray))
                Text(item.updateTime)
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
        }
        .padding(12)
        .background(Color(red: 248/255, green: 248/255, blue: 252/255))
        .cornerRadius(14)
    }
}

private struct NewsCard: View {
    let item: NewsItem
    let showMatchTags: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(item.source.displayName, systemImage: item.source == .cls ? "bolt.fill" : "newspaper.fill")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(item.source == .cls ? .orange : .blue)
                Spacer()
                Text(item.time)
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }

            Text(item.title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.primary)
                .lineLimit(2)

            Text(item.excerpt)
                .font(.system(size: 13))
                .foregroundColor(.secondary)
                .lineSpacing(2)
                .lineLimit(3)

            HStack {
                ImpactBadge(level: item.impactLevel)
                if showMatchTags {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(item.matchedKeywords, id: \.self) { keyword in
                                Text(keyword)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.purple)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.purple.opacity(0.12))
                                    .cornerRadius(10)
                            }
                        }
                    }
                }
                Spacer()
                if let url = item.url, let link = URL(string: url) {
                    Link(destination: link) {
                        Label("原文", systemImage: "arrow.up.right")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.blue)
                    }
                }
            }
        }
        .padding(14)
        .background(Color(red: 248/255, green: 248/255, blue: 252/255))
        .cornerRadius(14)
    }
}

private struct ImpactBadge: View {
    let level: NewsImpactLevel

    var body: some View {
        Text(level.displayText)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(foregroundColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .cornerRadius(10)
    }

    private var foregroundColor: Color {
        switch level {
        case .high:
            return .red
        case .medium:
            return .orange
        case .low:
            return .gray
        }
    }

    private var backgroundColor: Color {
        switch level {
        case .high:
            return Color.red.opacity(0.12)
        case .medium:
            return Color.orange.opacity(0.12)
        case .low:
            return Color.gray.opacity(0.12)
        }
    }
}

private struct KeywordChipsRow: View {
    let keywords: [String]
    let selectedKeyword: String
    let onTap: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(keywords, id: \.self) { keyword in
                    Button(action: { onTap(keyword) }) {
                        Text(keyword)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(selectedKeyword == keyword ? .white : .purple)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(selectedKeyword == keyword ? Color.purple : Color.purple.opacity(0.1))
                            .cornerRadius(14)
                    }
                }
            }
        }
    }
}

private struct EmptySectionView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundColor(.gray)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 6)
    }
}

private struct AIHighlightCard: View {
    let item: NewsAIHighlight

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(sentimentTitle(item.analysis.sentiment))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(sentimentColor(item.analysis.sentiment))
                Spacer()
                Text("强度 \(item.analysis.score)")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }

            Text(item.news.title)
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(2)

            Text(item.analysis.summary)
                .font(.system(size: 13))
                .foregroundColor(.secondary)
                .lineSpacing(2)

            if !item.analysis.impact.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(item.analysis.impact, id: \.self) { tag in
                            Text(tag)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.blue)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.blue.opacity(0.12))
                                .cornerRadius(10)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(Color(red: 248/255, green: 248/255, blue: 252/255))
        .cornerRadius(14)
    }

    private func sentimentTitle(_ sentiment: String) -> String {
        switch sentiment {
        case "利好":
            return "利好解读"
        case "利空":
            return "利空解读"
        default:
            return "中性解读"
        }
    }

    private func sentimentColor(_ sentiment: String) -> Color {
        switch sentiment {
        case "利好":
            return .red
        case "利空":
            return .green
        default:
            return .gray
        }
    }
}
