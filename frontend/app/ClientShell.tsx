'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import VoiceAssistant from '@/app/components/VoiceAssistant';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', weight: 600 },
  { href: '/billing', label: 'Billing', weight: 400 },
  { href: '/sales', label: 'Sales', weight: 400 },
  { href: '/receiving', label: 'Receiving', weight: 400 },
  { href: '/inventory', label: 'Inventory', weight: 400 },
  { href: '/import', label: 'Import', weight: 400 },
  { href: '/reports', label: 'Reports', weight: 400 },
  { href: '/chart-of-accounts', label: 'Accounts', weight: 400 },
  { href: '/journal-entries', label: 'Journal', weight: 400 },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) router.replace('/login');
    if (user && isLoginPage) router.replace('/');
  }, [loading, user, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '14px' }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      <nav className="no-print" style={{ background: '#1e40af', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '8px 12px', minWidth: 'max-content' }}>
          {NAV_LINKS.map(({ href, label, weight }) => (
            <Link
              key={href}
              href={href}
              style={{
                color: pathname === href ? '#fff' : '#bfdbfe',
                fontWeight: pathname === href ? 700 : weight,
                fontSize: '13px',
                textDecoration: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                background: pathname === href ? 'rgba(255,255,255,0.15)' : 'transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Link>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
            {user.profile_picture_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profile_picture_url} alt="" width={26} height={26} style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', flexShrink: 0 }} />
            )}
            <span style={{ color: '#bfdbfe', fontSize: '12px', whiteSpace: 'nowrap' }}>{user.full_name}</span>
            <button onClick={logout} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main style={{ padding: 'clamp(12px, 3vw, 24px)' }}>{children}</main>
      <VoiceAssistant />
    </>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
