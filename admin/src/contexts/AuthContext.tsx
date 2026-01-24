"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';

interface Admin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: any;
  profileImage?: string;
}

interface AuthContextType {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = sessionStorage.getItem('rifah_admin_token');
    
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await adminApi.getProfile();
      if (response.success && response.admin) {
        setAdmin(response.admin);
      } else {
        sessionStorage.removeItem('rifah_admin_token');
        sessionStorage.removeItem('rifah_admin_refresh_token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      sessionStorage.removeItem('rifah_admin_token');
      sessionStorage.removeItem('rifah_admin_refresh_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await adminApi.login(email, password);
    
    if (response.success) {
      sessionStorage.setItem('rifah_admin_token', response.accessToken);
      sessionStorage.setItem('rifah_admin_refresh_token', response.refreshToken);
      setAdmin(response.admin);
      router.push('/dashboard');
    } else {
      throw new Error('Login failed');
    }
  };

  const logout = () => {
    sessionStorage.removeItem('rifah_admin_token');
    sessionStorage.removeItem('rifah_admin_refresh_token');
    setAdmin(null);
    router.push('/login');
  };

  const refreshAdmin = async () => {
    try {
      const response = await adminApi.getProfile();
      if (response.success && response.admin) {
        setAdmin(response.admin);
      }
    } catch (error) {
      console.error('Refresh admin failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      admin,
      isAuthenticated: !!admin,
      isLoading,
      login,
      logout,
      refreshAdmin
    }}>
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

