const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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

  async approveTenant(id: string, notes?: string) {
    return this.request<{ success: boolean; tenant: any }>(`/admin/tenants/${id}/approve`, 'POST', { body: { notes } });
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
    return this.request<{ success: boolean; settings: { serviceCommissionRate: number; productCommissionRate: number; taxRate: number; updatedAt: string } }>('/admin/settings');
  }

  async updateSettings(settings: { serviceCommissionRate: number; productCommissionRate: number; taxRate: number }) {
    return this.request<{ success: boolean; message: string; settings: { serviceCommissionRate: number; productCommissionRate: number; taxRate: number; updatedAt: string } }>('/admin/settings', 'PUT', { body: settings });
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
      };
    }>(`/admin/financial/dashboard?${params.toString()}`);
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

  // Hot Deals Management
  async getPendingHotDeals() {
    return this.request<{ success: boolean; deals: any[] }>('/admin/hot-deals/pending');
  }

  async approveHotDeal(id: string) {
    return this.request<{ success: boolean; deal: any }>(`/admin/hot-deals/${id}/approve`, 'POST');
  }

  async rejectHotDeal(id: string, reason: string) {
    return this.request<{ success: boolean; deal: any }>(`/admin/hot-deals/${id}/reject`, 'POST', { body: { reason } });
  }
}


export const adminApi = new AdminApi();

