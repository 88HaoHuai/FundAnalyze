import SwiftUI

struct MainView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        TabView {
            // Tab 1: 持仓
            NavigationView {
                HomeView()
                    .navigationBarHidden(true) // 隐藏系统导航栏以完全自定义顶部
            }
            .tabItem {
                Label("持仓", systemImage: "chart.pie")
            }

            // Tab 2: 市场风向标
            NavigationView {
                MarketCompassView()
                    .navigationTitle("市场风向标")
                    .navigationBarTitleDisplayMode(.large)
            }
            .tabItem {
                Label("风向标", systemImage: "compass.drawing")
            }

            // Tab 3: 美股行情
            NavigationView {
                USStockView()
                    .navigationBarHidden(true)
            }
            .tabItem {
                Label("美股", systemImage: "chart.line.uptrend.xyaxis")
            }

            // Tab 4: 资讯
            NavigationView {
                NewsView()
            }
            .tabItem {
                Label("资讯", systemImage: "newspaper")
            }
        }
    }
}
