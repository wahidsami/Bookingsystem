export const EMPLOYEE_POSITIONS = [
  { value: '', label: { ar: 'اختر الوظيفة', en: 'Select job title' } },
  { value: 'accountant', label: { ar: 'محاسب', en: 'Accountant' } },
  { value: 'receptionist', label: { ar: 'استقبال', en: 'Receptionist' } },
  { value: 'service_provider', label: { ar: 'مقدم خدمة', en: 'Service Provider' } },
  { value: 'marketing', label: { ar: 'تسويق', en: 'Marketing' } },
  { value: 'manager', label: { ar: 'مدير', en: 'Manager' } },
  { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
] as const;

export type EmployeePositionValue = (typeof EMPLOYEE_POSITIONS)[number]['value'];

export const EMPLOYEE_GENDERS = [
  { value: '', label: { ar: 'اختر الجنس', en: 'Select gender' } },
  { value: 'male', label: { ar: 'ذكر', en: 'Male' } },
  { value: 'female', label: { ar: 'أنثى', en: 'Female' } },
  { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
  { value: 'prefer_not_to_say', label: { ar: 'أفضل عدم الإفصاح', en: 'Prefer not to say' } },
] as const;

export type EmployeeGenderValue = (typeof EMPLOYEE_GENDERS)[number]['value'];

export const isServiceProviderPosition = (position?: string | null) => {
  return `${position || ''}`.trim() === 'service_provider';
};

export const getDashboardRoleKeyForEmployeePosition = (position?: string | null) => {
  const normalized = `${position || ''}`.trim();

  if (!normalized || normalized === 'service_provider') {
    return null;
  }

  if (normalized === 'accountant' || normalized === 'receptionist' || normalized === 'marketing' || normalized === 'manager') {
    return normalized;
  }

  return 'custom';
};

export const getEmployeePositionLabel = (position?: string | null, locale: 'ar' | 'en' = 'en') => {
  const normalized = `${position || ''}`.trim();
  const match = EMPLOYEE_POSITIONS.find((item) => item.value === normalized);
  if (!match) {
    return normalized || '';
  }
  return match.label[locale] || match.label.en;
};

export const getEmployeeGenderLabel = (gender?: string | null, locale: 'ar' | 'en' = 'en') => {
  const normalized = `${gender || ''}`.trim();
  const match = EMPLOYEE_GENDERS.find((item) => item.value === normalized);
  if (!match) {
    return normalized || '';
  }
  return match.label[locale] || match.label.en;
};
