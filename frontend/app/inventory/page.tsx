'use client';

import { useCallback, useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import MedicineTable from '@/app/components/MedicineTable';

interface Medicine {
  id: number;
  name: string;
  price: number;
  stock: number;
  company: string | null;
  expiry_date: string | null;
  batch_number: string | null;
  cost_price: number | null;
  updated_at: string | null;
}

interface MedicineCreateOut extends Medicine {
  receiving_invoice_no: string;
  company_invoice_no: string | null;
  created_at: string;
}

export default function InventoryPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '', price: '', stock: '', company: '', company_invoice_no: '',
    expiry_date: '', batch_number: '', cost_price: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{ invoice_no: string; company_invoice_no: string | null; medicine_name: string } | null>(null);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      setMedicines(await get<Medicine[]>('/medicines'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMedicines(); }, [fetchMedicines]);

  const handleAdd = async () => {
    setFormError('');
    setLastInvoice(null);
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (form.price === '' || Number(form.price) < 0) { setFormError('Valid price is required (≥ 0)'); return; }
    if (form.stock === '' || Number(form.stock) < 0) { setFormError('Valid stock is required (≥ 0)'); return; }
    setFormLoading(true);
    try {
      const res = await post<MedicineCreateOut>('/medicines', {
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        company: form.company.trim() || null,
        company_invoice_no: form.company_invoice_no.trim() || null,
        expiry_date: form.expiry_date || null,
        batch_number: form.batch_number.trim() || null,
        cost_price: form.cost_price !== '' ? Number(form.cost_price) : null,
      });
      setLastInvoice({
        invoice_no: res.receiving_invoice_no,
        company_invoice_no: res.company_invoice_no,
        medicine_name: res.name,
      });
      setForm({ name: '', price: '', stock: '', company: '', company_invoice_no: '', expiry_date: '', batch_number: '', cost_price: '' });
      await fetchMedicines();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to add medicine');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Inventory</h1>

      {/* Data completeness notice */}
      <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: '#854d0e' }}>
        <strong>Note:</strong> Expiry date, batch number, and cost price are new fields. Older records will not have them filled in — please update them manually in the table below as needed.
      </div>

      {/* Add Medicine Form */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Add Medicine</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {/* Required fields */}
          <input
            type="text" placeholder="Name *" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '180px', boxSizing: 'border-box' }}
          />
          <input
            type="number" placeholder="Selling Price *" value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '150px', boxSizing: 'border-box' }}
          />
          <input
            type="number" placeholder="Quantity *" value={form.stock}
            onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '120px', boxSizing: 'border-box' }}
          />
          {/* Optional fields */}
          <input
            type="text" placeholder="Company" value={form.company}
            onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '160px', boxSizing: 'border-box' }}
          />
          <input
            type="number" placeholder="Cost Price" value={form.cost_price}
            onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '130px', boxSizing: 'border-box' }}
          />
          <input
            type="date" placeholder="Expiry Date" value={form.expiry_date}
            onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
            title="Expiry Date"
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '160px', boxSizing: 'border-box' }}
          />
          <input
            type="text" placeholder="Batch Number" value={form.batch_number}
            onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '150px', boxSizing: 'border-box' }}
          />
          <input
            type="text" placeholder="Company Invoice No" value={form.company_invoice_no}
            onChange={e => setForm(f => ({ ...f, company_invoice_no: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', maxWidth: '180px', boxSizing: 'border-box' }}
          />
          <button
            onClick={handleAdd}
            disabled={formLoading}
            style={{ padding: '8px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            {formLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
        {formError && <div style={{ color: '#ef4444', fontSize: '13px' }}>{formError}</div>}

        {lastInvoice && (
          <div style={{ marginTop: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontWeight: 600, color: '#166534', fontSize: '13px', marginBottom: '4px' }}>Medicine added successfully</div>
            <div style={{ fontSize: '13px', color: '#15803d' }}>
              <span>Medicine: <strong>{lastInvoice.medicine_name}</strong></span>
              <span style={{ margin: '0 12px' }}>|</span>
              <span>Receiving Invoice: <strong>{lastInvoice.invoice_no}</strong></span>
              {lastInvoice.company_invoice_no && (
                <><span style={{ margin: '0 12px' }}>|</span>
                <span>Company Invoice: <strong>{lastInvoice.company_invoice_no}</strong></span></>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Medicine Table */}
      {loading ? (
        <div style={{ color: '#64748b' }}>Loading medicines...</div>
      ) : (
        <MedicineTable medicines={medicines} onUpdated={fetchMedicines} />
      )}
    </div>
  );
}
