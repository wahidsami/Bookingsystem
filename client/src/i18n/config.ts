export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

// Font configurations
export const localeFonts: Record<Locale, string> = {
  en: 'var(--font-geist-sans)',
  ar: 'var(--font-noto-arabic), var(--font-geist-sans)',
};

