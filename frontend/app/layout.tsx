import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pharmacy Management System',
  description: 'Inventory, billing, and stock management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="no-print" style={{ padding: '12px 24px', background: '#1e40af', display: 'flex', gap: '24px' }}>
          <Link href="/" style={{ color: '#fff', fontWeight: 600 }}>Dashboard</Link>
          <Link href="/billing" style={{ color: '#fff' }}>Medicine Receiving</Link>
          <Link href="/inventory" style={{ color: '#fff' }}>Inventory</Link>
          <Link href="/import" style={{ color: '#fff' }}>Import List</Link>
          <Link href="/reports" style={{ color: '#fff' }}>Monthly Report</Link>
        </nav>
        <main style={{ padding: '24px' }}>{children}</main>
      </body>
    </html>
  );
}
