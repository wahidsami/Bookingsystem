import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import api from '../services/api';

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    photo?: string;
    must_change_password?: boolean;
    scheduleVisibilityWeeks?: number;
    tenant?: {
        id: string;
        businessName?: string;
        name_en: string;
        name_ar: string;
        logo?: string;
    };
    permissions?: {
        view_earnings: boolean;
        view_reviews: boolean;
        reply_reviews: boolean;
        view_clients: boolean;
        view_booking_notes: boolean;
        can_start_service: boolean;
        can_mark_no_show: boolean;
    };
    features?: {
        today: boolean;
        schedule: boolean;
        profile: boolean;
        messages: boolean;
        earnings: boolean;
        reviews: boolean;
        timeOff: boolean;
        clientNotes: boolean;
        pushNotifications: boolean;
        entitlements?: {
            internalMessaging: boolean;
            payroll: boolean;
            pushNotifications: boolean;
        };
    };
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    signIn: (tokens: any, userData: User) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    signIn: async () => { },
    signOut: async () => { },
    updateUser: () => { },
});

const STAFF_USER_CACHE_KEY = 'refah_staff_user_cache';

const normalizeUserPayload = (userData: any): User => ({
    id: `${userData?.id || ''}`,
    name: `${userData?.name || 'Staff'}`,
    email: `${userData?.email || ''}`,
    phone: userData?.phone ? `${userData.phone}` : undefined,
    photo: userData?.photo || undefined,
    must_change_password: Boolean(userData?.must_change_password),
    scheduleVisibilityWeeks: Number(userData?.scheduleVisibilityWeeks || 1),
    tenant: userData?.tenant
        ? {
            id: `${userData.tenant.id || ''}`,
            businessName: userData.tenant.businessName || undefined,
            name_en: userData.tenant.name_en || userData.tenant.businessName || '',
            name_ar: userData.tenant.name_ar || userData.tenant.businessName || '',
            logo: userData.tenant.logo || undefined,
        }
        : undefined,
    permissions: {
        view_earnings: Boolean(userData?.permissions?.view_earnings),
        view_reviews: Boolean(userData?.permissions?.view_reviews),
        reply_reviews: Boolean(userData?.permissions?.reply_reviews),
        view_clients: Boolean(userData?.permissions?.view_clients),
        view_booking_notes: Boolean(userData?.permissions?.view_booking_notes),
        can_start_service: userData?.permissions?.can_start_service !== false,
        can_mark_no_show: userData?.permissions?.can_mark_no_show !== false,
    },
    features: {
        today: userData?.features?.today !== false,
        schedule: userData?.features?.schedule !== false,
        profile: userData?.features?.profile !== false,
        messages: Boolean(userData?.features?.messages),
        earnings: Boolean(userData?.features?.earnings),
        reviews: Boolean(userData?.features?.reviews),
        timeOff: Boolean(userData?.features?.timeOff),
        clientNotes: userData?.features?.clientNotes !== false,
        pushNotifications: userData?.features?.pushNotifications !== false,
        entitlements: {
            internalMessaging: Boolean(userData?.features?.entitlements?.internalMessaging),
            payroll: Boolean(userData?.features?.entitlements?.payroll),
            pushNotifications: Boolean(userData?.features?.entitlements?.pushNotifications),
        },
    },
});

const parseCachedUser = async (): Promise<User | null> => {
    try {
        const raw = await SecureStore.getItemAsync(STAFF_USER_CACHE_KEY);
        if (!raw) return null;
        return normalizeUserPayload(JSON.parse(raw));
    } catch {
        return null;
    }
};

const persistCachedUser = async (userData: User) => {
    try {
        await SecureStore.setItemAsync(STAFF_USER_CACHE_KEY, JSON.stringify(userData));
    } catch (error) {
        console.warn('Failed to persist cached staff user', error);
    }
};

const clearCachedSession = async () => {
    await SecureStore.deleteItemAsync('refah_staff_access_token');
    await SecureStore.deleteItemAsync('refah_staff_refresh_token');
    await SecureStore.deleteItemAsync(STAFF_USER_CACHE_KEY);
};

export function useAuth() {
    return useContext(AuthContext);
}

// Custom hook to protect routes
function useProtectedRoute(user: User | null, isLoading: boolean) {
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!user && !inAuthGroup) {
            // Redirect to login
            router.replace('/(auth)/login');
        } else if (user) {
            // If user is logged in, but needs to change password, force them to change-password screen
            const currentRoute = segments.length > 1 ? (segments as string[])[1] : undefined;
            if (user.must_change_password && currentRoute !== 'change-password') {
                router.replace('/(auth)/change-password');
            } else if (!user.must_change_password && inAuthGroup) {
                // Logged in user shouldn't see auth screens
                router.replace('/(tabs)');
            }
        }
    }, [user, isLoading, segments, router]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Attempt to restore session on mount
        const restoreSession = async () => {
            const cachedUser = await parseCachedUser();

            try {
                const token = await SecureStore.getItemAsync('refah_staff_access_token');
                if (!token) {
                    await SecureStore.deleteItemAsync(STAFF_USER_CACHE_KEY);
                    setUser(null);
                    return;
                }

                // Verify token by fetching user profile.
                // If the backend is temporarily unavailable, fall back to the cached profile
                // rather than wiping valid credentials.
                try {
                    const response = await api.get('/staff/me');
                    if (response.data.success && response.data.staff) {
                        const normalizedUser = normalizeUserPayload(response.data.staff);
                        setUser(normalizedUser);
                        await persistCachedUser(normalizedUser);
                        return;
                    }
                    if (cachedUser) {
                        setUser(cachedUser);
                        return;
                    }
                } catch (error: any) {
                    const status = error?.response?.status;
                    if (status === 401 || status === 403) {
                        await clearCachedSession();
                        setUser(null);
                        return;
                    }

                    if (cachedUser) {
                        console.warn('Restoring staff session from cache after profile lookup failure');
                        setUser(cachedUser);
                        return;
                    }

                    console.error('Failed to restore session', error);
                }
            } finally {
                setIsLoading(false);
            }
        };

        restoreSession();
    }, []);

    // Protect routes centrally
    useProtectedRoute(user, isLoading);

    const signIn = async (tokens: { accessToken: string; refreshToken: string }, userData: User) => {
        await SecureStore.setItemAsync('refah_staff_access_token', tokens.accessToken);
        await SecureStore.setItemAsync('refah_staff_refresh_token', tokens.refreshToken);
        const normalizedUser = normalizeUserPayload(userData);
        await persistCachedUser(normalizedUser);
        setUser(normalizedUser);
    };

    const signOut = async () => {
        try {
            await api.post('/staff/auth/logout');
        } catch {
            // Ignore network errors on logout, we still want to wipe local state
        } finally {
            await clearCachedSession();
            setUser(null);
        }
    };

    const updateUser = (userData: Partial<User>) => {
        setUser(prev => {
            if (!prev) return null;
            const next = normalizeUserPayload({ ...prev, ...userData });
            void persistCachedUser(next);
            return next;
        });
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}
