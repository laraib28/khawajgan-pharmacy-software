'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';

interface SaleItem {
  medicine_name: string;
  quantity: number;
  price: number;
  amount: number;
}

interface Sale {
  sale_id: number;
  patient_name: string;
  created_at: string;
  items: SaleItem[];
  total_amount: number;
}

const PAK_TZ = 'Asia/Karachi';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    timeZone: PAK_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    get<Sale[]>('/sales')
      .then(setSales)
      .catch(() => setError('Sales load karne mein masla aaya'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = sales.filter(
    s =>
      s.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      String(s.sale_id).includes(search)
  );

  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.total_amount), 0);

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Sale Records</h1>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 20px', minWidth: '160px' }}>
          <div style={{ fontSize: '12px', color: '#1e40af' }}>Total Sales</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e3a8a' }}>{filtered.length}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 20px', minWidth: '160px' }}>
          <div style={{ fontSize: '12px', color: '#166534' }}>Total Revenue</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#14532d' }}>Rs. {totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Patient name ya sale ID se search karein..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '320px', fontSize: '14px' }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#64748b' }}>Loading...</div>
      ) : error ? (
        <div style={{ color: '#ef4444' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#94a3b8', padding: '24px', textAlign: 'center' }}>Koi sale record nahi mila</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#e2e8f0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', width: '40px' }}></th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Sale ID</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Patient</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Items</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sale => (
                <>
                  <tr
                    key={sale.sale_id}
                    onClick={() => setExpanded(expanded === sale.sale_id ? null : sale.sale_id)}
                    style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: expanded === sale.sale_id ? '#f8fafc' : '#fff' }}
                  >
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>
                      {expanded === sale.sale_id ? '▲' : '▼'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#475569' }}>#{sale.sale_id}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{sale.patient_name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{sale.items.length}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      Rs. {Number(sale.total_amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>{formatDate(sale.created_at)}</td>
                  </tr>
                  {expanded === sale.sale_id && (
                    <tr key={`detail-${sale.sale_id}`} style={{ background: '#f8fafc' }}>
                      <td colSpan={6} style={{ padding: '0 12px 12px 40px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Medicine</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Qty</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Price</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((item, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 8px' }}>{item.medicine_name}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.quantity}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>Rs. {Number(item.price).toFixed(2)}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Rs. {Number(item.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
