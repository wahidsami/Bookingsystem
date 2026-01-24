/**
 * Public API Client
 * Handles all API calls to the backend public endpoints
 */

const API_BASE_URL = 'http://localhost:5000/api/v1/public';

export interface WorkingDay {
  open: string;
  close: string;
  isOpen: boolean;
}

export interface WorkingHours {
  sunday?: WorkingDay;
  monday?: WorkingDay;
  tuesday?: WorkingDay;
  wednesday?: WorkingDay;
  thursday?: WorkingDay;
  friday?: WorkingDay;
  saturday?: WorkingDay;
}

export interface Tenant {
  id: string;
  name: string;
  name_en: string;
  name_ar: string;
  slug: string;
  businessType: string;
  logo: string | null;
  profileImage: string | null;
  email: string;
  phone: string;
  mobile: string;
  buildingNumber: string | null;
  street: string | null;
  district: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  googleMapLink: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  snapchatUrl: string | null;
  pinterestUrl: string | null;
  whatsappNumber: string | null;
  workingHours?: WorkingHours;
}

export interface PublicPageData {
  aboutUs: {
    heroImage: string | null;
    storyTitle: string;
    storyEn: string;
    storyAr: string;
    missions: any[];
    visions: any[];
    values: any[];
    facilitiesDescriptionEn: string;
    facilitiesDescriptionAr: string;
    facilitiesImages: string[];
    finalWordTitleEn: string;
    finalWordTitleAr: string;
    finalWordTextEn: string;
    finalWordTextAr: string;
    finalWordType: 'icon' | 'image';
    finalWordImageUrl: string | null;
    finalWordIconName: string | null;
  };
  heroSliders: any[];
  generalSettings: {
    template: 'template1' | 'template2' | 'template3';
    theme: {
      primaryColor: string;
      secondaryColor: string;
      helperColor: string;
    };
    sections: {
      heroSlider: boolean;
      services: boolean;
      products: boolean;
      callToAction: boolean;
    };
  };
}

export interface Service {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  category: string;
  finalPrice: number;
  duration: number;
  image: string | null;
  rating: number;
  availableInCenter: boolean;
  availableHomeVisit: boolean;
  benefits: any[];
  whatToExpect: any[];
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
  images: string[];
  stock: number;
  isAvailable: boolean;
}

export interface Staff {
  id: string;
  name: string;
  image: string | null;
  rating: number;
  specialty: string | null;
  experience: string | null;
  skills: any[];
  bio: string | null;
}

class PublicAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Get stored access token
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('rifah_access_token');
  }

  // Refresh access token using refresh token
  private async refreshAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const refreshToken = sessionStorage.getItem('rifah_refresh_token');
    if (!refreshToken) return null;

    try {
      const response = await fetch('http://localhost:5000/api/v1/auth/user/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.success && data.accessToken) {
        sessionStorage.setItem('rifah_access_token', data.accessToken);
        return data.accessToken;
      }

      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options?.headers,
      };

      // Add auth header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

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
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('rifah_access_token');
            sessionStorage.removeItem('rifah_refresh_token');
            sessionStorage.removeItem('rifah_user');
          }
        }
      }

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Request failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      // Handle network errors, CORS errors, etc.
      if (error.message) {
        throw error;
      }
      throw new Error('Network error: Unable to connect to the server. Please check your connection.');
    }
  }

  // Get all tenants (for listing/browsing)
  async getAllTenants(search?: string): Promise<{ success: boolean; tenants: Tenant[] }> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/tenants${query}`);
  }

  // Get tenant by slug
  async getTenantBySlug(slug: string): Promise<{ success: boolean; data: Tenant }> {
    return this.request(`/tenant/${slug}`);
  }

  // Get public page data
  async getPublicPageData(tenantId: string): Promise<{ success: boolean; data: PublicPageData }> {
    return this.request(`/tenant/${tenantId}/page-data`);
  }

  // Get services
  async getServices(tenantId: string, filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }): Promise<{ success: boolean; services: Service[] }> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
    if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return this.request(`/tenant/${tenantId}/services${query ? `?${query}` : ''}`);
  }

  // Get single service
  async getService(tenantId: string, serviceId: string): Promise<{ success: boolean; service: Service }> {
    return this.request(`/tenant/${tenantId}/services/${serviceId}`);
  }

  // Get products
  async getProducts(tenantId: string, filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }): Promise<{ success: boolean; products: Product[] }> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
    if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return this.request(`/tenant/${tenantId}/products${query ? `?${query}` : ''}`);
  }

  // Get single product
  async getProduct(tenantId: string, productId: string): Promise<{ success: boolean; product: Product }> {
    return this.request(`/tenant/${tenantId}/products/${productId}`);
  }

  // Get staff
  async getStaff(tenantId: string): Promise<{ success: boolean; staff: Staff[] }> {
    return this.request(`/tenant/${tenantId}/staff`);
  }

  // Search availability (Phase 4)
  async searchAvailability(tenantId: string, data: {
    serviceId: string;
    staffId?: string | null;
    date: string;
  }): Promise<{
    success: boolean;
    slots: Array<{
      startTime: string;
      endTime: string;
      available: boolean;
      staffId?: string;
      staffName?: string;
    }>;
    date: string;
    totalSlots: number;
    availableSlots: number;
    metadata: {
      serviceDuration: number;
      bufferBefore: number;
      bufferAfter: number;
      totalSlotLength: number;
      stepSize: number;
      timezone: string;
      staffCount: number;
    };
  }> {
    // Use the booking API endpoint (not public API)
    const API_BASE_URL = 'http://localhost:5000/api/v1';
    const response = await fetch(`${API_BASE_URL}/bookings/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        tenantId
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to search availability' }));
      throw new Error(error.message || 'Failed to search availability');
    }

    return response.json();
  }

  // Create booking
  async createBooking(tenantId: string, bookingData: {
    serviceId: string;
    staffId?: string;
    date: string;
    time: string;
    serviceType: 'in-center' | 'home-visit';
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    specialRequests?: string;
    paymentMethod: 'at-center' | 'online-full' | 'booking-fee';
    location?: string;
    platformUserId?: string; // Optional - for authenticated users
  }): Promise<{ success: boolean; message: string; data: { bookingId: string; bookingReference: string; totalAmount: number; bookingFee: number } }> {
    return this.request(`/tenant/${tenantId}/bookings`, {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  // Create order
  async createOrder(tenantId: string, orderData: {
    items: Array<{ productId: string; quantity: number }>;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress?: string | null;
    city?: string;
    district?: string;
    street?: string;
    building?: string;
    floor?: string;
    apartment?: string;
    notes?: string;
    postalCode?: string;
    deliveryMethod: 'standard' | 'express' | 'pickup';
    paymentMethod: 'online' | 'cash-on-delivery';
    platformUserId?: string; // Optional - for authenticated users
  }): Promise<{ success: boolean; message: string; data: { orderId: string; orderReference: string; total: number; items: any[] } }> {
    return this.request(`/tenant/${tenantId}/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  // Submit contact form
  async submitContactForm(tenantId: string, formData: {
    name: string;
    email: string;
    phone: string;
    subject?: string;
    message: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request(`/tenant/${tenantId}/contact`, {
      method: 'POST',
      body: JSON.stringify(formData),
    });
  }
}

export const publicAPI = new PublicAPI();

