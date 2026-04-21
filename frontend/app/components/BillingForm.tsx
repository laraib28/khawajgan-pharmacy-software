'use client';

import { useEffect, useReducer, useState } from 'react';
import { get, post } from '@/lib/api';

interface Medicine {
  id: number;
  name: string;
  price: number;
  stock: number;
  company: string | null;
}

interface LineItem {
  medicineId: number;
  medicineName: string;
  quantity: number;
  price: number;
}

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  amount: number;
}

interface Invoice {
  sale_id: number;
  patient_name: string;
  created_at: string;
  items: InvoiceItem[];
  total_amount: number;
}

interface BillingState {
  patientName: string;
  items: LineItem[];
}

type Action =
  | { type: 'SET_PATIENT'; value: string }
  | { type: 'ADD_ITEM' }
  | { type: 'UPDATE_MEDICINE'; idx: number; medicine: Medicine }
  | { type: 'UPDATE_QTY'; idx: number; quantity: number }
  | { type: 'REMOVE_ITEM'; idx: number };

function reducer(state: BillingState, action: Action): BillingState {
  switch (action.type) {
    case 'SET_PATIENT':
      return { ...state, patientName: action.value };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, { medicineId: 0, medicineName: '', quantity: 1, price: 0 }] };
    case 'UPDATE_MEDICINE': {
      const items = [...state.items];
      items[action.idx] = { ...items[action.idx], medicineId: action.medicine.id, medicineName: action.medicine.name, price: action.medicine.price };
      return { ...state, items };
    }
    case 'UPDATE_QTY': {
      const items = [...state.items];
      items[action.idx] = { ...items[action.idx], quantity: action.quantity };
      return { ...state, items };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((_, i) => i !== action.idx) };
  }
}

interface BillingFormProps {
  onSuccess: (invoice: Invoice) => void;
}

export default function BillingForm({ onSuccess }: BillingFormProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [state, dispatch] = useReducer(reducer, { patientName: '', items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Medicine[]>('/medicines')
      .then(data => {
        console.log('Medicines loaded:', data.length);
        setMedicines(data);
      })
      .catch(err => {
        console.error('Failed to load medicines:', err);
      });
  }, []);

  // UI-only display total (backend is authoritative)
  const displayTotal = state.items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);

  const handleSubmit = async () => {
    setError('');
    if (!state.patientName.trim()) { setError('Patient name is required'); return; }
    if (state.items.length === 0) { setError('Add at least one medicine'); return; }
    if (state.items.some(it => it.medicineId === 0)) { setError('Select a medicine for each row'); return; }

    setLoading(true);
    try {
      const invoice = await post<Invoice>('/sale', {
        patient_name: state.patientName,
        items: state.items.map(it => ({ medicine_id: it.medicineId, quantity: it.quantity })),
      });
      onSuccess(invoice);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sale failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Patient Name</label>
        <input
          value={state.patientName}
          onChange={e => dispatch({ type: 'SET_PATIENT', value: e.target.value })}
          placeholder="Enter patient name"
          style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '300px' }}
        />
      </div>

      {state.items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <select
            value={item.medicineId}
            onChange={e => {
              const med = medicines.find(m => m.id === Number(e.target.value));
              if (med) dispatch({ type: 'UPDATE_MEDICINE', idx, medicine: med });
            }}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          >
            <option value={0}>-- Select Medicine --</option>
            {medicines.map(m => (
              <option key={m.id} value={m.id} disabled={m.stock === 0}>
                {m.name} — Stock: {m.stock}{m.stock === 0 ? ' (out)' : ''}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={e => dispatch({ type: 'UPDATE_QTY', idx, quantity: Number(e.target.value) })}
            style={{ width: '70px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          />
          <span style={{ minWidth: '80px' }}>Rs. {(Number(item.price) * item.quantity).toFixed(2)}</span>
          <button onClick={() => dispatch({ type: 'REMOVE_ITEM', idx })} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      ))}

      <button
        onClick={() => dispatch({ type: 'ADD_ITEM' })}
        style={{ marginBottom: '12px', padding: '6px 12px', border: '1px dashed #94a3b8', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
      >
        + Add Medicine
      </button>

      {state.items.length > 0 && (
        <div style={{ marginBottom: '12px', fontWeight: 600 }}>
          Display Total: Rs. {displayTotal.toFixed(2)} <span style={{ fontWeight: 400, fontSize: '12px', color: '#64748b' }}>(backend-verified on submit)</span>
        </div>
      )}

      {error && (
        <div style={{
          color: '#fff',
          background: '#dc2626',
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '10px',
          fontWeight: 600,
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ padding: '10px 24px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
      >
        {loading ? 'Processing...' : 'Generate Slip'}
      </button>
    </div>
  );
}
