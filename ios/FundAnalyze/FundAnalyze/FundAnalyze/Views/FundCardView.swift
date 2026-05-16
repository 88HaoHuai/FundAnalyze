import SwiftUI

struct FundCardView: View {
    let code: String
    let position: FundPosition?
    let realTimeData: RealTimeFund?

    var body: some View {
        HStack(alignment: .center, spacing: 0) {

            // 左侧名称区域：单独用 ScrollView(.horizontal) 包裹
            // 初始状态：ScrollView 自动 clip 超出内容，视觉上等同截断
            // 向右滑动后：完整名称展开
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 4) {
                    // 优先使用持仓中的名称，其次实时数据中的名称
                    let displayName = position?.fund_name ?? realTimeData?.name ?? "加载中..."
                    Text(displayName)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(.primary)
                        .fixedSize() // 禁止文字折行/截断，让内容超出 ScrollView 宽度

                    HStack(spacing: 6) {
                        Text(code)
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                            .fixedSize()

                        if let pos = position, pos.amount > 0 {
                            Text("持仓: ¥\(String(format: "%.2f", pos.amount))")
                                .font(.system(size: 10))
                                .foregroundColor(.purple)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                                .background(Color.purple.opacity(0.1))
                                .cornerRadius(4)
                                .fixedSize()
                        }
                    }
                }
                // 右侧留一点呼吸空间，防止滑到头时内容紧贴边缘
                .padding(.trailing, 12)
            }
            // 名称列占满所有剩余空间，右侧数据列固定
            .frame(maxWidth: .infinity)

            // 中间：当日预估收益和涨跌幅（固定宽度，始终可见）
            VStack(alignment: .trailing, spacing: 4) {
                let amount = position?.amount ?? 0
                let change = realTimeData?.estChangeDouble ?? 0
                let profit = amount * (change / 100.0)
                let pSign = profit > 0 ? "+" : ""
                let pColor: Color = profit > 0 ? .red : (profit == 0 ? .gray : .green)

                Text("\(pSign)\(String(format: "%.2f", profit))")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(pColor)

                Text("\(change > 0 ? "+" : "")\(String(format: "%.2f", change))%")
                    .font(.system(size: 12))
                    .foregroundColor(pColor)
            }
            .frame(width: 80, alignment: .trailing)

            // 右侧：昨日涨跌及日期（固定宽度，始终可见）
            VStack(alignment: .trailing, spacing: 4) {
                let yChangeStr = realTimeData?.yesterdayChange ?? "--"
                let yChangeVal = Double(yChangeStr) ?? 0.0
                let yColor: Color = yChangeStr == "--" ? .gray : (yChangeVal > 0 ? .red : (yChangeVal == 0 ? .gray : .green))
                let ySign = yChangeVal > 0 ? "+" : ""

                Text(yChangeStr == "--" ? "--%"  : "\(ySign)\(yChangeStr)%")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(yColor)

                // 截取月日部分，如 "2023-10-18" -> "10-18"
                // 若日期比昨天早，说明净值还未更新，用橙色+⚠️提示
                let dateStr = realTimeData?.navDate ?? "--"
                let shortDate = dateStr.count >= 10 ? String(dateStr.suffix(5)) : dateStr
                let isStale = isDataStale(navDate: dateStr)

                HStack(spacing: 2) {
                    if isStale {
                        Image(systemName: "clock.badge.exclamationmark")
                            .font(.system(size: 9))
                            .foregroundColor(.orange)
                    }
                    Text(shortDate)
                        .font(.system(size: 12))
                        .foregroundColor(isStale ? .orange : .gray)
                }
            }
            .frame(width: 80, alignment: .trailing)

        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .background(Color.white)
    }
}

// MARK: - 判断净值数据是否过期（日期不是最近一个交易日）
private func isDataStale(navDate: String) -> Bool {
    guard navDate.count >= 10 else { return false }
    let fmt = DateFormatter()
    fmt.dateFormat = "yyyy-MM-dd"
    fmt.timeZone = TimeZone(identifier: "Asia/Shanghai")
    guard let nav = fmt.date(from: String(navDate.prefix(10))) else { return false }

    // 计算前一个交易日（跳过周末）
    let cal = Calendar.current
    var check = Date()
    var count = 0
    while count < 1 {
        check = cal.date(byAdding: .day, value: -1, to: check) ?? check
        let wd = cal.component(.weekday, from: check)
        if wd != 1 && wd != 7 { count += 1 } // 跳过周日(1)和周六(7)
    }

    // nav 比前一交易日早：数据过期
    return nav < cal.startOfDay(for: check)
}
