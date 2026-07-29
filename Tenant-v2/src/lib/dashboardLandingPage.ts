import { ViewType } from '../types';

export type DashboardLandingPage =
  | 'home'
  | 'appointments'
  | 'customers'
  | 'messages'
  | 'pos'
  | 'employees'
  | 'services'
  | 'products'
  | 'inventory'
  | 'marketing'
  | 'giftcards'
  | 'loyalty'
  | 'financial'
  | 'reports'
  | 'subscription'
  | 'billing'
  | 'settings';

export interface DashboardLandingPageOption {
  value: DashboardLandingPage;
  view: ViewType;
  labelAr: string;
  labelEn: string;
}

export const DEFAULT_DASHBOARD_LANDING_PAGE: DashboardLandingPage = 'home';

export const DASHBOARD_LANDING_PAGE_OPTIONS: DashboardLandingPageOption[] = [
  { value: 'home', view: 'dashboard', labelAr: 'الرئيسية', labelEn: 'Home' },
  { value: 'appointments', view: 'appointments', labelAr: 'المواعيد', labelEn: 'Appointments' },
  { value: 'customers', view: 'customers', labelAr: 'العملاء', labelEn: 'Customers' },
  { value: 'messages', view: 'messages', labelAr: 'الرسائل الداخلية', labelEn: 'Messages' },
  { value: 'pos', view: 'pos', labelAr: 'نقطة البيع', labelEn: 'POS' },
  { value: 'employees', view: 'employees', labelAr: 'الفرق', labelEn: 'Teams' },
  { value: 'services', view: 'services', labelAr: 'الخدمات', labelEn: 'Services' },
  { value: 'products', view: 'products', labelAr: 'المنتجات', labelEn: 'Products' },
  { value: 'inventory', view: 'inventory', labelAr: 'المخزون', labelEn: 'Inventory' },
  { value: 'marketing', view: 'marketing', labelAr: 'التسويق', labelEn: 'Marketing' },
  { value: 'giftcards', view: 'giftcards', labelAr: 'بطاقات الهدايا', labelEn: 'Gift Cards' },
  { value: 'loyalty', view: 'loyalty', labelAr: 'الولاء', labelEn: 'Loyalty' },
  { value: 'financial', view: 'financial', labelAr: 'المالية', labelEn: 'Finance' },
  { value: 'reports', view: 'reports', labelAr: 'التقارير', labelEn: 'Reports' },
  { value: 'subscription', view: 'subscription', labelAr: 'الاشتراك', labelEn: 'Subscription' },
  { value: 'billing', view: 'billing', labelAr: 'الفواتير', labelEn: 'Billing' },
  { value: 'settings', view: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings' }
];

const DASHBOARD_LANDING_PAGE_VALUES = new Set<DashboardLandingPage>(
  DASHBOARD_LANDING_PAGE_OPTIONS.map(option => option.value)
);

export function isDashboardLandingPage(value: unknown): value is DashboardLandingPage {
  return typeof value === 'string' && DASHBOARD_LANDING_PAGE_VALUES.has(value as DashboardLandingPage);
}

export function normalizeDashboardLandingPage(value: unknown): DashboardLandingPage {
  return isDashboardLandingPage(value) ? value : DEFAULT_DASHBOARD_LANDING_PAGE;
}

export function dashboardLandingPageToView(value: DashboardLandingPage): ViewType {
  return DASHBOARD_LANDING_PAGE_OPTIONS.find(option => option.value === value)?.view || 'dashboard';
}

export function dashboardLandingPageLabel(value: DashboardLandingPage, lang: 'ar' | 'en'): string {
  const option = DASHBOARD_LANDING_PAGE_OPTIONS.find(item => item.value === value);
  if (!option) return lang === 'ar' ? 'الرئيسية' : 'Home';
  return lang === 'ar' ? option.labelAr : option.labelEn;
}
