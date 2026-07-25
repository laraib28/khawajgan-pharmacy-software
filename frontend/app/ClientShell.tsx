'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', weight: 600 },
  { href: '/billing', label: 'Medicine Billing', weight: 400 },
  { href: '/sales', label: 'Sale Records', weight: 400 },
  { href: '/receiving', label: 'Medicine Receiving', weight: 400 },
  { href: '/inventory', label: 'Inventory', weight: 400 },
  { href: '/import', label: 'Import List', weight: 400 },
  { href: '/reports', label: 'Monthly Report', weight: 400 },
  { href: '/chart-of-accounts', label: 'Chart of Accounts', weight: 400 },
  { href: '/journal-entries', label: 'Journal Entries', weight: 400 },
  { href: '/assistant', label: '🤖 Assistant', weight: 600 },
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
      <nav className="no-print" style={{ padding: '10px 24px', background: '#1e40af', display: 'flex', gap: '24px', alignItems: 'center' }}>
        {NAV_LINKS.map(({ href, label, weight }) => (
          <Link key={href} href={href} style={{ color: '#fff', fontWeight: weight, fontSize: '14px', textDecoration: 'none' }}>
            {label}
          </Link>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user.profile_picture_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profile_picture_url} alt="" width={28} height={28} style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)' }} />
          )}
          <span style={{ color: '#bfdbfe', fontSize: '13px' }}>{user.full_name}</span>
          <button onClick={logout} style={{ padding: '4px 14px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
            Logout
          </button>
        </div>
      </nav>
      <main style={{ padding: '24px' }}>{children}</main>
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
