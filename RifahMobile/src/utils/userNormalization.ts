import type { User } from '../api/client';

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

export const normalizeUser = (user: Partial<User> | null | undefined): User => ({
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

