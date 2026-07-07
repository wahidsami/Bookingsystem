export const API_BASE_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
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
  return payload;
}

class TenantApiAdapter {
  private fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    this.fetchImpl = fetchImpl || window.fetch.bind(window);
  }

  private get baseUrl(): string {
    return API_BASE_URL;
  }

  private getToken(): string | null {
    return this.getAccessToken();
  }

  private async handleResponse(response: Response): Promise<any> {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Request failed') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return data;
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

  private buildQueryString(params?: Record<string, any>): string {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        const normalizedArray = value
          .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
          .filter((item) => item.length > 0 && !['all', 'any', 'none', 'select', 'default', '*'].includes(item.toLowerCase()));
        if (normalizedArray.length === 0) return;
        value = normalizedArray.join(',');
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        if (Object.keys(value).length === 0) return;
        value = JSON.stringify(value);
      }

      const normalized = typeof value === 'string' ? value.trim() : String(value);
      const lower = normalized.toLowerCase();
      if (
        normalized.length === 0 ||
        ['all', 'any', 'none', 'select', 'default', '*'].includes(lower)
      ) {
        return;
      }

      q.set(key, key === 'sortOrder' ? normalized.toUpperCase() : normalized);
    });
    return q.toString();
  }

  async getCustomers(params: Record<string, string | number | undefined>): Promise<CustomerListResponse> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/customers${query ? `?${query}` : ''}`);
  }

  async getCustomer(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/customers/${id}${query ? `?${query}` : ''}`);
  }

  async getCustomerHistory(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/customers/${id}/history${query ? `?${query}` : ''}`);
  }

  async getCustomerTransactions(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/customers/${id}/transactions${query ? `?${query}` : ''}`);
  }

  async getEmployees(): Promise<any> {
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
  async getProducts(): Promise<any> {
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

  async getMessages(): Promise<any> {
    return this.get('/tenant/messages');
  }

  async createMessage(data: Record<string, any>): Promise<any> {
    return this.post('/tenant/messages', data);
  }

  async deleteMessage(id: string): Promise<any> {
    return this.delete(`/tenant/messages/${id}`);
  }

  async getServices(): Promise<any> {
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

  async getAppointmentsBoard(date: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString({ date, ...(params || {}) });
    return this.get(`/tenant/appointments/board${query ? `?${query}` : ''}`);
  }

  async getAppointments(params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/appointments${query ? `?${query}` : ''}`);
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

  async updateAppointmentStatus(id: string, status: string, notes?: string): Promise<any> {
    return this.request(`/tenant/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes, notifyCustomer: true })
    });
  }

  async reassignAppointmentStaff(id: string, staffId: string): Promise<any> {
    return this.patch(`/tenant/appointments/${id}/reassign-staff`, {
      staffId
    });
  }

  async reassignRescheduleAppointment(
    id: string,
    data: { staffId: string; startTime: string; notifyCustomer?: boolean }
  ): Promise<any> {
    return this.patch(`/tenant/appointments/${id}/reassign-reschedule`, {
      ...data,
      notifyCustomer: data.notifyCustomer ?? true
    });
  }

  async getEmployeeShifts(employeeId: string): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/shifts`);
  }

  async createEmployeeShift(employeeId: string, shiftData: {
    dayOfWeek?: number | null;
    specificDate?: string | null;
    startTime: string;
    endTime: string;
    isRecurring?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    label?: string;
  }): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/shifts`, {
      method: 'POST',
      body: JSON.stringify(shiftData),
    });
  }

  async updateEmployeeShift(employeeId: string, shiftId: string, shiftData: any): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/shifts/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify(shiftData),
    });
  }

  async deleteEmployeeShift(employeeId: string, shiftId: string): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/shifts/${shiftId}`, {
      method: 'DELETE',
    });
  }

  async getEmployeeBreaks(employeeId: string): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/breaks`);
  }

  async createEmployeeBreak(employeeId: string, breakData: {
    dayOfWeek?: number | null;
    specificDate?: string | null;
    startTime: string;
    endTime: string;
    type?: 'lunch' | 'prayer' | 'cleaning' | 'other';
    label?: string;
    isRecurring?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    referenceDate?: string | null;
  }): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/breaks`, {
      method: 'POST',
      body: JSON.stringify(breakData),
    });
  }

  async updateEmployeeBreak(employeeId: string, breakId: string, breakData: any): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/breaks/${breakId}`, {
      method: 'PUT',
      body: JSON.stringify(breakData),
    });
  }

  async deleteEmployeeBreak(employeeId: string, breakId: string): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/breaks/${breakId}`, {
      method: 'DELETE',
    });
  }

  async getDashboardStats(): Promise<any> {
    return this.get('/tenant/dashboard/stats');
  }

  async getTodaysAppointments(): Promise<any> {
    return this.get('/tenant/dashboard/todays-appointments');
  }

  // --- Reports ---
  async getReportsSummary(params: Record<string, string | number | undefined> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/summary${query ? `?${query}` : ''}`);
  }

  async getDashboardSummary(params: Record<string, string | number | undefined> = {}): Promise<any> {
    return this.getReportsSummary(params);
  }

  async getFinancialOverview(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/financial/overview${query ? `?${query}` : ''}`);
  }

  async getBookingTrends(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/booking-trends${query ? `?${query}` : ''}`);
  }

  async getFullReport(startDate: string, endDate: string, sections: string[] = []): Promise<any> {
    const query = this.buildQueryString({ startDate, endDate, sections });
    return this.get(`/tenant/reports/full${query ? `?${query}` : ''}`);
  }

  async getPeakHoursAnalysis(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/peak-hours${query ? `?${query}` : ''}`);
  }

  async getServicePerformance(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/service-performance?startDate=${startDate}&endDate=${endDate}`);
  }

  async getEmployeePerformance(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/employee-performance?startDate=${startDate}&endDate=${endDate}`);
  }

  async getCustomerAnalytics(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/customer-analytics?startDate=${startDate}&endDate=${endDate}`);
  }

  async getRebookingAnalytics(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/rebookings?startDate=${startDate}&endDate=${endDate}`);
  }

  async getProductRevenue(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/financial/products${query ? `?${query}` : ''}`);
  }

  async getRefundsReport(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/refunds?startDate=${startDate}&endDate=${endDate}`);
  }

  async getPaymentMethodsReport(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/payment-methods?startDate=${startDate}&endDate=${endDate}`);
  }

  async getPosClosingSummary(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/pos/closing${query ? `?${query}` : ''}`);
  }

  async getAdvancedAnalytics(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/advanced-analytics${query ? `?${query}` : ''}`);
  }

  // --- POS & Cart Checkout ---
  async checkoutProducts(payload: any): Promise<any> {
    return this.post('/tenant/cart/products/purchase', payload);
  }

  async checkoutGiftCards(payload: any): Promise<any> {
    return this.post('/tenant/cart/gift-cards/purchase', payload);
  }

  async updateAppointmentPaymentStatus(id: string, payload: any): Promise<any> {
    return this.patch(`/tenant/appointments/${id}/payment`, payload);
  }

  async recordRemainderPayment(id: string, payload: any): Promise<any> {
    return this.post(`/tenant/appointments/${id}/record-payment`, payload);
  }

  async topUpCustomerWallet(id: string, payload: any): Promise<any> {
    return this.post(`/tenant/customers/${id}/wallet/topup`, payload);
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
