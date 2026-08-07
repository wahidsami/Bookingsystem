import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from '../config/env';
import { normalizeUser } from '../utils/userNormalization';
import type { GoogleCompleteResponse, GoogleStartResponse, StaffProfile, User } from '../api/client';

const SESSION_STORAGE_KEYS = {
    ACCESS_TOKEN: 'refah_access_token',
    REFRESH_TOKEN: 'refah_refresh_token',
    USER: 'refah_user',
    SESSION_LAST_ACTIVE: 'refah_session_last_active',
};

const SESSION_MAX_INACTIVE_DAYS = 90;
const SESSION_MAX_INACTIVE_MS = SESSION_MAX_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

type SessionMode = 'customer' | 'staff';
type SessionStatus = 'booting' | 'anonymous' | 'authenticated';

export interface SessionSnapshot {
    status: SessionStatus;
    ready: boolean;
    authenticated: boolean;
    bootstrapping: boolean;
    user: User | null;
    staffProfile: StaffProfile | null;
    appMode: SessionMode;
    lastSyncedAt: string | null;
}

type SessionListener = (snapshot: SessionSnapshot) => void;

type PasswordLoginResponse = {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    user?: User;
    message?: string;
};

type RegisterResponse = {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    user?: User;
    message?: string;
};

type GoogleSendOtpResponse = {
    success: boolean;
    message: string;
    phone: string;
    testCodeEnabled: boolean;
};

type ProfileResponse = {
    success: boolean;
    user?: User;
};

type StaffProfileResponse = {
    success: boolean;
    staff?: StaffProfile;
};

class SessionManager {
    private readonly apiBaseUrl = getApiUrl();

    private snapshot: SessionSnapshot = {
        status: 'booting',
        ready: false,
        authenticated: false,
        bootstrapping: true,
        user: null,
        staffProfile: null,
        appMode: 'customer',
        lastSyncedAt: null,
    };

    private listeners = new Set<SessionListener>();

    subscribe(listener: SessionListener): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getSnapshot(): SessionSnapshot {
        return this.snapshot;
    }

    private emit(nextSnapshot: Partial<SessionSnapshot> = {}): SessionSnapshot {
        this.snapshot = {
            ...this.snapshot,
            ...nextSnapshot,
        };

        this.listeners.forEach((listener) => listener(this.snapshot));
        return this.snapshot;
    }

    private async fetchJson<T>(
        path: string,
        options: RequestInit & { timeoutMs?: number } = {}
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutMs = options.timeoutMs ?? 30000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(`${this.apiBaseUrl}${path}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    ...(options.headers as Record<string, string> | undefined),
                    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
                },
            });
        } finally {
            clearTimeout(timer);
        }
    }

    private async requestJson<T>(
        path: string,
        options: RequestInit & { timeoutMs?: number } = {}
    ): Promise<T> {
        const response = await this.fetchJson(path, options);
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            const message = payload?.message || `HTTP ${response.status}`;
            throw new Error(message);
        }

        return payload as T;
    }

    private async getStoredValue(key: string): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.error('SessionManager storage read failed:', error);
            return null;
        }
    }

    private async setStoredValue(key: string, value: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.error('SessionManager storage write failed:', error);
        }
    }

    private async removeStoredValue(key: string): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error('SessionManager storage delete failed:', error);
        }
    }

    private async getCachedUser(): Promise<User | null> {
        try {
            const rawUser = await AsyncStorage.getItem(SESSION_STORAGE_KEYS.USER);
            return rawUser ? normalizeUser(JSON.parse(rawUser)) : null;
        } catch (error) {
            console.error('SessionManager cached user read failed:', error);
            return null;
        }
    }

    private async setCachedUser(user: User | null): Promise<void> {
        try {
            if (!user) {
                await AsyncStorage.removeItem(SESSION_STORAGE_KEYS.USER);
                return;
            }

            await AsyncStorage.setItem(SESSION_STORAGE_KEYS.USER, JSON.stringify(normalizeUser(user)));
        } catch (error) {
            console.error('SessionManager cached user write failed:', error);
        }
    }

    private async touchSession(): Promise<void> {
        try {
            await AsyncStorage.setItem(SESSION_STORAGE_KEYS.SESSION_LAST_ACTIVE, new Date().toISOString());
        } catch (error) {
            console.error('SessionManager session touch failed:', error);
        }
    }

    private async getLastSessionActivity(): Promise<Date | null> {
        try {
            const rawValue = await AsyncStorage.getItem(SESSION_STORAGE_KEYS.SESSION_LAST_ACTIVE);
            if (!rawValue) {
                return null;
            }

            const parsed = new Date(rawValue);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        } catch (error) {
            console.error('SessionManager session activity read failed:', error);
            return null;
        }
    }

    private async clearSessionStorage(): Promise<void> {
        await Promise.allSettled([
            this.removeStoredValue(SESSION_STORAGE_KEYS.ACCESS_TOKEN),
            this.removeStoredValue(SESSION_STORAGE_KEYS.REFRESH_TOKEN),
            AsyncStorage.removeItem(SESSION_STORAGE_KEYS.USER),
            AsyncStorage.removeItem(SESSION_STORAGE_KEYS.SESSION_LAST_ACTIVE),
        ]);
    }

    async getAccessToken(): Promise<string | null> {
        return this.getStoredValue(SESSION_STORAGE_KEYS.ACCESS_TOKEN);
    }

    async getRefreshToken(): Promise<string | null> {
        return this.getStoredValue(SESSION_STORAGE_KEYS.REFRESH_TOKEN);
    }

    async setTokens(accessToken: string, refreshToken?: string | null): Promise<void> {
        await this.setStoredValue(SESSION_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        const normalizedRefresh = `${refreshToken ?? ''}`.trim();
        if (normalizedRefresh) {
            await this.setStoredValue(SESSION_STORAGE_KEYS.REFRESH_TOKEN, normalizedRefresh);
        }
        await this.touchSession();
    }

    private async hasExpiredSession(): Promise<boolean> {
        const lastActive = await this.getLastSessionActivity();
        if (!lastActive) {
            return false;
        }

        return Date.now() - lastActive.getTime() > SESSION_MAX_INACTIVE_MS;
    }

    private async resolveSession(): Promise<SessionSnapshot> {
        const token = await this.getAccessToken();
        const refreshToken = await this.getRefreshToken();

        const expired = await this.hasExpiredSession();
        if (expired) {
            await this.logout();
            return this.snapshot;
        }

        let activeToken = token;
        if (!activeToken && refreshToken) {
            activeToken = await this.refreshAccessToken();
        }

        if (!activeToken) {
            const cachedUser = await this.getCachedUser();
            this.emit({
                status: 'anonymous',
                ready: true,
                bootstrapping: false,
                authenticated: false,
                user: cachedUser,
                staffProfile: null,
                appMode: 'customer',
                lastSyncedAt: new Date().toISOString(),
            });
            return this.snapshot;
        }

        const [cachedUser, profileResult, staffProfileResult] = await Promise.all([
            this.getCachedUser(),
            this.fetchProfile().catch(() => null),
            this.fetchStaffProfile().catch(() => null),
        ]);

        const user = profileResult ?? cachedUser;
        if (user) {
            await this.setCachedUser(user);
        }

        const staffProfile = staffProfileResult;
        this.emit({
            status: 'authenticated',
            ready: true,
            bootstrapping: false,
            authenticated: true,
            user: user ?? null,
            staffProfile,
            appMode: staffProfile ? 'staff' : 'customer',
            lastSyncedAt: new Date().toISOString(),
        });
        return this.snapshot;
    }

    async bootstrap(): Promise<SessionSnapshot> {
        this.emit({
            status: 'booting',
            ready: false,
            bootstrapping: true,
            lastSyncedAt: new Date().toISOString(),
        });

        return this.resolveSession();
    }

    async loginWithPassword(email: string, password: string): Promise<SessionSnapshot> {
        const response = await this.requestJson<PasswordLoginResponse>('/auth/user/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (!response.success || !response.accessToken) {
            throw new Error(response.message || 'Login failed. Please check your credentials.');
        }

        await this.setTokens(response.accessToken, response.refreshToken ?? null);
        if (response.user) {
            await this.setCachedUser(response.user);
        }

        return this.resolveSession();
    }

    async registerCustomer(data: {
        email: string;
        phone: string;
        password: string;
        firstName: string;
        lastName: string;
        dateOfBirth?: string;
        gender?: 'male' | 'female' | 'other' | '';
    }): Promise<SessionSnapshot> {
        const response = await this.requestJson<RegisterResponse>('/auth/user/register', {
            method: 'POST',
            body: JSON.stringify({
                email: data.email,
                phone: data.phone,
                password: data.password,
                firstName: data.firstName,
                lastName: data.lastName,
            }),
        });

        if (!response.success || !response.accessToken) {
            throw new Error(response.message || 'Registration failed');
        }

        await this.setTokens(response.accessToken, response.refreshToken ?? null);
        let user = response.user ?? null;

        if ((data.dateOfBirth || data.gender) && user) {
            try {
                const updatedUser = await this.requestJson<{ success: boolean; user: User }>('/users/profile', {
                    method: 'PUT',
                    body: JSON.stringify({
                        dateOfBirth: data.dateOfBirth || undefined,
                        gender: data.gender || undefined,
                    }),
                });
                user = updatedUser.user;
            } catch (error) {
                console.error('SessionManager registration profile update failed:', error);
            }
        }

        if (user) {
            await this.setCachedUser(user);
        }

        return this.resolveSession();
    }

    async startGoogleLogin(idToken: string): Promise<GoogleStartResponse> {
        const response = await this.requestJson<GoogleStartResponse>('/auth/user/google/start', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
        });

        if (response.success && response.requiresOnboarding === false && response.accessToken && response.user) {
            await this.setTokens(response.accessToken, response.refreshToken ?? null);
            await this.setCachedUser(response.user);
            await this.resolveSession();
        }

        return response;
    }

    async completeGoogleOnboarding(data: {
        onboardingToken: string;
        phone: string;
        otp: string;
        firstName?: string;
        lastName?: string;
    }): Promise<GoogleCompleteResponse> {
        const response = await this.requestJson<GoogleCompleteResponse>('/auth/user/google/complete', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        if (!response.success || !response.accessToken) {
            throw new Error(response.message || 'Google completion failed');
        }

        await this.setTokens(response.accessToken, response.refreshToken ?? null);
        if (response.user) {
            await this.setCachedUser(response.user);
        }
        await this.resolveSession();
        return response;
    }

    async googleSendPhoneOtp(onboardingToken: string, phone: string): Promise<GoogleSendOtpResponse> {
        return this.requestJson<GoogleSendOtpResponse>('/auth/user/google/send-phone-otp', {
            method: 'POST',
            body: JSON.stringify({
                onboardingToken,
                phone,
            }),
        });
    }

    async refreshAccessToken(): Promise<string | null> {
        const refreshToken = await this.getRefreshToken();
        if (!refreshToken) {
            return null;
        }

        try {
            const response = await this.fetchJson('/auth/user/refresh-token', {
                method: 'POST',
                body: JSON.stringify({ refreshToken }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    await this.logout();
                }
                return null;
            }

            if (payload?.success && payload.accessToken) {
                await this.setTokens(payload.accessToken, payload.refreshToken || refreshToken);
                return payload.accessToken;
            }

            if (`${payload?.message || ''}`.toLowerCase().includes('expired')) {
                await this.logout();
            }

            return null;
        } catch (error) {
            console.error('SessionManager token refresh failed:', error);
            return null;
        }
    }

    async ensureSession(): Promise<boolean> {
        const token = await this.getAccessToken();
        const refreshToken = await this.getRefreshToken();

        if (!token && !refreshToken) {
            return false;
        }

        if (await this.hasExpiredSession()) {
            await this.logout();
            return false;
        }

        if (!token) {
            return Boolean(await this.refreshAccessToken());
        }

        await this.touchSession();
        return true;
    }

    async touch(): Promise<void> {
        if (!this.snapshot.authenticated) {
            return;
        }

        await this.touchSession();
        this.emit({
            lastSyncedAt: new Date().toISOString(),
        });
    }

    async logout(): Promise<void> {
        await this.clearSessionStorage();
        this.emit({
            status: 'anonymous',
            ready: true,
            bootstrapping: false,
            authenticated: false,
            user: null,
            staffProfile: null,
            appMode: 'customer',
            lastSyncedAt: new Date().toISOString(),
        });
    }

    async getUser(): Promise<User | null> {
        if (this.snapshot.user) {
            return this.snapshot.user;
        }

        return this.getCachedUser();
    }

    async setUser(user: User): Promise<void> {
        await this.setCachedUser(user);
        this.emit({
            user: normalizeUser(user),
            lastSyncedAt: new Date().toISOString(),
        });
    }

    async getStaffProfile(): Promise<StaffProfile | null> {
        if (this.snapshot.staffProfile) {
            return this.snapshot.staffProfile;
        }

        return this.fetchStaffProfile().catch(() => null);
    }

    async fetchProfile(): Promise<User | null> {
        try {
            const token = await this.getAccessToken();
            if (!token) {
                return null;
            }

            const response = await this.fetchJson('/users/profile', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success || !payload?.user) {
                return null;
            }

            return normalizeUser(payload.user);
        } catch (error) {
            console.error('SessionManager profile fetch failed:', error);
            return null;
        }
    }

    async fetchStaffProfile(): Promise<StaffProfile | null> {
        try {
            const token = await this.getAccessToken();
            if (!token) {
                return null;
            }

            const response = await this.fetchJson('/staff/me', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success || !payload?.staff) {
                return null;
            }

            return payload.staff as StaffProfile;
        } catch (error) {
            return null;
        }
    }

    async hasActiveSession(): Promise<boolean> {
        return this.ensureSession();
    }

    async isAuthenticated(): Promise<boolean> {
        return this.ensureSession();
    }
}

export const sessionManager = new SessionManager();
