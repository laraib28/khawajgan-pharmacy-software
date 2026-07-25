'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AccountNode,
  JournalEntryCreate,
  JournalEntryLineCreate,
  JournalEntryOut,
  createJournalEntry,
  deleteJournalEntry,
  getAccounts,
  listJournalEntries,
  reverseJournalEntry,
} from '@/lib/api';

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };

function fmt(v: string | number) {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sourceLabel(t: string) {
  if (t === 'billing') return { label: 'Sale', color: '#15803d', bg: '#f0fdf4', border: '#86efac' };
  if (t === 'receiving') return { label: 'Receiving', color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' };
  return { label: 'Manual', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' };
}

function flattenAccounts(nodes: AccountNode[]): AccountNode[] {
  const out: AccountNode[] = [];
  function walk(n: AccountNode) { out.push(n); n.children.forEach(walk); }
  nodes.forEach(walk);
  return out;
}

// ── Add Entry Modal ───────────────────────────────────────────────────────────

interface LineState { account_id: string; side: 'debit' | 'credit'; amount: string; note: string; }

interface AddEntryModalProps { accounts: AccountNode[]; onClose: () => void; onSaved: () => void; }

function AddEntryModal({ accounts, onClose, onSaved }: AddEntryModalProps) {
  const flat = flattenAccounts(accounts).filter(a => a.is_active);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineState[]>([
    { account_id: '', side: 'debit', amount: '', note: '' },
    { account_id: '', side: 'credit', amount: '', note: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addLine = () => setLines(l => [...l, { account_id: '', side: 'debit', amount: '', note: '' }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<LineState>) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, ...patch } : line));

  const totalDebit = lines.filter(l => l.side === 'debit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCredit = lines.filter(l => l.side === 'credit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  const handleSubmit = async () => {
    setError('');
    if (!description.trim()) { setError('Description is required'); return; }
    if (!balanced) { setError(`Debits (${fmt(totalDebit)}) must equal credits (${fmt(totalCredit)})`); return; }
    const linePayloads: JournalEntryLineCreate[] = lines.map(l => ({
      account_id: parseInt(l.account_id),
      debit_amount: l.side === 'debit' ? parseFloat(l.amount) || 0 : 0,
      credit_amount: l.side === 'credit' ? parseFloat(l.amount) || 0 : 0,
      note: l.note.trim() || null,
    }));
    const payload: JournalEntryCreate = { entry_date: date, description: description.trim(), lines: linePayloads };
    setLoading(true);
    try { await createJournalEntry(payload); onSaved(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to create entry'); setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', paddingTop: '48px', paddingBottom: '48px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '660px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>New Manual Journal Entry</h2>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
          <div style={{ flex: '0 0 160px' }}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Description *</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Opening balance adjustment" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 1fr 28px', gap: '6px', marginBottom: '6px' }}>
            {['Account', 'Dr/Cr', 'Amount', 'Note', ''].map(h => (
              <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 1fr 28px', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
              <select value={line.account_id} onChange={e => updateLine(i, { account_id: e.target.value })}
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '13px', width: '100%' }}>
                <option value="">— select —</option>
                {flat.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
              </select>
              <select value={line.side} onChange={e => updateLine(i, { side: e.target.value as 'debit' | 'credit' })}
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '13px', width: '100%' }}>
                <option value="debit">Dr</option>
                <option value="credit">Cr</option>
              </select>
              <input type="number" min="0" step="0.01" value={line.amount} onChange={e => updateLine(i, { amount: e.target.value })} placeholder="0.00"
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '13px', fontFamily: 'monospace', width: '100%', boxSizing: 'border-box' }} />
              <input type="text" value={line.note} onChange={e => updateLine(i, { note: e.target.value })} placeholder="Optional"
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
              <button onClick={() => removeLine(i)} disabled={lines.length <= 2}
                style={{ padding: '0', background: 'transparent', border: 'none', color: lines.length <= 2 ? '#cbd5e1' : '#ef4444', cursor: lines.length <= 2 ? 'default' : 'pointer', fontSize: '18px', lineHeight: 1, textAlign: 'center' }}>
                ×
              </button>
            </div>
          ))}
          <button onClick={addLine} style={{ marginTop: '4px', padding: '5px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>
            + Add line
          </button>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', display: 'flex', gap: '24px', fontSize: '13px' }}>
          <span>Dr total: <strong style={{ fontFamily: 'monospace' }}>{fmt(totalDebit)}</strong></span>
          <span>Cr total: <strong style={{ fontFamily: 'monospace' }}>{fmt(totalCredit)}</strong></span>
          <span style={{ color: balanced ? '#15803d' : '#dc2626', fontWeight: 700 }}>{balanced ? '✓ Balanced' : '✗ Not balanced'}</span>
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer', background: '#f8fafc', fontSize: '14px' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !balanced}
            style={{ padding: '8px 22px', background: balanced ? '#1e40af' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '7px', cursor: balanced ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '14px' }}>
            {loading ? 'Posting…' : 'Post entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entry Detail Modal ────────────────────────────────────────────────────────

interface EntryDetailModalProps { entry: JournalEntryOut; onClose: () => void; onReversed: () => void; onDeleted: () => void; }

function EntryDetailModal({ entry, onClose, onReversed, onDeleted }: EntryDetailModalProps) {
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleReverse = async () => {
    setReversing(true); setError('');
    try { await reverseJournalEntry(entry.id); onReversed(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setReversing(false); }
  };

  const handleDelete = async () => {
    setDeleting(true); setError('');
    try { await deleteJournalEntry(entry.id); onDeleted(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setDeleting(false); }
  };

  const src = sourceLabel(entry.source_type);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '620px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Entry #{entry.id}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: src.bg, color: src.color, border: `1px solid ${src.border}` }}>{src.label}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#475569' }}>{entry.description}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{entry.entry_date}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Account', 'Debit', 'Credit', 'Note'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Debit' || h === 'Credit' ? 'right' : 'left', fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entry.lines.map(line => (
              <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 12px', fontSize: '13px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#64748b', marginRight: '6px' }}>{line.account_code}</span>
                  {line.account_name}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: parseFloat(line.debit_amount) > 0 ? '#15803d' : '#cbd5e1' }}>
                  {parseFloat(line.debit_amount) > 0 ? fmt(line.debit_amount) : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: parseFloat(line.credit_amount) > 0 ? '#1e40af' : '#cbd5e1' }}>
                  {parseFloat(line.credit_amount) > 0 ? fmt(line.credit_amount) : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: '12px', color: '#64748b' }}>{line.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
              <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: '#374151' }}>Total</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#15803d' }}>{fmt(entry.total_debit)}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>{fmt(entry.total_credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', border: '1px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer', background: '#f8fafc', fontSize: '13px' }}>Close</button>
          <button onClick={handleReverse} disabled={reversing}
            style={{ padding: '7px 16px', background: '#fef9c3', color: '#713f12', border: '1px solid #fde047', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            {reversing ? 'Reversing…' : 'Post Reversal'}
          </button>
          {entry.source_type === 'manual' && (
            <button onClick={handleDelete} disabled={deleting}
              style={{ padding: '7px 16px', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntryOut[]>([]);
  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [detailEntry, setDetailEntry] = useState<JournalEntryOut | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await listJournalEntries({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        source_type: sourceType || undefined,
      }));
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, sourceType]);

  useEffect(() => {
    fetchEntries();
    getAccounts().then(setAccounts);
  }, [fetchEntries]);

  const handleSaved = async () => { setShowAdd(false); await fetchEntries(); };
  const handleReversed = async () => { setDetailEntry(null); await fetchEntries(); };
  const handleDeleted = async () => { setDetailEntry(null); await fetchEntries(); };

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '4px', letterSpacing: '-0.02em' }}>Journal Entries</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{entries.length} entries</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: '10px 22px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
          + Manual Entry
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>Source</label>
          <select value={sourceType} onChange={e => setSourceType(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}>
            <option value="">All sources</option>
            <option value="billing">Sale</option>
            <option value="receiving">Receiving</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        {(dateFrom || dateTo || sourceType) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setSourceType(''); }}
            style={{ padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: '#f8fafc', color: '#64748b' }}>
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', padding: '48px', textAlign: 'center', fontSize: '14px' }}>Loading entries…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: '#94a3b8', padding: '48px', textAlign: 'center', fontSize: '14px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          No journal entries found. Complete a sale or stock receiving to auto-generate entries.
        </div>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Date', 'Description', 'Source', 'Debit', 'Credit', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Debit' || h === 'Credit' ? 'right' : 'left', fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const src = sourceLabel(entry.source_type);
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onClick={() => setDetailEntry(entry)}>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>#{entry.id}</td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>{entry.entry_date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#0f172a', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: src.bg, color: src.color, border: `1px solid ${src.border}` }}>{src.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: '#15803d' }}>{fmt(entry.total_debit)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: '#1e40af' }}>{fmt(entry.total_credit)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8', fontSize: '13px' }}>▸</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddEntryModal accounts={accounts} onClose={() => setShowAdd(false)} onSaved={handleSaved} />}
      {detailEntry && <EntryDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onReversed={handleReversed} onDeleted={handleDeleted} />}
    </div>
  );
}
