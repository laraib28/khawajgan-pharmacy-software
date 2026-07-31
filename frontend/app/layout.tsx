import type { Metadata } from 'next';
import './globals.css';
import ClientShell from './ClientShell';

export const metadata: Metadata = {
  title: 'PharmaCare',
  description: 'Inventory, billing, and stock management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <header className="no-print" style={{ background: '#fff', borderBottom: '2px solid #1e40af', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'clamp(16px, 3vw, 22px)', fontWeight: 700, color: '#1e40af' }}>PharmaCare</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Pharmacy Management System</div>
          </div>
        </header>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
