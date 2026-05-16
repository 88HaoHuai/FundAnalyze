import Foundation

struct USStockIndex: Identifiable {
    let id = UUID()
    let name: String      // 指数名称 (如: 纳斯达克)
    let symbol: String    // 代码 (如: IXIC)
    let price: Double     // 当前点位
    let change: Double    // 涨跌额
    let changePct: Double // 涨跌幅
    let open: Double      // 开盘
    let preClose: Double  // 昨收
    let high: Double      // 最高
    let low: Double       // 最低
    let time: String      // 时间
}
