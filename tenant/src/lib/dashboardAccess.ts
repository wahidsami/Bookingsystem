'use client';

export const DASHBOARD_PERMISSION_KEYS = [
  'view_dashboard',
  'view_appointments',
  'view_schedules',
  'view_employees',
  'view_customers',
  'view_services',
  'view_products',
  'view_orders',
  'view_financial',
  'view_bills',
  'view_pos',
  'view_messages',
  'view_reviews',
  'view_hot_deals',
  'view_notifications',
  'view_reports',
  'view_payroll',
  'view_subscription',
  'view_settings',
  'manage_accounts'
] as const;

export type DashboardPermissionKey = (typeof DASHBOARD_PERMISSION_KEYS)[number];
export type DashboardRoleKey =
  | 'owner'
  | 'manager'
  | 'accountant'
  | 'receptionist'
  | 'marketing'
  | 'hr'
  | 'service_provider'
  | 'custom';

export type DashboardPermissions = Partial<Record<DashboardPermissionKey, boolean>>;

export const DEFAULT_DASHBOARD_PERMISSIONS: Record<DashboardPermissionKey, boolean> = DASHBOARD_PERMISSION_KEYS.reduce(
  (acc, key) => {
    acc[key] = false;
    return acc;
  },
  {} as Record<DashboardPermissionKey, boolean>
);

const allTrue = DASHBOARD_PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {} as Record<DashboardPermissionKey, boolean>);

export const DASHBOARD_ROLE_PRESETS: Record<DashboardRoleKey, DashboardPermissions> = {
  owner: allTrue,
  manager: {
    view_dashboard: true,
    view_appointments: true,
    view_schedules: true,
    view_employees: true,
    view_customers: true,
    view_services: true,
    view_products: true,
    view_orders: true,
    view_financial: true,
    view_bills: true,
    view_pos: true,
    view_messages: true,
    view_reviews: true,
    view_hot_deals: true,
    view_notifications: true,
    view_reports: true,
    view_payroll: true
  },
  accountant: {
    view_dashboard: true,
    view_financial: true,
    view_bills: true,
    view_pos: true,
    view_orders: true,
    view_reports: true
  },
  receptionist: {
    view_dashboard: true,
    view_appointments: true,
    view_schedules: true,
    view_customers: true,
    view_messages: true,
    view_notifications: true
  },
  marketing: {
    view_dashboard: true,
    view_customers: true,
    view_messages: true,
    view_reviews: true,
    view_hot_deals: true,
    view_notifications: true,
    view_reports: true
  },
  hr: {
    view_dashboard: true,
    view_employees: true,
    view_schedules: true,
    view_payroll: true,
    view_reports: true
  },
  service_provider: {
    view_dashboard: true,
    view_appointments: true,
    view_schedules: true,
    view_reviews: true
  },
  custom: {
    view_dashboard: true
  }
};

export const ROLE_OPTIONS: Array<{ value: DashboardRoleKey; labelEn: string; labelAr: string }> = [
  { value: 'manager', labelEn: 'Manager', labelAr: 'مدير' },
  { value: 'accountant', labelEn: 'Accountant', labelAr: 'محاسب' },
  { value: 'receptionist', labelEn: 'Receptionist', labelAr: 'استقبال' },
  { value: 'marketing', labelEn: 'Marketing', labelAr: 'تسويق' },
  { value: 'hr', labelEn: 'HR', labelAr: 'موارد بشرية' },
  { value: 'service_provider', labelEn: 'Service Provider', labelAr: 'مقدم خدمة' },
  { value: 'custom', labelEn: 'Custom', labelAr: 'مخصص' }
];

export const SECTION_PERMISSION_LABELS: Record<DashboardPermissionKey, { en: string; ar: string }> = {
  view_dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
  view_appointments: { en: 'Appointments', ar: 'الحجوزات' },
  view_schedules: { en: 'Schedules', ar: 'الجداول' },
  view_employees: { en: 'Teams', ar: 'الفرق' },
  view_customers: { en: 'Customers', ar: 'العملاء' },
  view_services: { en: 'Services', ar: 'الخدمات' },
  view_products: { en: 'Products', ar: 'المنتجات' },
  view_orders: { en: 'Orders', ar: 'الطلبات' },
  view_financial: { en: 'Financial', ar: 'المالية' },
  view_bills: { en: 'Bills', ar: 'الفواتير' },
  view_pos: { en: 'POS / Collections', ar: 'نقطة البيع / التحصيل' },
  view_messages: { en: 'Messages', ar: 'الرسائل' },
  view_reviews: { en: 'Reviews', ar: 'التقييمات' },
  view_hot_deals: { en: 'Hot Deals', ar: 'العروض الساخنة' },
  view_notifications: { en: 'Customer Push', ar: 'إشعارات العملاء' },
  view_reports: { en: 'Reports', ar: 'التقارير' },
  view_payroll: { en: 'Payroll', ar: 'الرواتب' },
  view_subscription: { en: 'Subscription', ar: 'الاشتراك' },
  view_settings: { en: 'Settings', ar: 'الإعدادات' },
  manage_accounts: { en: 'Team & Access', ar: 'الفريق والصلاحيات' }
};

export const DASHBOARD_SECTION_PERMISSION_MAP: Record<string, DashboardPermissionKey | null> = {
  dashboard: 'view_dashboard',
  services: 'view_services',
  products: 'view_products',
  employees: 'view_employees',
  schedules: 'view_schedules',
  appointments: 'view_appointments',
  pos: 'view_pos',
  orders: 'view_orders',
  'hot-deals': 'view_hot_deals',
  messages: 'view_messages',
  notifications: 'view_notifications',
  customers: 'view_customers',
  bills: 'view_bills',
  subscription: 'view_subscription',
  financial: 'view_financial',
  payroll: 'view_payroll',
  reviews: 'view_reviews',
  reports: 'view_reports',
  mypage: 'view_settings',
  settings: 'view_settings'
};

export const normalizeDashboardPermissions = (
  permissions: Partial<Record<DashboardPermissionKey, boolean | string>> | null | undefined,
  roleKey: DashboardRoleKey = 'custom'
): Record<DashboardPermissionKey, boolean> => {
  const normalized = { ...DEFAULT_DASHBOARD_PERMISSIONS, ...(DASHBOARD_ROLE_PRESETS[roleKey] || {}) };

  if (permissions) {
    DASHBOARD_PERMISSION_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(permissions, key)) {
        const value = permissions[key];
        normalized[key] = value === true || value === 'true';
      }
    });
  }

  normalized.view_dashboard = true;
  return normalized;
};

export const hasDashboardPermission = (
  permissions: Record<string, boolean> | null | undefined,
  key: DashboardPermissionKey
): boolean => {
  if (!permissions) return false;
  return permissions[key] === true;
};
