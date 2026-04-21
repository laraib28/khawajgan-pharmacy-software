'use client';

import { useState } from 'react';
import { put } from '@/lib/api';

interface Medicine {
  id: number;
  name: string;
  price: number;
  stock: number;
  company: string | null;
}

interface MedicineTableProps {
  medicines: Medicine[];
  onUpdated: () => void;
}

export default function MedicineTable({ medicines, onUpdated }: MedicineTableProps) {
  const [editId, setEditId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

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
            <th style={{ padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(m => (
            <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0', background: m.stock <= 10 ? '#fef3c7' : undefined }}>
              <td style={{ padding: '8px' }}>{m.name}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                {editId === m.id
                  ? <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ width: '80px', padding: '4px' }} />
                  : `Rs. ${Number(m.price).toFixed(2)}`}
              </td>
              <td style={{ padding: '8px', textAlign: 'right' }}>
                {editId === m.id
                  ? <input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} style={{ width: '70px', padding: '4px' }} />
                  : m.stock}
              </td>
              <td style={{ padding: '8px' }}>{m.company ?? '—'}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>
                {editId === m.id
                  ? <><button onClick={saveEdit} style={{ marginRight: '6px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                     <button onClick={() => setEditId(null)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button></>
                  : <button onClick={() => startEdit(m)} style={{ color: '#1e40af', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No medicines found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
