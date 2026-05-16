import SwiftUI

// MARK: - 市场风向标 Tab 页
struct MarketCompassView: View {
    @StateObject private var vm = MarketCompassViewModel()

    var body: some View {
        ZStack {
            Color(red: 245/255, green: 245/255, blue: 250/255).ignoresSafeArea()

            if vm.isLoading && vm.items.isEmpty {
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("加载市场数据...")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                }
            } else if let err = vm.errorMessage, vm.items.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 36))
                        .foregroundColor(.orange)
                    Text(err)
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                    Button("重试") { Task { await vm.fetchMarketCompass() } }
                        .foregroundColor(.purple)
                }
                .padding(.horizontal, 32)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(vm.groupedByCategory, id: \.category) { section in
                            MarketSectionView(
                                category: section.category,
                                funds: section.funds,
                                realTimeData: vm.realTimeData
                            )
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
                .refreshable { await vm.refresh() }
            }
        }
        .onAppear {
            if vm.items.isEmpty {
                Task { await vm.fetchMarketCompass() }
            }
        }
    }
}

// MARK: - 分类分区卡片
struct MarketSectionView: View {
    let category: String
    let funds: [MarketFundItem]
    let realTimeData: [String: RealTimeFund]

    var body: some View {
        VStack(spacing: 0) {
            // 分类标题栏
            HStack {
                Text(category)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.purple)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.purple.opacity(0.1))
                    .cornerRadius(6)
                Spacer()
                Text("\(funds.count) 个指数")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            Divider().padding(.horizontal, 14)

            // 基金行列表
            ForEach(funds) { fund in
                MarketFundRow(fund: fund, rt: realTimeData[fund.fund_code])
                if fund.id != funds.last?.id {
                    Divider().padding(.horizontal, 14)
                }
            }
        }
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
    }
}

// MARK: - 单行基金展示（只显示昨日涨跌）
struct MarketFundRow: View {
    let fund: MarketFundItem
    let rt: RealTimeFund?

    var body: some View {
        HStack(spacing: 8) {
            // 左侧：简称 + 代码
            VStack(alignment: .leading, spacing: 3) {
                Text(fund.fund_name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.primary)

                Text(fund.fund_code)
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // 中间：今日估算涨跌幅
            VStack(alignment: .trailing, spacing: 3) {
                let estChange = rt?.estChangeDouble ?? 0
                let hasEst = rt?.estChange != nil
                let estColor: Color = estChange > 0 ? .red : (estChange < 0 ? .green : .gray)
                let estSign = estChange > 0 ? "+" : ""

                Text(hasEst ? "\(estSign)\(String(format: "%.2f", estChange))%" : "--")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(estColor)

                Text("今日估算")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
            .frame(width: 72, alignment: .trailing)

            // 右侧：昨日涨跌幅 + 净值日期
            VStack(alignment: .trailing, spacing: 3) {
                let yStr = rt?.yesterdayChange ?? "--"
                let yVal = Double(yStr) ?? 0.0
                let yColor: Color = yStr == "--" ? .gray : (yVal > 0 ? .red : (yVal < 0 ? .green : .gray))
                let ySign = yVal > 0 ? "+" : ""

                Text(yStr == "--" ? "--%"  : "\(ySign)\(yStr)%")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(yColor)

                let dateStr = rt?.navDate ?? "--"
                let shortDate = dateStr.count >= 10 ? String(dateStr.suffix(5)) : dateStr
                Text(shortDate)
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
            .frame(width: 66, alignment: .trailing)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(Color.white)
    }
}
