/**
 * Secure API Client for Rifah Platform
 * Handles authentication, token management, and secure API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Secure token storage using httpOnly cookies (handled by backend)
// For client-side, we use sessionStorage (more secure than localStorage)
// In production, tokens should be in httpOnly cookies set by backend

class ApiClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    /**
     * Get stored access token
     * Uses sessionStorage for better security (cleared on tab close)
     */
    private getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem('rifah_access_token');
    }

    /**
     * Get stored refresh token
     */
    private getRefreshToken(): string | null {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem('rifah_refresh_token');
    }

    /**
     * Store tokens securely
     */
    setTokens(accessToken: string, refreshToken: string): void {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem('rifah_access_token', accessToken);
        sessionStorage.setItem('rifah_refresh_token', refreshToken);
    }

    /**
     * Clear tokens (logout)
     */
    clearTokens(): void {
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem('rifah_access_token');
        sessionStorage.removeItem('rifah_refresh_token');
        sessionStorage.removeItem('rifah_user');
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(): Promise<string | null> {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return null;

        try {
            const response = await fetch(`${this.baseURL}/auth/user/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
                this.clearTokens();
                return null;
            }

            const data = await response.json();
            if (data.success && data.accessToken) {
                this.setTokens(data.accessToken, refreshToken);
                return data.accessToken;
            }

            return null;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearTokens();
            return null;
        }
    }

    /**
     * Make authenticated API request with automatic token refresh
     */
    async request(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<Response> {
        const token = this.getToken();
        const url = `${this.baseURL}${endpoint}`;

        // Add auth header if token exists
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Make request
        let response = await fetch(url, {
            ...options,
            headers,
        });

        // If 401, try to refresh token and retry once
        if (response.status === 401 && token) {
            const newToken = await this.refreshAccessToken();
            if (newToken) {
                // Retry with new token
                headers['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, {
                    ...options,
                    headers,
                });
            } else {
                // Refresh failed, clear tokens
                this.clearTokens();
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            }
        }

        return response;
    }

    /**
     * GET request
     */
    async get<T>(endpoint: string): Promise<T> {
        const response = await this.request(endpoint, { method: 'GET' });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * POST request
     */
    async post<T>(endpoint: string, data?: any): Promise<T> {
        const response = await this.request(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * PUT request
     */
    async put<T>(endpoint: string, data?: any): Promise<T> {
        const response = await this.request(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * PATCH request
     */
    async patch<T>(endpoint: string, data?: any): Promise<T> {
        const response = await this.request(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * DELETE request
     */
    async delete<T>(endpoint: string): Promise<T> {
        const response = await this.request(endpoint, { method: 'DELETE' });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

// Export types
export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data?: T;
}

export interface User {
    id: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    createdAt?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    walletBalance: number;
    loyaltyPoints: number;
    totalBookings: number;
    totalSpent: number;
    preferredLanguage?: string;
    notificationPreferences?: {
        email: boolean;
        sms: boolean;
        push?: boolean;
        whatsapp?: boolean;
    };
}

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    servicesCount?: number;
    staffCount?: number;
    customColors?: {
        primaryColor: string;
    };
    logo?: string;
    location?: string;
}

export interface Service {
    id: string;
    name_en: string;
    name_ar: string;
    description_en: string;
    description_ar: string;
    category: string;
    duration: number;
    basePrice: number;
}

export interface Staff {
    id: string;
    name: string;
    rating: number;
    skills: string[];
    aiScore?: number;
    recommended?: boolean;
    image?: string;
    photo?: string;
    specialization?: string;
}

export interface Appointment {
    id: string;
    serviceId: string;
    staffId: string;
    platformUserId: string;
    startTime: string;
    endTime: string;
    status: string;
    price: number;
    paymentStatus?: string;
    paymentMethod?: string;
    paidAt?: string;
    notes?: string;
    tenantId?: string;
    Service?: Service;
    Staff?: Staff;
    user?: User;
    service?: Service; // Alternative naming
    staff?: Staff; // Alternative naming
    tenant?: {
        id: string;
        name: string;
        slug?: string;
    };
}

