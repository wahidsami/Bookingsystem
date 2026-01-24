/**
 * Tenant Context
 * Provides tenant data, theme colors, and template information to all components
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { publicAPI, Tenant, PublicPageData } from '../lib/api';

interface TenantContextType {
  tenant: Tenant | null;
  pageData: PublicPageData | null;
  loading: boolean;
  error: string | null;
  template: 'template1' | 'template2' | 'template3';
  theme: {
    primaryColor: string;
    secondaryColor: string;
    helperColor: string;
  };
  sections: {
    heroSlider: boolean;
    services: boolean;
    products: boolean;
    callToAction: boolean;
  };
  tenantId: string | null;
  slug: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
  slug: string;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, slug }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [pageData, setPageData] = useState<PublicPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTenantData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get tenant by slug
        const tenantResponse = await publicAPI.getTenantBySlug(slug);
        if (!tenantResponse.success || !tenantResponse.data) {
          throw new Error('Tenant not found');
        }

        const tenantData = tenantResponse.data;
        setTenant(tenantData);

        // Get public page data - don't fail if this fails, just use defaults
        try {
          const pageDataResponse = await publicAPI.getPublicPageData(tenantData.id);
          if (pageDataResponse.success && pageDataResponse.data) {
            setPageData(pageDataResponse.data);

            // Apply theme colors to root element
            const theme = pageDataResponse.data.generalSettings?.theme || {
              primaryColor: '#3B82F6',
              secondaryColor: '#8B5CF6',
              helperColor: '#10B981',
            };

            document.documentElement.style.setProperty('--color-primary', theme.primaryColor);
            document.documentElement.style.setProperty('--color-secondary', theme.secondaryColor);
            document.documentElement.style.setProperty('--color-helper', theme.helperColor);
          }
        } catch (pageDataError: any) {
          // Page data failed, but tenant exists - continue with defaults
          console.warn('Failed to load page data, using defaults:', pageDataError);
          // Apply default theme colors
          document.documentElement.style.setProperty('--color-primary', '#3B82F6');
          document.documentElement.style.setProperty('--color-secondary', '#8B5CF6');
          document.documentElement.style.setProperty('--color-helper', '#10B981');
        }
      } catch (err: any) {
        console.error('Failed to load tenant data:', err);
        setError(err.message || 'Failed to load tenant data');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      loadTenantData();
    }
  }, [slug]);

  // Apply theme colors whenever pageData changes
  useEffect(() => {
    if (pageData?.generalSettings?.theme) {
      const theme = pageData.generalSettings.theme;
      document.documentElement.style.setProperty('--color-primary', theme.primaryColor);
      document.documentElement.style.setProperty('--color-secondary', theme.secondaryColor);
      document.documentElement.style.setProperty('--color-helper', theme.helperColor);
    }
  }, [pageData]);

  const template = pageData?.generalSettings?.template || 'template1';
  const theme = pageData?.generalSettings?.theme || {
    primaryColor: '#3B82F6',
    secondaryColor: '#8B5CF6',
    helperColor: '#10B981',
  };
  const sections = pageData?.generalSettings?.sections || {
    heroSlider: true,
    services: true,
    products: true,
    callToAction: true,
  };

  const value: TenantContextType = {
    tenant,
    pageData,
    loading,
    error,
    template,
    theme,
    sections,
    tenantId: tenant?.id || null,
    slug,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

