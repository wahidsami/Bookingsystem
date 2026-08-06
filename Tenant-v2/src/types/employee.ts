import { WorkingHoursDayKey } from '../lib/tenantWorkingHours';

export const EMPLOYEE_POSITION_OPTIONS = [
  { value: 'accountant', en: 'Accountant', ar: 'محاسب', uiPosition: 'dashboard-admin' },
  { value: 'receptionist', en: 'Receptionist', ar: 'استقبال', uiPosition: 'dashboard-admin' },
  { value: 'service_provider', en: 'Service Provider', ar: 'مقدم خدمة', uiPosition: 'service-provider' },
  { value: 'marketing', en: 'Marketing', ar: 'تسويق', uiPosition: 'dashboard-admin' },
  { value: 'manager', en: 'Manager', ar: 'مدير', uiPosition: 'dashboard-admin' },
  { value: 'other', en: 'Other', ar: 'أخرى', uiPosition: 'dashboard-admin' }
] as const;

export type EmployeePosition = typeof EMPLOYEE_POSITION_OPTIONS[number]['value'];

export const EMPLOYEE_POSITION_LOOKUP = Object.fromEntries(
  EMPLOYEE_POSITION_OPTIONS.map((option) => [option.value, option])
) as Record<EmployeePosition, (typeof EMPLOYEE_POSITION_OPTIONS)[number]>;

export const STAFF_APP_PERMISSION_KEYS = [
  'view_earnings',
  'view_reviews',
  'reply_reviews',
  'view_clients',
  'view_booking_notes',
  'can_start_service',
  'can_mark_no_show'
] as const;

export type StaffAppPermissionKey = typeof STAFF_APP_PERMISSION_KEYS[number];

export const DEFAULT_STAFF_APP_PERMISSIONS: Record<StaffAppPermissionKey, boolean> = {
  view_earnings: false,
  view_reviews: true,
  reply_reviews: false,
  view_clients: false,
  view_booking_notes: false,
  can_start_service: true,
  can_mark_no_show: true
};

export const WEEKDAY_ROWS = [
  { dayOfWeek: 0, dayEn: 'Sunday', dayAr: 'الأحد' },
  { dayOfWeek: 1, dayEn: 'Monday', dayAr: 'الاثنين' },
  { dayOfWeek: 2, dayEn: 'Tuesday', dayAr: 'الثلاثاء' },
  { dayOfWeek: 3, dayEn: 'Wednesday', dayAr: 'الأربعاء' },
  { dayOfWeek: 4, dayEn: 'Thursday', dayAr: 'الخميس' },
  { dayOfWeek: 5, dayEn: 'Friday', dayAr: 'الجمعة' },
  { dayOfWeek: 6, dayEn: 'Saturday', dayAr: 'السبت' }
] as const;

export const WEEKDAY_KEYS: WorkingHoursDayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

export type TeamSubTab =
  | 'profile'
  | 'schedule'
  | 'performance'
  | 'revenue'
  | 'availability'
  | 'reviews'
  | 'payroll';

export interface TeamMemberData {
  id: string;
  nameEn: string;
  nameAr: string;
  roleEn: string;
  roleAr: string;
  avatar: string;
  rating: number;
  status: 'active' | 'break' | 'off';
  email: string;
  phone: string;
  joinedDate: string;
  bioEn: string;
  bioAr: string;
  experienceEn: string;
  experienceAr: string;
  nationalityAr: string;
  nationalityEn: string;
  gender: 'female' | 'male';
  position: EmployeePosition;
  specialtiesEn: string[];
  specialtiesAr: string[];
  languagesEn: string[];
  languagesAr: string[];

  // Financial fields
  baseSalary: number;
  commissionRatePct: number;
  serviceCommissionEnabled: boolean;
  productCommissionEnabled: boolean;

  // Schedule fields
  scheduleVisibilityWeeks: number;
  workingHours?: Record<string, { isOpen?: boolean; open?: string; close?: string }>;
  schedule: Array<{
    dayEn: string;
    dayAr: string;
    hours: string;
    status: 'working' | 'off';
    slots: Array<{ time: string; customer: string; service: string; status: 'booked' | 'empty' }>;
    subShifts?: Array<{
      id: string;
      label: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
  scheduleDraft?: boolean;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleContinues?: boolean;
  draftShifts?: Array<{
    id: string;
    dayOfWeek: number;
    specificDate: string | null;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
    startDate: string | null;
    endDate: string | null;
    label: string;
    isActive: boolean;
    isDraft: boolean;
  }>;

  // Access fields
  staffAppPassword?: string;
  isActive?: boolean;
  dashboardPermissions: {
    view_dashboard: boolean;
    manage_appointments: boolean;
    view_employees: boolean;
    manage_financials: boolean;
    view_reports: boolean;
    manage_settings: boolean;
    
    // Detailed permission keys from REFAH Access Section Guide
    view_appointments?: boolean;
    view_schedules?: boolean;
    view_customers?: boolean;
    view_services?: boolean;
    view_products?: boolean;
    view_orders?: boolean;
    view_financial?: boolean;
    view_bills?: boolean;
    view_pos?: boolean;
    view_messages?: boolean;
    view_reviews?: boolean;
    view_hot_deals?: boolean;
    view_notifications?: boolean;
    view_payroll?: boolean;
    view_subscription?: boolean;
    view_settings?: boolean;
    manage_accounts?: boolean;
  };

  // Performance stats
  bookingsCount: number;
  utilizationRate: number; // %
  retentionRate: number; // %
  noShowCount: number;
  servicesSales: number;
  productSales: number;
  tips: number;
  reviewsList: Array<{
    id: string;
    customer: string;
    service: string;
    rating: number;
    textEn: string;
    textAr: string;
    date: string;
  }>;
}

export const canonicalEmployeePosition = (value: string) => {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (!normalized) return 'other';
  if (normalized === 'service-provider') return 'service_provider';
  if (normalized === 'dashboard-admin') return 'manager';
  if (normalized === 'service_provider') return 'service_provider';
  if (normalized === 'accountant' || normalized === 'receptionist' || normalized === 'marketing' || normalized === 'manager' || normalized === 'other') {
    return normalized as EmployeePosition;
  }
  return 'other';
};

export const getRoleLabel = (position: string) => {
  const normalized = canonicalEmployeePosition(position);
  const labels = EMPLOYEE_POSITION_LOOKUP[normalized] || EMPLOYEE_POSITION_LOOKUP.other;
  return {
    uiPosition: labels.uiPosition,
    roleEn: labels.en,
    roleAr: labels.ar,
    position: normalized
  };
};
