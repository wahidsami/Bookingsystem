/**
 * API Client for Tenant Dashboard
 * Handles authenticated requests to the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  [key: string]: any;
}

class TenantApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get access token from session storage
   */
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('rifah_tenant_access_token');
  }

  /**
   * Get refresh token from local storage
   */
  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('rifah_tenant_refresh_token');
  }

  /**
   * Set tokens in storage
   */
  private setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('rifah_tenant_access_token', accessToken);
    localStorage.setItem('rifah_tenant_refresh_token', refreshToken);
  }

  /**
   * Clear tokens from storage
   */
  private clearTokens(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('rifah_tenant_access_token');
    localStorage.removeItem('rifah_tenant_refresh_token');
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseUrl}/auth/tenant/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.accessToken) {
        sessionStorage.setItem('rifah_tenant_access_token', data.accessToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Make an authenticated API request
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = this.getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // If unauthorized, try to refresh token
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();

      if (refreshed) {
        // Retry request with new token
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }

        response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        // Refresh failed, clear tokens and redirect to login
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'API request failed');
    }

    return data;
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Login tenant
   */
  async login(email: string, password: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/auth/tenant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success && data.accessToken && data.refreshToken) {
      this.setTokens(data.accessToken, data.refreshToken);
      return data;
    }

    throw new Error(data.message || 'Login failed');
  }

  /**
   * Logout tenant
   */
  async logout(): Promise<void> {
    try {
      await this.post('/auth/tenant/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/ar/login';
      }
    }
  }

  /**
   * Dashboard
   */
  async getDashboardStats(): Promise<any> {
    return this.get('/tenant/dashboard/stats');
  }

  async getTodaysAppointments(): Promise<any> {
    return this.get('/tenant/dashboard/todays-appointments');
  }

  /**
   * Employee Management
   */
  async getEmployees(params?: { isActive?: boolean; search?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.isActive !== undefined) {
      queryParams.append('isActive', params.isActive.toString());
    }
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    const query = queryParams.toString();
    return this.get(`/tenant/employees${query ? `?${query}` : ''}`);
  }

  async getEmployee(id: string): Promise<any> {
    return this.get(`/tenant/employees/${id}`);
  }

  async createEmployee(data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/employees`, {
      method: 'POST',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/employees`, {
          method: 'POST',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to create employee');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      // If response is not JSON, get text
      const text = await response.text();
      console.error('Failed to parse response as JSON:', text);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      // Show more detailed error message
      const errorMsg = result.message || result.error || 'Failed to create employee';
      console.error('Employee creation error:', {
        status: response.status,
        statusText: response.statusText,
        message: errorMsg,
        error: result.error,
        errorName: result.errorName,
        details: result.details,
        requestBody: result.requestBody,
        fullResponse: result
      });
      throw new Error(errorMsg);
    }
    return result;
  }

  async updateEmployee(id: string, data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/employees/${id}`, {
      method: 'PUT',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/employees/${id}`, {
          method: 'PUT',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to update employee');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to update employee');
    }
    return result;
  }

  async deleteEmployee(id: string): Promise<any> {
    return this.delete(`/tenant/employees/${id}`);
  }

  // Schedule Management (Phase 7.8+)
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

  async getEmployeeTimeOff(employeeId: string, params?: { startDate?: string; endDate?: string }): Promise<any> {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/tenant/employees/${employeeId}/time-off${query}`);
  }

  async createEmployeeTimeOff(employeeId: string, timeOffData: {
    startDate: string;
    endDate: string;
    type?: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
    reason?: string;
  }): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/time-off`, {
      method: 'POST',
      body: JSON.stringify(timeOffData),
    });
  }

  async updateEmployeeTimeOff(employeeId: string, timeOffId: string, timeOffData: any): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/time-off/${timeOffId}`, {
      method: 'PUT',
      body: JSON.stringify(timeOffData),
    });
  }

  async deleteEmployeeTimeOff(employeeId: string, timeOffId: string): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/time-off/${timeOffId}`, {
      method: 'DELETE',
    });
  }

  async getEmployeeOverrides(employeeId: string, params?: { startDate?: string; endDate?: string }): Promise<any> {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/tenant/employees/${employeeId}/overrides${query}`);
  }

  async createEmployeeOverride(employeeId: string, overrideData: {
    date: string;
    type?: 'override' | 'exception';
    startTime?: string | null;
    endTime?: string | null;
    isAvailable?: boolean;
    reason?: string;
  }): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/overrides`, {
      method: 'POST',
      body: JSON.stringify(overrideData),
    });
  }

  async updateEmployeeOverride(employeeId: string, overrideId: string, overrideData: any): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/overrides/${overrideId}`, {
      method: 'PUT',
      body: JSON.stringify(overrideData),
    });
  }

  async deleteEmployeeOverride(employeeId: string, overrideId: string): Promise<any> {
    return this.request(`/tenant/employees/${employeeId}/overrides/${overrideId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Product Management
   */
  async getProducts(params?: { isAvailable?: boolean; category?: string; search?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.isAvailable !== undefined) {
      queryParams.append('isAvailable', params.isAvailable.toString());
    }
    if (params?.category) {
      queryParams.append('category', params.category);
    }
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    const query = queryParams.toString();
    return this.get(`/tenant/products${query ? `?${query}` : ''}`);
  }

  async getProduct(id: string): Promise<any> {
    return this.get(`/tenant/products/${id}`);
  }

  async createProduct(data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/products`, {
      method: 'POST',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/products`, {
          method: 'POST',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to create product');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to create product');
    }
    return result;
  }

  async updateProduct(id: string, data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/products/${id}`, {
      method: 'PUT',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/products/${id}`, {
          method: 'PUT',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to update product');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to update product');
    }
    return result;
  }

  async deleteProduct(id: string): Promise<any> {
    return this.delete(`/tenant/products/${id}`);
  }

  /**
   * Service Management
   */
  async getServices(params?: { isActive?: boolean; category?: string; search?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.isActive !== undefined) {
      queryParams.append('isActive', params.isActive.toString());
    }
    if (params?.category) {
      queryParams.append('category', params.category);
    }
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    const query = queryParams.toString();
    return this.get(`/tenant/services${query ? `?${query}` : ''}`);
  }

  async getService(id: string): Promise<any> {
    return this.get(`/tenant/services/${id}`);
  }

  async createService(data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/services`, {
      method: 'POST',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/services`, {
          method: 'POST',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to create service');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to create service');
    }
    return result;
  }

  async updateService(id: string, data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/services/${id}`, {
      method: 'PUT',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/services/${id}`, {
          method: 'PUT',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to update service');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to update service');
    }
    return result;
  }

  async deleteService(id: string): Promise<any> {
    return this.delete(`/tenant/services/${id}`);
  }

  /**
   * Appointment Management
   */
  async getAppointments(params?: {
    startDate?: string;
    endDate?: string;
    staffId?: string;
    serviceId?: string;
    status?: string;
    platformUserId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.staffId) queryParams.append('staffId', params.staffId);
    if (params?.serviceId) queryParams.append('serviceId', params.serviceId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.platformUserId) queryParams.append('platformUserId', params.platformUserId);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return this.get(`/tenant/appointments${query ? `?${query}` : ''}`);
  }

  /**
   * Order Management
   */
  async getOrders(params?: {
    status?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.paymentStatus) queryParams.append('paymentStatus', params.paymentStatus);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return this.get(`/tenant/orders${query ? `?${query}` : ''}`);
  }

  async getOrder(id: string): Promise<any> {
    return this.get(`/tenant/orders/${id}`);
  }

  async updateOrderStatus(id: string, status: string, trackingNumber?: string, estimatedDeliveryDate?: string): Promise<any> {
    return this.patch(`/tenant/orders/${id}/status`, {
      status,
      trackingNumber,
      estimatedDeliveryDate
    });
  }

  async updateOrderPaymentStatus(id: string, paymentStatus: string): Promise<any> {
    return this.patch(`/tenant/orders/${id}/payment`, {
      paymentStatus
    });
  }

  async getCalendarAppointments(params?: {
    startDate?: string;
    endDate?: string;
    staffId?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.staffId) queryParams.append('staffId', params.staffId);
    const query = queryParams.toString();
    return this.get(`/tenant/appointments/calendar${query ? `?${query}` : ''}`);
  }

  async getAppointment(id: string): Promise<any> {
    return this.get(`/tenant/appointments/${id}`);
  }

  async getAppointmentStats(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/appointments/stats${query ? `?${query}` : ''}`);
  }

  async updateAppointmentStatus(id: string, status: string, notes?: string): Promise<any> {
    return this.request(`/tenant/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes })
    });
  }

  async updatePaymentStatus(id: string, paymentStatus: string, paymentMethod?: string): Promise<any> {
    return this.request(`/tenant/appointments/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus, paymentMethod })
    });
  }

  /**
   * Financial Management
   */
  async getFinancialOverview(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/financial/overview${query ? `?${query}` : ''}`);
  }

  async getEmployeeRevenue(params?: {
    startDate?: string;
    endDate?: string;
    staffId?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.staffId) queryParams.append('staffId', params.staffId);
    const query = queryParams.toString();
    return this.get(`/tenant/financial/employees${query ? `?${query}` : ''}`);
  }

  async getEmployeeFinancialDetails(id: string, params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/financial/employees/${id}${query ? `?${query}` : ''}`);
  }

  async getServiceRevenue(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/financial/services${query ? `?${query}` : ''}`);
  }

  async getProductRevenue(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/financial/products${query ? `?${query}` : ''}`);
  }

  async getDailyRevenue(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/financial/daily${query ? `?${query}` : ''}`);
  }

  /**
   * Customer Management
   */
  async getCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    loyaltyTier?: string;
    customerType?: string;
    minBookings?: number;
    minSpent?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params?.loyaltyTier) queryParams.append('loyaltyTier', params.loyaltyTier);
    if (params?.customerType) queryParams.append('customerType', params.customerType);
    if (params?.minBookings) queryParams.append('minBookings', params.minBookings.toString());
    if (params?.minSpent) queryParams.append('minSpent', params.minSpent.toString());
    const query = queryParams.toString();
    return this.get(`/tenant/customers${query ? `?${query}` : ''}`);
  }

  async getCustomer(id: string): Promise<any> {
    return this.get(`/tenant/customers/${id}`);
  }

  async getCustomerHistory(id: string, params?: {
    type?: 'appointment' | 'order';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return this.get(`/tenant/customers/${id}/history${query ? `?${query}` : ''}`);
  }

  async getCustomerStats(): Promise<any> {
    return this.get('/tenant/customers/stats');
  }

  async updateCustomerNotes(id: string, data: { notes?: string; tags?: string[] }): Promise<any> {
    return this.patch(`/tenant/customers/${id}/notes`, data);
  }

  async exportCustomers(): Promise<Blob> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/customers/export`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to export customers');
    }

    return response.blob();
  }

  /**
   * Settings Management
   */
  async getSettings(): Promise<any> {
    return this.get('/tenant/settings');
  }

  async updateBusinessInfo(data: any): Promise<any> {
    return this.put('/tenant/settings/business', data);
  }

  // Public Page Data
  async getPublicPageData(): Promise<any> {
    return this.get('/tenant/public-page');
  }

  async updatePublicPageData(data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/public-page`, {
      method: 'PUT',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/public-page`, {
          method: 'PUT',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to update public page data');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to update public page data');
    }
    return result;
  }

  async updateHeroSlider(data: FormData): Promise<any> {
    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/public-page/hero-slider`, {
      method: 'PUT',
      headers,
      body: data,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newAccessToken = this.getAccessToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        const retryResponse = await fetch(`${this.baseUrl}/tenant/public-page/hero-slider`, {
          method: 'PUT',
          headers,
          body: data,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.message || retryData.error || 'Failed to update hero slider');
        }
        return retryData;
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/ar/login';
        }
        throw new Error('Authentication failed. Please login again.');
      }
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to update hero slider');
    }
    return result;
  }

  async updateWorkingHours(workingHours: any): Promise<any> {
    return this.put('/tenant/settings/working-hours', { workingHours });
  }

  async updateBookingSettings(data: any): Promise<any> {
    return this.put('/tenant/settings/booking', data);
  }

  async updateNotificationSettings(data: any): Promise<any> {
    return this.put('/tenant/settings/notifications', data);
  }

  async updatePaymentSettings(data: any): Promise<any> {
    return this.put('/tenant/settings/payment', data);
  }

  async updateLocalizationSettings(data: any): Promise<any> {
    return this.put('/tenant/settings/localization', data);
  }

  async updateAppearanceSettings(data: any): Promise<any> {
    return this.put('/tenant/settings/appearance', data);
  }

  async uploadLogo(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('logo', file);

    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/settings/logo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to upload logo');
    }
    return result;
  }

  async uploadCoverImage(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('coverImage', file);

    const accessToken = this.getAccessToken();
    const headers: HeadersInit = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}/tenant/settings/cover`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Failed to upload cover image');
    }
    return result;
  }

  /**
   * Reports and Analytics
   */
  async getReportsSummary(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/reports/summary${query ? `?${query}` : ''}`);
  }

  async getBookingTrends(params?: { startDate?: string; endDate?: string; groupBy?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.groupBy) queryParams.append('groupBy', params.groupBy);
    const query = queryParams.toString();
    return this.get(`/tenant/reports/booking-trends${query ? `?${query}` : ''}`);
  }

  async getServicePerformance(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/reports/service-performance${query ? `?${query}` : ''}`);
  }

  async getEmployeePerformance(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/reports/employee-performance${query ? `?${query}` : ''}`);
  }

  async getPeakHoursAnalysis(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/reports/peak-hours${query ? `?${query}` : ''}`);
  }

  async getCustomerAnalytics(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const query = queryParams.toString();
    return this.get(`/tenant/reports/customer-analytics${query ? `?${query}` : ''}`);
  }

  // ==================== Hot Deals Management ====================

  /**
   * Get all hot deals for the current tenant
   */
  async getMyHotDeals(): Promise<any> {
    return this.get('/tenant/hot-deals');
  }

  /**
   * Get a single hot deal by ID
   */
  async getHotDeal(id: string): Promise<any> {
    return this.get(`/tenant/hot-deals/${id}`);
  }

  /**
   * Create a new hot deal
   */
  async createHotDeal(data: any): Promise<any> {
    return this.post('/tenant/hot-deals', data);
  }

  /**
   * Update an existing hot deal
   */
  async updateHotDeal(id: string, data: any): Promise<any> {
    return this.put(`/tenant/hot-deals/${id}`, data);
  }

  /**
   * Delete a hot deal
   */
  async deleteHotDeal(id: string): Promise<any> {
    return this.delete(`/tenant/hot-deals/${id}`);
  }

  /**
   * Check hot deals package limits
   */
  async checkHotDealsLimits(): Promise<any> {
    return this.get('/tenant/hot-deals/limits');
  }
}

// Export singleton instance
export const tenantApi = new TenantApiClient(API_URL);

