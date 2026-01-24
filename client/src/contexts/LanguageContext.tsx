"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Locale, locales, defaultLocale, localeDirection } from '@/i18n/config';
import enMessages from '@/i18n/messages/en.json';
import arMessages from '@/i18n/messages/ar.json';

type Messages = typeof enMessages;
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

type TranslationKey = NestedKeyOf<Messages>;

const messages: Record<Locale, Messages> = {
  en: enMessages,
  ar: arMessages,
};

interface LanguageContextType {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'rifah_locale';

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj) || path;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Initialize with saved locale or default
  const getInitialLocale = (): Locale => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (savedLocale && locales.includes(savedLocale)) {
        return savedLocale;
      }
    }
    return defaultLocale;
  };

  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [mounted, setMounted] = useState(false);

  // Load saved locale on mount (client-side only)
  useEffect(() => {
    const savedLocale = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (savedLocale && locales.includes(savedLocale)) {
      setLocaleState(savedLocale);
    }
    setMounted(true);
  }, []);

  // Apply direction to document immediately and on locale change
  // Use useLayoutEffect to run synchronously before paint
  useLayoutEffect(() => {
    const direction = localeDirection[locale];
    
    if (document.documentElement) {
      document.documentElement.setAttribute('dir', direction);
      document.documentElement.setAttribute('lang', locale);
      document.documentElement.dir = direction;
      document.documentElement.lang = locale;
      if (document.body) {
        document.body.style.fontFamily = "'Cairo', 'Segoe UI', sans-serif";
      }
    }
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let translation = getNestedValue(messages[locale], key);
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{${paramKey}}`, String(value));
      });
    }
    
    return translation;
  }, [locale]);

  const direction = localeDirection[locale];
  const isRTL = direction === 'rtl';

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    locale,
    direction,
    setLocale,
    t,
    isRTL
  }), [locale, direction, setLocale, t, isRTL]);

  // Prevent flash of wrong direction
  if (!mounted) {
    return null;
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Hook for convenience - just the translation function
export function useTranslations() {
  const { t, locale, isRTL } = useLanguage();
  return { t, locale, isRTL };
}

