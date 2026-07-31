'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? 'Login failed. Check your email and password.');
        return;
      }
      await refreshUser();
      router.replace('/');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: '380px', background: '#fff', borderRadius: '12px', padding: '36px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '4px', textAlign: 'center' }}>Sign in</h1>
        <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginBottom: '28px' }}>
          PharmaCare
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Email</label>
            <input
              type="email" value={form.email} required autoComplete="email"
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Password</label>
            <input
              type="password" value={form.password} required autoComplete="current-password"
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: '13px', background: '#fff1f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecdd3' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ padding: '11px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '4px' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e2e8f0' }} />
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e2e8f0' }} />
        </div>

        <a href="/api/auth/google/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '11px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
