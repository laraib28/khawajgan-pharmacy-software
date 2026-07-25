'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccountCreate,
  AccountNode,
  AccountUpdate,
  createAccount,
  deactivateAccount,
  getAccounts,
  updateAccount,
} from '@/lib/api';

const ACCOUNT_TYPES = [
  { value: 'asset',     label: 'Assets',       acronym: 'ASSET', range: [1000, 1999] as [number, number], color: '#1e40af', light: '#dbeafe', emptyHint: 'Add cash, bank, inventory, and equipment accounts.' },
  { value: 'liability', label: 'Liabilities',   acronym: 'LIAB',  range: [2000, 2999] as [number, number], color: '#6d28d9', light: '#ede9fe', emptyHint: 'Add supplier payables and loan accounts.' },
  { value: 'equity',    label: 'Equity',        acronym: 'EQ',    range: [3000, 3999] as [number, number], color: '#0f766e', light: '#ccfbf1', emptyHint: 'Add owner capital and retained earnings accounts.' },
  { value: 'revenue',   label: 'Revenue',       acronym: 'REV',   range: [4000, 4999] as [number, number], color: '#15803d', light: '#dcfce7', emptyHint: 'Add medicine sales and other income accounts.' },
  { value: 'expense',   label: 'Expenses',      acronym: 'EXP',   range: [5000, 5999] as [number, number], color: '#b91c1c', light: '#fee2e2', emptyHint: 'Add COGS, rent, utilities, and salary accounts.' },
];

function flattenTree(nodes: AccountNode[]): AccountNode[] {
  const result: AccountNode[] = [];
  function walk(node: AccountNode) { result.push(node); node.children.forEach(walk); }
  nodes.forEach(walk);
  return result;
}

function nextSuggestedCode(flat: AccountNode[], type: string): string {
  const typeInfo = ACCOUNT_TYPES.find(t => t.value === type);
  if (!typeInfo) return '';
  const [lo, hi] = typeInfo.range;
  const codes = flat.filter(a => a.account_type === type).map(a => parseInt(a.account_code, 10)).filter(n => !isNaN(n));
  if (codes.length === 0) return String(lo + 1);
  const max = Math.max(...codes);
  return max < hi ? String(max + 1) : '';
}

// Accounting shorthand that professionals recognise
function balanceLabel(b: string) { return b === 'debit' ? 'Dr' : 'Cr'; }
function balanceStyle(b: string): React.CSSProperties {
  return b === 'debit'
    ? { background: '#fef9c3', color: '#713f12', border: '1px solid #fde047' }
    : { background: '#e0f2fe', color: '#0c4a6e', border: '1px solid #7dd3fc' };
}

interface EditModalProps { account: AccountNode; onClose: () => void; onSaved: () => void; }
function EditModal({ account, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({ account_name: account.account_name, description: account.description ?? '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!form.account_name.trim()) { setError('Account name is required'); return; }
    setLoading(true);
    try {
      await updateAccount(account.id, { account_name: form.account_name.trim(), description: form.description.trim() || null });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update account');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Edit Account</h2>
          <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{account.account_code} · {account.account_type.toUpperCase()}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Account Name</label>
            <input type="text" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer', background: '#f8fafc', fontSize: '14px' }}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={{ padding: '8px 22px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddModalProps { flatAccounts: AccountNode[]; onClose: () => void; onSaved: () => void; }
function AddModal({ flatAccounts, onClose, onSaved }: AddModalProps) {
  const [form, setForm] = useState({ account_code: nextSuggestedCode(flatAccounts, 'asset'), account_name: '', account_type: 'asset', parent_account_id: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(f => ({ ...f, account_code: nextSuggestedCode(flatAccounts, f.account_type), parent_account_id: '' }));
  }, [form.account_type]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeInfo = ACCOUNT_TYPES.find(t => t.value === form.account_type)!;
  const parentOptions = flatAccounts.filter(a => a.account_type === form.account_type && a.is_active);

  const handleAdd = async () => {
    setError('');
    if (!form.account_code.trim()) { setError('Account code is required'); return; }
    if (!form.account_name.trim()) { setError('Account name is required'); return; }
    setLoading(true);
    try {
      const payload: AccountCreate = {
        account_code: form.account_code.trim(),
        account_name: form.account_name.trim(),
        account_type: form.account_type,
        parent_account_id: form.parent_account_id ? parseInt(form.parent_account_id, 10) : null,
        description: form.description.trim() || null,
      };
      await createAccount(payload);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Add Account</h2>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Codes {typeInfo.range[0]}–{typeInfo.range[1]} are reserved for <strong>{typeInfo.label}</strong></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: '0 0 110px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Code *</label>
              <input type="text" value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Type *</label>
              <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px' }}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} ({t.range[0]}–{t.range[1]})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Account Name *</label>
            <input type="text" placeholder={`e.g. ${typeInfo.emptyHint.split(' ')[1]}`} value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Parent Account <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
            <select value={form.parent_account_id} onChange={e => setForm(f => ({ ...f, parent_account_id: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px' }}>
              <option value="">— Top level —</option>
              {parentOptions.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Description <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer', background: '#f8fafc', fontSize: '14px' }}>Cancel</button>
          <button onClick={handleAdd} disabled={loading} style={{ padding: '8px 22px', background: '#059669', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
            {loading ? 'Adding…' : 'Add account'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AccountRowProps { account: AccountNode; depth: number; color: string; onEdit: (a: AccountNode) => void; onDeactivate: (a: AccountNode) => void; }
function AccountRow({ account, depth, color, onEdit, onDeactivate }: AccountRowProps) {
  return (
    <>
      <tr style={{ borderBottom: '1px solid #f1f5f9', opacity: account.is_active ? 1 : 0.5 }}>
        <td style={{ padding: '10px 16px', paddingLeft: `${16 + depth * 28}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {depth > 0 && (
              <span style={{ color: '#cbd5e1', fontSize: '13px', userSelect: 'none' }}>└</span>
            )}
            <span style={{
              fontFamily: 'monospace', fontSize: '13px', fontWeight: 700,
              color: account.is_active ? color : '#94a3b8',
              background: account.is_active ? `${color}12` : '#f1f5f9',
              padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.03em',
            }}>
              {account.account_code}
            </span>
          </div>
        </td>
        <td style={{ padding: '10px 16px', fontSize: '14px', fontWeight: depth === 0 ? 600 : 400, color: '#0f172a' }}>
          {account.account_name}
        </td>
        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#64748b', maxWidth: '240px' }}>
          {account.description ?? <span style={{ color: '#cbd5e1' }}>—</span>}
        </td>
        <td style={{ padding: '10px 16px' }}>
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', ...balanceStyle(account.normal_balance) }}>
            {balanceLabel(account.normal_balance)}
          </span>
        </td>
        <td style={{ padding: '10px 16px' }}>
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
            background: account.is_active ? '#f0fdf4' : '#f1f5f9',
            color: account.is_active ? '#15803d' : '#94a3b8',
            border: `1px solid ${account.is_active ? '#86efac' : '#e2e8f0'}`,
          }}>
            {account.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => onEdit(account)}
              style={{ padding: '4px 10px', fontSize: '12px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}>
              Edit
            </button>
            {account.is_active && (
              <button onClick={() => onDeactivate(account)}
                style={{ padding: '4px 10px', fontSize: '12px', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}>
                Deactivate
              </button>
            )}
          </div>
        </td>
      </tr>
      {account.children.map(child => (
        <AccountRow key={child.id} account={child} depth={depth + 1} color={color} onEdit={onEdit} onDeactivate={onDeactivate} />
      ))}
    </>
  );
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountNode | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AccountNode | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); };
  }, []);

  const flatAccounts = useMemo(() => flattenTree(accounts), [accounts]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try { setAccounts(await getAccounts()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSaved = async (msg: string) => {
    setShowAddModal(false);
    setEditingAccount(null);
    setSuccessMsg(msg);
    await fetchAccounts();
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    setDeactivating(true);
    setDeactivateError('');
    try {
      await deactivateAccount(confirmDeactivate.id);
      setConfirmDeactivate(null);
      await handleSaved(`"${confirmDeactivate.account_name}" deactivated`);
    } catch (e: unknown) {
      setDeactivateError(e instanceof Error ? e.message : 'Failed to deactivate');
    } finally { setDeactivating(false); }
  };

  const activeCount = flatAccounts.filter(a => a.is_active).length;

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '4px', letterSpacing: '-0.02em' }}>Chart of Accounts</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            {flatAccounts.length} accounts &nbsp;·&nbsp; {activeCount} active &nbsp;·&nbsp; {flatAccounts.length - activeCount} inactive
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          style={{ padding: '10px 22px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', letterSpacing: '0.01em' }}>
          + Add account
        </button>
      </div>

      {successMsg && (
        <div style={{ marginBottom: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 16px', color: '#15803d', fontSize: '13px', fontWeight: 600 }}>
          ✓ {successMsg}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#94a3b8', padding: '48px', textAlign: 'center', fontSize: '14px' }}>Loading accounts…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ACCOUNT_TYPES.map(({ value, label, acronym, color, light, emptyHint }) => {
            const typeAccounts = accounts.filter(a => a.account_type === value);
            const isCollapsed = collapsed[value];
            const flatCount = flatAccounts.filter(a => a.account_type === value).length;
            const activeInType = flatAccounts.filter(a => a.account_type === value && a.is_active).length;

            return (
              <div key={value} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {/* Ledger-tab section header — bold left bar is the aesthetic risk */}
                <button onClick={() => setCollapsed(c => ({ ...c, [value]: !c[value] }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: `5px solid ${color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'monospace', color: '#fff', background: color, padding: '3px 7px', borderRadius: '4px', letterSpacing: '0.08em' }}>
                      {acronym}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{label}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {activeInType}/{flatCount} active
                    </span>
                  </div>
                  <span style={{ fontSize: '16px', color: '#94a3b8' }}>{isCollapsed ? '▸' : '▾'}</span>
                </button>

                {!isCollapsed && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                        {['Code', 'Name', 'Description', 'Bal.', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '7px 16px', textAlign: 'left', fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {typeAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '28px 20px', textAlign: 'center' }}>
                            <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>No {label.toLowerCase()} accounts yet.</div>
                            <div style={{ color: '#cbd5e1', fontSize: '12px' }}>{emptyHint}</div>
                          </td>
                        </tr>
                      ) : (
                        typeAccounts.map(account => (
                          <AccountRow key={account.id} account={account} depth={0} color={color} onEdit={setEditingAccount} onDeactivate={setConfirmDeactivate} />
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && <AddModal flatAccounts={flatAccounts} onClose={() => setShowAddModal(false)} onSaved={() => handleSaved('Account created')} />}
      {editingAccount && <EditModal account={editingAccount} onClose={() => setEditingAccount(null)} onSaved={() => handleSaved('Account updated')} />}

      {confirmDeactivate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>Deactivate account?</h2>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, marginBottom: '16px' }}>
              <strong>{confirmDeactivate.account_code} — {confirmDeactivate.account_name}</strong> will be hidden from new transaction forms.
              Existing records that reference this account are not affected.
            </p>
            {deactivateError && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{deactivateError}</div>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setConfirmDeactivate(null); setDeactivateError(''); }}
                style={{ padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer', background: '#f8fafc', fontSize: '14px' }}>
                Keep active
              </button>
              <button onClick={handleDeactivate} disabled={deactivating}
                style={{ padding: '8px 22px', background: '#be123c', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                {deactivating ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
