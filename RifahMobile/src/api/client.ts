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

    // Absolute server path (not necessarily under /uploads)
    if (normalizedPath.startsWith('/')) {
        return `${SERVER_URL}${normalizedPath}`;
    }

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
    CUSTOMER_APP_CONTENT: 'refah_customer_app_content',
    SESSION_LAST_ACTIVE: 'refah_session_last_active',
};

const SESSION_MAX_INACTIVE_DAYS = 90;
const SESSION_MAX_INACTIVE_MS = SESSION_MAX_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

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
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other' | '';
    emailVerified: boolean;
    phoneVerified: boolean;
    walletBalance: number;
    loyaltyPoints: number;
    totalBookings: number;
    totalSpent: number;
    preferredLanguage?: string;
    authProvider?: 'local' | 'google';
    addressStreet?: string;
    addressCity?: string;
    addressBuilding?: string;
    addressFloor?: string;
    addressApartment?: string;
    addressPhone?: string;
    addressNotes?: string;
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
    district?: string;
    street?: string;
    buildingNumber?: string;
    country?: string;
    postalCode?: string;
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
    linkedinUrl?: string;
    tiktokUrl?: string;
    youtubeUrl?: string;
    snapchatUrl?: string;
    pinterestUrl?: string;
    whatsappNumber?: string;
    workingHours?: {
        [key: string]: { open: string; close: string; isOpen: boolean };
    };
    isAvailable?: boolean;
    paymentSettings?: {
        allowServicePayAtCenter: boolean;
        allowServiceFullOnline: boolean;
        allowServiceDeposit: boolean;
        serviceDepositMode: 'fixed' | 'percentage';
        serviceDepositFixedAmount: number;
        serviceDepositPercentage: number;
    };
}

export interface GoogleStartResponse {
    success: boolean;
    message: string;
    requiresOnboarding?: boolean;
    onboardingToken?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: User;
    profile: {
        email: string;
        firstName: string | null;
        lastName: string | null;
        picture?: string | null;
    };
}

export interface GoogleSendOtpResponse {
    success: boolean;
    message: string;
    phone: string;
    testCodeEnabled: boolean;
}

export interface GoogleCompleteResponse {
    success: boolean;
    message: string;
    accessToken: string;
    refreshToken: string;
    user: User;
}

export interface Service {
    id: string;
    tenantId?: string;
    name_en: string;
    name_ar: string;
    description_en: string;
    description_ar: string;
    category: string;
    duration: number;
    basePrice?: number;
    minPrice?: number;
    maxPrice?: number;
    rawPrice?: number;
    finalPrice?: number;
    paymentOptions?: Array<'at-center' | 'online-full' | 'booking-fee'>;
    allowReschedule?: boolean;
    variants?: ServiceVariant[];
    employees?: Staff[];
    image?: string;
    imageUrl?: string;
    images?: string[];
    thumbnail?: string;
    coverImage?: string;
    media?: string[];
}

export interface ServiceVariant {
    id: string;
    description: string;
    duration: number;
    finalPrice: number;
    isActive: boolean;
}

export interface Product {
    id: string;
    tenantId?: string;
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
    image?: string;
    bio?: string;
    experience?: string;
    rating: number;
    skills: string[];
    aiScore?: number;
    recommended?: boolean;
    specialization?: string;
}

export interface Booking {
    id: string;
    bookingNumber?: string | null;
    bookingSessionId?: string | null;
    bookingReference?: string | null;
    bookingItemIndex?: number | null;
    serviceId: string;
    staffId: string;
    platformUserId: string;
    serviceVariantId?: string | null;
    serviceVariantName?: string | null;
    serviceVariantDescription?: string | null;
    serviceVariantDuration?: number | null;
    startTime: string;
    endTime: string;
    status: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'cancelled' | 'completed' | 'no_show';
    price: number;
    paymentStatus?: string;
    paymentMethod?: string;
    paidAt?: string;
    depositAmount?: number;
    depositPaid?: boolean;
    remainderAmount?: number;
    remainderPaid?: boolean;
    totalPaid?: number;
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
    customerConfirmationRequired?: boolean;
    customerConfirmationStatus?: 'not_required' | 'pending' | 'confirmed' | 'declined';
    customerConfirmedAt?: string;
    inviteToken?: string;
    inviteExpiresAt?: string;
}

export interface AppointmentInviteDetails {
    token: string;
    isExpired: boolean;
    appointmentId: string;
    platformUserId?: string;
    customerConfirmationRequired: boolean;
    customerConfirmationStatus: 'not_required' | 'pending' | 'confirmed' | 'declined';
    inviteExpiresAt?: string;
    startTime: string;
    endTime: string;
    status: string;
    service?: Service | null;
    staff?: Staff | null;
    tenant?: {
        id: string;
        name: string;
        slug?: string;
        logo?: string;
    } | null;
}

export interface CustomerNotification {
    id: string;
    campaignId?: string;
    title: string;
    body: string;
    imageUrl?: string;
    linkType?: 'none' | 'tenant' | 'service';
    tenantId?: string | null;
    tenantName?: string | null;
    tenantLogo?: string;
    serviceId?: string | null;
    audienceType?: string;
    sentAt?: string | null;
    createdAt?: string | null;
    readAt?: string | null;
    data?: Record<string, any>;
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
    orderNumber?: string;
    tenantId: string;
    platformUserId: string;
    items: OrderItem[];
    totalAmount: number;
    status: 'pending' | 'confirmed' | 'processing' | 'ready_for_pickup' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
    paymentStatus: string;
    paymentMethod: string;
    createdAt: string;
    shippingAddress?: {
        street?: string;
        city?: string;
        district?: string;
        building?: string;
        floor?: string;
        apartment?: string;
        phone?: string;
        notes?: string;
    };
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

export interface AppContentEntry {
    key: string;
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
    url: string;
    iconKey: string;
    metadata: Record<string, any>;
    publishedVersion: string;
    publishedAt?: string | null;
    updatedAt?: string | null;
    sortOrder: number;
}

export interface PublicAppContent {
    appTarget: 'customer_app' | 'staff_app';
    legal: Record<string, AppContentEntry>;
    support: Record<string, AppContentEntry>;
    social: AppContentEntry[];
    store: Record<string, AppContentEntry>;
    display: Record<string, AppContentEntry>;
}

const DEFAULT_CUSTOMER_APP_CONTENT: PublicAppContent = {
    appTarget: 'customer_app',
    legal: {},
    support: {},
    social: [],
    store: {},
    display: {},
};

const toNumber = (value: unknown, fallback: number = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown, fallback: boolean = false): boolean => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }

    return fallback;
};

const toStringValue = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (value === null || value === undefined) {
        return fallback;
    }

    return `${value}`;
};

const toOptionalString = (value: unknown): string | undefined => {
    const normalized = toStringValue(value, '').trim();
    return normalized ? normalized : undefined;
};

const normalizeServicePaymentOptionsValue = (value: unknown): Array<'at-center' | 'online-full' | 'booking-fee'> | undefined => {
    const allowed = new Set(['at-center', 'online-full', 'booking-fee']);
    const normalizeToken = (token: unknown) => `${token ?? ''}`.trim().toLowerCase();

    let source: unknown[] = [];
    if (Array.isArray(value)) {
        source = value;
    } else if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) {
            source = [];
        } else if (raw.startsWith('[') && raw.endsWith(']')) {
            try {
                const parsed = JSON.parse(raw);
                source = Array.isArray(parsed) ? parsed : [raw];
            } catch {
                source = raw.split(',');
            }
        } else {
            source = raw.split(',');
        }
    } else if (value !== null && value !== undefined) {
        source = [value];
    }

    const normalized = source
        .map(normalizeToken)
        .filter((token): token is 'at-center' | 'online-full' | 'booking-fee' => allowed.has(token));

    if (normalized.length === 0) {
        return undefined;
    }

    return Array.from(new Set(normalized));
};

const normalizeNotificationPreferences = (value: unknown): User['notificationPreferences'] => {
    if (!value || typeof value !== 'object') {
        return {
            email: true,
            sms: true,
            push: true,
            whatsapp: false,
        };
    }

    const prefs = value as Record<string, unknown>;
    return {
        email: toBoolean(prefs.email, true),
        sms: toBoolean(prefs.sms, true),
        push: toBoolean(prefs.push, true),
        whatsapp: toBoolean(prefs.whatsapp, false),
    };
};

const normalizeUser = (user: Partial<User> | null | undefined): User => ({
    id: toStringValue(user?.id),
    email: toStringValue(user?.email),
    phone: toStringValue(user?.phone),
    firstName: toStringValue(user?.firstName, 'Refah'),
    lastName: toStringValue(user?.lastName),
    profileImage: toOptionalString(user?.profileImage),
    createdAt: toOptionalString(user?.createdAt),
    dateOfBirth: toOptionalString(user?.dateOfBirth),
    gender: (user?.gender as User['gender']) || '',
    emailVerified: toBoolean(user?.emailVerified),
    phoneVerified: toBoolean(user?.phoneVerified),
    walletBalance: toNumber(user?.walletBalance),
    loyaltyPoints: toNumber(user?.loyaltyPoints),
    totalBookings: toNumber(user?.totalBookings),
    totalSpent: toNumber(user?.totalSpent),
    preferredLanguage: toOptionalString(user?.preferredLanguage),
    addressStreet: toOptionalString(user?.addressStreet),
    addressCity: toOptionalString(user?.addressCity),
    addressBuilding: toOptionalString(user?.addressBuilding),
    addressFloor: toOptionalString(user?.addressFloor),
    addressApartment: toOptionalString(user?.addressApartment),
    addressPhone: toOptionalString(user?.addressPhone),
    addressNotes: toOptionalString(user?.addressNotes),
    notificationPreferences: normalizeNotificationPreferences(user?.notificationPreferences),
});

export const normalizeTenant = (tenant: Partial<Tenant> | null | undefined): Tenant => ({
    id: toStringValue(tenant?.id),
    name: toStringValue(tenant?.name || tenant?.name_en || tenant?.name_ar, 'Refah'),
    name_en: toOptionalString(tenant?.name_en),
    name_ar: toOptionalString(tenant?.name_ar),
    slug: toStringValue(tenant?.slug || tenant?.id),
    plan: toStringValue(tenant?.plan),
    status: toStringValue(tenant?.status),
    businessType: Array.isArray(tenant?.businessType)
        ? tenant?.businessType.map((item) => toStringValue(item)).filter(Boolean)
        : toOptionalString(tenant?.businessType),
    servicesCount: toNumber(tenant?.servicesCount),
    staffCount: toNumber(tenant?.staffCount),
    customColors: tenant?.customColors,
    logo: toOptionalString(tenant?.logo),
    coverImage: toOptionalString(tenant?.coverImage),
    city: toOptionalString(tenant?.city),
    district: toOptionalString(tenant?.district),
    street: toOptionalString(tenant?.street),
    buildingNumber: toOptionalString(tenant?.buildingNumber),
    country: toOptionalString(tenant?.country),
    postalCode: toOptionalString(tenant?.postalCode),
    location: toOptionalString(tenant?.location),
    address: toOptionalString(tenant?.address),
    googleMapLink: toOptionalString(tenant?.googleMapLink),
    description: toOptionalString(tenant?.description),
    descriptionAr: toOptionalString(tenant?.descriptionAr),
    description_en: toOptionalString(tenant?.description_en),
    description_ar: toOptionalString(tenant?.description_ar),
    phone: toOptionalString(tenant?.phone),
    mobile: toOptionalString(tenant?.mobile),
    email: toOptionalString(tenant?.email),
    website: toOptionalString(tenant?.website),
    instagramUrl: toOptionalString(tenant?.instagramUrl),
    twitterUrl: toOptionalString(tenant?.twitterUrl),
    facebookUrl: toOptionalString(tenant?.facebookUrl),
    linkedinUrl: toOptionalString(tenant?.linkedinUrl),
    tiktokUrl: toOptionalString(tenant?.tiktokUrl),
    youtubeUrl: toOptionalString(tenant?.youtubeUrl),
    snapchatUrl: toOptionalString(tenant?.snapchatUrl),
    pinterestUrl: toOptionalString(tenant?.pinterestUrl),
    whatsappNumber: toOptionalString(tenant?.whatsappNumber),
    workingHours: tenant?.workingHours,
    isAvailable: toBoolean(tenant?.isAvailable),
    paymentSettings: tenant?.paymentSettings ? {
        allowServicePayAtCenter: toBoolean((tenant.paymentSettings as any).allowServicePayAtCenter, true),
        allowServiceFullOnline: toBoolean((tenant.paymentSettings as any).allowServiceFullOnline, true),
        allowServiceDeposit: toBoolean((tenant.paymentSettings as any).allowServiceDeposit, true),
        serviceDepositMode: (tenant.paymentSettings as any).serviceDepositMode === 'percentage' ? 'percentage' : 'fixed',
        serviceDepositFixedAmount: toNumber((tenant.paymentSettings as any).serviceDepositFixedAmount, 50),
        serviceDepositPercentage: toNumber((tenant.paymentSettings as any).serviceDepositPercentage, 50),
    } : undefined,
});

export const normalizeServiceVariant = (variant: unknown): ServiceVariant | null => {
    if (!variant || typeof variant !== 'object') {
        return null;
    }

    const source = variant as Record<string, unknown>;
    const description = toStringValue(source.description).trim();
    const duration = toNumber(source.duration, 30);
    const finalPrice = toNumber(source.finalPrice ?? source.price);
    const isActive = source.isActive === undefined || source.isActive === null
        ? true
        : toBoolean(source.isActive, true);
    const id = toOptionalString(source.id);
    const fallbackPayload = JSON.stringify({
        description: description.toLowerCase(),
        duration,
        finalPrice,
        isActive
    });
    let fallbackHash = 0;
    for (let index = 0; index < fallbackPayload.length; index += 1) {
        fallbackHash = ((fallbackHash << 5) - fallbackHash) + fallbackPayload.charCodeAt(index);
        fallbackHash |= 0;
    }

    return {
        id: id || `variant-${Math.abs(fallbackHash).toString(36)}`,
        description,
        duration,
        finalPrice,
        isActive,
    };
};

export const normalizeService = (service: Partial<Service> | null | undefined): Service => ({
    id: toStringValue(service?.id),
    tenantId: toOptionalString(service?.tenantId),
    name_en: toStringValue(service?.name_en || service?.name_ar, 'Service'),
    name_ar: toStringValue(service?.name_ar || service?.name_en, 'الخدمة'),
    description_en: toStringValue(service?.description_en),
    description_ar: toStringValue(service?.description_ar),
    category: toStringValue(service?.category, 'General'),
    duration: toNumber(service?.duration),
    basePrice: toNumber(service?.basePrice),
    minPrice: toNumber((service as Partial<Service> & { minPrice?: number }).minPrice),
    maxPrice: toNumber((service as Partial<Service> & { maxPrice?: number }).maxPrice),
    rawPrice: toNumber(service?.rawPrice),
    finalPrice: toNumber(service?.finalPrice),
    paymentOptions: normalizeServicePaymentOptionsValue((service as Partial<Service> & { paymentOptions?: unknown }).paymentOptions),
    allowReschedule: toBoolean((service as Partial<Service> & { allowReschedule?: unknown }).allowReschedule, false),
    image: toOptionalString((service as Partial<Service> & { image?: unknown; imageUrl?: unknown }).image)
        || toOptionalString((service as Partial<Service> & { imageUrl?: unknown }).imageUrl),
    imageUrl: toOptionalString((service as Partial<Service> & { imageUrl?: unknown; image?: unknown }).imageUrl)
        || toOptionalString((service as Partial<Service> & { image?: unknown }).image),
    images: Array.isArray((service as Partial<Service> & { images?: unknown }).images)
        ? ((service as Partial<Service> & { images?: unknown }).images as unknown[])
            .map((img) => toStringValue(img))
            .filter(Boolean)
        : [],
    thumbnail: toOptionalString((service as Partial<Service> & { thumbnail?: unknown }).thumbnail),
    coverImage: toOptionalString((service as Partial<Service> & { coverImage?: unknown }).coverImage),
    media: Array.isArray((service as Partial<Service> & { media?: unknown }).media)
        ? ((service as Partial<Service> & { media?: unknown }).media as unknown[])
            .map((img) => toStringValue(img))
            .filter(Boolean)
        : [],
    variants: Array.isArray((service as Partial<Service> & { variants?: unknown }).variants)
        ? ((service as Partial<Service> & { variants?: unknown }).variants as unknown[])
            .map((variant) => normalizeServiceVariant(variant))
            .filter((variant): variant is ServiceVariant => Boolean(variant))
        : [],
});

export const normalizeProduct = (product: Partial<Product> | null | undefined): Product => ({
    id: toStringValue(product?.id),
    tenantId: toOptionalString(product?.tenantId),
    name_en: toStringValue(product?.name_en || product?.name_ar, 'Product'),
    name_ar: toStringValue(product?.name_ar || product?.name_en, 'منتج'),
    description_en: toStringValue(product?.description_en),
    description_ar: toStringValue(product?.description_ar),
    category: toStringValue(product?.category, 'General'),
    price: toNumber(product?.price),
    rawPrice: toNumber(product?.rawPrice ?? product?.price),
    images: Array.isArray(product?.images)
        ? product.images.map((image) => toStringValue(image)).filter(Boolean)
        : [],
    stock: toNumber(product?.stock),
    isAvailable: toBoolean(product?.isAvailable, true),
});

export const normalizeStaff = (staff: Partial<Staff> | null | undefined): Staff => ({
    id: toStringValue(staff?.id),
    name: toStringValue(staff?.name, 'Staff'),
    role: toOptionalString(staff?.role),
    specialty: toOptionalString(staff?.specialty),
    avatar: toOptionalString(staff?.avatar || staff?.image),
    image: toOptionalString(staff?.image || staff?.avatar),
    bio: toOptionalString(staff?.bio),
    experience: toOptionalString(staff?.experience),
    rating: toNumber(staff?.rating),
    skills: Array.isArray(staff?.skills)
        ? staff.skills.map((item) => toStringValue(item)).filter(Boolean)
        : [],
    aiScore: staff?.aiScore !== undefined ? toNumber(staff.aiScore) : undefined,
    recommended: staff?.recommended !== undefined ? toBoolean(staff.recommended) : undefined,
    specialization: toOptionalString(staff?.specialization),
});

const normalizeBooking = (appointment: Partial<Booking> | null | undefined): Booking => {
    const normalizedService = appointment?.Service || appointment?.service
        ? normalizeService(appointment?.Service || appointment?.service)
        : undefined;
    const normalizedStaff = appointment?.Staff || appointment?.staff
        ? normalizeStaff(appointment?.Staff || appointment?.staff)
        : undefined;

    return {
        id: toStringValue(appointment?.id),
        bookingNumber: toOptionalString(appointment?.bookingNumber),
        bookingSessionId: toOptionalString(appointment?.bookingSessionId),
        bookingReference: toOptionalString(appointment?.bookingReference),
        bookingItemIndex: appointment?.bookingItemIndex !== undefined
            ? toNumber(appointment.bookingItemIndex)
            : undefined,
        serviceId: toStringValue(appointment?.serviceId || normalizedService?.id),
        staffId: toStringValue(appointment?.staffId || normalizedStaff?.id),
        platformUserId: toStringValue(appointment?.platformUserId),
        serviceVariantId: toOptionalString(appointment?.serviceVariantId),
        serviceVariantName: toOptionalString(appointment?.serviceVariantName),
        serviceVariantDescription: toOptionalString(appointment?.serviceVariantDescription),
        serviceVariantDuration: appointment?.serviceVariantDuration !== undefined
            ? toNumber(appointment.serviceVariantDuration)
            : undefined,
        startTime: toStringValue(appointment?.startTime),
        endTime: toStringValue(appointment?.endTime),
        status: (appointment?.status as Booking['status']) || 'pending',
        price: toNumber(appointment?.price),
        paymentStatus: toOptionalString(appointment?.paymentStatus),
        paymentMethod: toOptionalString(appointment?.paymentMethod),
        paidAt: toOptionalString(appointment?.paidAt),
        depositAmount: toNumber(appointment?.depositAmount),
        depositPaid: toBoolean(appointment?.depositPaid),
        remainderAmount: toNumber(appointment?.remainderAmount),
        remainderPaid: toBoolean(appointment?.remainderPaid),
        totalPaid: toNumber(appointment?.totalPaid),
        notes: toOptionalString(appointment?.notes),
        tenantId: toOptionalString(appointment?.tenantId),
        Service: normalizedService,
        Staff: normalizedStaff,
        service: normalizedService,
        staff: normalizedStaff,
        tenant: appointment?.tenant ? {
            id: toStringValue(appointment.tenant.id),
            name: toStringValue(appointment.tenant.name, 'Refah'),
            slug: toOptionalString(appointment.tenant.slug),
            logo: toOptionalString(appointment.tenant.logo),
        } : undefined,
        duration: appointment?.duration !== undefined
            ? toNumber(appointment.duration)
            : normalizedService?.duration,
        customerConfirmationRequired: toBoolean(appointment?.customerConfirmationRequired, false),
        customerConfirmationStatus: (appointment?.customerConfirmationStatus as Booking['customerConfirmationStatus']) || 'not_required',
        customerConfirmedAt: toOptionalString(appointment?.customerConfirmedAt),
        inviteToken: toOptionalString(appointment?.inviteToken),
        inviteExpiresAt: toOptionalString(appointment?.inviteExpiresAt),
    };
};

const normalizeOrderItem = (item: Partial<OrderItem> | null | undefined): OrderItem => {
    const normalizedProductNameEn = toStringValue(item?.Product?.name_en || item?.product?.name_en);
    const normalizedProductNameAr = toStringValue(item?.Product?.name_ar || item?.product?.name_ar);
    const normalizedImages = Array.isArray(item?.Product?.images)
        ? item!.Product!.images!.map((image) => toStringValue(image)).filter(Boolean)
        : Array.isArray(item?.product?.images)
            ? item!.product!.images!.map((image) => toStringValue(image)).filter(Boolean)
            : [];

    return {
        id: toStringValue(item?.id),
        productId: toStringValue(item?.productId),
        quantity: toNumber(item?.quantity),
        price: toNumber(item?.price),
        Product: normalizedProductNameEn || normalizedProductNameAr ? {
            name_en: normalizedProductNameEn,
            name_ar: normalizedProductNameAr,
            images: normalizedImages,
        } : undefined,
        product: normalizedProductNameEn || normalizedProductNameAr ? {
            name_en: normalizedProductNameEn,
            name_ar: normalizedProductNameAr,
            images: normalizedImages,
        } : undefined,
    };
};

const normalizeOrder = (order: Partial<Order> | null | undefined): Order => ({
    id: toStringValue(order?.id),
    orderNumber: toOptionalString(order?.orderNumber),
    tenantId: toStringValue(order?.tenantId),
    platformUserId: toStringValue(order?.platformUserId),
    items: Array.isArray(order?.items) ? order.items.map((item) => normalizeOrderItem(item)) : [],
    totalAmount: toNumber(order?.totalAmount),
    status: (order?.status as Order['status']) || 'pending',
    paymentStatus: toStringValue(order?.paymentStatus),
    paymentMethod: toStringValue(order?.paymentMethod),
    createdAt: toStringValue(order?.createdAt),
    shippingAddress: order?.shippingAddress,
    tenant: order?.tenant ? {
        name: toStringValue(order.tenant.name, 'Refah'),
        logo: toOptionalString(order.tenant.logo),
    } : undefined,
});

const normalizeHotDeal = (deal: Partial<HotDeal> | null | undefined): HotDeal => ({
    id: toStringValue(deal?.id),
    title_en: toStringValue(deal?.title_en || deal?.title_ar, 'Hot Deal'),
    title_ar: toStringValue(deal?.title_ar || deal?.title_en, 'عرض ساخن'),
    description_en: toOptionalString(deal?.description_en),
    description_ar: toOptionalString(deal?.description_ar),
    discountType: deal?.discountType === 'fixed_amount' ? 'fixed_amount' : 'percentage',
    discountValue: toNumber(deal?.discountValue),
    originalPrice: toNumber(deal?.originalPrice),
    discountedPrice: toNumber(deal?.discountedPrice),
    validFrom: toStringValue(deal?.validFrom),
    validUntil: toStringValue(deal?.validUntil),
    maxRedemptions: toNumber(deal?.maxRedemptions),
    currentRedemptions: toNumber(deal?.currentRedemptions),
    image: toOptionalString(deal?.image),
    tenant: deal?.tenant ? {
        id: toStringValue(deal.tenant.id),
        name: toStringValue(deal.tenant.name, 'Refah'),
        name_en: toOptionalString(deal.tenant.name_en),
        name_ar: toOptionalString(deal.tenant.name_ar),
        logo: toOptionalString(deal.tenant.logo),
        slug: toOptionalString(deal.tenant.slug),
    } : undefined,
    service: deal?.service ? {
        id: toStringValue(deal.service.id),
        name_en: toStringValue(deal.service.name_en || deal.service.name_ar, 'Service'),
        name_ar: toStringValue(deal.service.name_ar || deal.service.name_en, 'الخدمة'),
        duration: deal.service.duration !== undefined ? toNumber(deal.service.duration) : undefined,
    } : undefined,
});

const normalizeCategory = (category: Partial<ServiceCategory> | null | undefined): ServiceCategory => ({
    id: toStringValue(category?.id),
    name_en: toStringValue(category?.name_en || category?.name_ar, 'Category'),
    name_ar: toStringValue(category?.name_ar || category?.name_en, 'الفئة'),
    slug: toStringValue(category?.slug || category?.id),
    icon: toOptionalString(category?.icon),
    sortOrder: toNumber(category?.sortOrder),
    isActive: toBoolean(category?.isActive, true),
});

const normalizeAppContent = (content: PublicAppContent | null | undefined): PublicAppContent => ({
    appTarget: content?.appTarget || 'customer_app',
    legal: content?.legal || {},
    support: content?.support || {},
    social: Array.isArray(content?.social) ? content.social : [],
    store: content?.store || {},
    display: content?.display || {},
});

class ApiClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    getBaseUrl(): string {
        return this.baseURL;
    }

    private async fetchWithTimeout(
        input: RequestInfo | URL,
        init?: RequestInit,
        timeoutMs: number = 15000
    ): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(input, {
                ...init,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }
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
            await this.touchSession();
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
            await AsyncStorage.removeItem(KEYS.SESSION_LAST_ACTIVE);
        } catch (error) {
            console.error('Error clearing tokens:', error);
        }
    }

    async touchSession(): Promise<void> {
        try {
            await AsyncStorage.setItem(KEYS.SESSION_LAST_ACTIVE, new Date().toISOString());
        } catch (error) {
            console.error('Error updating session activity:', error);
        }
    }

    async getLastSessionActivity(): Promise<Date | null> {
        try {
            const rawValue = await AsyncStorage.getItem(KEYS.SESSION_LAST_ACTIVE);
            if (!rawValue) {
                return null;
            }

            const parsed = new Date(rawValue);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        } catch (error) {
            console.error('Error reading session activity:', error);
            return null;
        }
    }

    async isSessionExpired(): Promise<boolean> {
        const lastActive = await this.getLastSessionActivity();
        if (!lastActive) {
            return false;
        }

        return Date.now() - lastActive.getTime() > SESSION_MAX_INACTIVE_MS;
    }

    async hasActiveSession(): Promise<boolean> {
        let token = await this.getToken();
        const refreshToken = await this.getRefreshToken();

        const expired = await this.isSessionExpired();
        if (expired) {
            await this.clearTokens();
            return false;
        }

        // If access token is missing but refresh token exists, recover session silently.
        if (!token) {
            const refreshedToken = await this.refreshAccessToken();
            if (!refreshedToken) {
                // Keep the user signed in when refresh token still exists.
                // This prevents silent logout during transient network outages.
                return Boolean(refreshToken);
            }
            token = refreshedToken;
        }

        const lastActive = await this.getLastSessionActivity();
        if (!lastActive) {
            await this.touchSession();
        }

        return Boolean(token);
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(): Promise<string | null> {
        const refreshToken = await this.getRefreshToken();
        if (!refreshToken) return null;

        try {
            const response = await this.fetchWithTimeout(`${this.baseURL}/auth/user/refresh-token`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    await this.clearTokens();
                }
                return null;
            }

            const data = await response.json();
            if (data.success && data.accessToken) {
                const nextRefreshToken = data.refreshToken || refreshToken;
                await this.setTokens(data.accessToken, nextRefreshToken);
                await this.touchSession();
                return data.accessToken;
            }

            if (data?.message && `${data.message}`.toLowerCase().includes('expired')) {
                await this.clearTokens();
            }

            return null;
        } catch (error) {
            console.error('Token refresh failed:', error);
            // Keep session data on transient network/runtime failures.
            // We'll only clear tokens when backend explicitly rejects token validity.
            return null;
        }
    }

    /**
     * Make authenticated API request with automatic token refresh
     */
    async request(
        endpoint: string,
        options: RequestInit & { timeoutMs?: number } = {}
    ): Promise<Response> {
        const token = await this.getToken();
        const url = `${this.baseURL}${endpoint}`;
        const { timeoutMs, ...requestOptions } = options;

        // Add auth header if token exists
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string>),
        };

        headers['Accept'] = headers['Accept'] || 'application/json';

        // Don't set Content-Type for FormData - browser will set it with boundary
        if (!(requestOptions.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Make request
        let response = await this.fetchWithTimeout(url, {
            ...requestOptions,
            headers,
        }, timeoutMs);

        // If 401, try to refresh token and retry once (even if access token was missing)
        if (response.status === 401) {
            const newToken = await this.refreshAccessToken();
            if (newToken) {
                // Retry with new token
                headers['Authorization'] = `Bearer ${newToken}`;
                response = await this.fetchWithTimeout(url, {
                    ...requestOptions,
                    headers,
                }, timeoutMs);
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
    async get<T>(endpoint: string, options: { timeoutMs?: number } = {}): Promise<T> {
        const response = await this.request(endpoint, { method: 'GET', ...options });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * POST request
     */
    async post<T>(endpoint: string, data?: any, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
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
    async put<T>(endpoint: string, data?: any, options?: { timeoutMs?: number }): Promise<T> {
        const response = await this.request(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
            ...options,
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
    async patch<T>(endpoint: string, data?: any, options?: { timeoutMs?: number }): Promise<T> {
        const response = await this.request(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
            ...options,
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
    async delete<T>(endpoint: string, options: { timeoutMs?: number } = {}): Promise<T> {
        const response = await this.request(endpoint, { method: 'DELETE', ...options });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    async testConnection(): Promise<{
        ok: boolean;
        status: number;
        url: string;
        success?: boolean;
        message?: string;
    }> {
        const endpoint = '/tenants';
        const url = `${this.baseURL}${endpoint}`;

        try {
            const response = await this.fetchWithTimeout(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            }, 10000);

            let payload: any = null;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            return {
                ok: response.ok,
                status: response.status,
                url,
                success: payload?.success,
                message: payload?.message,
            };
        } catch (error: any) {
            return {
                ok: false,
                status: 0,
                url,
                message: error?.message || 'Connection test failed',
            };
        }
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        return this.hasActiveSession();
    }

    /**
     * Get stored user data
     */
    async getUser(): Promise<User | null> {
        try {
            const userJson = await AsyncStorage.getItem(KEYS.USER);
            return userJson ? normalizeUser(JSON.parse(userJson)) : null;
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
            await AsyncStorage.setItem(KEYS.USER, JSON.stringify(normalizeUser(user)));
        } catch (error) {
            console.error('Error storing user:', error);
        }
    }

    /**
     * Request a password reset email.
     */
    async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
        return this.post<{ success: boolean; message: string }>('/auth/user/forgot-password', {
            email,
        });
    }

    async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
        return this.post<{ success: boolean; message: string }>(`/auth/user/reset-password/${encodeURIComponent(token)}`, {
            password,
        });
    }

    async googleStart(idToken: string): Promise<GoogleStartResponse> {
        return this.post<GoogleStartResponse>('/auth/user/google/start', { idToken });
    }

    async googleSendPhoneOtp(onboardingToken: string, phone: string): Promise<GoogleSendOtpResponse> {
        return this.post<GoogleSendOtpResponse>('/auth/user/google/send-phone-otp', {
            onboardingToken,
            phone,
        });
    }

    async googleComplete(data: {
        onboardingToken: string;
        phone: string;
        otp: string;
        firstName?: string;
        lastName?: string;
    }): Promise<GoogleCompleteResponse> {
        return this.post<GoogleCompleteResponse>('/auth/user/google/complete', data);
    }

    /**
     * Get authenticated user profile from backend.
     */
    async getProfile(): Promise<User> {
        const response = await this.get<{ success: boolean; user: User }>('/users/profile');
        return normalizeUser(response.user);
    }

    /**
     * Update authenticated user profile.
     */
    async updateProfile(data: Partial<User>): Promise<User> {
        const response = await this.put<{ success: boolean; user: User }>('/users/profile', data);
        return normalizeUser(response.user);
    }

    async registerPushToken(data: {
        token: string;
        platform: string;
        appVersion?: string;
        deviceName?: string;
    }): Promise<{ success: boolean; message: string }> {
        return this.post<{ success: boolean; message: string }>('/users/push-token', data);
    }

    async unregisterPushToken(token: string): Promise<{ success: boolean; message: string }> {
        const response = await this.request('/users/push-token', {
            method: 'DELETE',
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    async getNotifications(page: number = 1, limit: number = 20): Promise<{
        success: boolean;
        notifications: CustomerNotification[];
        unreadCount: number;
        pagination: { total: number; page: number; limit: number; totalPages: number };
    }> {
        return this.get(`/users/notifications?page=${page}&limit=${limit}`);
    }

    async getNotificationDetail(id: string): Promise<{ success: boolean; notification: CustomerNotification }> {
        return this.get(`/users/notifications/${id}`);
    }

    async getNotificationByCampaign(campaignId: string): Promise<{ success: boolean; notification: CustomerNotification }> {
        return this.get(`/users/notifications/campaign/${campaignId}`);
    }

    async markNotificationRead(id: string): Promise<{ success: boolean; message: string }> {
        return this.post(`/users/notifications/${id}/read`, {});
    }

    async getMyReviews(limit: number = 50): Promise<CustomerReviewRecord[]> {
        const response = await this.get<{ success: boolean; reviews: CustomerReviewRecord[] }>(`/users/reviews?limit=${limit}`);
        return response.reviews || [];
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
    async getBookings(status?: 'upcoming' | 'completed' | 'cancelled' | 'no_show'): Promise<Booking[]> {
        const response = await this.get<{ success: boolean; appointments: Booking[] }>('/bookings');
        const normalized = (response.appointments || []).map((appointment) => normalizeBooking(appointment));

        if (!status) {
            return normalized;
        }

        if (status === 'upcoming') {
            return normalized.filter((appointment) => ['pending', 'confirmed', 'checked_in', 'in_service'].includes(appointment.status));
        }

        if (status === 'completed') return normalized.filter((appointment) => appointment.status === 'completed');
        if (status === 'cancelled') return normalized.filter((appointment) => appointment.status === 'cancelled');
        if (status === 'no_show') return normalized.filter((appointment) => appointment.status === 'no_show');

        return normalized.filter((appointment) => appointment.status === status);
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(
        id: string,
        payload?: {
            reasonCode?: string;
            reasonText?: string;
        }
    ): Promise<boolean> {
        const response = await this.patch<{ success: boolean; message: string }>(
            `/bookings/${id}/cancel`,
            payload
        );
        return response.success;
    }

    async rescheduleBooking(id: string, data: { startTime: string; staffId?: string }): Promise<Booking> {
        const response = await this.patch<{ success: boolean; appointment: Booking }>(
            `/bookings/${id}/reschedule`,
            data
        );
        return normalizeBooking(response.appointment);
    }

    /**
     * Get booking details
     */
    async getBooking(id: string): Promise<Booking> {
        const response = await this.get<{ success: boolean; appointment: Booking }>(
            `/bookings/${id}`
        );
        return normalizeBooking(response.appointment);
    }

    async getAppointmentInvite(token: string): Promise<AppointmentInviteDetails> {
        const response = await this.get<{ success: boolean; invite: AppointmentInviteDetails }>(
            `/bookings/invites/${encodeURIComponent(token)}`
        );
        return response.invite;
    }

    async respondToAppointmentInvite(appointmentId: string, response: 'confirm' | 'decline'): Promise<Booking> {
        const payload = await this.post<{ success: boolean; appointment: Booking }>(
            `/bookings/${appointmentId}/respond`,
            { response }
        );
        return normalizeBooking(payload.appointment);
    }

    async respondToAppointmentInviteByToken(token: string, response: 'confirm' | 'decline'): Promise<Booking> {
        const payload = await this.post<{ success: boolean; appointment: Booking }>(
            `/bookings/invites/${encodeURIComponent(token)}/respond`,
            { response }
        );
        return normalizeBooking(payload.appointment);
    }

    /**
     * Get user orders
     */
    async getOrders(): Promise<Order[]> {
        const response = await this.get<{ success: boolean; orders: Order[] }>('/orders');
        return (response.orders || []).map((order) => normalizeOrder(order));
    }

    /**
     * Get order details
     */
    async getOrder(id: string): Promise<Order> {
        const response = await this.get<{ success: boolean; order: Order }>(`/orders/${id}`);
        return normalizeOrder(response.order);
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
        paymentMethod?: 'card' | 'wallet';
        cardNumber?: string;
        expiryDate?: string;
        cvv?: string;
        cardholderName?: string;
        saveCard?: boolean;
        tenantId?: string;
        paymentChoice?: 'online-full' | 'booking-fee';
    }): Promise<{ success: boolean; transaction: any }> {
        return this.post<{ success: boolean; transaction: any }>('/payments/process', data);
    }

    async getWalletBalance(): Promise<number> {
        const response = await this.get<{ success: boolean; walletBalance: number }>('/payments/wallet/balance');
        return toNumber(response.walletBalance, 0);
    }

    /**
     * Get active hot deals for mobile carousel
     */
    async getHotDeals(): Promise<HotDeal[]> {
        const response = await this.get<{ success: boolean; deals: HotDeal[] }>('/hot-deals');
        return (response.deals || []).map((deal) => normalizeHotDeal(deal));
    }

    /**
     * Get service categories
     */
    async getCategories(): Promise<ServiceCategory[]> {
        const response = await this.get<{ success: boolean; categories: ServiceCategory[] }>('/categories');
        return (response.categories || []).map((category) => normalizeCategory(category));
    }

    /**
     * Get all public tenants for discovery
     */
    async getTenants(): Promise<Tenant[]> {
        const response = await this.get<{ success: boolean; tenants: Tenant[] }>('/public/tenants');
        return (response.tenants || []).map((tenant) => normalizeTenant(tenant));
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
        return (response.tenants || []).map((tenant) => normalizeTenant(tenant)).slice(0, limit);
    }

    /**
     * Get top service providers (cross-tenant staff)
     */
    async getTopProviders(): Promise<Staff[]> {
        const response = await this.get<{ success?: boolean; staff?: Array<Partial<Staff> & { photo?: string }> }>('/public/providers/top');
        const staff = response.staff || [];

        return staff
            .map((member) => ({
                id: member.id || '',
                name: member.name || 'Staff',
                role: member.role,
                specialty: member.specialty,
                avatar: member.avatar || member.photo,
                bio: member.bio,
                experience: member.experience,
                rating: Number(member.rating || 0),
                skills: Array.isArray(member.skills) ? member.skills : [],
            }))
            .map((member) => normalizeStaff(member))
            .filter((member) => member.id)
            .sort((left, right) => right.rating - left.rating);
    }

    async getCustomerAppContent(): Promise<PublicAppContent> {
        try {
            const response = await this.get<{
                success: boolean;
                appContent: PublicAppContent;
            }>('/public/apps-center/customer-app');

            const appContent = normalizeAppContent(response.appContent || DEFAULT_CUSTOMER_APP_CONTENT);
            await AsyncStorage.setItem(KEYS.CUSTOMER_APP_CONTENT, JSON.stringify(appContent));
            return appContent;
        } catch (error) {
            console.error('Failed to fetch customer app content:', error);

            try {
                const cached = await AsyncStorage.getItem(KEYS.CUSTOMER_APP_CONTENT);
                return cached ? normalizeAppContent(JSON.parse(cached)) : DEFAULT_CUSTOMER_APP_CONTENT;
            } catch (storageError) {
                console.error('Failed to load cached app content:', storageError);
                return DEFAULT_CUSTOMER_APP_CONTENT;
            }
        }
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

export interface CustomerReviewRecord {
    id: string;
    tenantId: string;
    staffId?: string | null;
    appointmentId?: string | null;
    rating: number;
    comment?: string | null;
    customerName?: string | null;
    staffReply?: string | null;
    staffRepliedAt?: string | null;
    isVisible: boolean;
    createdAt: string;
    tenant?: {
        id: string;
        name?: string;
        name_en?: string;
        name_ar?: string;
        slug?: string;
        logo?: string | null;
    } | null;
    staff?: {
        id: string;
        name?: string;
        photo?: string | null;
    } | null;
}

export const getServicePrice = (
    service: Partial<Service> | null | undefined,
    variant?: Partial<ServiceVariant> | null
): number => {
    if (!service) {
        return variant ? toNumber(variant.finalPrice) : 0;
    }

    if (variant) {
        return toNumber(variant.finalPrice);
    }

    const candidate = service.finalPrice
        ?? service.basePrice
        ?? service.minPrice
        ?? service.maxPrice
        ?? service.rawPrice
        ?? 0;
    return toNumber(candidate);
};

export const bookingNeedsPayment = (paymentStatus?: string | null): boolean =>
    paymentStatus === 'pending' || paymentStatus === 'deposit_paid';

export const getBookingOutstandingAmount = (booking: Partial<Booking> | null | undefined): number => {
    if (!booking) {
        return 0;
    }

    const totalPrice = toNumber(booking.price);
    const totalPaid = toNumber(booking.totalPaid);
    const remainingBalance = parseFloat(Math.max(0, totalPrice - totalPaid).toFixed(2));

    if (booking.paymentStatus === 'pending'
        && booking.paymentMethod === 'booking-fee'
        && !toBoolean(booking.depositPaid)
        && toNumber(booking.depositAmount) > 0) {
        return toNumber(booking.depositAmount);
    }

    return remainingBalance;
};

export const orderNeedsPayment = (order: Pick<Order, 'paymentMethod' | 'paymentStatus' | 'status'>): boolean =>
    order.paymentMethod === 'online' &&
    order.paymentStatus !== 'paid' &&
    !['cancelled', 'refunded', 'completed'].includes(order.status);

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
