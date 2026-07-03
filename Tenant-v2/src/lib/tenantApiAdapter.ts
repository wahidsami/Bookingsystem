export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:5000/api/v1';

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const ACCESS_TOKEN_KEY = 'rifah_tenant_access_token';
const REFRESH_TOKEN_KEY = 'rifah_tenant_refresh_token';
const FETCH_BRIDGE_FLAG = '__tenant_v2_fetch_bridge_installed__';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type TenantApiResponse<T = any> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
  [key: string]: any;
};

type CustomerListResponse<T = any> = {
  customers: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    [key: string]: any;
  };
};

type NormalizedCustomerStats = Record<string, any>;

function toAbsoluteUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return new URL(input.toString(), window.location.origin);
  }

  if (typeof input === 'string') {
    return new URL(input, window.location.origin);
  }

  return new URL(input.url, window.location.origin);
}

function isTenantApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/v1/') || pathname.startsWith('/auth/tenant/');
}

function createJsonResponse(body: any, init: ResponseInit & { headers?: HeadersInit } = {}): Response {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pick<T = any>(value: any, keys: string[]): T | undefined {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of keys) {
    if (value[key] !== undefined) return value[key];
  }
  return undefined;
}

function normalizeCustomerStats(payload: TenantApiResponse | Record<string, any>): NormalizedCustomerStats {
  return (
    pick(payload, ['data']) ||
    payload ||
    {}
  );
}

function normalizeCustomerList(payload: TenantApiResponse | Record<string, any>): CustomerListResponse {
  const data = pick(payload, ['data']) || payload || {};
  const customers = pick(data, ['customers', 'items', 'rows']) || [];
  const pagination = pick(data, ['pagination']) || {
    total: Array.isArray(customers) ? customers.length : 0,
    page: 1,
    limit: Array.isArray(customers) ? customers.length : 0,
    totalPages: 1
  };

  return { customers, pagination };
}

function normalizeEntityPayload(payload: TenantApiResponse | Record<string, any>): any {
  return pick(payload, ['data']) || payload || {};
}

function normalizeHistoryPayload(payload: TenantApiResponse | Record<string, any>): any {
  const data = pick(payload, ['data']) || payload || {};
  return {
    history: pick(data, ['history']) || [],
    metrics: pick(data, ['metrics', 'summary']) || null
  };
}

function normalizeMessageList(payload: TenantApiResponse | Record<string, any>): any[] {
  if (Array.isArray(payload)) return payload;
  const data = pick(payload, ['data']) || payload || {};
  return pick(data, ['messages', 'items', 'threads']) || data || [];
}

function normalizeEmployeeList(payload: TenantApiResponse | Record<string, any>): any[] {
  if (Array.isArray(payload)) return payload;
  const data = pick(payload, ['data']) || payload || {};
  return pick(data, ['employees', 'items']) || data || [];
}

function translateRequestBody(pathname: string, method: string, body: any): any {
  if (!body || typeof body !== 'object' || body instanceof FormData) {
    return body;
  }

  if (pathname.includes('/tenant/customers') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const translated = { ...body };
    if (translated.sortField && !translated.sortBy) translated.sortBy = translated.sortField;
    if (translated.sortDirection && !translated.sortOrder) translated.sortOrder = translated.sortDirection;
    if (translated.pageIndex && !translated.page) translated.page = translated.pageIndex;
    if (translated.pageSize && !translated.limit) translated.limit = translated.pageSize;
    return translated;
  }

  return body;
}

function normalizeResponseForPath(pathname: string, method: string, payload: any): any {
  if (pathname === '/api/v1/tenant/customers/stats') {
    return normalizeCustomerStats(payload);
  }

  if (pathname === '/api/v1/tenant/customers' && method === 'GET') {
    return normalizeCustomerList(payload);
  }

  if (/^\/api\/v1\/tenant\/customers\/[^/]+\/history$/.test(pathname) && method === 'GET') {
    return normalizeHistoryPayload(payload);
  }

  if (/^\/api\/v1\/tenant\/customers\/[^/]+$/.test(pathname) && method === 'GET') {
    return normalizeEntityPayload(payload);
  }

  if (pathname === '/api/v1/tenant/messages' && method === 'GET') {
    return normalizeMessageList(payload);
  }

  if (pathname === '/api/v1/tenant/employees' && method === 'GET') {
    return normalizeEmployeeList(payload);
  }

  if (pathname === '/api/v1/tenant/appointments' && method === 'GET') {
    const data = pick(payload, ['data']) || payload || {};
    return pick(data, ['appointments']) || data || [];
  }

  if (/^\/api\/v1\/tenant\/appointments\/[^/]+$/.test(pathname) && method === 'GET') {
    return normalizeEntityPayload(payload);
  }

  return payload;
}

class TenantApiAdapter {
  private fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    this.fetchImpl = fetchImpl || window.fetch.bind(window);
  }

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken?: string | null): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    const response = await this.fetchImpl(`${API_BASE_URL}/auth/tenant/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json().catch(() => null);
    if (data?.success && data?.accessToken) {
      this.setTokens(data.accessToken, data.refreshToken || refreshToken);
      return true;
    }

    return false;
  }

  async login(email: string, password: string): Promise<any> {
    const response = await this.fetchImpl(`${API_BASE_URL}/auth/tenant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (data?.success && data?.accessToken && data?.refreshToken) {
      this.setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/tenant/logout', { method: 'POST' });
    } catch {
      // ignore logout failures and clear local session anyway
    } finally {
      this.clearTokens();
    }
  }

  private buildUrl(input: RequestInfo | URL): URL {
    const url = toAbsoluteUrl(input);
    if (url.pathname.startsWith('/api/v1/')) {
      return new URL(`${API_BASE_URL}${url.pathname.replace(/^\/api\/v1/, '')}${url.search}${url.hash}`);
    }

    if (url.pathname.startsWith('/tenant/')) {
      return new URL(`${API_BASE_URL}${url.pathname}${url.search}${url.hash}`);
    }

    if (url.pathname.startsWith('/auth/tenant/')) {
      return new URL(`${API_BASE_URL}${url.pathname}${url.search}${url.hash}`);
    }

    return url;
  }

  private async requestRaw(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = this.buildUrl(input);
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    const body = init.body;

    if (!(body instanceof FormData) && body !== undefined && body !== null && !headers.has('content-type')) {
      headers.set('Content-Type', 'application/json');
    }

    const accessToken = this.getAccessToken();
    if (accessToken && isTenantApiPath(url.pathname)) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const translatedBody = translateRequestBody(url.pathname, method, body);

    let response = await this.fetchImpl(url.toString(), {
      ...init,
      method,
      headers,
      body: translatedBody instanceof FormData || typeof translatedBody === 'string' || translatedBody == null
        ? translatedBody
        : JSON.stringify(translatedBody)
    });

    if (response.status === 401 && isTenantApiPath(url.pathname) && !url.pathname.startsWith('/auth/tenant/')) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const retryToken = this.getAccessToken();
        if (retryToken) {
          headers.set('Authorization', `Bearer ${retryToken}`);
        }
        response = await this.fetchImpl(url.toString(), {
          ...init,
          method,
          headers,
          body: translatedBody instanceof FormData || typeof translatedBody === 'string' || translatedBody == null
            ? translatedBody
            : JSON.stringify(translatedBody)
        });
      }
    }

    return response;
  }

  async request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const response = await this.requestRaw(input, init);
    const url = this.buildUrl(input);
    const method = (init.method || 'GET').toUpperCase();

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return response;
    }

    const text = await response.clone().text();
    const parsed = safeJsonParse(text);
    if (!parsed) {
      return response;
    }

    const normalized = normalizeResponseForPath(url.pathname, method, parsed);
    if (normalized === parsed) {
      return response;
    }

    return createJsonResponse(normalized, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint, { method: 'GET' });
    return response.json();
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint, { method: 'DELETE' });
    return response.json();
  }

  async getProfile(): Promise<any> {
    return this.get('/tenant/profile');
  }

  async getCustomers(params: Record<string, string | number | undefined>): Promise<CustomerListResponse> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        q.set(key, String(value));
      }
    });
    return this.get(`/tenant/customers${q.toString() ? `?${q.toString()}` : ''}`);
  }

  async getCustomer(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        q.set(key, String(value));
      }
    });
    return this.get(`/tenant/customers/${id}${q.toString() ? `?${q.toString()}` : ''}`);
  }

  async getCustomerHistory(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        q.set(key, String(value));
      }
    });
    return this.get(`/tenant/customers/${id}/history${q.toString() ? `?${q.toString()}` : ''}`);
  }

  async getCustomerTransactions(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        q.set(key, String(value));
      }
    });
    return this.get(`/tenant/customers/${id}/transactions${q.toString() ? `?${q.toString()}` : ''}`);
  }

  async getEmployees(): Promise<any[]> {
    return this.get('/tenant/employees');
  }

  async createEmployee(data: Record<string, any>): Promise<any> {
    return this.post('/tenant/employees', data);
  }

  async updateEmployee(id: string, data: Record<string, any>): Promise<any> {
    return this.put(`/tenant/employees/${id}`, data);
  }

  async deleteEmployee(id: string): Promise<any> {
    return this.delete(`/tenant/employees/${id}`);
  }

  // --- Products ---
  async getProducts(): Promise<any[]> {
    return this.get('/tenant/products');
  }

  async createProduct(data: any): Promise<any> {
    // Check if data is FormData
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    return this.post('/tenant/products', data);
  }

  async updateProduct(id: string, data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/products/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    return this.put(`/tenant/products/${id}`, data);
  }

  async deleteProduct(id: string): Promise<any> {
    return this.delete(`/tenant/products/${id}`);
  }

  async getMessages(): Promise<any[]> {
    return this.get('/tenant/messages');
  }

  async createMessage(data: Record<string, any>): Promise<any> {
    return this.post('/tenant/messages', data);
  }

  async deleteMessage(id: string): Promise<any> {
    return this.delete(`/tenant/messages/${id}`);
  }

  async getServices(): Promise<any[]> {
    return this.get('/tenant/services');
  }

  async createService(data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    return this.post('/tenant/services', data);
  }

  async updateService(id: string, data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/services/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    return this.put(`/tenant/services/${id}`, data);
  }

  async deleteService(id: string): Promise<any> {
    return this.delete(`/tenant/services/${id}`);
  }

  async getAppointmentsBoard(date: string): Promise<any> {
    return this.get(`/tenant/appointments/board?date=${date}`);
  }

  async getAppointments(params?: Record<string, string | number | undefined>): Promise<any[]> {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        q.set(key, String(value));
      }
    });
    return this.get(`/tenant/appointments${q.toString() ? `?${q.toString()}` : ''}`);
  }

  async getAppointment(id: string): Promise<any> {
    return this.get(`/tenant/appointments/${id}`);
  }

  async createAppointment(data: Record<string, any>): Promise<any> {
    return this.post('/tenant/appointments', data);
  }

  async updateAppointment(id: string, data: Record<string, any>): Promise<any> {
    return this.put(`/tenant/appointments/${id}`, data);
  }

  async patchAppointment(id: string, data: Record<string, any>): Promise<any> {
    return this.patch(`/tenant/appointments/${id}`, data);
  }

  async getDashboardStats(): Promise<any> {
    return this.get('/tenant/dashboard/stats');
  }

  async getTodaysAppointments(): Promise<any> {
    return this.get('/tenant/dashboard/todays-appointments');
  }
}

export const tenantApiAdapter = new TenantApiAdapter();

export function installTenantApiFetchBridge(onAuthFailure?: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if ((window as any)[FETCH_BRIDGE_FLAG]) {
    return () => undefined;
  }

  const originalFetch = window.fetch.bind(window);
  const bridgeAdapter = new TenantApiAdapter(originalFetch);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = toAbsoluteUrl(input);
    if (!isTenantApiPath(url.pathname)) {
      return originalFetch(input as any, init);
    }

    try {
      const response = await bridgeAdapter.request(input, init);

      if (response.status === 401 && onAuthFailure) {
        onAuthFailure();
      }

      return response;
    } catch (error) {
      if (onAuthFailure) {
        onAuthFailure();
      }
      throw error;
    }
  }) as typeof window.fetch;

  (window as any)[FETCH_BRIDGE_FLAG] = true;

  return () => {
    window.fetch = originalFetch;
    (window as any)[FETCH_BRIDGE_FLAG] = false;
  };
}
