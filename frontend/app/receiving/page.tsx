'use client';

import { useCallback, useEffect, useState } from 'react';
import { get, post } from '@/lib/api';

interface Medicine {
  id: number;
  name: string;
  price: number;
  stock: number;
  company: string | null;
}

interface StockReceiving {
  id: number;
  invoice_no: string;
  company_invoice_no: string | null;
  medicine_id: number;
  medicine_name: string;
  quantity: number;
  received_at: string;
}

const PAK_TZ = 'Asia/Karachi';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { timeZone: PAK_TZ, dateStyle: 'medium', timeStyle: 'short' });
}

export default function ReceivingPage() {
  const [receivings, setReceivings] = useState<StockReceiving[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ medicine_id: '', quantity: '', company_invoice_no: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [lastReceiving, setLastReceiving] = useState<StockReceiving | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        get<StockReceiving[]>('/receiving'),
        get<Medicine[]>('/medicines'),
      ]);
      setReceivings(r);
      setMedicines(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRestock = async () => {
    setFormError('');
    setLastReceiving(null);
    if (!form.medicine_id) { setFormError('Medicine select karein'); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setFormError('Quantity 1 ya zyada honi chahiye'); return; }
    setFormLoading(true);
    try {
      const res = await post<StockReceiving>('/receiving', {
        medicine_id: Number(form.medicine_id),
        quantity: Number(form.quantity),
        company_invoice_no: form.company_invoice_no.trim() || null,
      });
      setLastReceiving(res);
      setForm({ medicine_id: '', quantity: '', company_invoice_no: '' });
      await fetchData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Restock failed');
    } finally {
      setFormLoading(false);
    }
  };

  const selectedMedicine = medicines.find(m => m.id === Number(form.medicine_id));

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Medicine Receiving</h1>

      {/* Restock Form */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Stock Receive Karein (Restock)</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
          <select
            value={form.medicine_id}
            onChange={e => setForm(f => ({ ...f, medicine_id: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: '220px' }}
          >
            <option value="">Medicine select karein *</option>
            {medicines.map(m => (
              <option key={m.id} value={m.id}>{m.name} (Stock: {m.stock})</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Quantity *"
            min={1}
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '120px' }}
          />
          <input
            type="text"
            placeholder="Company Invoice No"
            value={form.company_invoice_no}
            onChange={e => setForm(f => ({ ...f, company_invoice_no: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '180px' }}
          />
          <button
            onClick={handleRestock}
            disabled={formLoading}
            style={{ padding: '8px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            {formLoading ? 'Saving...' : 'Receive Stock'}
          </button>
        </div>
        {selectedMedicine && (
          <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
            Current stock: <strong>{selectedMedicine.stock}</strong> | Price: <strong>Rs. {Number(selectedMedicine.price).toFixed(2)}</strong>
            {selectedMedicine.company && <> | Company: <strong>{selectedMedicine.company}</strong></>}
          </div>
        )}
        {formError && <div style={{ color: '#ef4444', fontSize: '13px' }}>{formError}</div>}

        {lastReceiving && (
          <div style={{ marginTop: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontWeight: 600, color: '#166534', fontSize: '13px', marginBottom: '4px' }}>Stock successfully received!</div>
            <div style={{ fontSize: '13px', color: '#15803d' }}>
              <span>Medicine: <strong>{lastReceiving.medicine_name}</strong></span>
              <span style={{ margin: '0 12px' }}>|</span>
              <span>Qty: <strong>+{lastReceiving.quantity}</strong></span>
              <span style={{ margin: '0 12px' }}>|</span>
              <span>Invoice: <strong>{lastReceiving.invoice_no}</strong></span>
              {lastReceiving.company_invoice_no && (
                <><span style={{ margin: '0 12px' }}>|</span>
                <span>Company Invoice: <strong>{lastReceiving.company_invoice_no}</strong></span></>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Receivings History */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Receiving History</h2>
        {loading ? (
          <div style={{ color: '#64748b' }}>Loading...</div>
        ) : receivings.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '16px', textAlign: 'center' }}>Koi receiving record nahi mila</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#e2e8f0' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Invoice No</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Company Invoice</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Medicine</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {receivings.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{r.invoice_no}</td>
                  <td style={{ padding: '8px', color: '#64748b' }}>{r.company_invoice_no ?? '—'}</td>
                  <td style={{ padding: '8px', fontWeight: 500 }}>{r.medicine_name}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>+{r.quantity}</td>
                  <td style={{ padding: '8px', fontSize: '12px', color: '#64748b' }}>{formatDate(r.received_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
