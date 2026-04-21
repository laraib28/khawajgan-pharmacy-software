'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import StatsCard from '@/app/components/StatsCard';

interface Medicine {
  id: number;
  name: string;
  price: number;
  stock: number;
  company: string | null;
}

interface DashboardStats {
  total_medicines: number;
  total_sales: number;
  total_stock: number;
  low_stock_medicines: Medicine[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get<DashboardStats>('/dashboard/stats')
      .then(setStats)
      .catch(() => setError('Failed to load dashboard stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#64748b' }}>Loading dashboard...</div>;
  if (error) return <div style={{ color: '#ef4444' }}>{error}</div>;
  if (!stats) return null;

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Dashboard</h1>

      {/* Stat Tiles */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <StatsCard label="Total Medicines" value={stats.total_medicines} />
        <StatsCard label="Total Sales" value={stats.total_sales} />
        <StatsCard label="Remaining Stock (units)" value={stats.total_stock} />
      </div>

      {/* Low-stock alerts */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>
          Low Stock Alerts <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '13px' }}>(stock ≤ 10)</span>
        </h2>
        {stats.low_stock_medicines.length === 0 ? (
          <p style={{ color: '#059669' }}>✓ All medicines are well-stocked.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#fef3c7' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '8px 16px', textAlign: 'right' }}>Stock</th>
                <th style={{ padding: '8px 16px', textAlign: 'left' }}>Company</th>
              </tr>
            </thead>
            <tbody>
              {stats.low_stock_medicines.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #fde68a', background: '#fffbeb' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 600, color: '#92400e' }}>{m.name}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{m.stock}</td>
                  <td style={{ padding: '8px 16px', color: '#78350f' }}>{m.company ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
