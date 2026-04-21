'use client';

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

interface SlipProps {
  invoice: Invoice;
}

// Slip component — 300px thermal receipt layout.
// IMPORTANT: stock values are NEVER rendered here (constitution Principle I + VI).
export default function Slip({ invoice }: SlipProps) {
  if (!invoice) return null;

  const pharmacyName = process.env.NEXT_PUBLIC_PHARMACY_NAME ?? 'Khawajgan Pharmacy';

  let date = '';
  try {
    const d = new Date(invoice.created_at);
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    date = isNaN(d.getTime())
      ? String(invoice.created_at)
      : `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    date = String(invoice.created_at ?? '');
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div className="slip" style={{
      width: '300px',
      fontFamily: 'monospace',
      fontSize: '12px',
      border: '1px solid #ccc',
      padding: '12px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
        {pharmacyName}
      </div>
      <div style={{ textAlign: 'center', fontSize: '11px', marginBottom: '8px' }}>
        Sale #{invoice.sale_id} | {date}
      </div>
      <hr style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />

      {/* Patient */}
      <div style={{ marginBottom: '6px' }}>
        Patient: <strong>{invoice.patient_name}</strong>
      </div>
      <hr style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />

      {/* Items table — stock is explicitly excluded */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Item</th>
            <th style={{ textAlign: 'center' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'left' }}>{item.name ?? ''}</td>
              <td style={{ textAlign: 'center' }}>{item.quantity ?? 0}</td>
              <td style={{ textAlign: 'right' }}>{Number(item.price || 0).toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>{Number(item.amount || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <span>Net Payable:</span>
        <span>{Number(invoice.total_amount || 0).toFixed(2)}</span>
      </div>
      <hr style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px' }}>
        Refund within 7 days
      </div>
    </div>
  );
}
