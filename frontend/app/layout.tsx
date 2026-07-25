import type { Metadata } from 'next';
import Image from 'next/image';
import './globals.css';
import ClientShell from './ClientShell';

export const metadata: Metadata = {
  title: 'Tanzeem-e-Khawajgan Medical Center',
  description: 'Inventory, billing, and stock management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="no-print" style={{ background: '#fff', borderBottom: '2px solid #1e40af', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Image src="/logo-khawajgan.png" alt="Logo" width={60} height={60} style={{ objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af' }}>Tanzeem-e-Khawajgan Medical Center</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Pharmacy Management System</div>
          </div>
        </header>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
