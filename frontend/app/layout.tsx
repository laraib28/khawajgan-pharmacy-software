import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tanzeem-e-Khawajgan Medical Center',
  description: 'Inventory, billing, and stock management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Header with logo and title */}
        <header className="no-print" style={{ background: '#fff', borderBottom: '2px solid #1e40af', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Image src="/logo-khawajgan.png" alt="Logo" width={60} height={60} style={{ objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af' }}>Tanzeem-e-Khawajgan Medical Center</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Pharmacy Management System</div>
          </div>
        </header>
        <nav className="no-print" style={{ padding: '10px 24px', background: '#1e40af', display: 'flex', gap: '24px' }}>
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
