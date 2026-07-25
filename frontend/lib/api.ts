// Use relative /api path so the browser calls Next.js (same origin).
// Next.js rewrites /api/* → BACKEND_URL/* on the server side,
// avoiding CORS issues and keeping the backend URL private.
// cache: 'no-store' prevents Next.js 14 / Vercel CDN from caching API responses.
const BASE_URL = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });

  // On 401, try a token refresh once then retry the original request.
  // Excludes auth endpoints to avoid infinite loops.
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh' && path !== '/auth/me') {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', cache: 'no-store' });
    if (refreshRes.ok) {
      return request<T>(path, init);
    }
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export async function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', cache: 'no-store' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? 'Delete failed');
  }
}

// Chart of Accounts
export interface AccountNode {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_account_id: number | null;
  normal_balance: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  balance?: number | null;
  children: AccountNode[];
}

export interface AccountCreate {
  account_code: string;
  account_name: string;
  account_type: string;
  parent_account_id?: number | null;
  description?: string | null;
}

export interface AccountUpdate {
  account_name?: string;
  description?: string | null;
  is_active?: boolean;
}

export async function getAccounts(params?: { account_type?: string; is_active?: boolean; include_balance?: boolean }): Promise<AccountNode[]> {
  const defined = params ? (Object.entries(params).filter(([, v]) => v !== undefined) as [string, unknown][]).map(([k, v]) => [k, String(v)] as [string, string]) : [];
  const qs = defined.length ? '?' + new URLSearchParams(defined).toString() : '';
  return get<AccountNode[]>(`/chart-of-accounts${qs}`);
}

export async function createAccount(data: AccountCreate): Promise<AccountNode> {
  return post<AccountNode>('/chart-of-accounts', data);
}

export async function updateAccount(id: number, data: AccountUpdate): Promise<AccountNode> {
  return put<AccountNode>(`/chart-of-accounts/${id}`, data);
}

export async function deactivateAccount(id: number): Promise<void> {
  return del(`/chart-of-accounts/${id}`);
}

// Journal Entries
export interface JournalEntryLineOut {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  debit_amount: string;
  credit_amount: string;
  note: string | null;
}

export interface JournalEntryOut {
  id: number;
  entry_date: string;
  description: string;
  source_type: string;
  source_id: number | null;
  created_by_id: number;
  created_at: string;
  lines: JournalEntryLineOut[];
  total_debit: string;
  total_credit: string;
}

export interface JournalEntryLineCreate {
  account_id: number;
  debit_amount: number;
  credit_amount: number;
  note?: string | null;
}

export interface JournalEntryCreate {
  entry_date: string;
  description: string;
  lines: JournalEntryLineCreate[];
}

export interface AccountBalanceOut {
  account_id: number;
  account_code: string;
  account_name: string;
  normal_balance: string;
  balance: string;
}

export async function listJournalEntries(params?: { date_from?: string; date_to?: string; source_type?: string; account_id?: number }): Promise<JournalEntryOut[]> {
  const defined = params ? (Object.entries(params).filter(([, v]) => v !== undefined) as [string, unknown][]).map(([k, v]) => [k, String(v)] as [string, string]) : [];
  const qs = defined.length ? '?' + new URLSearchParams(defined).toString() : '';
  return get<JournalEntryOut[]>(`/journal-entries${qs}`);
}

export async function getJournalEntry(id: number): Promise<JournalEntryOut> {
  return get<JournalEntryOut>(`/journal-entries/${id}`);
}

export async function createJournalEntry(data: JournalEntryCreate): Promise<JournalEntryOut> {
  return post<JournalEntryOut>('/journal-entries', data);
}

export async function deleteJournalEntry(id: number): Promise<void> {
  return del(`/journal-entries/${id}`);
}

export async function reverseJournalEntry(id: number): Promise<JournalEntryOut> {
  return post<JournalEntryOut>(`/journal-entries/${id}/reverse`, {});
}

export async function getAccountBalance(accountId: number): Promise<AccountBalanceOut> {
  return get<AccountBalanceOut>(`/chart-of-accounts/${accountId}/balance`);
}

export async function postForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — browser sets multipart boundary automatically
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? 'Upload failed');
  }
  return res.json() as Promise<T>;
}
