import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel
    
    @State private var isLoginMode = true
    @State private var email = ""
    @State private var password = ""
    
    var body: some View {
        ZStack {
            Color("Background").ignoresSafeArea() // 请在 Asset 中配置对应的暗色背景
            
            VStack(spacing: 24) {
                Text(isLoginMode ? "欢迎回来" : "创建账号")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                if let error = authVM.errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.footnote)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                }
                
                VStack(spacing: 16) {
                    TextField("邮箱", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                    
                    SecureField("密码", text: $password)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                }
                
                Button(action: {
                    Task {
                        if isLoginMode {
                            await authVM.login(email: email, password: password)
                        } else {
                            await authVM.register(email: email, password: password)
                        }
                    }
                }) {
                    if authVM.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text(isLoginMode ? "登 录" : "注 册")
                            .font(.headline)
                            .foregroundColor(.white)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .cornerRadius(10)
                .disabled(authVM.isLoading || email.isEmpty || password.isEmpty)
                .opacity((authVM.isLoading || email.isEmpty || password.isEmpty) ? 0.6 : 1.0)
                
                Button(action: {
                    isLoginMode.toggle()
                    authVM.errorMessage = nil
                }) {
                    Text(isLoginMode ? "还没有账号？去注册" : "已有账号？去登录")
                        .font(.footnote)
                        .foregroundColor(.blue)
                }
            }
            .padding(32)
        }
        .preferredColorScheme(.dark)
    }
}
