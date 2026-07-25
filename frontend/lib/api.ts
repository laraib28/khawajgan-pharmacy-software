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

export async function getAccounts(params?: { account_type?: string; is_active?: boolean }): Promise<AccountNode[]> {
  const defined = params ? Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][] : [];
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
