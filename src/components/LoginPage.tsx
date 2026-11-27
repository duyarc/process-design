import React, { useState, useEffect, useRef } from 'react';
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

  // Keep Google Sign-In button aligned with input/CTA width across viewports
  const googleBtnWrapperRef = useRef<HTMLDivElement>(null);
  const [googleBtnWidth, setGoogleBtnWidth] = useState<number>(340);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qPage = params.get('page');
    const qProcessId = params.get('processId');
    const qFormName = params.get('formName');

    if (qPage === 'fill' && qProcessId && qFormName) {
      setFillContext({ processId: qProcessId, formName: qFormName });
    }
  }, []);

  useEffect(() => {
    const el = googleBtnWrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateWidth = (rawWidth: number) => {
      const clamped = Math.max(240, Math.min(340, Math.floor(rawWidth)));
      setGoogleBtnWidth((prev) => (prev === clamped ? prev : clamped));
    };

    updateWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [step]);

  // Step 1: Check Email
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = email.trim().toLowerCase();
    if (!clean) {
      setError('Please enter your email address or username.');
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
        throw new Error(data.error || 'Unable to verify account.');
      }

      if (data.exists) {
        setExistingUserFullName(data.full_name);
        setStep('LOGIN');
      } else {
        if (!clean.includes('@')) {
          setError('New accounts require a valid email address (e.g. name@company.com).');
          setIsLoading(false);
          return;
        }
        setStep('REGISTER');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to connect to the server.';
      setError(message || 'Unable to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2A: Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const err = await login(email.trim(), password);
      if (err) setError(err);
    } catch {
      setError('Sign-in failed. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2B: Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const err = await register(email.trim().toLowerCase(), fullName.trim(), password);
      if (err) setError(err);
    } catch {
      setError('Account creation failed. Please check your connection.');
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
    <div className="signin-page">
      <div className="signin-shell">
        <div className="signin-brand">
          <BookOpen size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>Process Design</span>
        </div>

        <figure className="signin-principle">
          <blockquote>
            “We believe <strong>common sense</strong> and <strong>simplicity</strong> are usually better guidelines than unnecessary sophistication and complexity.”
          </blockquote>
          <figcaption>
            — AB InBev’s 7<sup>th</sup> principle
          </figcaption>
        </figure>

        <div className="signin-card">
          {step === 'EMAIL' && (
            <h1 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Sign in
            </h1>
          )}

          {step === 'LOGIN' && (
            <>
              <button type="button" className="signin-back-btn" onClick={handleReset}>
                <ArrowLeft size={14} /> Back
              </button>
              <h1 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Welcome back{existingUserFullName ? `, ${existingUserFullName}` : ''}
              </h1>
            </>
          )}

          {step === 'REGISTER' && (
            <>
              <button type="button" className="signin-back-btn" onClick={handleReset}>
                <ArrowLeft size={14} /> Back
              </button>
              <h1 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Create account
              </h1>
            </>
          )}

          {/* Form Link Notice Banner (If accessing via share link) */}
          {fillContext && (
            <div style={{
              background: 'var(--neutral-bg)',
              border: '1px solid var(--neutral-border)',
              borderLeft: '2px solid var(--primary)',
              borderRadius: '6px',
              padding: '0.6rem 0.8rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.8rem',
              color: 'var(--text-primary)'
            }}>
              <FileText size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>Form invitation</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {fillContext.formName} ({fillContext.processId})
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: EMAIL ENTRY */}
          {step === 'EMAIL' && (
            <form onSubmit={handleCheckEmail} noValidate>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="login-email"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}
                >
                  Email or username
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{
                    position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="login-email"
                    className="signin-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '6px', padding: '0.55rem 0.75rem',
                  marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.8rem',
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              <button
                id="login-continue"
                className="signin-primary-btn"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Checking...' : 'Continue'}
              </button>

              {/* Hairline separator */}
              <div style={{
                display: 'flex', alignItems: 'center', margin: '1.15rem 0',
                fontSize: '0.75rem', color: 'var(--text-muted)',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--neutral-border)' }}></div>
                <span style={{ padding: '0 0.75rem' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--neutral-border)' }}></div>
              </div>

              {/* Google Login button */}
              <div
                ref={googleBtnWrapperRef}
                style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
                id="login-google-btn"
              >
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    if (credentialResponse.credential) {
                      setIsLoading(true);
                      setError(null);
                      try {
                        const err = await loginWithGoogle(credentialResponse.credential);
                        if (err) setError(err);
                      } catch {
                        setError('Google sign-in failed.');
                      } finally {
                        setIsLoading(false);
                      }
                    }
                  }}
                  onError={() => {
                    setError('Google authentication failed.');
                  }}
                  theme="outline"
                  shape="rectangular"
                  size="large"
                  text="signin_with"
                  width={String(googleBtnWidth)}
                />
              </div>
            </form>
          )}

          {/* STEP 2A: LOGIN WITH PASSWORD */}
          {step === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} noValidate>
              <div style={{
                fontSize: '0.8rem', color: 'var(--text-secondary)',
                background: 'var(--neutral-bg)', border: '1px solid var(--neutral-border)',
                padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem'
              }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email}
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
                >
                  Change
                </button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="login-password"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="login-password"
                    className="signin-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '6px', padding: '0.55rem 0.75rem',
                  marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.8rem',
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              <button
                id="login-submit"
                className="signin-primary-btn"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}

          {/* STEP 2B: SELF-SERVICE REGISTER */}
          {step === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} noValidate>
              <div style={{
                fontSize: '0.78rem', color: 'var(--text-secondary)',
                background: 'var(--neutral-bg)', border: '1px solid var(--neutral-border)',
                padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem'
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Creating account for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
                >
                  Change
                </button>
              </div>

              {/* Full Name */}
              <div style={{ marginBottom: '0.9rem' }}>
                <label
                  htmlFor="register-fullname"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Full name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{
                    position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="register-fullname"
                    className="signin-input"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Nguyen"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '0.9rem' }}>
                <label
                  htmlFor="register-password"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="register-password"
                    className="signin-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label
                  htmlFor="register-confirm-password"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Confirm password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="register-confirm-password"
                    className="signin-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '6px', padding: '0.55rem 0.75rem',
                  marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.8rem',
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              <button
                id="register-submit"
                className="signin-primary-btn"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
