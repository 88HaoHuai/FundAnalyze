import SwiftUI

struct AISettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var apiKey = ""
    @State private var modelName = DeepSeekConfigStore.shared.configuredModel
    @State private var statusMessage = ""
    @State private var showSavedBanner = false

    var body: some View {
        Form {
            Section("DeepSeek API") {
                SecureField("输入 API Key", text: $apiKey)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)

                HStack {
                    Text("当前模型")
                    Spacer()
                    Text(modelName)
                        .foregroundColor(.secondary)
                }

                Text("将使用 DeepSeek 官方 OpenAI 兼容接口，默认调用 `deepseek-v4-pro`。API Key 仅保存在当前手机本地。")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }

            Section("已保存配置") {
                HStack {
                    Text("API Key")
                    Spacer()
                    Text(DeepSeekConfigStore.shared.maskedAPIKey())
                        .foregroundColor(.secondary)
                }
            }

            Section {
                Button("保存配置") {
                    let trimmed = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else {
                        statusMessage = "请输入有效的 API Key。"
                        return
                    }

                    if DeepSeekConfigStore.shared.saveAPIKey(trimmed) {
                        DeepSeekConfigStore.shared.configuredModel = modelName
                        statusMessage = "已保存 API Key 配置。"
                        showSavedBanner = true
                    } else {
                        statusMessage = "保存失败，请稍后再试。"
                    }
                }

                Button("清除配置", role: .destructive) {
                    if DeepSeekConfigStore.shared.clearAPIKey() {
                        apiKey = ""
                        statusMessage = "已清除本地 API Key。"
                    } else {
                        statusMessage = "清除失败，请稍后再试。"
                    }
                }
            }

            if !statusMessage.isEmpty {
                Section {
                    Text(statusMessage)
                        .font(.system(size: 12))
                        .foregroundColor(statusMessage.contains("失败") ? .red : .green)
                }
            }
        }
        .navigationTitle("AI 解读配置")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            apiKey = DeepSeekConfigStore.shared.loadAPIKey()
            modelName = DeepSeekConfigStore.shared.configuredModel
        }
        .alert("配置已保存", isPresented: $showSavedBanner) {
            Button("完成") {
                dismiss()
            }
        } message: {
            Text("现在可以在资讯页使用 DeepSeek V4 生成 AI 解读。")
        }
    }
}
