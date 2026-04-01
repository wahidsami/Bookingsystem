"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tenantApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface TenantUser {
  id: string;
  email: string;
  businessName: string;
  businessType: string[];
  status: string;
  profileImage?: string;
  [key: string]: any;
}

interface TenantAuthContextType {
  user: TenantUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const TenantAuthContext = createContext<TenantAuthContextType | undefined>(undefined);

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TenantUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user;

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const accessToken = typeof window !== 'undefined'
        ? sessionStorage.getItem('rifah_tenant_access_token')
        : null;

      if (!accessToken) {
        setLoading(false);
        return;
      }

      // Fetch current tenant user
      const response = await tenantApi.get('/tenant/profile');

      if (response.success && response.tenant) {
        setUser(response.tenant);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      // Clear invalid tokens
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('rifah_tenant_access_token');
        localStorage.removeItem('rifah_tenant_refresh_token');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await tenantApi.login(email, password);

      if (response.success && response.tenant) {
        setUser(response.tenant);
        router.push('/ar/dashboard');
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await tenantApi.logout();
      setUser(null);
      router.push('/ar/login');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      router.push('/ar/login');
    }
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <TenantAuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth() {
  const context = useContext(TenantAuthContext);
  if (context === undefined) {
    throw new Error('useTenantAuth must be used within TenantAuthProvider');
  }
  return context;
}

