'use client';

import { useEffect, useRef, useState } from 'react';
import { get, postForm } from '@/lib/api';

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  message?: string;
}

interface ReceivingRecord {
  id: number;
  invoice_no: string;
  company_invoice_no: string | null;
  medicine_id: number;
  medicine_name: string;
  quantity: number;
  received_at: string;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const [receivings, setReceivings] = useState<ReceivingRecord[]>([]);
  const [recLoading, setRecLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setReceivings(await get<ReceivingRecord[]>('/receiving'));
      } finally {
        setRecLoading(false);
      }
    })();
  }, [result]); // refresh after import too

  const handleUpload = async () => {
    setError('');
    setResult(null);
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Please select a .xlsx file'); return; }
    if (!file.name.endsWith('.xlsx')) { setError('Only .xlsx files are accepted'); return; }

    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const res = await postForm<ImportResult>('/upload-excel', formData);
      setResult(res);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Import List</h1>

      {/* Excel Import */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', maxWidth: '500px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Import from Excel</h2>
        <p style={{ marginBottom: '12px', color: '#475569', fontSize: '14px' }}>
          Upload an <strong>.xlsx</strong> file with columns: <code>name, price, stock, company</code>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          style={{ marginBottom: '12px', display: 'block' }}
        />
        {error && <div style={{ color: '#ef4444', marginBottom: '8px', fontSize: '13px' }}>{error}</div>}
        <button
          onClick={handleUpload}
          disabled={loading}
          style={{ padding: '10px 24px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {result && (
        <div style={{ marginBottom: '32px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', maxWidth: '500px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Import Result</h2>
          {result.message && <p style={{ color: '#f59e0b', marginBottom: '8px' }}>{result.message}</p>}
          <p style={{ color: '#059669' }}>✓ Inserted: <strong>{result.inserted}</strong></p>
          <p style={{ color: '#64748b' }}>⟲ Skipped (duplicates): <strong>{result.skipped}</strong></p>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ color: '#ef4444', marginBottom: '4px' }}>✗ Rows with errors ({result.errors.length}):</p>
              <ul style={{ fontSize: '13px', paddingLeft: '16px' }}>
                {result.errors.map((e, i) => (
                  <li key={i} style={{ color: '#ef4444' }}>Row {e.row}: {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Receiving History */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Stock Receiving History</h2>
        {recLoading ? (
          <div style={{ color: '#64748b' }}>Loading...</div>
        ) : receivings.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>No receiving records yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Receiving Invoice', 'Company Invoice', 'Medicine', 'Qty', 'Date & Time'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receivings.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e40af' }}>{r.invoice_no}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{r.company_invoice_no ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.medicine_name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.quantity}</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>{formatDateTime(r.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
