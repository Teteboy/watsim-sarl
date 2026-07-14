export type FetchResult<T> = { data?: T; error?: string };

async function fetchJson<T>(path: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) return { error: `Request failed ${res.status}` };
    const data = (await res.json()) as T;
    return { data };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
  const res = await fetch(path, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.message) msg = errBody.message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(msg);
  }
  return (await res.json()) as T;
}

async function putJson<T>(path: string, body: any): Promise<T> {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
  const res = await fetch(path, {
    method: 'PUT',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.message) msg = errBody.message;
    } catch { /* ignore JSON parse error */ }
    throw new ApiError(msg);
  }
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: any): Promise<T> {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
  const res = await fetch(path, {
    method: 'PATCH',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.message) msg = errBody.message;
    } catch { /* ignore JSON parse error */ }
    throw new ApiError(msg);
  }
  return (await res.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const headers: Record<string,string> = {};
  if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
  const res = await fetch(path, { credentials: 'same-origin', headers });
  if (!res.ok) {
    let msg = `Request failed ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.message) msg = errBody.message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(msg);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status?: number;
  constructor(message?: string) { super(message ?? 'API error'); this.name = 'ApiError'; }
}

export const API_PREFIX = (import.meta.env?.VITE_API_PREFIX as string) ?? '/api/v1';

// Common accounting types used across pages
export type TrialBalanceRow = { code: string; name: string; type: string; debit: number; credit: number; balance: number };
export type JournalEntryLine = { id: string; accountCode: string; debit: number; credit: number; memo?: string };
export type JournalEntryRow = { id: string; reference: string; description: string; postedAt: string; lines: JournalEntryLine[] };

export interface BnplCategoryConfig { id: string; name: string; enabled: boolean; maxCredit: number; minScore: number; merchantCommission: number }

export async function getBnplCategorySettings() {
  // admin-only; falls back to empty on error (no token etc)
  try {
    return { data: await getJson<BnplCategoryConfig[]>(`${API_PREFIX}/admin/bnpl/category-settings`) } as FetchResult<BnplCategoryConfig[]>;
  } catch {
    return { data: [] };
  }
}

export async function getPublicCategories() {
  return fetchJson<any[]>(`${API_PREFIX}/products/categories`);
}

export async function simulateBnpl(productId: string, instalmentCount: number, frequency: 'daily' | 'weekly' | 'monthly' = 'monthly') {
  return postJson<any>(`${API_PREFIX}/bnpl/simulate`, { productId, instalmentCount, frequency });
}

export async function getMerchantProfile() {
  return getJson<any>(`${API_PREFIX}/merchant/profile`);
}

export async function getMerchantStats() {
  return fetchJson<any>(`${API_PREFIX}/merchant/stats`);
}

export async function getTransactionChartData() {
  try {
    const raw = await getJson<any>(`${API_PREFIX}/admin/transactions?limit=100`).catch(() => ({} as any));
    const items = (raw?.items ?? []) as any[];
    // Build last 12 months keys
    const months: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleString('fr-FR', { month: 'short' });
      months.push({ key, label });
    }

    const counts: Record<string, number> = {};
    const sums: Record<string, number> = {};
    for (const it of items) {
      const date = new Date(it.createdAt || it.created_at || it.date || it.postedAt || it.createdAt);
      if (isNaN(date.getTime())) continue;
      const key = date.toISOString().slice(0, 7);
      // only include completed transactions
      const status = (it.status ?? '').toString().toUpperCase();
      if (status !== 'COMPLETED') continue;
      counts[key] = (counts[key] ?? 0) + 1;
      sums[key] = (sums[key] ?? 0) + (Number(it.amount) || 0);
    }

    const data = months.map((m) => ({
      month: m.label,
      transactions: counts[m.key] ?? 0,
      // revenue in millions FCFA with one decimal
      revenue: Math.round(((sums[m.key] ?? 0) / 1_000_000) * 10) / 10,
    }));

    return { data } as FetchResult<typeof data>;
  } catch (e) {
    return { data: [] };
  }
}

export async function getCategoryData() {
  try {
    // Use the dedicated category distribution endpoint
    const res = await getJson<{ data: { label: string; value: number; color: string }[] }>(`${API_PREFIX}/admin/reports/category-distribution`);
    return { data: res?.data ?? [] } as FetchResult<{ label: string; value: number; color: string }[]>;
  } catch (e) {
    return { data: [] };
  }
}

// Generic helpers for other resources (returns {data, error})
export async function getResource<T = any>(path: string) {
  if (path.startsWith('/')) return fetchJson<T>(`${API_PREFIX}${path}`);
  return fetchJson<T>(path);
}

// Minimal token store used by hooks/pages
export const tokenStore = {
  access: null as string | null,
  refresh: null as string | null,
  user: null as any,
  getUser() { return this.user; },
  setTokens(access: string, refresh: string) {
    this.access = access; this.refresh = refresh;
    try {
      sessionStorage.setItem('watsim_access', access);
      sessionStorage.setItem('watsim_refresh', refresh);
    } catch (e) { /* ignore */ }
  },
  setUser(u: any) {
    this.user = u;
    try { sessionStorage.setItem('watsim_user', JSON.stringify(u)); } catch (e) { /* ignore */ }
  },
  loadFromStorage() {
    try {
      const a = sessionStorage.getItem('watsim_access');
      const r = sessionStorage.getItem('watsim_refresh');
      const u = sessionStorage.getItem('watsim_user');
      if (a) this.access = a;
      if (r) this.refresh = r;
      if (u) this.user = JSON.parse(u);
    } catch (e) { /* ignore */ }
  },
  clear() {
    this.access = null; this.refresh = null; this.user = null;
    try { sessionStorage.removeItem('watsim_access'); sessionStorage.removeItem('watsim_refresh'); sessionStorage.removeItem('watsim_user'); } catch (e) { /* ignore */ }
  },
};

// initialize from storage so page reloads keep tokens/user
try { tokenStore.loadFromStorage(); } catch (e) { /* ignore */ }


// Authentication API wrapper
export const authApi = {
  async login(email: string, password: string) {
    return postJson<any>(`${API_PREFIX}/auth/login`, { email, password });
  },
  async register(input: { email: string; phone: string; password: string; fullName: string }) {
    return postJson<any>(`${API_PREFIX}/auth/register`, input);
  },
  async registerMerchant(input: any) {
    return postJson<any>(`${API_PREFIX}/merchants/register`, input);
  },
  async logout() {
    try { await postJson<any>(`${API_PREFIX}/auth/logout`, {}); } catch { /* ignore */ return; }
  },
};

// Public product helper (backend-driven price suggestion for forms)
export async function suggestProductPrice(costPrice: number, categoryId?: string) {
  const q = new URLSearchParams({ costPrice: String(costPrice) });
  if (categoryId) q.set('categoryId', categoryId);
  return getJson<any>(`${API_PREFIX}/products/suggest-price?${q.toString()}`);
}

// Admin API wrapper (only methods used by UI are implemented)
export const adminApi = {
  async summary() { return getJson<any>(`${API_PREFIX}/admin/reports/summary`); },
  async merchants(params: { page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    // backend schema allows limit/page; keep within [1..100]
    if (typeof params.limit === 'number') q.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (typeof params.page === 'number') q.set('page', String(Math.max(1, params.page)));
    const url = `${API_PREFIX}/admin/merchants${q.toString() ? `?${q.toString()}` : ''}`;
    return getJson<any>(url);
  },
  async setMerchantStatus(id: string, status: string) { return postJson<any>(`${API_PREFIX}/admin/merchants/${id}/status`, { status }); },
  async users(params: { page?: number; limit?: number; role?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (typeof params.limit === 'number') q.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (typeof params.page === 'number') q.set('page', String(Math.max(1, params.page)));
    if (params.role) q.set('role', params.role);
    if (params.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/admin/users${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async setUserActive(id: string, active: boolean) { return postJson<any>(`${API_PREFIX}/admin/users/${id}/active`, { active }); },
  async setKyc(id: string, status: string) { return postJson<any>(`${API_PREFIX}/admin/users/${id}/kyc`, { status }); },
  async setCreditLimit(id: string, limit: number) { return postJson<any>(`${API_PREFIX}/admin/users/${id}/credit-limit`, { limit }); },
  async transactions(params: { page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (typeof params.limit === 'number') q.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (typeof params.page === 'number') q.set('page', String(Math.max(1, params.page)));
    return getJson<any>(`${API_PREFIX}/admin/transactions${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async bnplPurchases(params: { page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (typeof params.limit === 'number') q.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (typeof params.page === 'number') q.set('page', String(Math.max(1, params.page)));
    return getJson<any>(`${API_PREFIX}/admin/bnpl${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async publicities(params: { page?: number; limit?: number; status?: string; type?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (typeof params.limit === 'number') q.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (typeof params.page === 'number') q.set('page', String(Math.max(1, params.page)));
    if (params.status) q.set('status', params.status);
    if (params.type) q.set('type', params.type);
    if (params.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/admin/publicities${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async createPublicity(body: any) { return postJson<any>(`${API_PREFIX}/admin/publicities`, body); },
  async updatePublicity(id: string, body: any) { 
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/admin/publicities/${id}`, { 
      method: 'PUT', 
      headers, 
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new ApiError(`Request failed ${res.status}`);
    return (await res.json()) as any;
  },
  async deletePublicity(id: string) {
    const headers: Record<string,string> = {};
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/admin/publicities/${id}`, { method: 'DELETE', headers, credentials: 'same-origin' });
    if (!res.ok) throw new ApiError(`Request failed ${res.status}`);
    return true;
  },

  async uploadImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);
    const headers: Record<string, string> = {};
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/upload/image`, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: formData,
    });
    if (!res.ok) {
      let msg = `Upload failed ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
      throw new ApiError(msg);
    }
    return (await res.json()) as { url: string };
  },

  // Admin Notifications
  async notifications(params: { page?: number; limit?: number; status?: string; type?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (typeof params.limit === 'number') q.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (typeof params.page === 'number') q.set('page', String(Math.max(1, params.page)));
    if (params.status) q.set('status', params.status);
    if (params.type) q.set('type', params.type);
    if (params.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/admin/notifications${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async createNotification(body: any) { return postJson<any>(`${API_PREFIX}/admin/notifications`, body); },
  async updateNotificationStatus(id: string, status: string) {
    return postJson<any>(`${API_PREFIX}/admin/notifications/${id}/status`, { status });
  },
  // Categories & BNPL settings (admin settings page)
  async categories() { return getJson<any>(`${API_PREFIX}/admin/categories`); },
  async createCategory(body: any) { return postJson<any>(`${API_PREFIX}/admin/categories`, body); },
  async updateCategory(id: string, body: any) { return putJson<any>(`${API_PREFIX}/admin/categories/${id}`, body); },
  async deleteCategory(id: string) {
    const headers: Record<string,string> = {};
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/admin/categories/${id}`, { method: 'DELETE', headers, credentials: 'same-origin' });
    if (!res.ok) throw new ApiError(`Request failed ${res.status}`);
    return true;
  },
  async bnplCategorySettings() { return getJson<any>(`${API_PREFIX}/admin/bnpl/category-settings`); },
  async getSystemSettings() { return getJson<Record<string, string>>(`${API_PREFIX}/admin/settings`); },
  async setSystemSetting(key: string, value: string) { return putJson(`${API_PREFIX}/admin/settings/${key}`, { value }); },
  async createAdminUser(body: { email: string; phone: string; fullName: string; password: string; pin?: string; imageUrl?: string }) {
    return postJson<any>(`${API_PREFIX}/admin/users`, body);
  },
  async resetUserPassword(id: string, password?: string) {
    return postJson<any>(`${API_PREFIX}/admin/users/${id}/reset-password`, { password });
  },
  async repairMerchantLinkage(merchantId: string) {
    return postJson<any>(`${API_PREFIX}/admin/merchants/${merchantId}/repair-link`, {});
  },
  async products(params: { page?: number; limit?: number; search?: string } = {}) {
    const q = new URLSearchParams();
    if (typeof params.limit === 'number') q.set('limit', String(Math.min(100, Math.max(1, params.limit))));
    if (typeof params.page === 'number') q.set('page', String(Math.max(1, params.page)));
    if (params.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/admin/products${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async createProduct(body: any) { return postJson<any>(`${API_PREFIX}/admin/products`, body); },
  async updateProduct(id: string, body: any) { return putJson<any>(`${API_PREFIX}/admin/products/${id}`, body); },
  async deleteProduct(id: string) {
    const headers: Record<string,string> = {};
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/admin/products/${id}`, { method: 'DELETE', headers, credentials: 'same-origin' });
    if (!res.ok) { let msg = `Request failed ${res.status}`; try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore */ } throw new ApiError(msg); }
    return true;
  },
  async disputes() {
    const res = await getJson<{ items?: any[] }>(`${API_PREFIX}/admin/disputes`);
    return res?.items ?? [];
  },
  async fraudAlerts() {
    const res = await getJson<{ items?: any[] }>(`${API_PREFIX}/admin/fraud-alerts`);
    return res?.items ?? [];
  },
  async conversations(params: { page?: number; limit?: number; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/admin/conversations${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async conversationMessages(convId: string, params: { limit?: number; before?: string } = {}) {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.before) q.set('before', params.before);
    return getJson<any>(`${API_PREFIX}/admin/conversations/${convId}/messages${q.toString() ? `?${q.toString()}` : ''}`);
  },
async sendMessage(convId: string, data: { text?: string; attachmentUrl?: string; attachmentType?: string }) {
    return postJson<any>(`${API_PREFIX}/admin/conversations/${convId}/messages`, data);
  },
  async getDefaultFees() { return getJson<any>(`${API_PREFIX}/admin/fees/default`); },
  async applyDefaultFees() { return postJson<any>(`${API_PREFIX}/admin/fees/apply`, {}); },

  // Admin Wallet Management
  async wallets(params: { page?: number; limit?: number; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/admin/wallets${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async merchantWallet(merchantId: string) {
    return getJson<any>(`${API_PREFIX}/admin/wallets/${merchantId}`);
  },
  async creditMerchantWallet(merchantId: string, amount: number, note?: string) {
    return postJson<any>(`${API_PREFIX}/admin/wallets/${merchantId}/credit`, { amount, note });
  },
  async creditClientWallet(userId: string, amount: number, note?: string) {
    return postJson<any>(`${API_PREFIX}/admin/users/${userId}/wallet/credit`, { amount, note });
  },
  async contributeToInstallment(instalmentId: string, amount: number, note?: string) {
    return postJson<any>(`${API_PREFIX}/admin/installments/${instalmentId}/contribute`, { amount, note });
  },

  // Admin Referrals
  async referrals(params: { page?: number; limit?: number; status?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/admin/referrals${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async referralStats() {
    return getJson<any>(`${API_PREFIX}/admin/referrals/stats`);
  },

  // Cash Withdrawals
  async cashWithdrawals(params: { page?: number; limit?: number; status?: string } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.status) q.set('status', params.status);
    return getJson<any>(`${API_PREFIX}/admin/withdrawals/cash${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async approveCashWithdrawal(id: string) {
    return putJson<any>(`${API_PREFIX}/admin/withdrawals/cash/${id}/approve`, {});
  },
  async rejectCashWithdrawal(id: string, reason?: string) {
    return putJson<any>(`${API_PREFIX}/admin/withdrawals/cash/${id}/reject`, { reason });
  },

  // Create regular customer user from admin panel
  async createUser(body: { email: string; phone: string; fullName: string; password?: string; pin?: string; creditLimit?: number; role?: string }) {
    return postJson<any>(`${API_PREFIX}/admin/users`, { ...body, role: body.role || 'CUSTOMER' });
  },

  async updateUser(userId: string, body: { fullName?: string; email?: string; phone?: string; creditLimit?: number }) {
    return patchJson<any>(`${API_PREFIX}/admin/users/${userId}`, body);
  },

  // Create transaction from admin panel
  async createTransaction(body: { userId: string; type: string; amount: number; description?: string; merchantId?: string; method?: string }) {
    return postJson<any>(`${API_PREFIX}/admin/transactions`, body);
  },

  // BNPL Fee Settings
  async getBnplFeeSettings() {
    return getJson<any>(`${API_PREFIX}/admin/fees/bnpl`);
  },
  async updateBnplFeeSettings(settings: {
    stockingFee?: number;
    accountCreationFee?: number;
    deliveryFee?: number;
    collectionFee?: number;
  }) {
    return putJson<any>(`${API_PREFIX}/admin/fees/bnpl`, settings);
  },

  // Category Margin Management
  async updateCategoryMargin(categoryId: string, marginPercentage: number) {
    return putJson<any>(`${API_PREFIX}/admin/categories/${categoryId}/margin`, { marginPercentage });
  },
  async updateAllCategoryMargins(marginPercentage: number) {
    return putJson<any>(`${API_PREFIX}/admin/categories/margin/all`, { marginPercentage });
  },

  // Payout management
  async listPayoutRequests(params: { status?: string; page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return getJson<any>(`${API_PREFIX}/admin/payouts${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async approvePayout(id: string) {
    return postJson<any>(`${API_PREFIX}/admin/payouts/${id}/approve`, {});
  },
  async rejectPayout(id: string, note?: string) {
    return postJson<any>(`${API_PREFIX}/admin/payouts/${id}/reject`, { note });
  },
  async updatePayoutStatus(id: string, status: string, note?: string) {
    return postJson<any>(`${API_PREFIX}/admin/payouts/${id}/status`, { status, note });
  },
  async bulkApprovePayouts(ids: string[]) {
    return postJson<any>(`${API_PREFIX}/admin/payouts/bulk-approve`, { ids });
  },
  async bulkRejectPayouts(ids: string[], note?: string) {
    return postJson<any>(`${API_PREFIX}/admin/payouts/bulk-reject`, { ids, note });
  },

  // Bulk merchant actions
  async bulkMerchantStatus(ids: string[], status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') {
    return postJson<any>(`${API_PREFIX}/admin/merchants/bulk-status`, { ids, status });
  },
  async setMerchantCategories(merchantId: string, categoryIds: string[], allCategories?: boolean) {
    return putJson<any>(`${API_PREFIX}/admin/merchants/${merchantId}/categories`, { categoryIds, allCategories });
  },

  // Bulk user actions
  async bulkUserActive(ids: string[], isActive: boolean) {
    return postJson<any>(`${API_PREFIX}/admin/users/bulk-active`, { ids, isActive });
  },

  // Bulk product actions
  async bulkProductActive(ids: string[], isActive: boolean) {
    return postJson<any>(`${API_PREFIX}/admin/products/bulk-active`, { ids, isActive });
  },
};

// Merchant API wrapper
export const merchantApi = {
  async profile() { return getJson<any>(`${API_PREFIX}/merchant/profile`); },
  async updateProfile(data: any) { return putJson<any>(`${API_PREFIX}/merchant/profile`, data); },
  async getCategories() { return getJson<any>(`${API_PREFIX}/merchant/categories`); },
  async setCategories(categoryIds: string[], allCategories?: boolean) {
    return putJson<any>(`${API_PREFIX}/merchant/categories`, { categoryIds, allCategories });
  },
  async getSettings() { return getJson<any>(`${API_PREFIX}/merchant/settings`); },
  async updateSettings(data: any) { return putJson<any>(`${API_PREFIX}/merchant/settings`, data); },

  // Dedicated notification preferences (cleaner than generic settings)
  async getNotificationPreferences() {
    return getJson<any>(`${API_PREFIX}/merchant/notification-preferences`);
  },
  async updateNotificationPreferences(prefs: any) {
    return putJson<any>(`${API_PREFIX}/merchant/notification-preferences`, prefs);
  },

  async getMerchantNotifications() {
    return getJson<any>(`${API_PREFIX}/merchant/notifications`);
  },
  async getMerchantUnreadNotificationCount() {
    return getJson<any>(`${API_PREFIX}/merchant/notifications/unread-count`);
  },
  async markNotificationRead(id: string) {
    return postJson<any>(`${API_PREFIX}/merchant/notifications/${id}/read`, {});
  },
  async markAllNotificationsRead() {
    return postJson<any>(`${API_PREFIX}/merchant/notifications/mark-all-read`, {});
  },

  // Wallet
  async wallet() { return getJson<any>(`${API_PREFIX}/merchant/wallet`); },

  // Payout requests
  async getPayoutRequests() {
    return getJson<any>(`${API_PREFIX}/merchant/payouts`);
  },
  async requestPayout(amount: number, provider: string) {
    return postJson<any>(`${API_PREFIX}/merchant/payouts/request`, { amount, provider });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return postJson<any>(`${API_PREFIX}/merchant/change-password`, { currentPassword, newPassword });
  },
  async dashboard() { return getJson<any>(`${API_PREFIX}/merchant/dashboard`); },
  async orders(params: { page?: number; limit?: number } = {}) {
    const q = new URLSearchParams(); if (typeof params.limit === 'number') q.set('limit', String(params.limit)); if (typeof params.page === 'number') q.set('page', String(params.page));
    return getJson<any>(`${API_PREFIX}/merchant/orders${q.toString() ? `?${q.toString()}` : ''}`);
  },
  // products(arg) supports two usages:
  // - products(merchantId: string) -> GET /merchants/:id/products (public)
  // - products({page,limit}) -> POST /merchant/products (self)
  async products(arg?: { page?: number; limit?: number } | string) {
    if (typeof arg === 'string') {
      const id = arg;
      // return array directly for callers that expect a list
      const r = await fetchJson<any>(`${API_PREFIX}/merchants/${id}/products`);
      return r.data ?? [];
    }
    const params = (arg as { page?: number; limit?: number } | undefined) ?? {};
    const q = new URLSearchParams(); if (typeof params.limit === 'number') q.set('limit', String(params.limit)); if (typeof params.page === 'number') q.set('page', String(params.page));
    const url = `${API_PREFIX}/merchant/products${q.toString() ? `?${q.toString()}` : ''}`;
    return getJson<any>(url);
  },
  async createProduct(body: any) { return postJson<any>(`${API_PREFIX}/merchant/products`, body); },
  async updateProduct(id: string, body: any) {
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/merchant/products/${id}`, { method: 'PUT', headers, credentials: 'same-origin', body: JSON.stringify(body) });
    if (!res.ok) {
      let msg = `Request failed ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore JSON parse error */ }
      throw new ApiError(msg);
    }
    return (await res.json()) as any;
  },
  async deleteProduct(id: string) {
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/merchant/products/${id}`, { method: 'DELETE', headers, credentials: 'same-origin' });
    if (!res.ok) {
      let msg = `Request failed ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore JSON parse error */ }
      throw new ApiError(msg);
    }
    return (await res.json()) as any;
  },

  // Merchant Staff Management
  async createMerchantUser(body: { fullName: string; email: string; phone?: string; password: string; pin?: string }) {
    return postJson<any>(`${API_PREFIX}/merchant/users`, body);
  },
  async updateMerchantUser(id: string, body: { fullName?: string; email?: string; phone?: string; role?: string }) {
    return putJson<any>(`${API_PREFIX}/merchant/users/${id}`, body);
  },
  async updateMerchantUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    return putJson<any>(`${API_PREFIX}/merchant/users/${id}/status`, { status });
  },
  async deleteMerchantUser(id: string) {
    const headers: Record<string,string> = {};
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/merchant/users/${id}`, { method: 'DELETE', headers, credentials: 'same-origin' });
    if (!res.ok) {
      let msg = `Request failed ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore JSON parse error */ }
      throw new ApiError(msg);
    }
    return true;
  },
  async resetMerchantUserPassword(id: string, password?: string) {
    return postJson<any>(`${API_PREFIX}/merchant/users/${id}/reset-password`, { password });
  },

  // Merchant Customers (CRUD)
  async getMerchantCustomers(params?: { page?: number; limit?: number; search?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return getJson<any>(`${API_PREFIX}/merchant/customers${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async createMerchantCustomer(body: { fullName: string; email: string; phone: string; password: string; pin?: string; creditLimit?: number }) {
    return postJson<any>(`${API_PREFIX}/merchant/customers`, body);
  },
  async updateMerchantCustomer(id: string, body: { fullName?: string; email?: string; phone?: string; creditLimit?: number }) {
    return putJson<any>(`${API_PREFIX}/merchant/customers/${id}`, body);
  },
  async updateMerchantCustomerStatus(id: string, status: 'active' | 'suspended') {
    return putJson<any>(`${API_PREFIX}/merchant/customers/${id}/status`, { status });
  },
  async deleteMerchantCustomer(id: string) {
    const headers: Record<string,string> = {};
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/merchant/customers/${id}`, { method: 'DELETE', headers, credentials: 'same-origin' });
    if (!res.ok) {
      let msg = `Request failed ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore JSON parse error */ }
      throw new ApiError(msg);
    }
    return true;
  },
  async resetMerchantCustomerPassword(id: string, password?: string) {
    return postJson<any>(`${API_PREFIX}/merchant/customers/${id}/reset-password`, { password });
  },
  async creditClientWallet(customerId: string, amount: number, note?: string) {
    return postJson<any>(`${API_PREFIX}/merchant/customers/${customerId}/wallet/credit`, { amount, note });
  },
  async contributeToInstallment(instalmentId: string, amount: number, note?: string) {
    return postJson<any>(`${API_PREFIX}/merchant/installments/${instalmentId}/contribute`, { amount, note });
  },

  // Image Upload
  async uploadImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);
    const headers: Record<string, string> = {};
    if (tokenStore?.access) headers['Authorization'] = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${API_PREFIX}/upload/image`, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: formData,
    });
    if (!res.ok) {
      let msg = `Upload failed ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
      throw new ApiError(msg);
    }
    return (await res.json()) as { url: string };
  },
};

// Accounting API placeholder
export const accountingApi = {
  async journal(page: number = 1, limit: number = 50) {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', String(limit));
    return getJson<any>(`${API_PREFIX}/admin/accounting/journal?${q.toString()}`);
  },
  async postJournal(body: any) {
    return postJson<any>(`${API_PREFIX}/admin/accounting/journal`, body);
  },
  async trialBalance(params: { from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return getJson<any>(`${API_PREFIX}/admin/accounting/trial-balance${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async incomeStatement(params: { from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return getJson<any>(`${API_PREFIX}/admin/accounting/reports/income-statement${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async balanceSheet(params: { from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return getJson<any>(`${API_PREFIX}/admin/accounting/reports/balance-sheet${q.toString() ? `?${q.toString()}` : ''}`);
  },

};

export type { PlatformCategory } from './mocks';

