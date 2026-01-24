/**
 * Authentication Context for PublicPage App
 * Handles user authentication, token management, and user state
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:5000/api/v1';

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  walletBalance: number;
  loyaltyPoints: number;
  totalBookings: number;
  totalSpent: number;
  photo?: string;
}

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

// Helper functions for token management
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('rifah_access_token');
};

const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('rifah_refresh_token');
};

const setTokens = (accessToken: string, refreshToken: string): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('rifah_access_token', accessToken);
  sessionStorage.setItem('rifah_refresh_token', refreshToken);
};

const clearTokens = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('rifah_access_token');
  sessionStorage.removeItem('rifah_refresh_token');
  sessionStorage.removeItem('rifah_user');
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
        const token = getToken();
        if (token) {
          await refreshUser();
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      clearTokens();
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('rifah_user', JSON.stringify(data.user));
          }
        } else {
          throw new Error('Failed to get user');
        }
      } else {
        // Token might be expired, try to refresh
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/user/refresh-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.accessToken) {
              setTokens(refreshData.accessToken, refreshToken);
              // Retry getting user
              await refreshUser();
              return;
            }
          }
        }
        // Refresh failed, clear tokens
        clearTokens();
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      clearTokens();
      setUser(null);
    }
  }, []);

  const login = async (email: string, password: string, options?: { skipRedirect?: boolean }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || 'Login failed. Please check your credentials.');
      }

      const data = await response.json();

      if (data.success && data.accessToken) {
        setTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('rifah_user', JSON.stringify(data.user));
        }

        // Only redirect if skipRedirect is not true
        if (!options?.skipRedirect) {
          // For PublicPage, we might want to redirect to client app dashboard
          // But for now, we'll stay on the page
          window.location.href = 'http://localhost:3000/dashboard';
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
      const response = await fetch(`${API_BASE_URL}/auth/user/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(error.message || 'Registration failed. Please try again.');
      }

      const result = await response.json();

      if (result.success && result.accessToken) {
        setTokens(result.accessToken, result.refreshToken);
        setUser(result.user);
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('rifah_user', JSON.stringify(result.user));
        }

        // Check if we should return to a specific page after registration
        if (typeof window !== 'undefined' && !options?.skipRedirect) {
          const returnUrl = sessionStorage.getItem('rifah_return_after_register');
          if (returnUrl) {
            sessionStorage.removeItem('rifah_return_after_register');
            window.location.href = returnUrl;
          } else {
            window.location.href = 'http://localhost:3000/dashboard';
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
      const token = getToken();
      if (token) {
        await fetch(`${API_BASE_URL}/auth/user/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      setUser(null);
      // Redirect to current page (refresh)
      window.location.reload();
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
