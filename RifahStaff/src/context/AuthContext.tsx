import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import api from '../services/api';

interface User {
    id: string;
    name: string;
    email: string;
    photo?: string;
    must_change_password?: boolean;
    tenant?: {
        id: string;
        name_en: string;
        name_ar: string;
        logo?: string;
    };
    permissions?: {
        view_earnings: boolean;
        view_reviews: boolean;
        reply_reviews: boolean;
        view_clients: boolean;
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
    }, [user, isLoading, segments]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Attempt to restore session on mount
        const restoreSession = async () => {
            try {
                const token = await SecureStore.getItemAsync('refah_staff_access_token');
                if (token) {
                    // Verify token by fetching user profile
                    const response = await api.get('/staff/me');
                    if (response.data.success && response.data.staff) {
                        setUser(response.data.staff);
                    }
                }
            } catch (e) {
                console.error('Failed to restore session', e);
                // Clean up bad tokens
                await SecureStore.deleteItemAsync('refah_staff_access_token');
                await SecureStore.deleteItemAsync('refah_staff_refresh_token');
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
        setUser(userData);
    };

    const signOut = async () => {
        try {
            await api.post('/staff/auth/logout');
        } catch (e) {
            // Ignore network errors on logout, we still want to wipe local state
        } finally {
            await SecureStore.deleteItemAsync('refah_staff_access_token');
            await SecureStore.deleteItemAsync('refah_staff_refresh_token');
            setUser(null);
        }
    };

    const updateUser = (userData: Partial<User>) => {
        setUser(prev => prev ? { ...prev, ...userData } : null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}
