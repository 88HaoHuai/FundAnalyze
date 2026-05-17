import SwiftUI

struct FundAnalysisView: View {
    let context: FundAnalysisContext
    @StateObject private var vm: FundAnalysisViewModel

    init(context: FundAnalysisContext) {
        self.context = context
        _vm = StateObject(wrappedValue: FundAnalysisViewModel(context: context))
    }

    var body: some View {
        ZStack {
            Color(red: 245/255, green: 245/255, blue: 250/255).ignoresSafeArea()

            if vm.isLoading && vm.realTimeData == nil && vm.relatedNews.isEmpty {
                VStack(spacing: 14) {
                    ProgressView()
                        .scaleEffect(1.15)
                    Text("正在加载基金分析...")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(.gray)
                }
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        FundHeroCard(
                            fundName: vm.displayedFundName,
                            fundCode: context.fundCode,
                            position: context.position,
                            realTimeData: vm.realTimeData
                        )

                        AnalysisSectionContainer(title: "涨跌趋势") {
                            if vm.trendPoints.isEmpty {
                                if vm.isLoading {
                                    HStack(spacing: 10) {
                                        ProgressView()
                                        Text("正在加载趋势数据...")
                                            .font(.system(size: 13))
                                            .foregroundColor(.gray)
                                    }
                                } else {
                                    AnalysisEmptyView(text: "暂未获取到趋势数据")
                                }
                            } else {
                                FundTrendSection(points: vm.trendPoints)
                            }
                        }

                        AnalysisSectionContainer(title: "提取关键词") {
                            if vm.resolvedKeywords.isEmpty {
                                AnalysisEmptyView(text: "暂未提取到可用关键词")
                            } else {
                                KeywordTagFlow(keywords: vm.resolvedKeywords)
                            }
                        }

                        AnalysisSectionContainer(title: "相关资讯") {
                            if vm.relatedNews.isEmpty {
                                AnalysisEmptyView(text: "暂未发现与当前基金强相关的资讯")
                            } else {
                                VStack(spacing: 12) {
                                    ForEach(vm.relatedNews) { item in
                                        AnalysisNewsCard(item: item)
                                    }
                                }
                            }
                        }

                        AnalysisSectionContainer(title: "政策观察") {
                            if vm.policyNews.isEmpty {
                                AnalysisEmptyView(text: "当前没有明显政策类信号")
                            } else {
                                VStack(spacing: 12) {
                                    ForEach(vm.policyNews) { item in
                                        AnalysisNewsCard(item: item)
                                    }
                                }
                            }
                        }

                        AnalysisSectionContainer(title: "AI 综合分析") {
                            if DeepSeekConfigStore.shared.hasConfiguredAPIKey() {
                                HStack {
                                    Text("使用 \(DeepSeekConfigStore.shared.configuredModel) 生成当前基金综合分析")
                                        .font(.system(size: 12))
                                        .foregroundColor(.gray)
                                    Spacer()
                                    Button(action: {
                                        Task { await vm.generateAIAnalysis() }
                                    }) {
                                        HStack(spacing: 6) {
                                            if vm.isGeneratingAI {
                                                ProgressView().controlSize(.small)
                                            } else {
                                                Image(systemName: "sparkles")
                                            }
                                            Text(vm.aiAnalysis == nil ? "生成分析" : "重新分析")
                                        }
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(.purple)
                                    }
                                    .disabled(vm.isGeneratingAI)
                                }

                                if let aiErrorMessage = vm.aiErrorMessage {
                                    Text(aiErrorMessage)
                                        .font(.system(size: 12))
                                        .foregroundColor(.red)
                                }

                                if let aiAnalysis = vm.aiAnalysis {
                                    FundAIAnalysisCard(analysis: aiAnalysis)
                                } else {
                                    AnalysisEmptyView(text: vm.isGeneratingAI ? "正在生成综合分析..." : "点击按钮生成 AI 综合分析")
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
        .navigationTitle("基金分析")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await vm.loadIfNeeded()
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

private struct FundTrendSection: View {
    let points: [FundTrendPoint]
    @State private var selectedRange: TrendRange = .threeMonths

    private var filteredPoints: [FundTrendPoint] {
        selectedRange.filter(points: points)
    }

    private var trendEntries: [TrendChartEntry] {
        guard let base = filteredPoints.first?.nav, base != 0 else { return [] }
        return filteredPoints.map { point in
            TrendChartEntry(
                id: point.id,
                date: point.date,
                nav: point.nav,
                changePercent: (point.nav - base) / base * 100
            )
        }
    }

    private var latestValueText: String {
        filteredPoints.last.map { String(format: "%.4f", $0.nav) } ?? "--"
    }

    private var totalChangePercent: Double {
        trendEntries.last?.changePercent ?? 0
    }

    private var minNav: Double {
        filteredPoints.map(\.nav).min() ?? 0
    }

    private var maxNav: Double {
        filteredPoints.map(\.nav).max() ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(latestValueText)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(totalChangePercent >= 0 ? Color.red : Color.green)
                    Text(selectedRange.label)
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text(signedPercent(totalChangePercent))
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(totalChangePercent >= 0 ? Color.red : Color.green)
                    Text("\(filteredPoints.first?.date ?? "--") - \(filteredPoints.last?.date ?? "--")")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                }
            }

            TrendRangeSelector(selectedRange: $selectedRange)

            FundTrendChart(entries: trendEntries)
                .frame(height: 180)

            HStack(spacing: 12) {
                TrendStatPill(label: "区间最低", value: String(format: "%.4f", minNav))
                TrendStatPill(label: "区间最高", value: String(format: "%.4f", maxNav))
            }
        }
    }

    private func signedPercent(_ value: Double) -> String {
        let sign = value > 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", value))%"
    }
}

private enum TrendRange: String, CaseIterable, Identifiable {
    case sevenDays
    case oneMonth
    case threeMonths
    case sixMonths
    case oneYear
    case threeYears

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sevenDays: return "近7天"
        case .oneMonth: return "近1月"
        case .threeMonths: return "近3月"
        case .sixMonths: return "近6月"
        case .oneYear: return "近1年"
        case .threeYears: return "近3年"
        }
    }

    var days: Int {
        switch self {
        case .sevenDays: return 7
        case .oneMonth: return 31
        case .threeMonths: return 92
        case .sixMonths: return 183
        case .oneYear: return 366
        case .threeYears: return 1096
        }
    }

    func filter(points: [FundTrendPoint]) -> [FundTrendPoint] {
        guard let latestDate = points.compactMap(\.parsedDate).max() else { return points }
        let threshold = Calendar.current.date(byAdding: .day, value: -days, to: latestDate) ?? latestDate
        let filtered = points.filter { point in
            guard let pointDate = point.parsedDate else { return false }
            return pointDate >= threshold
        }
        if filtered.count >= 2 {
            return filtered
        }
        return Array(points.suffix(min(points.count, max(days / 3, 2))))
    }
}

private struct TrendChartEntry: Identifiable {
    let id: String
    let date: String
    let nav: Double
    let changePercent: Double
}

private struct TrendRangeSelector: View {
    @Binding var selectedRange: TrendRange

    var body: some View {
        HStack(spacing: 8) {
            ForEach(TrendRange.allCases) { range in
                Button(action: { selectedRange = range }) {
                    Text(range.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(selectedRange == range ? .blue : .gray)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(selectedRange == range ? Color.blue.opacity(0.14) : Color.clear)
                        )
                }
            }
        }
    }
}

private struct FundTrendChart: View {
    let entries: [TrendChartEntry]

    private var yAxisValues: [Double] {
        guard !entries.isEmpty else { return [0, 0, 0, 0] }
        let minValue = entries.map(\.changePercent).min() ?? 0
        let maxValue = entries.map(\.changePercent).max() ?? 0
        let absolute = max(abs(minValue), abs(maxValue))
        let padded = max(absolute * 1.15, 1.0)
        let step = padded / 2
        return [step * 2, step, 0, -step, -step * 2]
    }

    private var xAxisLabels: [String] {
        guard !entries.isEmpty else { return [] }
        let indexes = Array(Set([0, max(entries.count / 2, 0), max(entries.count - 1, 0)])).sorted()
        return indexes.compactMap { index in
            guard entries.indices.contains(index) else { return nil }
            return simplifiedDate(entries[index].date)
        }
    }

    private var strokeColor: Color {
        guard let last = entries.last?.changePercent else { return .blue }
        return last >= 0 ? Color.blue : Color.green
    }

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let leftAxisWidth: CGFloat = 52
            let bottomAxisHeight: CGFloat = 24
            let topPadding: CGFloat = 10
            let chartWidth = max(size.width - leftAxisWidth - 8, 1)
            let chartHeight = max(size.height - bottomAxisHeight - topPadding, 1)
            let values = yAxisValues
            let maxValue = values.max() ?? 1
            let minValue = values.min() ?? -1
            let range = max(maxValue - minValue, 0.0001)
            let steps = max(entries.count - 1, 1)

            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(red: 248/255, green: 249/255, blue: 255/255))

                VStack(spacing: 0) {
                    ZStack(alignment: .topLeading) {
                        ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                            let ratio = (value - minValue) / range
                            let y = chartHeight - CGFloat(ratio) * chartHeight + topPadding

                            Path { path in
                                path.move(to: CGPoint(x: leftAxisWidth, y: y))
                                path.addLine(to: CGPoint(x: leftAxisWidth + chartWidth, y: y))
                            }
                            .stroke(Color.gray.opacity(0.18), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))

                            Text(percentLabel(value))
                                .font(.system(size: 10))
                                .foregroundColor(.gray)
                                .position(x: leftAxisWidth / 2, y: y)
                        }
                        Path { path in
                            for (index, entry) in entries.enumerated() {
                                let x = leftAxisWidth + CGFloat(index) / CGFloat(steps) * chartWidth
                                let yRatio = (entry.changePercent - minValue) / range
                                let y = chartHeight - CGFloat(yRatio) * chartHeight + topPadding
                                if index == 0 {
                                    path.move(to: CGPoint(x: x, y: y))
                                } else {
                                    path.addLine(to: CGPoint(x: x, y: y))
                                }
                            }
                        }
                        .stroke(strokeColor, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))

                        if let lastEntry = entries.last {
                            let x = leftAxisWidth + CGFloat(entries.count - 1) / CGFloat(steps) * chartWidth
                            let yRatio = (lastEntry.changePercent - minValue) / range
                            let y = chartHeight - CGFloat(yRatio) * chartHeight + topPadding

                            Circle()
                                .fill(strokeColor)
                                .frame(width: 10, height: 10)
                                .position(x: x, y: y)
                        }
                    }
                    .frame(height: chartHeight + topPadding)

                    HStack {
                        Spacer()
                        if xAxisLabels.count == 3 {
                            Text(xAxisLabels[0])
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(xAxisLabels[1])
                                .frame(maxWidth: .infinity, alignment: .center)
                            Text(xAxisLabels[2])
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                    }
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
                    .padding(.leading, leftAxisWidth)
                    .padding(.top, 6)
                }
            }
        }
    }

    private func percentLabel(_ value: Double) -> String {
        let sign = value > 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", value))%"
    }

    private func simplifiedDate(_ date: String) -> String {
        if date.count >= 10 {
            let start = date.index(date.startIndex, offsetBy: 5)
            return String(date[start...])
        }
        return date
    }
}

private struct TrendStatPill: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(red: 247/255, green: 248/255, blue: 252/255))
        .cornerRadius(12)
    }
}

private extension FundTrendPoint {
    var parsedDate: Date? {
        Self.formatters.lazy.compactMap { $0.date(from: date) }.first
    }

    private static let formatters: [DateFormatter] = {
        let formats = ["yyyy-MM-dd", "yyyy/MM/dd", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm"]
        return formats.map { format in
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "zh_CN")
            formatter.timeZone = .current
            formatter.dateFormat = format
            return formatter
        }
    }()
}

private struct FundHeroCard: View {
    let fundName: String
    let fundCode: String
    let position: FundPosition?
    let realTimeData: RealTimeFund?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(fundName)
                        .font(.system(size: 22, weight: .bold))
                    Text(fundCode)
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.82))
                }
                Spacer()
                if let position {
                    Text(position.isAutoInvest ? "定投中" : "非定投")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.16))
                        .cornerRadius(10)
                }
            }

            HStack(spacing: 18) {
                AnalysisMetric(label: "持仓金额", value: formattedAmount(position?.amount ?? 0))
                AnalysisMetric(label: "当日预估", value: signedPercent(realTimeData?.estChangeDouble ?? 0))
                AnalysisMetric(label: "昨日涨跌", value: signedPercent(Double(realTimeData?.yesterdayChange ?? "0") ?? 0))
            }

            Text("净值日期：\(realTimeData?.navDate ?? realTimeData?.estTime ?? "暂无更新")")
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.85))
        }
        .padding(18)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color(red: 0.20, green: 0.38, blue: 0.89), Color(red: 0.12, green: 0.66, blue: 0.70)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(22)
        .shadow(color: Color.blue.opacity(0.16), radius: 14, x: 0, y: 8)
    }

    private func formattedAmount(_ amount: Double) -> String {
        "¥\(String(format: "%.2f", amount))"
    }

    private func signedPercent(_ value: Double) -> String {
        let sign = value > 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", value))%"
    }
}

private struct AnalysisMetric: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.78))
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
        }
    }
}

private struct AnalysisSectionContainer<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.system(size: 18, weight: .bold))
            content
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(18)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}

private struct AnalysisNewsCard: View {
    let item: NewsItem

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
                .font(.system(size: 17, weight: .bold))
                .foregroundColor(.primary)

            Text(item.excerpt)
                .font(.system(size: 13))
                .foregroundColor(.secondary)
                .lineLimit(3)

            if let urlString = item.url,
               let url = URL(string: urlString) {
                Link(destination: url) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.right")
                        Text("原文")
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.blue)
                }
            }
        }
        .padding(14)
        .background(Color(red: 248/255, green: 248/255, blue: 252/255))
        .cornerRadius(16)
    }
}

private struct KeywordTagFlow: View {
    let keywords: [String]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(keywords, id: \.self) { keyword in
                    Text(keyword)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.purple)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.purple.opacity(0.12))
                        .cornerRadius(14)
                }
            }
        }
    }
}

private struct FundAIAnalysisCard: View {
    let analysis: FundAIAnalysis

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(sentimentTitle(analysis.sentiment))
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(sentimentColor(analysis.sentiment))
                Spacer()
                Text("强度 \(analysis.score)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.gray)
            }

            Text(analysis.summary)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.primary)

            AnalysisInsightRow(title: "市场环境", value: analysis.marketView)
            AnalysisInsightRow(title: "政策影响", value: analysis.policyView)
            AnalysisInsightRow(title: "基金判断", value: analysis.fundView)
        }
        .padding(14)
        .background(Color(red: 248/255, green: 248/255, blue: 252/255))
        .cornerRadius(16)
    }

    private func sentimentTitle(_ sentiment: String) -> String {
        switch sentiment {
        case "偏正面":
            return "偏正面分析"
        case "偏谨慎":
            return "偏谨慎分析"
        default:
            return "中性分析"
        }
    }

    private func sentimentColor(_ sentiment: String) -> Color {
        switch sentiment {
        case "偏正面":
            return .red
        case "偏谨慎":
            return .orange
        default:
            return .blue
        }
    }
}

private struct AnalysisInsightRow: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 14))
                .foregroundColor(.primary)
        }
    }
}

private struct AnalysisEmptyView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundColor(.gray)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 10)
    }
}
