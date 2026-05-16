import SwiftUI

struct GroupFundsManageView: View {
    @ObservedObject var vm: GroupSettingsViewModel
    let groupId: Int
    let groupName: String

    @State private var newFundCode = ""

    // 编辑弹窗状态
    @State private var showingEditSheet = false
    @State private var editingFundCode = ""
    @State private var editingFundName = ""
    @State private var editingAmountStr = ""
    @State private var editingIsAutoInvest = false
    @State private var editingAutoInvestAmountStr = ""

    private var currentGroup: FundGroup? {
        vm.groups.first(where: { $0.id == groupId })
    }

    var body: some View {
        VStack(spacing: 0) {
            // 添加基金输入区
            HStack(spacing: 10) {
                TextField("输入6位基金代码", text: $newFundCode)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .keyboardType(.numberPad)

                Button(action: {
                    let code = newFundCode.trimmingCharacters(in: .whitespaces)
                    guard code.count == 6 else { return }
                    Task {
                        await vm.addFundToGroup(groupId: groupId, fundCode: code)
                        newFundCode = ""
                    }
                }) {
                    Text("添加")
                        .fontWeight(.semibold)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 9)
                        .background(newFundCode.count == 6 ? Color.blue : Color.gray.opacity(0.4))
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
                .disabled(newFundCode.count != 6)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(UIColor.systemBackground))

            if let error = vm.errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
                    .padding(.horizontal)
            }

            Divider()

            // 基金列表
            if let group = currentGroup {
                if group.codes.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "tray")
                            .font(.system(size: 40))
                            .foregroundColor(.gray)
                        Text("暂无基金，请添加")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(group.codes, id: \.self) { code in
                            FundManageRow(
                                code: code,
                                position: group.positions[code],
                                onEdit: {
                                    let pos = group.positions[code]
                                    editingFundCode = code
                                    editingFundName = pos?.fund_name ?? code
                                    editingAmountStr = String(format: "%.2f", pos?.amount ?? 0)
                                    editingIsAutoInvest = pos?.isAutoInvest ?? false
                                    editingAutoInvestAmountStr = String(format: "%.2f", pos?.autoInvestAmount ?? 0)
                                    showingEditSheet = true
                                },
                                onDelete: {
                                    Task {
                                        await vm.removeFundFromGroup(groupId: groupId, fundCode: code)
                                    }
                                }
                            )
                        }
                    }
                    .listStyle(.plain)
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("\(groupName) 基金列表")
        .navigationBarTitleDisplayMode(.inline)
        // 编辑持仓/定投 Sheet
        .sheet(isPresented: $showingEditSheet) {
            EditPositionSheet(
                fundCode: editingFundCode,
                fundName: editingFundName,
                amountStr: $editingAmountStr,
                isAutoInvest: $editingIsAutoInvest,
                autoInvestAmountStr: $editingAutoInvestAmountStr,
                onSave: {
                    guard let amount = Double(editingAmountStr) else { return }
                    let autoAmt = Double(editingAutoInvestAmountStr) ?? 0
                    Task {
                        await vm.updateFundPosition(
                            groupId: groupId,
                            fundCode: editingFundCode,
                            amount: amount,
                            isAutoInvest: editingIsAutoInvest,
                            autoInvestAmount: autoAmt
                        )
                    }
                    showingEditSheet = false
                },
                onCancel: { showingEditSheet = false }
            )
        }
    }
}

// MARK: - 单行基金展示
struct FundManageRow: View {
    let code: String
    let position: FundPosition?
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            // 左侧：基金名称 + 代码
            VStack(alignment: .leading, spacing: 3) {
                Text(position?.fund_name ?? code)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(code)
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // 中间：金额 + 定投标识
            VStack(alignment: .trailing, spacing: 3) {
                if let pos = position {
                    Text(String(format: "¥%.2f", pos.amount))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.primary)

                    if pos.isAutoInvest {
                        Label(String(format: "定投 ¥%.0f", pos.autoInvestAmount), systemImage: "arrow.clockwise.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.orange)
                    }
                } else {
                    Text("¥0.00")
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                }
            }

            // 右侧：操作按钮
            HStack(spacing: 14) {
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .foregroundColor(.blue)
                        .font(.system(size: 15))
                }
                .buttonStyle(BorderlessButtonStyle())

                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                        .font(.system(size: 15))
                }
                .buttonStyle(BorderlessButtonStyle())
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - 编辑持仓/定投 Sheet
struct EditPositionSheet: View {
    let fundCode: String
    let fundName: String
    @Binding var amountStr: String
    @Binding var isAutoInvest: Bool
    @Binding var autoInvestAmountStr: String
    let onSave: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationView {
            Form {
                // 基金信息（只读）
                Section(header: Text("基金信息")) {
                    HStack {
                        Text("名称")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(fundName)
                            .fontWeight(.medium)
                    }
                    HStack {
                        Text("代码")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(fundCode)
                            .fontWeight(.medium)
                            .foregroundColor(.blue)
                    }
                }

                // 持仓金额
                Section(header: Text("持仓设置")) {
                    HStack {
                        Text("持仓金额 (¥)")
                        Spacer()
                        TextField("0.00", text: $amountStr)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 140)
                    }
                }

                // 定投设置
                Section(header: Text("定投设置")) {
                    Toggle("开启定投", isOn: $isAutoInvest)
                        .tint(.orange)

                    if isAutoInvest {
                        HStack {
                            Text("每次定投金额 (¥)")
                            Spacer()
                            TextField("0.00", text: $autoInvestAmountStr)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 120)
                        }
                    }
                }
            }
            .navigationTitle("编辑持仓")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("取消") { onCancel() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("保存") { onSave() }
                        .fontWeight(.semibold)
                        .disabled(Double(amountStr) == nil)
                }
            }
        }
    }
}
