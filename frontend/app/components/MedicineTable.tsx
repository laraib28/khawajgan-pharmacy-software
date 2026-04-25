'use client';

import { useState } from 'react';
import { put, del, get } from '@/lib/api';

interface Medicine {
  id: number;
  name: string;
  price: number;
  stock: number;
  company: string | null;
  updated_at: string | null;
}

interface InventoryLog {
  id: number;
  medicine_name: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  changed_at: string;
}

interface MedicineTableProps {
  medicines: Medicine[];
  onUpdated: () => void;
}

const PAK_TZ = 'Asia/Karachi';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PK', { timeZone: PAK_TZ, dateStyle: 'medium', timeStyle: 'short' });
}

export default function MedicineTable({ medicines, onUpdated }: MedicineTableProps) {
  const [editId, setEditId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [historyMedicine, setHistoryMedicine] = useState<Medicine | null>(null);
  const [historyLogs, setHistoryLogs] = useState<InventoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (m: Medicine) => {
    setEditId(m.id);
    setEditPrice(String(m.price));
    setEditStock(String(m.stock));
    setError('');
  };

  const saveEdit = async () => {
    if (!editId) return;
    setError('');
    try {
      await put(`/medicines/${editId}`, {
        price: editPrice !== '' ? Number(editPrice) : undefined,
        stock: editStock !== '' ? Number(editStock) : undefined,
      });
      setEditId(null);
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const openHistory = async (m: Medicine) => {
    setHistoryMedicine(m);
    setHistoryLoading(true);
    setHistoryLogs([]);
    try {
      const logs = await get<InventoryLog[]>(`/medicines/${m.id}/history`);
      setHistoryLogs(logs);
    } finally {
      setHistoryLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleteError('');
    try {
      await del(`/medicines/${deleteConfirmId}`);
      setDeleteConfirmId(null);
      onUpdated();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div>
      <input
        placeholder="Search by name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginBottom: '12px', width: '280px' }}
      />
      {error && <div style={{ color: '#ef4444', marginBottom: '8px' }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#e2e8f0' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Price</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Stock</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Company</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Last Updated</th>
            <th style={{ padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(m => (
            <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0', background: m.stock === 0 ? '#fee2e2' : m.stock <= 10 ? '#fef3c7' : undefined }}>
              <td style={{ padding: '8px' }}>{m.name}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                {editId === m.id
                  ? <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ width: '80px', padding: '4px' }} />
                  : `Rs. ${Number(m.price).toFixed(2)}`}
              </td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                {editId === m.id
                  ? <input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} style={{ width: '70px', padding: '4px' }} />
                  : m.stock === 0
                    ? <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px', background: '#fecaca', padding: '2px 8px', borderRadius: '12px' }}>Out of Stock</span>
                    : m.stock}
              </td>
              <td style={{ padding: '8px' }}>{m.company ?? '—'}</td>
              <td style={{ padding: '8px', fontSize: '12px', color: '#64748b' }}>{formatDate(m.updated_at)}</td>
              <td style={{ padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {editId === m.id ? (
                  <>
                    <button onClick={saveEdit} style={{ marginRight: '6px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                    <button onClick={() => setEditId(null)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(m)} style={{ color: '#1e40af', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                    <button onClick={() => openHistory(m)} style={{ color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}>History</button>
                    <button onClick={() => { setDeleteConfirmId(m.id); setDeleteError(''); }} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No medicines found</td></tr>
          )}
        </tbody>
      </table>

      {/* History Modal */}
      {historyMedicine && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', minWidth: '500px', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Update History — {historyMedicine.name}</h3>
              <button onClick={() => setHistoryMedicine(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            {historyLoading ? (
              <p style={{ color: '#64748b' }}>Loading...</p>
            ) : historyLogs.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No changes recorded yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Field</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Old Value</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>New Value</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Changed At</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', fontWeight: 600, textTransform: 'capitalize' }}>{log.field_changed}</td>
                      <td style={{ padding: '8px', color: '#ef4444' }}>{log.field_changed === 'price' ? `Rs. ${Number(log.old_value).toFixed(2)}` : log.old_value}</td>
                      <td style={{ padding: '8px', color: '#059669' }}>{log.field_changed === 'price' ? `Rs. ${Number(log.new_value).toFixed(2)}` : log.new_value}</td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{formatDate(log.changed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', maxWidth: '400px', width: '90vw' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>Delete Medicine</h3>
            <p style={{ margin: '0 0 16px', color: '#374151' }}>
              Are you sure you want to delete <strong>{medicines.find(m => m.id === deleteConfirmId)?.name}</strong>? This cannot be undone.
            </p>
            {deleteError && <p style={{ color: '#dc2626', marginBottom: '12px', fontSize: '13px' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteConfirmId(null); setDeleteError(''); }} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
