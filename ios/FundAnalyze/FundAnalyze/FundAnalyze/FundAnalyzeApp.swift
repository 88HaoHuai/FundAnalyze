//
//  FundAnalyzeApp.swift
//  FundAnalyze
//
//  Created by 怀浩 on 2026/5/13.
//

import SwiftUI

@main
struct FundAnalyzeApp: App {
    @StateObject private var authVM = AuthViewModel()
    
    var body: some Scene {
        WindowGroup {
            if authVM.isAuthenticated {
                MainView()
                    .environmentObject(authVM)
            } else {
                LoginView()
                    .environmentObject(authVM)
            }
        }
    }
}
