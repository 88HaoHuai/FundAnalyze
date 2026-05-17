import SwiftUI

enum SortOption {
    case defaultOrder
    case desc
    case asc
    
    var next: SortOption {
        switch self {
        case .desc: return .asc
        case .asc: return .defaultOrder
        case .defaultOrder: return .desc
        }
    }
}

struct HomeView: View {
    @StateObject private var vm = HomeViewModel()
    @EnvironmentObject var authVM: AuthViewModel // 用于退出登录
    @State private var selectedGroupId: Int? = nil // nil 表示全部
    @State private var sortOption: SortOption = .desc // 默认按照降序排列
    @State private var isAmountHidden: Bool = false // 总资产显示/隐藏状态
    
    var body: some View {
        ZStack {
            // 背景底色：极淡的紫色/灰白色
            Color(red: 245/255, green: 245/255, blue: 250/255).ignoresSafeArea()
            
            VStack(spacing: 0) {
                // 自定义紧凑型 Header (极致压缩高度)
                HStack {
                    Text("FundTracker")
                        .font(.system(size: 20, weight: .bold)) // 字体减小
                        .foregroundColor(.black)
                    
                    Spacer()
                    
                    HStack(spacing: 14) {
                        NavigationLink(destination: GroupSettingsView()) {
                            Image(systemName: "gearshape")
                                .font(.system(size: 16))
                                .foregroundColor(.black)
                        }
                        
                        Button("退出") {
                            authVM.logout()
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.black)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 4) // 垂直间距减半
                
                // 顶部总览
                TotalOverviewCard(
                    totalAmount: selectedTotalAmount,
                    totalEstProfit: selectedTotalEstProfit,
                    isAmountHidden: $isAmountHidden
                )
                    .padding(.horizontal, 16)
                    .padding(.top, 2) // 间距压到极小
                
                // 分组切换器
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        GroupTabButton(title: "全部", isSelected: selectedGroupId == nil) {
                            selectedGroupId = nil
                        }
                        
                        // 先排序，把市场风向标放到最后
                        let sortedTabs = vm.groups.sorted { (g1, g2) in
                            if g1.is_market && !g2.is_market { return false }
                            if !g1.is_market && g2.is_market { return true }
                            return g1.sort_order < g2.sort_order
                        }
                        
                        ForEach(sortedTabs) { group in
                            GroupTabButton(title: group.name, isSelected: selectedGroupId == group.id) {
                                selectedGroupId = group.id
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)
                }
                
                // 列表区域 (带有圆角白底)
                VStack(spacing: 0) {
                    // 表头
                    HStack {
                        Text("基金名称")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        // 可点击的排序表头
                        Button(action: {
                            withAnimation {
                                sortOption = sortOption.next
                            }
                        }) {
                            HStack(spacing: 2) {
                                Text("当日预估")
                                    .font(.system(size: 12))
                                
                                Image(systemName: sortIcon)
                                    .font(.system(size: 10))
                            }
                            .foregroundColor(.gray)
                        }
                        .frame(width: 80, alignment: .trailing)
                        
                        VStack(spacing: 2) {
                            Text("昨日涨跌")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        .frame(width: 80, alignment: .trailing)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    
                    Divider().padding(.horizontal, 16)
                    
                    if vm.isLoading && vm.groups.isEmpty {
                        ProgressView("加载中...").padding(.top, 50)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                let sortedCodes = sortCodes(visibleCodes)
                                
                                ForEach(sortedCodes, id: \.self) { code in
                                    NavigationLink(
                                        destination: FundAnalysisView(
                                            context: FundAnalysisContext(
                                                fundCode: code,
                                                fundName: positionForCode(code)?.fund_name ?? vm.realTimeData[code]?.name ?? "基金 \(code)",
                                                position: positionForCode(code),
                                                realTimeData: vm.realTimeData[code]
                                            )
                                        )
                                    ) {
                                        FundCardView(
                                            code: code,
                                            position: positionForCode(code),
                                            realTimeData: vm.realTimeData[code],
                                            isAmountHidden: isAmountHidden
                                        )
                                        .id("\(code)-\(isAmountHidden)")
                                    }
                                    .buttonStyle(.plain)
                                    Divider().padding(.horizontal, 16)
                                }
                            }
                            .padding(.bottom, 20)
                        }
                        .refreshable {
                            await vm.refreshData()
                        }
                    }
                }
                .background(Color.white)
                .cornerRadius(16)
                .padding(.horizontal, 16)
            }
        }
        .onAppear {
            Task {
                await vm.fetchGroups()
            }
        }
    }
    
    // 返回对应的排序图标
    private var sortIcon: String {
        switch sortOption {
        case .desc: return "arrow.down"
        case .asc: return "arrow.up"
        case .defaultOrder: return "arrow.up.arrow.down"
        }
    }
    
    private var selectedPositions: [FundPosition] {
        if let selectedGroupId,
           let group = vm.groups.first(where: { $0.id == selectedGroupId }) {
            return group.codes.compactMap { group.positions[$0] }
        }
        
        let uniqueCodes = Set(vm.groups.flatMap { $0.codes })
        return uniqueCodes.compactMap { code in
            vm.groups.compactMap { $0.positions[code] }.first
        }
    }
    
    private var selectedTotalAmount: Double {
        selectedPositions.reduce(0) { $0 + $1.amount }
    }
    
    private var selectedTotalEstProfit: Double {
        if let selectedGroupId,
           let group = vm.groups.first(where: { $0.id == selectedGroupId }) {
            return group.codes.reduce(0) { total, code in
                let amount = group.positions[code]?.amount ?? 0
                let change = vm.realTimeData[code]?.estChangeDouble ?? 0
                return total + amount * (change / 100.0)
            }
        }
        
        let uniqueCodes = Set(vm.groups.flatMap { $0.codes })
        return uniqueCodes.reduce(0) { total, code in
            let amount = vm.groups.compactMap { $0.positions[code] }.first?.amount ?? 0
            let change = vm.realTimeData[code]?.estChangeDouble ?? 0
            return total + amount * (change / 100.0)
        }
    }
    
    private var visibleCodes: [String] {
        if let selectedGroupId,
           let group = vm.groups.first(where: { $0.id == selectedGroupId }) {
            return group.codes
        }
        
        return Array(Set(vm.groups.flatMap { $0.codes }))
    }
    
    private func positionForCode(_ code: String) -> FundPosition? {
        if let selectedGroupId,
           let group = vm.groups.first(where: { $0.id == selectedGroupId }) {
            return group.positions[code]
        }
        
        return vm.groups.compactMap { $0.positions[code] }.first
    }
    
    // 执行排序逻辑
    private func sortCodes(_ codes: [String]) -> [String] {
        guard sortOption != .defaultOrder else { return codes }
        return codes.sorted { a, b in
            let changeA = vm.realTimeData[a]?.estChangeDouble ?? 0
            let changeB = vm.realTimeData[b]?.estChangeDouble ?? 0
            if sortOption == .desc {
                return changeA > changeB
            } else {
                return changeA < changeB
            }
        }
    }
}

// 分组标签按钮
struct GroupTabButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: isSelected ? .bold : .regular))
                .foregroundColor(isSelected ? .white : .gray)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.purple.opacity(0.8) : Color.white)
                .cornerRadius(20)
                .shadow(color: isSelected ? Color.purple.opacity(0.3) : Color.clear, radius: 4, y: 2)
        }
    }
}

// 顶部总览卡片子组件
struct TotalOverviewCard: View {
    let totalAmount: Double
    let totalEstProfit: Double
    @Binding var isAmountHidden: Bool
    
    var body: some View {
        VStack(spacing: 12) {
            // 标题行：眼睛按钮可点击
            HStack {
                Text("总资产 (元)")
                    .font(.system(size: 13))
                    .foregroundColor(Color(white: 0.3))
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isAmountHidden.toggle()
                    }
                }) {
                    Image(systemName: isAmountHidden ? "eye.slash" : "eye")
                        .foregroundColor(.purple)
                        .font(.system(size: 12))
                }
                .buttonStyle(.plain)
                Spacer()
            }
            
            // 总资产金额：隐藏时显示 ****
            HStack {
                if isAmountHidden {
                    Text("****")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.black)
                        .transition(.opacity)
                } else {
                    Text(String(format: "%.2f", totalAmount))
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.black)
                        .transition(.opacity)
                }
                Spacer()
            }
            
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("当日预估")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                    let pSign = totalEstProfit > 0 ? "+" : ""
                    let pColor: Color = totalEstProfit > 0 ? .red : (totalEstProfit == 0 ? .gray : .green)
                    // 当日预估也跟随隐藏
                    Text(isAmountHidden ? "****" : "\(pSign)\(String(format: "%.2f", totalEstProfit))")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(isAmountHidden ? .gray : pColor)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("收益率")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                    
                    let rate = totalAmount > 0 ? (totalEstProfit / totalAmount) * 100 : 0
                    let rSign = rate > 0 ? "+" : ""
                    let rColor: Color = rate > 0 ? .red : (rate == 0 ? .gray : .green)
                    Text(isAmountHidden ? "**%" : "\(rSign)\(String(format: "%.2f", rate))%")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(isAmountHidden ? .gray : rColor)
                }
            }
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        // 使用非常淡的紫色渐变，贴近截图效果
        .background(
            LinearGradient(gradient: Gradient(colors: [
                Color(red: 235/255, green: 225/255, blue: 250/255),
                Color(red: 245/255, green: 235/255, blue: 255/255)
            ]), startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .cornerRadius(12)
    }
}
