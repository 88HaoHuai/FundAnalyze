import SwiftUI

struct USStockView: View {
    @StateObject private var vm = USStockViewModel()

    var body: some View {
        ZStack {
            Color(red: 245/255, green: 245/255, blue: 250/255).ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("美股市场")
                            .font(.system(size: 24, weight: .bold))
                        Text("上次更新: \(vm.lastUpdateTime)")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    Spacer()
                    if vm.isLoading {
                        ProgressView()
                    } else {
                        Button(action: { Task { await vm.fetchIndices() } }) {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 18))
                                .foregroundColor(.purple)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)

                ScrollView {
                    VStack(spacing: 16) {
                        // 重点突出纳斯达克 (第一条数据)
                        if let nasdaq = vm.indices.first(where: { $0.symbol == "NASDAQ" }) {
                            NasdaqHighlightCard(index: nasdaq)
                        }

                        // 其他指数列表
                        VStack(spacing: 12) {
                            ForEach(vm.indices.filter { $0.symbol != "NASDAQ" }) { index in
                                IndexSmallRow(index: index)
                            }
                        }
                        .padding(.top, 8)
                        
                        // 友情提示
                        Text("数据来源: 新浪财经 (延时约15分钟)")
                            .font(.system(size: 10))
                            .foregroundColor(.gray.opacity(0.6))
                            .padding(.top, 20)
                    }
                    .padding(.horizontal, 16)
                }
                .refreshable {
                    await vm.fetchIndices()
                }
            }
        }
        .onAppear {
            vm.startAutoRefresh()
        }
        .onDisappear {
            vm.stopAutoRefresh()
        }
    }
}

// MARK: - 纳斯达克高亮大卡片
struct NasdaqHighlightCard: View {
    let index: USStockIndex

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(index.name)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white.opacity(0.9))
                    Text(index.symbol)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.7))
                }
                Spacer()
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 24))
                    .foregroundColor(.white.opacity(0.8))
            }

            VStack(spacing: 4) {
                Text(String(format: "%.2f", index.price))
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                
                HStack(spacing: 12) {
                    let sign = index.change >= 0 ? "+" : ""
                    Text("\(sign)\(String(format: "%.2f", index.change))")
                    Text("\(sign)\(String(format: "%.2f", index.changePct))%")
                }
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white.opacity(0.9))
            }
            .padding(.vertical, 8)

            HStack {
                InfoItem(label: "开盘", value: String(format: "%.1f", index.open))
                Spacer()
                InfoItem(label: "最高", value: String(format: "%.1f", index.high))
                Spacer()
                InfoItem(label: "最低", value: String(format: "%.1f", index.low))
            }
            .padding(.top, 8)
        }
        .padding(20)
        .background(
            LinearGradient(
                gradient: Gradient(colors: [
                    index.change >= 0 ? Color.red.opacity(0.8) : Color.green.opacity(0.8),
                    index.change >= 0 ? Color.orange.opacity(0.8) : Color.teal.opacity(0.8)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(24)
        .shadow(color: (index.change >= 0 ? Color.red : Color.green).opacity(0.2), radius: 15, x: 0, y: 8)
    }

    struct InfoItem: View {
        let label: String
        let value: String
        var body: some View {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.system(size: 11)).foregroundColor(.white.opacity(0.6))
                Text(value).font(.system(size: 14, weight: .medium)).foregroundColor(.white)
            }
        }
    }
}

// MARK: - 普通指数行
struct IndexSmallRow: View {
    let index: USStockIndex

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(index.name)
                    .font(.system(size: 16, weight: .medium))
                Text(index.symbol)
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(String(format: "%.2f", index.price))
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                
                let sign = index.change >= 0 ? "+" : ""
                let color = index.change >= 0 ? Color.red : Color.green
                Text("\(sign)\(String(format: "%.2f", index.changePct))%")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(color)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(color.opacity(0.1))
                    .cornerRadius(4)
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.03), radius: 5, x: 0, y: 2)
    }
}
