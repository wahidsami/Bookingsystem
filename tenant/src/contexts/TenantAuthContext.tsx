"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tenantApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { normalizeDashboardPermissions } from '@/lib/dashboardAccess';

interface TenantUser {
  id: string;
  email: string;
  businessName: string;
  businessType: string[];
  status: string;
  profileImage?: string;
  displayName?: string;
  roleKey?: string;
  permissions?: Record<string, boolean>;
  [key: string]: any;
}

interface TenantAuthContextType {
  user: TenantUser | null;
  tenant: TenantUser | null;
  account: Record<string, any> | null;
  permissions: Record<string, boolean> | null;
  sessionType: 'tenant_owner' | 'tenant_account' | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const TenantAuthContext = createContext<TenantAuthContextType | undefined>(undefined);

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TenantUser | null>(null);
  const [tenant, setTenant] = useState<TenantUser | null>(null);
  const [account, setAccount] = useState<Record<string, any> | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [sessionType, setSessionType] = useState<'tenant_owner' | 'tenant_account' | null>(null);
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
        const tenantData = response.tenant;
        const accountData = response.account || null;
        const combinedUser = accountData
          ? {
              ...tenantData,
              ...accountData,
              businessName: tenantData.businessName || tenantData.name_en || tenantData.name || tenantData.name_ar || accountData.displayName || accountData.email,
              displayName: accountData.displayName || accountData.email,
              permissions: normalizeDashboardPermissions(accountData.permissions || {}, accountData.roleKey)
            }
          : {
              ...tenantData,
              businessName: tenantData.businessName || tenantData.name_en || tenantData.name || tenantData.name_ar || tenantData.email,
              permissions: null
            };

        setTenant(tenantData);
        setAccount(accountData);
        setPermissions(response.permissions || accountData?.permissions || null);
        setSessionType(response.sessionType || (accountData ? 'tenant_account' : 'tenant_owner'));
        setUser(combinedUser as TenantUser);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      // Clear invalid tokens
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('rifah_tenant_access_token');
        localStorage.removeItem('rifah_tenant_refresh_token');
      }
      setUser(null);
      setTenant(null);
      setAccount(null);
      setPermissions(null);
      setSessionType(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await tenantApi.login(email, password);

      if (response.success && response.tenant) {
        const tenantData = response.tenant;
        const accountData = response.account || null;
        const combinedUser = accountData
          ? {
              ...tenantData,
              ...accountData,
              businessName: tenantData.businessName || tenantData.name_en || tenantData.name || tenantData.name_ar || accountData.displayName || accountData.email,
              displayName: accountData.displayName || accountData.email,
              permissions: normalizeDashboardPermissions(accountData.permissions || {}, accountData.roleKey)
            }
          : {
              ...tenantData,
              businessName: tenantData.businessName || tenantData.name_en || tenantData.name || tenantData.name_ar || tenantData.email,
              permissions: null
            };

        setTenant(tenantData);
        setAccount(accountData);
        setPermissions(response.permissions || accountData?.permissions || null);
        setSessionType(response.sessionType || (accountData ? 'tenant_account' : 'tenant_owner'));
        setUser(combinedUser as TenantUser);
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
      setTenant(null);
      setAccount(null);
      setPermissions(null);
      setSessionType(null);
      router.push('/ar/login');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setTenant(null);
      setAccount(null);
      setPermissions(null);
      setSessionType(null);
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
        tenant,
        account,
        permissions,
        sessionType,
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

