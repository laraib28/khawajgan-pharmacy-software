'use client';

import { useState } from 'react';
import { get } from '@/lib/api';

interface MonthlyRow {
  medicine_id: number;
  medicine_name: string;
  current_stock: number;
  received_qty: number;
  sold_qty: number;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<MonthlyRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get<MonthlyRow[]>(`/reports/monthly?year=${year}&month=${month}`);
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const totalReceived = rows?.reduce((s, r) => s + r.received_qty, 0) ?? 0;
  const totalSold = rows?.reduce((s, r) => s + r.sold_qty, 0) ?? 0;

  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Monthly Inventory Report</h2>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Year</label>
          <input
            type="number"
            value={year}
            min={2020}
            max={2100}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Month</label>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '140px' }}
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          style={{ padding: '9px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
        >
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: '16px' }}>{error}</div>}

      {rows !== null && (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px 24px', minWidth: '160px' }}>
              <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>Total Received</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e3a8a' }}>{totalReceived}</div>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px 24px', minWidth: '160px' }}>
              <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 600 }}>Total Sold</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#14532d' }}>{totalSold}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 24px', minWidth: '160px' }}>
              <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Report Period</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{MONTH_NAMES[month]} {year}</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#e2e8f0' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Medicine Name</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Received (this month)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Sold (this month)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.medicine_id}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    background: r.current_stock === 0 ? '#fee2e2' : r.current_stock <= 10 ? '#fef3c7' : undefined,
                  }}
                >
                  <td style={{ padding: '8px' }}>{r.medicine_name}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: r.received_qty > 0 ? '#1d4ed8' : '#94a3b8' }}>
                    {r.received_qty > 0 ? `+${r.received_qty}` : '—'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: r.sold_qty > 0 ? '#15803d' : '#94a3b8' }}>
                    {r.sold_qty > 0 ? r.sold_qty : '—'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                    {r.current_stock === 0
                      ? <span style={{ color: '#dc2626', fontSize: '12px', background: '#fecaca', padding: '2px 8px', borderRadius: '12px' }}>Out of Stock</span>
                      : r.current_stock}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No data found</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
