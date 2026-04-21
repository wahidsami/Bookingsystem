export const EMPLOYEE_LANGUAGE_OPTIONS = [
  { value: 'arabic', label: { ar: 'العربية', en: 'Arabic' } },
  { value: 'english', label: { ar: 'الإنجليزية', en: 'English' } },
  { value: 'urdu', label: { ar: 'الأردية', en: 'Urdu' } },
  { value: 'hindi', label: { ar: 'الهندية', en: 'Hindi' } },
  { value: 'french', label: { ar: 'الفرنسية', en: 'French' } },
  { value: 'tagalog', label: { ar: 'التاغالوغية', en: 'Tagalog' } },
  { value: 'turkish', label: { ar: 'التركية', en: 'Turkish' } },
  { value: 'persian', label: { ar: 'الفارسية', en: 'Persian' } },
  { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
] as const;

export type EmployeeLanguageValue = (typeof EMPLOYEE_LANGUAGE_OPTIONS)[number]['value'];

export const EMPLOYEE_LANGUAGE_LABELS: Record<string, { ar: string; en: string }> = Object.fromEntries(
  EMPLOYEE_LANGUAGE_OPTIONS.map((item) => [item.value, item.label])
);
