import Foundation
import Combine

@MainActor
class GroupSettingsViewModel: ObservableObject {
    @Published var groups: [FundGroup] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    func fetchGroups() async {
        self.isLoading = true
        self.errorMessage = nil
        do {
            let fetchedGroups: [FundGroup] = try await APIClient.shared.request(endpoint: "/groups/")
            self.groups = fetchedGroups
            self.isLoading = false
        } catch {
            self.errorMessage = "加载失败: \(error.localizedDescription)"
            self.isLoading = false
        }
    }
    
    func addGroup(name: String, isMarket: Bool) async {
        let req = FundGroupCreate(name: name, is_market: isMarket, sort_order: groups.count)
        do {
            let body = try JSONEncoder().encode(req)
            let _: FundGroup = try await APIClient.shared.request(endpoint: "/groups/", method: "POST", body: body)
            await fetchGroups()
        } catch {
            self.errorMessage = "添加失败: \(error.localizedDescription)"
        }
    }
    
    func updateGroupName(id: Int, newName: String) async {
        let req = FundGroupUpdate(name: newName)
        do {
            let body = try JSONEncoder().encode(req)
            let _: SuccessResponse = try await APIClient.shared.request(endpoint: "/groups/\(id)", method: "PUT", body: body)
            await fetchGroups()
        } catch {
            self.errorMessage = "更新失败: \(error.localizedDescription)"
        }
    }
    
    func deleteGroup(id: Int) async {
        do {
            let _: SuccessResponse = try await APIClient.shared.request(endpoint: "/groups/\(id)", method: "DELETE")
            await fetchGroups()
        } catch {
            self.errorMessage = "删除失败: \(error.localizedDescription)"
        }
    }
    
    // MARK: - 基金管理
    func addFundToGroup(groupId: Int, fundCode: String) async {
        let req = GroupFundCreate(
            fund_code: fundCode,
            sort_order: 0,
            amount: 0,
            is_auto_invest: false,
            auto_invest_amount: 0
        )
        do {
            let body = try JSONEncoder().encode(req)
            let _: SuccessResponse = try await APIClient.shared.request(endpoint: "/groups/\(groupId)/funds", method: "POST", body: body)
            await fetchGroups()
        } catch {
            self.errorMessage = "添加基金失败: \(error.localizedDescription)"
        }
    }
    
    func removeFundFromGroup(groupId: Int, fundCode: String) async {
        do {
            let _: SuccessResponse = try await APIClient.shared.request(endpoint: "/groups/\(groupId)/funds/\(fundCode)", method: "DELETE")
            await fetchGroups()
        } catch {
            self.errorMessage = "移除基金失败: \(error.localizedDescription)"
        }
    }
    
    func updateFundPosition(groupId: Int, fundCode: String, amount: Double, isAutoInvest: Bool, autoInvestAmount: Double) async {
        let req = GroupFundUpdate(amount: amount, is_auto_invest: isAutoInvest, auto_invest_amount: autoInvestAmount)
        do {
            let body = try JSONEncoder().encode(req)
            let _: SuccessResponse = try await APIClient.shared.request(endpoint: "/groups/\(groupId)/funds/\(fundCode)", method: "PUT", body: body)
            await fetchGroups()
        } catch {
            self.errorMessage = "更新持仓失败: \(error.localizedDescription)"
        }
    }
}
