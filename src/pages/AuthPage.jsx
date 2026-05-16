import { useState, useEffect } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // 登录
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', password);
        
        const res = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || '登录失败');
        }
        
        const data = await res.json();
        localStorage.setItem('fund_token', data.access_token);
        window.location.reload(); // 刷新加载主应用
      } else {
        // 注册
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || '注册失败');
        }
        
        alert("注册成功！请登录。");
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', color: '#f8fafc', padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '30px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>
          Fund<span style={{ color: '#4f46e5' }}>Tracker</span>
        </h2>
        
        {error && <div style={{ 
            background: 'rgba(239,68,68,0.1)', color: '#ef4444', 
            padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' 
        }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>邮箱</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="search-input"
              style={{ width: '100%', background: '#1e293b' }}
              placeholder="请输入您的邮箱"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>密码</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="search-input"
              style={{ width: '100%', background: '#1e293b' }}
              placeholder="请输入密码"
            />
          </div>
          
          <button type="submit" className="btn" disabled={loading} style={{ 
              width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '8px',
              opacity: loading ? 0.7 : 1
          }}>
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? '处理中...' : (isLogin ? '登 录' : '注 册')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#94a3b8' }}>
          {isLogin ? '还没有账号？' : '已有账号？'}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            style={{ 
                background: 'none', border: 'none', color: '#4f46e5', 
                cursor: 'pointer', textDecoration: 'underline', marginLeft: '4px' 
            }}
          >
            {isLogin ? '去注册' : '去登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
