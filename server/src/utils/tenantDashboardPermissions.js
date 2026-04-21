'use strict';

const DASHBOARD_PERMISSION_KEYS = [
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
];

const DEFAULT_DASHBOARD_PERMISSIONS = DASHBOARD_PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {});

const ROLE_PRESETS = {
  owner: {
    ...DASHBOARD_PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {})
  },
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
    view_payroll: true,
    view_subscription: false,
    view_settings: false,
    manage_accounts: false
  },
  accountant: {
    view_dashboard: true,
    view_financial: true,
    view_bills: true,
    view_pos: true,
    view_orders: true,
    view_reports: true,
    view_subscription: false,
    view_settings: false
  },
  receptionist: {
    view_dashboard: true,
    view_appointments: true,
    view_schedules: true,
    view_customers: true,
    view_messages: true,
    view_notifications: true,
    view_settings: false
  },
  marketing: {
    view_dashboard: true,
    view_customers: true,
    view_messages: true,
    view_reviews: true,
    view_hot_deals: true,
    view_notifications: true,
    view_reports: true,
    view_settings: false
  },
  hr: {
    view_dashboard: true,
    view_employees: true,
    view_schedules: true,
    view_payroll: true,
    view_reports: true,
    view_settings: false
  },
  service_provider: {
    view_dashboard: true,
    view_appointments: true,
    view_schedules: true,
    view_reviews: true,
    view_settings: false
  },
  custom: {
    view_dashboard: true
  }
};

const ROLE_OPTIONS = ['manager', 'accountant', 'receptionist', 'marketing', 'hr', 'service_provider', 'custom'];

const normalizeDashboardPermissions = (permissions = {}, roleKey = 'custom') => {
  const preset = ROLE_PRESETS[roleKey] || ROLE_PRESETS.custom;
  const normalized = { ...DEFAULT_DASHBOARD_PERMISSIONS, ...preset };

  for (const key of DASHBOARD_PERMISSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(permissions, key)) {
      normalized[key] = permissions[key] === true || permissions[key] === 'true';
    }
  }

  normalized.view_dashboard = true;
  normalized.manage_accounts = roleKey === 'owner' ? true : Boolean(normalized.manage_accounts);

  return normalized;
};

const getDashboardRoleLabel = (roleKey, locale = 'en') => {
  const labels = {
    owner: locale === 'ar' ? 'المالك' : 'Owner',
    manager: locale === 'ar' ? 'مدير' : 'Manager',
    accountant: locale === 'ar' ? 'محاسب' : 'Accountant',
    receptionist: locale === 'ar' ? 'استقبال' : 'Receptionist',
    marketing: locale === 'ar' ? 'تسويق' : 'Marketing',
    hr: locale === 'ar' ? 'موارد بشرية' : 'HR',
    service_provider: locale === 'ar' ? 'مقدم خدمة' : 'Service Provider',
    custom: locale === 'ar' ? 'مخصص' : 'Custom'
  };

  return labels[roleKey] || labels.custom;
};

module.exports = {
  DASHBOARD_PERMISSION_KEYS,
  DEFAULT_DASHBOARD_PERMISSIONS,
  ROLE_OPTIONS,
  ROLE_PRESETS,
  normalizeDashboardPermissions,
  getDashboardRoleLabel
};
