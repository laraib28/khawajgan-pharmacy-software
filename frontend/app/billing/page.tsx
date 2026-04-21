'use client';

import { useState } from 'react';
import BillingForm from '@/app/components/BillingForm';
import Slip from '@/app/components/Slip';

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

export default function BillingPage() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const handleNewSale = () => setInvoice(null);

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Billing</h1>

      {!invoice ? (
        <BillingForm onSuccess={setInvoice} />
      ) : (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => window.print()}
              className="no-print"
              style={{ padding: '8px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Print Slip
            </button>
            <button
              onClick={handleNewSale}
              className="no-print"
              style={{ padding: '8px 20px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              New Sale
            </button>
          </div>
          <Slip invoice={invoice} />
        </div>
      )}
    </div>
  );
}
