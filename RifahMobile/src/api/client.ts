/**
 * Secure API Client for Refah Mobile App
 * Adapted from web client with AsyncStorage for React Native
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getApiUrl, getServerUrl } from '../config/env';

export const SERVER_URL = getServerUrl();
const API_BASE_URL = getApiUrl();

/**
 * Helper to get full image URL from relative path
 */
export const getImageUrl = (path: string | null | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;

    // Normalize path (convert backslashes to forward slashes if any)
    const normalizedPath = path.replace(/\\/g, '/');

    // Check if the path already starts with /uploads
    if (normalizedPath.startsWith('uploads/') || normalizedPath.startsWith('/uploads/')) {
        const fullPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
        return `${SERVER_URL}${fullPath}`;
    }

    // Prepend /uploads/ if missing
    const prefix = normalizedPath.startsWith('/') ? '/uploads' : '/uploads/';
    return `${SERVER_URL}${prefix}${normalizedPath}`;
};

// Storage keys
const KEYS = {
    ACCESS_TOKEN: 'refah_access_token',
    REFRESH_TOKEN: 'refah_refresh_token',
    USER: 'refah_user',
};

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
    profileImage?: string;
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
    name_en?: string;
    name_ar?: string;
    slug: string;
    plan: string;
    status: string;
    businessType?: string | string[];
    servicesCount?: number;
    staffCount?: number;
    customColors?: {
        primaryColor: string;
    };
    logo?: string;
    coverImage?: string;
    city?: string;
    location?: string;
    address?: string;
    googleMapLink?: string;
    description?: string;
    descriptionAr?: string;
    description_en?: string;
    description_ar?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    website?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    facebookUrl?: string;
    workingHours?: {
        [key: string]: { open: string; close: string; isOpen: boolean };
    };
    isAvailable?: boolean;
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

export interface Product {
    id: string;
    name_en: string;
    name_ar: string;
    description_en: string;
    description_ar: string;
    category: string;
    price: number;
    rawPrice: number;
    images?: string[];
    stock: number;
    isAvailable: boolean;
}

export interface Staff {
    id: string;
    name: string;
    role?: string;
    specialty?: string;
    avatar?: string;
    rating: number;
    skills: string[];
    aiScore?: number;
    recommended?: boolean;
    specialization?: string;
}

export interface Booking {
    id: string;
    serviceId: string;
    staffId: string;
    platformUserId: string;
    startTime: string;
    endTime: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
    price: number;
    paymentStatus?: string;
    paymentMethod?: string;
    paidAt?: string;
    notes?: string;
    tenantId?: string;
    Service?: Service;
    Staff?: Staff;
    service?: Service;
    staff?: Staff;
    tenant?: {
        id: string;
        name: string;
        slug?: string;
        logo?: string;
    };
    duration?: number; // Calculated or from service
}

export interface OrderItem {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    Product?: {
        name_en: string;
        name_ar: string;
        images?: string[];
    };
    product?: { // Sometimes lower case depending on include
        name_en: string;
        name_ar: string;
        images?: string[];
    };
}

export interface Order {
    id: string;
    tenantId: string;
    platformUserId: string;
    items: OrderItem[];
    totalAmount: number;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    paymentStatus: string;
    paymentMethod: string;
    createdAt: string;
    tenant?: {
        name: string;
        logo?: string;
    };
}

export interface SlotItem {
    startTime: string;
    endTime: string;
    available: boolean;
    staffId?: string;
    staffName?: string;
}

export interface HotDeal {
    id: string;
    title_en: string;
    title_ar: string;
    description_en?: string;
    description_ar?: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    originalPrice: number;
    discountedPrice: number;
    validFrom: string;
    validUntil: string;
    maxRedemptions: number;
    currentRedemptions: number;
    image?: string;
    tenant?: { id: string; name: string; name_en?: string; name_ar?: string; logo?: string; slug?: string };
    service?: { id: string; name_en: string; name_ar: string; duration?: number };
}

class ApiClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    /**
     * Get stored access token (using SecureStore for tokens)
     */
    private async getToken(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
        } catch (error) {
            console.error('Error getting token:', error);
            return null;
        }
    }

    /**
     * Get stored refresh token
     */
    private async getRefreshToken(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
        } catch (error) {
            console.error('Error getting refresh token:', error);
            return null;
        }
    }

    /**
     * Store tokens securely (using SecureStore for sensitive data)
     */
    async setTokens(accessToken: string, refreshToken: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
            await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
        } catch (error) {
            console.error('Error storing tokens:', error);
        }
    }

    /**
     * Clear tokens (logout)
     */
    async clearTokens(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
            await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
            await AsyncStorage.removeItem(KEYS.USER);
        } catch (error) {
            console.error('Error clearing tokens:', error);
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(): Promise<string | null> {
        const refreshToken = await this.getRefreshToken();
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
                await this.clearTokens();
                return null;
            }

            const data = await response.json();
            if (data.success && data.accessToken) {
                await this.setTokens(data.accessToken, refreshToken);
                return data.accessToken;
            }

            return null;
        } catch (error) {
            console.error('Token refresh failed:', error);
            await this.clearTokens();
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
        const token = await this.getToken();
        const url = `${this.baseURL}${endpoint}`;

        // Add auth header if token exists
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string>),
        };

        // Don't set Content-Type for FormData - browser will set it with boundary
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

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
                await this.clearTokens();
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
    async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
        // Check if data is FormData
        const isFormData = data instanceof FormData;

        const response = await this.request(endpoint, {
            method: 'POST',
            body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
            ...options,
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

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        const token = await this.getToken();
        return !!token;
    }

    /**
     * Get stored user data
     */
    async getUser(): Promise<User | null> {
        try {
            const userJson = await AsyncStorage.getItem(KEYS.USER);
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    /**
     * Store user data
     */
    async setUser(user: User): Promise<void> {
        try {
            await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
        } catch (error) {
            console.error('Error storing user:', error);
        }
    }

    /**
     * Upload profile photo (authenticated).
     * POST /users/profile/photo with FormData key 'photo'.
     * Returns { success, profileImage }.
     */
    async uploadProfilePhoto(uri: string, fileName: string = 'photo.jpg', type: string = 'image/jpeg'): Promise<{ success: boolean; profileImage: string }> {
        const formData = new FormData();
        formData.append('photo', {
            uri,
            name: fileName,
            type,
        } as any);
        const response = await this.request('/users/profile/photo', {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Upload failed' }));
            throw new Error(error.message || 'Upload failed');
        }
        return response.json();
    }

    /**
     * Get user bookings
     */
    async getBookings(status?: 'upcoming' | 'completed' | 'cancelled'): Promise<Booking[]> {
        const response = await this.get<{ success: boolean; appointments: Booking[] }>('/bookings');
        const normalized = (response.appointments || []).map((appointment) => ({
            ...appointment,
            Service: appointment.Service || appointment.service,
            Staff: appointment.Staff || appointment.staff,
        }));

        if (!status) {
            return normalized;
        }

        if (status === 'upcoming') {
            return normalized.filter((appointment) => ['pending', 'confirmed'].includes(appointment.status));
        }

        if (status === 'completed') {
            return normalized.filter((appointment) => ['completed', 'cancelled'].includes(appointment.status));
        }

        return normalized.filter((appointment) => appointment.status === status);
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(id: string): Promise<boolean> {
        const response = await this.patch<{ success: boolean; message: string }>(
            `/bookings/${id}/cancel`
        );
        return response.success;
    }

    /**
     * Get booking details
     */
    async getBooking(id: string): Promise<Booking> {
        const response = await this.get<{ success: boolean; appointment: Booking }>(
            `/bookings/${id}`
        );
        return {
            ...response.appointment,
            Service: response.appointment.Service || response.appointment.service,
            Staff: response.appointment.Staff || response.appointment.staff,
        };
    }

    /**
     * Get user orders
     */
    async getOrders(): Promise<Order[]> {
        const response = await this.get<{ success: boolean; orders: Order[] }>('/orders');
        return response.orders || [];
    }

    /**
     * Get order details
     */
    async getOrder(id: string): Promise<Order> {
        const response = await this.get<{ success: boolean; order: Order }>(`/orders/${id}`);
        return response.order;
    }

    /**
     * Cancel an order
     */
    async cancelOrder(id: string): Promise<boolean> {
        const response = await this.patch<{ success: boolean; message: string }>(
            `/orders/${id}/cancel`
        );
        return response.success;
    }

    /**
     * Process payment
     */
    async processPayment(data: {
        appointmentId?: string;
        orderId?: string;
        amount: number;
        cardNumber: string;
        expiryDate: string;
        cvv: string;
        cardholderName: string;
        saveCard?: boolean;
        tenantId?: string;
    }): Promise<{ success: boolean; transaction: any }> {
        return this.post<{ success: boolean; transaction: any }>('/payments/process', data);
    }

    /**
     * Get active hot deals for mobile carousel
     */
    async getHotDeals(): Promise<HotDeal[]> {
        const response = await this.get<{ success: boolean; deals: HotDeal[] }>('/hot-deals');
        return response.deals || [];
    }

    /**
     * Get service categories
     */
    async getCategories(): Promise<ServiceCategory[]> {
        const response = await this.get<{ success: boolean; categories: ServiceCategory[] }>('/categories');
        return response.categories || [];
    }

    /**
     * Get all public tenants for discovery
     */
    async getTenants(): Promise<Tenant[]> {
        const response = await this.get<{ success: boolean; tenants: Tenant[] }>('/tenants');
        return response.tenants || [];
    }

    /**
     * Get newest tenants (recently onboarded)
     */
    async getNewTenants(limit: number = 8): Promise<Tenant[]> {
        const tenants = await this.getTenants();
        return tenants.slice(0, limit);
    }

    /**
     * Get trending tenants (most bookings / activity)
     */
    async getTrendingTenants(limit: number = 8): Promise<Tenant[]> {
        const response = await this.get<{ success: boolean; tenants: Tenant[] }>('/featured-tenants');
        return (response.tenants || []).slice(0, limit);
    }

    /**
     * Get top service providers (cross-tenant staff)
     */
    async getTopProviders(): Promise<Staff[]> {
        const response = await this.get<{ success?: boolean; staff?: Array<Partial<Staff> & { photo?: string }> }>('/staff?isActive=true');
        const staff = response.staff || [];

        return staff
            .map((member) => ({
                id: member.id || '',
                name: member.name || 'Staff',
                role: member.role,
                specialty: member.specialty,
                avatar: member.avatar || member.photo,
                rating: Number(member.rating || 0),
                skills: Array.isArray(member.skills) ? member.skills : [],
            }))
            .filter((member) => member.id)
            .sort((left, right) => right.rating - left.rating);
    }
}

export interface ServiceCategory {
    id: string;
    name_en: string;
    name_ar: string;
    slug: string;
    icon?: string;
    sortOrder: number;
    isActive: boolean;
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
