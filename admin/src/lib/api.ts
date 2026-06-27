export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const API_ORIGIN = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, '')
  : 'http://localhost:5000';

export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const prefix = normalized.startsWith('uploads/') ? '' : 'uploads/';
  return `${API_ORIGIN}/${prefix}${normalized}`;
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiOptions {
  headers?: Record<string, string>;
  body?: any;
}

class AdminApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('rifah_admin_token');
  }

  private async request<T>(
    endpoint: string,
    method: RequestMethod = 'GET',
    options: ApiOptions = {}
  ): Promise<T> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (options.body && method !== 'GET') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        sessionStorage.removeItem('rifah_admin_token');
        sessionStorage.removeItem('rifah_admin_refresh_token');
        window.location.href = '/login';
      }
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  private async requestBlob(endpoint: string): Promise<{ blob: Blob; filename: string }> {
    const token = this.getToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem('rifah_admin_token');
        sessionStorage.removeItem('rifah_admin_refresh_token');
        window.location.href = '/login';
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to download document');
      }
      throw new Error(`Failed to download document: ${response.status}`);
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);

    return {
      blob: await response.blob(),
      filename: filenameMatch?.[1] || 'document.pdf'
    };
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{
      success: boolean;
      accessToken: string;
      refreshToken: string;
      admin: any;
    }>('/auth/admin/login', 'POST', { body: { email, password } });
  }

  async getProfile() {
    return this.request<{ success: boolean; admin: any }>('/auth/admin/profile');
  }

  // Dashboard Stats
  async getDashboardStats() {
    return this.request<{ success: boolean; stats: any }>('/admin/stats/dashboard');
  }

  async getRecentActivities(limit: number = 20) {
    return this.request<{ success: boolean; activities: any[] }>(`/admin/stats/activities?limit=${limit}`);
  }

  async getAdminNotifications(params: { page?: number; limit?: number; unreadOnly?: boolean; type?: string; severity?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page != null) query.append('page', params.page.toString());
    if (params.limit != null) query.append('limit', params.limit.toString());
    if (params.unreadOnly != null) query.append('unreadOnly', String(params.unreadOnly));
    if (params.type) query.append('type', params.type);
    if (params.severity) query.append('severity', params.severity);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ success: boolean; notifications: any[]; unreadCount: number; pagination: any }>(`/admin/notifications${suffix}`);
  }

  async getAdminNotificationUnreadCount() {
    return this.request<{ success: boolean; unreadCount: number }>('/admin/notifications/unread-count');
  }

  async markAdminNotificationRead(id: string) {
    return this.request<{ success: boolean; notification: any }>(`/admin/notifications/${id}/read`, 'PATCH');
  }

  async markAllAdminNotificationsRead() {
    return this.request<{ success: boolean }>('/admin/notifications/read-all', 'PATCH');
  }

  async getChartData(period: string = '30d') {
    return this.request<{ success: boolean; chartData: any }>(`/admin/stats/charts?period=${period}`);
  }

  // Tenants
  async getTenants(params: Record<string, any> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; tenants: any[]; pagination: any }>(`/admin/tenants?${query}`);
  }

  async getPendingTenants() {
    return this.request<{ success: boolean; tenants: any[]; count: number }>('/admin/tenants/pending');
  }

  async getTenantDetails(id: string) {
    return this.request<{ success: boolean; tenant: any; activities: any[]; bookingStats: any }>(`/admin/tenants/${id}`);
  }

  async getTenantBills(id: string) {
    return this.request<{ success: boolean; bills: any[]; summary: any }>(`/admin/tenants/${id}/bills`);
  }

  async getBillDetails(id: string) {
    return this.request<{ success: boolean; bill: any }>(`/admin/bills/${id}`);
  }

  async downloadBillInvoicePdf(id: string) {
    return this.requestBlob(`/admin/bills/${id}/invoice-pdf`);
  }

  async downloadBillReceiptPdf(id: string) {
    return this.requestBlob(`/admin/bills/${id}/receipt-pdf`);
  }

  async reconcileBillPayment(
    id: string,
    payload: {
      paymentProvider: string;
      paymentReference: string;
      paymentMethod: string;
      checkoutSessionId?: string;
      gatewayStatus?: string;
      notes?: string;
      idempotencyKey?: string;
    }
  ) {
    return this.request<{
      success: boolean;
      message: string;
      alreadyPaid?: boolean;
      duplicate?: boolean;
      bill?: any;
      attempt?: any;
    }>(`/admin/bills/${id}/reconcile-payment`, 'POST', { body: payload });
  }

  async voidBill(id: string, payload?: { reason?: string }) {
    return this.request<{
      success: boolean;
      message: string;
      bill?: any;
    }>(`/admin/bills/${id}/void`, 'POST', { body: payload || {} });
  }

  async approveTenant(id: string, notes?: string) {
    return this.request<{ success: boolean; tenant: any }>(`/admin/tenants/${id}/approve`, 'POST', { body: { notes } });
  }

  private async requestFormData<T>(
    endpoint: string,
    method: Exclude<RequestMethod, 'GET'>,
    formData: FormData
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem('rifah_admin_token');
        sessionStorage.removeItem('rifah_admin_refresh_token');
        window.location.href = '/login';
      }
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  async resendTenantPaymentEmail(id: string, billId?: string, ccEmail?: string) {
    return this.request<{ success: boolean; message: string; bill?: any }>(`/admin/tenants/${id}/resend-payment-email`, 'POST', {
      body: {
        ...(billId ? { billId } : {}),
        ...(ccEmail ? { ccEmail } : {})
      }
    });
  }

  async rejectTenant(id: string, reason: string) {
    return this.request<{ success: boolean; tenant: any }>(`/admin/tenants/${id}/reject`, 'POST', { body: { reason } });
  }

  async suspendTenant(id: string, reason: string) {
    return this.request<{ success: boolean; tenant: any }>(`/admin/tenants/${id}/suspend`, 'POST', { body: { reason } });
  }

  async activateTenant(id: string) {
    return this.request<{ success: boolean; tenant: any }>(`/admin/tenants/${id}/activate`, 'POST');
  }

  async updateTenant(id: string, data: any) {
    return this.request<{ success: boolean; tenant: any }>(`/admin/tenants/${id}`, 'PUT', { body: data });
  }

  async deleteTenant(id: string) {
    return this.request<{ success: boolean; message: string }>(`/admin/tenants/${id}`, 'DELETE');
  }

  // Users
  async getUsers(params: Record<string, any> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; users: any[]; pagination: any }>(`/admin/users?${query}`);
  }

  async getUserDetails(id: string) {
    return this.request<{ success: boolean; user: any; bookings: any[]; transactions: any[]; stats: any }>(`/admin/users/${id}`);
  }

  async updateUser(id: string, data: any) {
    return this.request<{ success: boolean; user: any }>(`/admin/users/${id}`, 'PUT', { body: data });
  }

  async toggleUserStatus(id: string, isActive: boolean, reason?: string) {
    return this.request<{ success: boolean }>(`/admin/users/${id}/toggle-status`, 'POST', { body: { isActive, reason } });
  }

  async adjustUserBalance(id: string, type: 'wallet' | 'loyalty', amount: number, reason: string) {
    return this.request<{ success: boolean }>(`/admin/users/${id}/adjust-balance`, 'POST', { body: { type, amount, reason } });
  }

  // Packages
  async getPackages(includeInactive: boolean = false) {
    return this.request<{ success: boolean; packages: any[] }>(`/admin/packages${includeInactive ? '?includeInactive=true' : ''}`);
  }

  async getPackage(id: string) {
    return this.request<{ success: boolean; package: any }>(`/admin/packages/${id}`);
  }

  async createPackage(data: any) {
    return this.request<{ success: boolean; message: string; package: any }>('/admin/packages', 'POST', { body: data });
  }

  async updatePackage(id: string, data: any) {
    return this.request<{ success: boolean; message: string; package: any }>(`/admin/packages/${id}`, 'PUT', { body: data });
  }

  async deletePackage(id: string) {
    return this.request<{ success: boolean; message: string }>(`/admin/packages/${id}`, 'DELETE');
  }

  // Settings
  async getSettings() {
    return this.request<{ success: boolean; settings: any }>('/admin/settings');
  }

  async updateSettings(settings: Record<string, any>) {
    return this.request<{ success: boolean; message: string; settings: any }>('/admin/settings', 'PUT', { body: settings });
  }

  // Financial Reporting
  async getFinancialDashboardOverview(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{
      success: boolean;
      data: {
        summary: any;
        leaderboard: any[];
        monthlyComparison: any[];
        commissionBreakdown: any[];
        topEmployees: any[];
        comparison?: any;
      };
    }>(`/admin/financial/dashboard?${params.toString()}`);
  }

  async getFinancialComparison(
    startDate: string,
    endDate: string,
    options?: { mode?: 'current_previous' | 'month_over_month' | 'year_over_year' | 'custom_vs_custom'; compareStartDate?: string; compareEndDate?: string }
  ) {
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    if (options?.mode) params.append('mode', options.mode);
    if (options?.compareStartDate) params.append('compareStartDate', options.compareStartDate);
    if (options?.compareEndDate) params.append('compareEndDate', options.compareEndDate);
    return this.request<{ success: boolean; data: any }>(`/admin/financial/comparison?${params.toString()}`);
  }

  async getReportBuilderOptions() {
    return this.request<{ success: boolean; data: any }>('/admin/financial/reports/builder/options');
  }

  async previewCustomReport(payload: Record<string, any>) {
    return this.request<{ success: boolean; data: any }>('/admin/financial/reports/builder/preview', 'POST', { body: payload });
  }

  async getSavedCustomReports() {
    return this.request<{ success: boolean; data: any[] }>('/admin/financial/reports/builder/saved');
  }

  async getSavedCustomReport(id: string) {
    return this.request<{ success: boolean; data: any }>(`/admin/financial/reports/builder/saved/${id}`);
  }

  async createSavedCustomReport(payload: Record<string, any>) {
    return this.request<{ success: boolean; data: any }>('/admin/financial/reports/builder/saved', 'POST', { body: payload });
  }

  async updateSavedCustomReport(id: string, payload: Record<string, any>) {
    return this.request<{ success: boolean; data: any }>(`/admin/financial/reports/builder/saved/${id}`, 'PUT', { body: payload });
  }

  async deleteSavedCustomReport(id: string) {
    return this.request<{ success: boolean; data: any }>(`/admin/financial/reports/builder/saved/${id}`, 'DELETE');
  }

  async runSavedCustomReport(id: string) {
    return this.request<{ success: boolean; data: any }>(`/admin/financial/reports/builder/saved/${id}/run`, 'POST');
  }

  async getSavedCustomReportHistory(id: string) {
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/reports/builder/saved/${id}/history`);
  }

  async getOperationalInsights(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any }>(`/admin/financial/insights?${params.toString()}`);
  }

  async getPlatformFinancialSummary(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any }>(`/admin/financial/summary?${params.toString()}`);
  }

  async getTenantFinancials(tenantId?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenantId', tenantId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any }>(`/admin/financial/tenants?${params.toString()}`);
  }

  async getTenantLeaderboard(limit: number = 10, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/leaderboard?${params.toString()}`);
  }

  async getMonthlyComparison(limit: number = 12) {
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/monthly-comparison?limit=${limit}`);
  }

  async getCommissionBreakdown(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/commission-breakdown?${params.toString()}`);
  }

  async getTopEmployees(limit: number = 20, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/top-employees?${params.toString()}`);
  }

  async getTransactionDetails(tenantId: string, limit: number = 50, offset: number = 0) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/transactions/${tenantId}?${params.toString()}`);
  }

  async getTenantEmployeeMetrics(tenantId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/employee-metrics/${tenantId}?${params.toString()}`);
  }

  async getRevenueByType(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: Record<string, { count: number; amount: number; platformFee: number; tenantRevenue: number }> }>(`/admin/financial/revenue-by-type?${params.toString()}`);
  }

  async getBillsSummary(status?: string) {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<{ success: boolean; data: Record<string, { count: number; totalAmount: number }> }>(`/admin/financial/bills-summary${params}`);
  }

  async getFinancialInvoices(
    params: {
      page?: number;
      limit?: number;
      status?: string;
      type?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      tenantId?: string;
    } = {}
  ) {
    const search = new URLSearchParams();
    if (params.page != null) search.append('page', params.page.toString());
    if (params.limit != null) search.append('limit', params.limit.toString());
    if (params.status) search.append('status', params.status);
    if (params.type) search.append('type', params.type);
    if (params.search) search.append('search', params.search);
    if (params.startDate) search.append('startDate', params.startDate);
    if (params.endDate) search.append('endDate', params.endDate);
    if (params.tenantId) search.append('tenantId', params.tenantId);
    const suffix = search.toString() ? `?${search.toString()}` : '';

    return this.request<{
      success: boolean;
      bills: any[];
      summary: Record<string, { count: number; totalAmount: number }>;
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>(`/admin/financial/invoices${suffix}`);
  }

  async getAnalyticsDrilldown(params: {
    entity: 'transactions' | 'appointments' | 'payments' | 'customers' | 'employees' | 'services' | 'products' | 'invoices' | 'bills';
    page?: number;
    limit?: number;
    search?: string;
    tenantId?: string;
    status?: string;
    type?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    active?: string;
  }) {
    const search = new URLSearchParams();
    search.append('entity', params.entity);
    if (params.page != null) search.append('page', params.page.toString());
    if (params.limit != null) search.append('limit', params.limit.toString());
    if (params.search) search.append('search', params.search);
    if (params.tenantId) search.append('tenantId', params.tenantId);
    if (params.status) search.append('status', params.status);
    if (params.type) search.append('type', params.type);
    if (params.paymentStatus) search.append('paymentStatus', params.paymentStatus);
    if (params.paymentMethod) search.append('paymentMethod', params.paymentMethod);
    if (params.category) search.append('category', params.category);
    if (params.startDate) search.append('startDate', params.startDate);
    if (params.endDate) search.append('endDate', params.endDate);
    if (params.active) search.append('active', params.active);
    const suffix = search.toString() ? `?${search.toString()}` : '';

    return this.request<{
      success: boolean;
      data: {
        entity: string;
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        rows: any[];
        summary?: Record<string, any>;
        filters?: Record<string, any>;
      };
    }>(`/admin/financial/drilldown${suffix}`);
  }

  async getPlatformTransactions(params: { startDate?: string; endDate?: string; tenantId?: string; type?: string; limit?: number; offset?: number } = {}) {
    const search = new URLSearchParams();
    if (params.startDate) search.append('startDate', params.startDate);
    if (params.endDate) search.append('endDate', params.endDate);
    if (params.tenantId) search.append('tenantId', params.tenantId);
    if (params.type) search.append('type', params.type);
    if (params.limit != null) search.append('limit', params.limit.toString());
    if (params.offset != null) search.append('offset', params.offset.toString());
    return this.request<{ success: boolean; data: { transactions: any[]; total: number } }>(`/admin/financial/transactions?${search.toString()}`);
  }

  async getCommissionByPackage(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<{ success: boolean; data: any[] }>(`/admin/financial/commission-by-package?${params.toString()}`);
  }

  async getGeneralReport(
    startDate?: string,
    endDate?: string,
    options?: {
      leaderboardLimit?: number;
      monthlyLimit?: number;
      employeesLimit?: number;
      comparisonMode?: 'current_previous' | 'month_over_month' | 'year_over_year' | 'custom_vs_custom';
      compareStartDate?: string;
      compareEndDate?: string;
    }
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (options?.leaderboardLimit != null) params.append('leaderboardLimit', options.leaderboardLimit.toString());
    if (options?.monthlyLimit != null) params.append('monthlyLimit', options.monthlyLimit.toString());
    if (options?.employeesLimit != null) params.append('employeesLimit', options.employeesLimit.toString());
    if (options?.comparisonMode) params.append('mode', options.comparisonMode);
    if (options?.compareStartDate) params.append('compareStartDate', options.compareStartDate);
    if (options?.compareEndDate) params.append('compareEndDate', options.compareEndDate);
    return this.request<{ success: boolean; data: any }>(`/admin/financial/reports/general?${params.toString()}`);
  }

  async getDetailedReport(params: { startDate?: string; endDate?: string; tenantId?: string; type?: string; limit?: number; offset?: number } = {}) {
    const search = new URLSearchParams();
    if (params.startDate) search.append('startDate', params.startDate);
    if (params.endDate) search.append('endDate', params.endDate);
    if (params.tenantId) search.append('tenantId', params.tenantId);
    if (params.type) search.append('type', params.type);
    if (params.limit != null) search.append('limit', params.limit.toString());
    if (params.offset != null) search.append('offset', params.offset.toString());
    return this.request<{ success: boolean; data: any }>(`/admin/financial/reports/detailed?${search.toString()}`);
  }

  // Hot Deals Management
  async getHotDeals(status: string = 'ALL') {
    const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<{ success: boolean; deals: any[]; summary?: Record<string, number> }>(`/admin/hot-deals${query}`);
  }

  async getPendingHotDeals() {
    return this.request<{ success: boolean; deals: any[] }>('/admin/hot-deals/pending');
  }

  async approveHotDeal(id: string) {
    return this.request<{ success: boolean; deal: any }>(`/admin/hot-deals/${id}/approve`, 'POST');
  }

  async rejectHotDeal(id: string, reason: string) {
    return this.request<{ success: boolean; deal: any }>(`/admin/hot-deals/${id}/reject`, 'POST', { body: { reason } });
  }

  // Service Categories Management
  async getCategories(includeHidden: boolean = false) {
    return this.request<{ success: boolean; categories: any[] }>(`/admin/categories${includeHidden ? '?includeHidden=true' : ''}`);
  }

  async createCategory(data: { name_en: string; name_ar: string; icon?: string; sortOrder?: number }) {
    return this.request<{ success: boolean; category: any }>('/admin/categories', 'POST', { body: data });
  }

  async updateCategory(id: string, data: { name_en?: string; name_ar?: string; icon?: string; sortOrder?: number; isActive?: boolean }) {
    return this.request<{ success: boolean; category: any }>(`/admin/categories/${id}`, 'PUT', { body: data });
  }

  async deleteCategory(id: string, hard: boolean = false) {
    return this.request<{ success: boolean; message: string }>(`/admin/categories/${id}${hard ? '?hard=true' : ''}`, 'DELETE');
  }

  async reorderCategories(orderMap: { id: string; sortOrder: number }[]) {
    return this.request<{ success: boolean; categories: any[] }>('/admin/categories/reorder', 'PUT', { body: { orderMap } });
  }

  // Feature Pricing Management
  async getFeaturePricing() {
    return this.request<{ success: boolean; features: any[] }>('/admin/feature-pricing');
  }

  async updateFeaturePricing(key: string, unitPrice: number) {
    return this.request<{ success: boolean; feature: any }>(`/admin/feature-pricing/${key}`, 'PUT', { body: { unitPrice } });
  }

  // Gift Cards (Wallet Packages)
  async getGiftPackages() {
    return this.request<{ success: boolean; packages: any[] }>('/admin/gift-packages');
  }

  async getGiftPackage(id: string) {
    return this.request<{ success: boolean; package: any }>(`/admin/gift-packages/${id}`);
  }

  async createGiftPackage(data: any, imageFile?: File | null) {
    if (imageFile) {
      const formData = new FormData();
      Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        formData.append(key, String(value));
      });
      formData.append('image', imageFile);
      return this.requestFormData<{ success: boolean; package: any; message?: string }>('/admin/gift-packages', 'POST', formData);
    }
    return this.request<{ success: boolean; package: any; message?: string }>('/admin/gift-packages', 'POST', { body: data });
  }

  async updateGiftPackage(id: string, data: any, imageFile?: File | null) {
    if (imageFile) {
      const formData = new FormData();
      Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        formData.append(key, String(value));
      });
      formData.append('image', imageFile);
      return this.requestFormData<{ success: boolean; package: any; message?: string }>(`/admin/gift-packages/${id}`, 'PUT', formData);
    }
    return this.request<{ success: boolean; package: any; message?: string }>(`/admin/gift-packages/${id}`, 'PUT', { body: data });
  }

  async deleteGiftPackage(id: string) {
    return this.request<{ success: boolean; message?: string }>(`/admin/gift-packages/${id}`, 'DELETE');
  }

  async getGiftTransactions(params: { limit?: number; status?: string; packageId?: string; startDate?: string; endDate?: string } = {}) {
    const query = new URLSearchParams();
    if (params.limit != null) query.append('limit', String(params.limit));
    if (params.status) query.append('status', params.status);
    if (params.packageId) query.append('packageId', params.packageId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ success: boolean; transactions: any[]; count: number }>(`/admin/gift-transactions${suffix}`);
  }

  async getGiftTransactionsReport(params: { status?: string; packageId?: string; startDate?: string; endDate?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.packageId) query.append('packageId', params.packageId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<{
      success: boolean;
      report: {
        totals: {
          transactionsCount: number;
          purchaseAmountTotal: number;
          creditAmountTotal: number;
          bonusAmountTotal: number;
        };
        byStatus: Record<string, number>;
        topPurchasers: Array<{
          senderId: string;
          senderName: string;
          senderEmail?: string | null;
          transactionsCount: number;
          purchaseAmountTotal: number;
          creditAmountTotal: number;
        }>;
        topRecipients: Array<{
          recipientId: string;
          recipientName: string;
          recipientEmail?: string | null;
          transactionsCount: number;
          receivedCreditTotal: number;
        }>;
        byPackage: Array<{
          packageId: string;
          packageTitle: string;
          transactionsCount: number;
          purchaseAmountTotal: number;
          creditAmountTotal: number;
        }>;
      };
    }>(`/admin/gift-transactions/report${suffix}`);
  }

  async downloadGiftTransactionsReportCsv(params: { status?: string; packageId?: string; startDate?: string; endDate?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.packageId) query.append('packageId', params.packageId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.requestBlob(`/admin/gift-transactions/report.csv${suffix}`);
  }

  async getGiftRedemptionsReport(params: { tenantId?: string; startDate?: string; endDate?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.tenantId) query.append('tenantId', params.tenantId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.limit !== undefined) query.append('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<{
      success: boolean;
      report: {
        totals: {
          redemptionsCount: number;
          totalRedeemedAmount: number;
          adminGlobalRedeemed: number;
          tenantScopedRedeemed: number;
          outstandingAdminLiability: number;
          outstandingTenantLiability: number;
        };
        recentRedemptions: any[];
        byTenant: any[];
        tenantOutstandingLiability: any[];
        tenantPayables: any[];
      };
    }>(`/admin/gift-redemptions/report${suffix}`);
  }
}


export const adminApi = new AdminApi();
