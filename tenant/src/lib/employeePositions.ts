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

export const getEmployeePositionLabel = (position?: string | null, locale: 'ar' | 'en' = 'en') => {
  const normalized = `${position || ''}`.trim();
  const match = EMPLOYEE_POSITIONS.find((item) => item.value === normalized);
  if (!match) {
    return normalized || '';
  }
  return match.label[locale] || match.label.en;
};
