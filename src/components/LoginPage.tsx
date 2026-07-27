import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Lock, User, Mail, AlertCircle, ArrowLeft, FileText } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

type AuthStep = 'EMAIL' | 'LOGIN' | 'REGISTER';

const LoginPage: React.FC = () => {
  const { login, register, loginWithGoogle } = useAuth();

  const [step, setStep] = useState<AuthStep>('EMAIL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [existingUserFullName, setExistingUserFullName] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fill link context details
  const [fillContext, setFillContext] = useState<{ processId: string; formName: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qPage = params.get('page');
    const qProcessId = params.get('processId');
    const qFormName = params.get('formName');

    if (qPage === 'fill' && qProcessId && qFormName) {
      setFillContext({ processId: qProcessId, formName: qFormName });
    }
  }, []);

  // Step 1: Check Email
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = email.trim().toLowerCase();
    if (!clean) {
      setError('Vui lòng nhập địa chỉ email hoặc tên đăng nhập.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kiểm tra tài khoản thất bại.');
      }

      if (data.exists) {
        setExistingUserFullName(data.full_name);
        setStep('LOGIN');
      } else {
        if (!clean.includes('@')) {
          setError('Email mới cần đúng định dạng (vd: user@company.com).');
          setIsLoading(false);
          return;
        }
        setStep('REGISTER');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2A: Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const err = await login(email.trim(), password);
      if (err) setError(err);
    } catch (err: any) {
      setError('Đăng nhập thất bại. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2B: Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên của bạn.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsLoading(true);
    try {
      const err = await register(email.trim().toLowerCase(), fullName.trim(), password);
      if (err) setError(err);
    } catch (err: any) {
      setError('Tạo tài khoản thất bại. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('EMAIL');
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--neutral-bg)',
      fontFamily: "'Be Vietnam Pro', var(--font-sans, Inter, system-ui, sans-serif)",
      padding: '1.5rem',
    }}>
      {/* Executive Paper Card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--neutral-card)',
        border: '1px solid var(--neutral-border)',
        borderTop: '4px solid var(--primary)',
        borderRadius: 'var(--container-radius, 16px)',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative'
      }}>
        {/* Back button if in step 2 */}
        {step !== 'EMAIL' && (
          <button
            type="button"
            onClick={handleReset}
            style={{
              position: 'absolute', left: '1.5rem', top: '1.5rem',
              background: '#f1f5f9', border: '1px solid var(--neutral-border)',
              color: 'var(--text-secondary)', borderRadius: '6px', padding: '0.35rem 0.6rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <ArrowLeft size={14} /> Quay lại
          </button>
        )}

        {/* Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px',
            background: 'var(--primary-gradient)',
            borderRadius: '14px',
            marginBottom: '0.75rem',
            boxShadow: '0 8px 20px rgba(16, 163, 163, 0.25)',
          }}>
            <BookOpen size={26} color="#fff" />
          </div>
          <h1 style={{
            margin: 0, fontSize: '1.4rem', fontWeight: 700,
            background: 'var(--primary-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Process Design
          </h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {step === 'EMAIL' && 'Đăng nhập hoặc tạo tài khoản để tiếp tục'}
            {step === 'LOGIN' && `Chào mừng trở lại ${existingUserFullName ? `, ${existingUserFullName}` : ''}`}
            {step === 'REGISTER' && 'Tạo tài khoản mới để điền & lưu biểu mẫu'}
          </p>
        </div>

        {/* Form Link Notice Banner (If accessing via share link) */}
        {fillContext && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.8rem',
            color: '#1e40af'
          }}>
            <FileText size={18} style={{ flexShrink: 0, color: '#3b82f6' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#1e3a8a' }}>Bạn được mời điền biểu mẫu</div>
              <div style={{ fontSize: '0.72rem', color: '#3b82f6' }}>Mẫu: {fillContext.formName} ({fillContext.processId})</div>
            </div>
          </div>
        )}

        {/* STEP 1: EMAIL ENTRY */}
        {step === 'EMAIL' && (
          <form onSubmit={handleCheckEmail} noValidate>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Địa chỉ Email / Tên đăng nhập
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--border-focus)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '8px', padding: '0.6rem 0.85rem',
                marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.82rem',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              id="login-continue"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: isLoading ? '#94a3b8' : 'var(--primary-gradient)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                boxShadow: isLoading ? 'none' : 'var(--shadow-sm)',
              }}
            >
              {isLoading ? 'Đang kiểm tra...' : 'Tiếp tục →'}
            </button>

            {/* OR separator */}
            <div style={{
              display: 'flex', alignItems: 'center', margin: '1.25rem 0',
              fontSize: '0.75rem', color: 'var(--text-muted)',
              fontFamily: 'inherit'
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--neutral-border)' }}></div>
              <span style={{ padding: '0 0.75rem' }}>HOẶC</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--neutral-border)' }}></div>
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
          </form>
        )}

        {/* STEP 2A: LOGIN WITH PASSWORD */}
        {step === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} noValidate>
            <div style={{
              fontSize: '0.8rem', color: 'var(--text-secondary)',
              background: '#f8fafc', border: '1px solid var(--neutral-border)',
              padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '1.25rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{email}</span>
              <button
                type="button"
                onClick={handleReset}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Đổi
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--border-focus)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '8px', padding: '0.6rem 0.85rem',
                marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.82rem',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: isLoading ? '#94a3b8' : 'var(--primary-gradient)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                boxShadow: isLoading ? 'none' : 'var(--shadow-sm)',
              }}
            >
              {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {/* STEP 2B: SELF-SERVICE REGISTER */}
        {step === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} noValidate>
            <div style={{
              fontSize: '0.78rem', color: 'var(--text-secondary)',
              background: '#f8fafc', border: '1px solid var(--neutral-border)',
              padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>Đăng ký tài khoản cho: <strong style={{ color: 'var(--primary)' }}>{email}</strong></span>
              <button
                type="button"
                onClick={handleReset}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Đổi
              </button>
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Họ và tên của bạn *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{
                  position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.6rem 0.85rem 0.6rem 2.4rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--border-focus)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Mật khẩu mới *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.6rem 0.85rem 0.6rem 2.4rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--border-focus)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Xác nhận mật khẩu *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.6rem 0.85rem 0.6rem 2.4rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--border-focus)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '8px', padding: '0.6rem 0.85rem',
                marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.82rem',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                boxShadow: isLoading ? 'none' : 'var(--shadow-sm)',
              }}
            >
              {isLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản & Tiếp tục →'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
