import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { installTenantApiFetchBridge, tenantApiAdapter } from '../lib/tenantApiAdapter';
import {
  normalizeDashboardPermissions,
  normalizePackageEntitlements
} from '../lib/tenantEntitlements';
import {
  normalizeTenantSubscriptionSnapshot,
  normalizeTenantSubscriptionUsage
} from '../lib/tenantSubscription';

type SessionType = 'tenant_owner' | 'tenant_account' | null;

export function isElevatedDashboardRoleKey(roleKey?: string | null): boolean {
  if (!roleKey) return false;

  const normalized = String(roleKey).trim().toLowerCase();
  return (
    normalized.includes('admin') ||
    normalized.includes('owner') ||
    normalized.includes('super')
  );
}

export interface TenantAuthUser {
  id?: string;
  email?: string;
  businessName?: string;
  displayName?: string;
  roleKey?: string;
  permissions?: Record<string, boolean> | null;
  packageEntitlements?: Record<string, any> | null;
  [key: string]: any;
}

interface TenantAuthContextValue {
  user: TenantAuthUser | null;
  tenant: Record<string, any> | null;
  account: Record<string, any> | null;
  tenantSettings: Record<string, any> | null;
  permissions: Record<string, boolean> | null;
  packageEntitlements: Record<string, any> | null;
  subscription: Record<string, any> | null;
  subscriptionUsage: Record<string, any> | null;
  sessionType: SessionType;
  error: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
}

const TenantAuthContext = createContext<TenantAuthContextValue | undefined>(undefined);

function isPublicAuthRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/registration-success')
  );
}

function pick<T = any>(source: any, keys: string[]): T | undefined {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (source[key] !== undefined) {
      return source[key];
    }
  }
  return undefined;
}

function normalizeAuthPayload(payload: any): {
  tenant: Record<string, any> | null;
  account: Record<string, any> | null;
  permissions: Record<string, boolean> | null;
  packageEntitlements: Record<string, any> | null;
  sessionType: SessionType;
  user: TenantAuthUser | null;
} {
  const data = pick(payload, ['data']) || payload || {};
  const tenant = pick(data, ['tenant', 'tenantData', 'business']) || null;
  const account = pick(data, ['account', 'user', 'dashboardAccount']) || null;
  const permissions = normalizeDashboardPermissions(
    pick(data, ['permissions']) || account?.permissions || null,
    account?.roleKey || null
  );
  const packageEntitlements = normalizePackageEntitlements(
    pick(data, ['packageEntitlements']) || tenant?.packageEntitlements || account?.packageEntitlements || null
  );
  const sessionType = (pick(data, ['sessionType']) || (account ? 'tenant_account' : 'tenant_owner')) as SessionType;

  const combinedUser = tenant || account
    ? {
        ...(tenant || {}),
        ...(account || {}),
        businessName:
          tenant?.businessName ||
          tenant?.name_en ||
          tenant?.name ||
          tenant?.name_ar ||
          account?.displayName ||
          account?.email ||
          tenant?.email ||
          null,
        displayName: account?.displayName || account?.email || tenant?.businessName || tenant?.email || null,
        permissions,
        packageEntitlements
      }
    : null;

  return {
    tenant,
    account,
    permissions,
    packageEntitlements,
    sessionType,
    user: combinedUser
  };
}

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TenantAuthUser | null>(null);
  const [tenant, setTenant] = useState<Record<string, any> | null>(null);
  const [account, setAccount] = useState<Record<string, any> | null>(null);
  const [tenantSettings, setTenantSettings] = useState<Record<string, any> | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [packageEntitlements, setPackageEntitlements] = useState<Record<string, any> | null>(null);
  const [subscription, setSubscription] = useState<Record<string, any> | null>(null);
  const [subscriptionUsage, setSubscriptionUsage] = useState<Record<string, any> | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  const clearSession = useCallback(() => {
    tenantApiAdapter.clearTokens();
    setUser(null);
    setTenant(null);
    setAccount(null);
    setTenantSettings(null);
    setPermissions(null);
    setPackageEntitlements(null);
    setSubscription(null);
    setSubscriptionUsage(null);
    setSessionType(null);
  }, []);

  const loadSubscriptionState = useCallback(async () => {
    const [subscriptionResult, usageResult] = await Promise.allSettled([
      tenantApiAdapter.getCurrentSubscription(),
      tenantApiAdapter.getSubscriptionLimits()
    ]);

    if (subscriptionResult.status === 'fulfilled') {
      setSubscription(normalizeTenantSubscriptionSnapshot(subscriptionResult.value));
    } else {
      setSubscription(null);
    }

    if (usageResult.status === 'fulfilled') {
      const normalizedUsage = normalizeTenantSubscriptionUsage(usageResult.value);
      setSubscriptionUsage(normalizedUsage);

      const livePackageEntitlements =
        usageResult.value?.limits ||
        usageResult.value?.data?.limits ||
        subscriptionResult.value?.subscription?.package?.limits ||
        null;
      if (livePackageEntitlements) {
        setPackageEntitlements(normalizePackageEntitlements(livePackageEntitlements));
      }
    } else {
      setSubscriptionUsage(null);
      const fallbackPackageEntitlements = subscriptionResult.value?.subscription?.package?.limits || null;
      if (fallbackPackageEntitlements) {
        setPackageEntitlements(normalizePackageEntitlements(fallbackPackageEntitlements));
      }
    }
  }, []);

  const loadTenantSettings = useCallback(async () => {
    try {
      const response = await tenantApiAdapter.get('/tenant/settings');
      const payload = response?.data || response || {};
      return payload?.settings || null;
    } catch (error) {
      console.error('Failed to load tenant settings:', error);
      return null;
    }
  }, []);

  const loadUser = useCallback(async () => {
    const accessToken = tenantApiAdapter.getAccessToken();
    const refreshToken = tenantApiAdapter.getRefreshToken();
    if (!accessToken && !refreshToken) {
      setLoading(false);
      return;
    }

    try {
      const refreshed = await tenantApiAdapter.ensureFreshAuthSession();
      if (!refreshed && !tenantApiAdapter.getAccessToken()) {
        clearSession();
        setAuthError('Session expired. Please sign in again.');
        return;
      }
      const response = await tenantApiAdapter.getProfile();
      const normalized = normalizeAuthPayload(response);

      setTenant(normalized.tenant);
      setAccount(normalized.account);
      setPermissions(normalized.permissions);
      setPackageEntitlements(normalized.packageEntitlements);
      setSessionType(normalized.sessionType);
      setUser(normalized.user);
      const [settings] = await Promise.all([
        loadTenantSettings(),
        loadSubscriptionState()
      ]);
      setTenantSettings(settings);
      setAuthError(null);
    } catch (error) {
      const status = (error as { status?: number } | undefined)?.status;
      if (status === 401) {
        clearSession();
        setAuthError('Session expired. Please sign in again.');
      } else {
        console.error('Failed to load tenant session:', error);
        clearSession();
        setAuthError('Unable to load tenant session.');
      }
    } finally {
      setLoading(false);
    }
  }, [clearSession, loadTenantSettings, loadSubscriptionState]);

  useEffect(() => {
    const uninstallBridge = installTenantApiFetchBridge(() => {
      clearSession();
      setAuthError('Session expired. Please sign in again.');
      setLoading(false);
    });

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (!isPublicAuthRoute(currentPath)) {
      void loadUser();
    } else {
      setLoading(false);
    }

    return () => {
      uninstallBridge();
    };
  }, [clearSession, loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setAuthError(null);

    try {
      const response = await tenantApiAdapter.login(email, password);
      let normalized = normalizeAuthPayload(response);

      if (!normalized.user) {
        const profileResponse = await tenantApiAdapter.getProfile();
        normalized = normalizeAuthPayload(profileResponse);
      }

      if (!normalized.user) {
        throw new Error(response?.message || 'Login failed');
      }

      setTenant(normalized.tenant);
      setAccount(normalized.account);
      setPermissions(normalized.permissions);
      setPackageEntitlements(normalized.packageEntitlements);
      setSessionType(normalized.sessionType);
      setUser(normalized.user);
      const [settings] = await Promise.all([
        loadTenantSettings(),
        loadSubscriptionState()
      ]);
      setTenantSettings(settings);
      setAuthError(null);
    } catch (error: any) {
      clearSession();
      setAuthError(error?.message || 'Login failed.');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearSession, loadTenantSettings, loadSubscriptionState]);

  const logout = useCallback(async () => {
    try {
      await tenantApiAdapter.logout();
    } finally {
      clearSession();
      setAuthError(null);
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      await loadUser();
    } finally {
      setLoading(false);
    }
  }, [loadUser]);

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (sessionType === 'tenant_owner') return true;
      if (isElevatedDashboardRoleKey(permissions?.roleKey)) return true;
      return Boolean(permissions?.[permissionKey]);
    },
    [permissions, sessionType]
  );

  const value = useMemo<TenantAuthContextValue>(() => ({
    user,
    tenant,
    account,
    tenantSettings,
    permissions,
    packageEntitlements,
    subscription,
    subscriptionUsage,
    sessionType,
    error: authError,
    loading,
    isAuthenticated,
    login,
    logout,
    refreshUser,
    refreshSubscription: loadSubscriptionState,
    hasPermission
  }), [
    user,
    tenant,
    account,
    tenantSettings,
    permissions,
    packageEntitlements,
    subscription,
    subscriptionUsage,
    sessionType,
    authError,
    loading,
    isAuthenticated,
    login,
    logout,
    refreshUser,
    loadSubscriptionState,
    hasPermission
  ]);

  return (
    <TenantAuthContext.Provider value={value}>
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth() {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error('useTenantAuth must be used within TenantAuthProvider');
  }
  return context;
}
