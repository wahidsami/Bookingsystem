"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, User } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string, options?: { skipRedirect?: boolean }) => Promise<void>;
    register: (data: RegisterData, options?: { skipRedirect?: boolean }) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

interface RegisterData {
    email: string;
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Load user from storage on mount
    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const storedUser = typeof window !== 'undefined' 
                ? sessionStorage.getItem('rifah_user')
                : null;

            if (storedUser) {
                setUser(JSON.parse(storedUser));
            } else {
                // Try to get user from API if token exists
                const token = typeof window !== 'undefined'
                    ? sessionStorage.getItem('rifah_access_token')
                    : null;

                if (token) {
                    await refreshUser();
                }
            }
        } catch (error) {
            console.error('Failed to load user:', error);
            api.clearTokens();
        } finally {
            setLoading(false);
        }
    };

    const refreshUser = useCallback(async () => {
        try {
            const response = await api.get<{ success: boolean; user: User }>('/users/profile');
            if (response.success && response.user) {
                setUser(response.user);
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('rifah_user', JSON.stringify(response.user));
                }
            }
        } catch (error) {
            console.error('Failed to refresh user:', error);
            api.clearTokens();
            setUser(null);
        }
    }, []);

    const login = async (email: string, password: string, options?: { skipRedirect?: boolean }) => {
        try {
            const response = await api.post<{
                success: boolean;
                accessToken: string;
                refreshToken: string;
                user: User;
            }>('/auth/user/login', { email, password });

            if (response.success && response.accessToken) {
                api.setTokens(response.accessToken, response.refreshToken);
                setUser(response.user);
                
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('rifah_user', JSON.stringify(response.user));
                }

                // Only redirect if skipRedirect is not true
                if (!options?.skipRedirect) {
                    router.push('/dashboard');
                }
            } else {
                throw new Error('Login failed');
            }
        } catch (error: any) {
            throw new Error(error.message || 'Login failed. Please check your credentials.');
        }
    };

    const register = async (data: RegisterData, options?: { skipRedirect?: boolean }) => {
        try {
            const response = await api.post<{
                success: boolean;
                accessToken: string;
                refreshToken: string;
                user: User;
            }>('/auth/user/register', data);

            if (response.success && response.accessToken) {
                api.setTokens(response.accessToken, response.refreshToken);
                setUser(response.user);
                
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('rifah_user', JSON.stringify(response.user));
                }

                // Check if we should return to a specific page after registration
                if (typeof window !== 'undefined' && !options?.skipRedirect) {
                    const returnUrl = sessionStorage.getItem('rifah_return_after_register');
                    if (returnUrl) {
                        sessionStorage.removeItem('rifah_return_after_register');
                        router.push(returnUrl);
                    } else {
                        router.push('/dashboard');
                    }
                }
            } else {
                throw new Error('Registration failed');
            }
        } catch (error: any) {
            throw new Error(error.message || 'Registration failed. Please try again.');
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/user/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            api.clearTokens();
            setUser(null);
            router.push('/login');
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

