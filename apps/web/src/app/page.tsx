'use client';

import { AlertCircle, Check, Lock, LogIn, Mail, Sparkles, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authApi } from '../lib/api-client';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@buildora.app');
  const [password, setPassword] = useState('Buildora123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!isPasswordValid) {
          setError('Password does not meet the security requirements.');
          setLoading(false);
          return;
        }
        await authApi.register({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        });
      } else {
        await authApi.login({
          email: email.trim(),
          password,
        });
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('buildora-entered', 'yes');
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      setLoading(false);
    }
  };

  const handleDemoFallback = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('buildora-entered', 'yes');
    }
    router.push('/dashboard');
  };

  return (
    <div className="login">
      <section className="login-art">
        <div className="brand">
          <span className="brand-mark">B</span> Buildora
        </div>
        <div>
          <span className="eyebrow" style={{ color: '#d9ff79' }}>
            AI-powered. Human-approved.
          </span>
          <h1>Your website, without the usual headache.</h1>
          <p>
            Create pages, publish stories, manage media and get a little help from AI—all from one
            calm workspace.
          </p>
        </div>
        <small style={{ color: '#9bb9af' }}>Built for the hackathon. Ready for the demo.</small>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 26, margin: '0 0 6px' }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p style={{ margin: 0, fontSize: 14 }}>
              {mode === 'login'
                ? 'Sign in with your API credentials or jump into the demo.'
                : 'Register a new account on the Buildora backend.'}
            </p>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 10,
                background: '#fff3f3',
                border: '1px solid #f8d7da',
                color: '#842029',
                fontSize: 13,
                marginBottom: 18,
                lineHeight: 1.5,
              }}
            >
              <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Authentication error:</strong> {error}
                <div style={{ marginTop: 4, fontSize: 12, color: '#a03b44' }}>
                  If the API is offline or database is unconfigured, you can still use the local
                  demo mode below.
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            {mode === 'register' && (
              <div className="field">
                <label htmlFor="name">Full Name (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    id="name"
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ paddingLeft: 34 }}
                  />
                  <User
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#889892',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: 34 }}
                />
                <Mail
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#889892',
                  }}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: 34 }}
                />
                <Lock
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#889892',
                  }}
                />
              </div>
            </div>

            {mode === 'register' && (
              <div
                style={{
                  background: '#f8faf9',
                  border: '1px solid #e4eae7',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 16,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: '#435850',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Password requirements:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                  <span
                    style={{
                      color: hasLength ? '#1e7b57' : '#889892',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Check size={12} style={{ opacity: hasLength ? 1 : 0.3 }} /> 8+ characters
                  </span>
                  <span
                    style={{
                      color: hasUpper ? '#1e7b57' : '#889892',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Check size={12} style={{ opacity: hasUpper ? 1 : 0.3 }} /> 1 uppercase
                  </span>
                  <span
                    style={{
                      color: hasLower ? '#1e7b57' : '#889892',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Check size={12} style={{ opacity: hasLower ? 1 : 0.3 }} /> 1 lowercase
                  </span>
                  <span
                    style={{
                      color: hasNumber ? '#1e7b57' : '#889892',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Check size={12} style={{ opacity: hasNumber ? 1 : 0.3 }} /> 1 number
                  </span>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary btn-wide"
              type="submit"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              <LogIn size={15} />
              <span>
                {loading
                  ? 'Connecting...'
                  : mode === 'login'
                    ? 'Sign in with API'
                    : 'Create account'}
              </span>
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === 'login' ? 'register' : 'login');
              }}
              style={{
                background: 'transparent',
                border: 0,
                fontSize: 13,
                fontWeight: 600,
                color: '#286b55',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {mode === 'login'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '20px 0 16px',
              color: '#889892',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#e4eae7' }} />
            <span style={{ padding: '0 12px' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e4eae7' }} />
          </div>

          <button
            type="button"
            className="btn btn-soft btn-wide"
            onClick={handleDemoFallback}
            style={{ justifyContent: 'center' }}
          >
            <Sparkles size={15} />
            <span>Open demo dashboard</span>
          </button>

          <small
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 10,
              color: '#7b8984',
              fontSize: 12,
            }}
          >
            Instant local browser demo • No server required
          </small>
        </div>
      </section>
    </div>
  );
}
