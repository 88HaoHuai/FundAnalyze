import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { TrendingUp, Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';

export function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error'|'success', text }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 登录成功后 App.jsx 的 onAuthStateChange 会自动更新 session，无需手动跳转
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ type: 'success', text: '注册成功！请检查您的邮箱完成验证，然后返回登录。' });
        setMode('login');
      }
    } catch (err) {
      // 友好的中文错误提示
      const errMap = {
        'Invalid login credentials': '邮箱或密码不正确，请重试。',
        'Email not confirmed': '邮箱尚未验证，请先查收注册邮件。',
        'User already registered': '该邮箱已注册，请直接登录。',
        'Password should be at least 6 characters': '密码长度至少需要 6 位字符。',
      };
      setMessage({ type: 'error', text: errMap[err.message] || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      {/* 背景装饰光效 */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-5%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', left: '-5%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'rgba(30, 41, 59, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
            borderRadius: '14px',
            marginBottom: '1rem',
            boxShadow: '0 8px 20px rgba(79,70,229,0.4)',
          }}>
            <TrendingUp size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc', marginBottom: '0.25rem' }}>
            Fund<span style={{ color: '#818cf8' }}>Tracker</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {mode === 'login' ? '登录您的账户，开始追踪基金' : '创建账户，开启您的基金投资旅程'}
          </p>
        </div>

        {/* Tab 切换 */}
        <div style={{
          display: 'flex',
          background: '#0f172a',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '1.5rem',
        }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setMessage(null); }}
              style={{
                flex: 1, padding: '8px',
                borderRadius: '8px',
                fontSize: '0.875rem', fontWeight: '500',
                transition: 'all 0.2s',
                background: mode === m ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
                color: mode === m ? '#ffffff' : '#64748b',
                border: 'none', cursor: 'pointer',
              }}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        {/* 消息提示 */}
        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            color: message.type === 'error' ? '#f87171' : '#34d399',
          }}>
            {message.text}
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 邮箱 */}
          <div>
            <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              邮箱地址
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: '#475569',
              }} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="你@example.com"
                style={{
                  width: '100%', padding: '10px 12px 10px 38px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#4f46e5'}
                onBlur={e => e.target.style.borderColor = '#334155'}
              />
            </div>
          </div>

          {/* 密码 */}
          <div>
            <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              密码
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: '#475569',
              }} />
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少 6 位字符"
                style={{
                  width: '100%', padding: '10px 40px 10px 38px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#4f46e5'}
                onBlur={e => e.target.style.borderColor = '#334155'}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#475569', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              marginTop: '0.5rem',
              background: loading ? '#334155' : 'linear-gradient(135deg, #4f46e5, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'opacity 0.2s',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(79,70,229,0.4)',
            }}
          >
            {loading ? <><Loader size={16} className="spin" /> 处理中...</> : (mode === 'login' ? '登录' : '注册账号')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: '#475569' }}>
          登录即表示您已同意我们的服务条款与隐私政策
        </p>
      </div>
    </div>
  );
}
