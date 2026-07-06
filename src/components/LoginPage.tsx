import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Lock, User, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const LoginPage: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    setIsLoading(true);
    try {
      const err = await login(username.trim(), password);
      if (err) setError(err);
    } catch (err: any) {
      setError('Đăng nhập thất bại. Vui lòng kiểm tra lại kết nối.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
    }}>
      {/* Glassmorphism card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        margin: '1rem',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '60px', height: '60px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            borderRadius: '16px',
            marginBottom: '1rem',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>
            <BookOpen size={28} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
            Process Design
          </h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
            Đăng nhập để tiếp tục
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem' }}>
              Tên đăng nhập
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{
                position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)',
              }} />
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem' }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.4)',
              }} />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', padding: '0.6rem 0.85rem',
              marginBottom: '1rem', color: '#fca5a5', fontSize: '0.82rem',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            id="login-submit"
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: isLoading
                ? 'rgba(99,102,241,0.5)'
                : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s, transform 0.1s',
              boxShadow: isLoading ? 'none' : '0 4px 15px rgba(99,102,241,0.4)',
            }}
            onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLButtonElement).style.opacity = '0.9'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
          >
            {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>

        {/* OR separator */}
        <div style={{
          display: 'flex', alignItems: 'center', margin: '1.5rem 0',
          fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)',
          fontFamily: 'inherit'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ padding: '0 0.75rem' }}>HOẶC</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        {/* Google Login button */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }} id="login-google-btn">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              if (credentialResponse.credential) {
                setIsLoading(true);
                setError(null);
                try {
                  const err = await loginWithGoogle(credentialResponse.credential);
                  if (err) setError(err);
                } catch (err: any) {
                  setError('Đăng nhập Google thất bại.');
                } finally {
                  setIsLoading(false);
                }
              }
            }}
            onError={() => {
              setError('Xác thực tài khoản Google thất bại.');
            }}
            theme="filled_blue"
            shape="pill"
            text="signin_with"
            width="336px"
          />
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
