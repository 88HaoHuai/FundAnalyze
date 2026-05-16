import SwiftUI

struct GroupSettingsView: View {
    @StateObject private var vm = GroupSettingsViewModel()
    @State private var showingAddGroup = false
    @State private var newGroupName = ""
    @State private var newGroupIsMarket = false
    
    @State private var showingEditGroup = false
    @State private var editingGroupId: Int? = nil
    @State private var editingGroupName = ""
    
    var body: some View {
        List {
            if vm.isLoading && vm.groups.isEmpty {
                HStack {
                    Spacer()
                    ProgressView("加载中...")
                    Spacer()
                }
            } else {
                ForEach(vm.groups) { group in
                    NavigationLink(destination: GroupFundsManageView(vm: vm, groupId: group.id, groupName: group.name)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(group.name)
                                    .font(.headline)
                                if group.is_market {
                                    Text("市场风向标")
                                        .font(.caption)
                                        .foregroundColor(.purple)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.purple.opacity(0.1))
                                        .cornerRadius(4)
                                }
                            }
                            Spacer()
                            Button(action: {
                                editingGroupId = group.id
                                editingGroupName = group.name
                                showingEditGroup = true
                            }) {
                                Image(systemName: "pencil")
                                    .foregroundColor(.blue)
                            }
                            .buttonStyle(BorderlessButtonStyle())
                        }
                    }
                }
                .onDelete { indexSet in
                    for index in indexSet {
                        let group = vm.groups[index]
                        Task {
                            await vm.deleteGroup(id: group.id)
                        }
                    }
                }
            }
        }
        .navigationTitle("分组配置")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    newGroupName = ""
                    newGroupIsMarket = false
                    showingAddGroup = true
                }) {
                    Image(systemName: "plus")
                }
            }
        }
        .onAppear {
            Task {
                await vm.fetchGroups()
            }
        }
        .sheet(isPresented: $showingAddGroup) {
            NavigationView {
                Form {
                    Section(header: Text("分组信息")) {
                        TextField("分组名称", text: $newGroupName)
                        Toggle("作为市场风向标", isOn: $newGroupIsMarket)
                    }
                }
                .navigationTitle("添加分组")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("取消") {
                            showingAddGroup = false
                        }
                    }
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("保存") {
                            showingAddGroup = false
                            Task {
                                await vm.addGroup(name: newGroupName, isMarket: newGroupIsMarket)
                            }
                        }
                        .disabled(newGroupName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
        }
        .alert("编辑分组", isPresented: $showingEditGroup) {
            TextField("分组名称", text: $editingGroupName)
            Button("取消", role: .cancel) { }
            Button("保存") {
                guard !editingGroupName.isEmpty, let id = editingGroupId else { return }
                Task {
                    await vm.updateGroupName(id: id, newName: editingGroupName)
                }
            }
        }
    }
}
