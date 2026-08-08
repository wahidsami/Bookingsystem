import { API_ORIGIN } from './apiConfig';

export const DEFAULT_EMPLOYEE_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

const isAbsoluteImageUrl = (value: string) => /^(https?:|data:|blob:)/i.test(value);

export const resolveEmployeeImageUrl = (value: unknown): string => {
  const raw = `${value ?? ''}`.trim();
  if (!raw) return DEFAULT_EMPLOYEE_AVATAR;
  if (isAbsoluteImageUrl(raw)) return raw;

  const normalized = raw
    .replace(/^\.?\//, '')
    .replace(/^server\//, '')
    .replace(/^\/+/, '');

  if (!normalized) return DEFAULT_EMPLOYEE_AVATAR;

  if (normalized.startsWith('uploads/')) {
    return `${API_ORIGIN}/${normalized}`;
  }

  if (
    normalized.startsWith('tenants/')
    || normalized.startsWith('employees/')
    || normalized.startsWith('staff/')
    || normalized.startsWith('profiles/')
    || normalized.startsWith('support/')
  ) {
    return `${API_ORIGIN}/uploads/${normalized}`;
  }

  return `${API_ORIGIN}/uploads/${normalized}`;
};

export const normalizeEmployeeAvatarRecord = <T extends Record<string, any>>(record: T): T => {
  const avatar = resolveEmployeeImageUrl(record?.avatar || record?.photo || record?.profileImage || record?.imageUrl || record?.image);
  
  const nameEn = record?.nameEn || record?.name_en || record?.name || record?.firstName || '—';
  const nameAr = record?.nameAr || record?.name_ar || record?.name || record?.firstName || '—';
  const roleEn = record?.roleEn || record?.role_en || record?.role || record?.title || 'Stylist';
  const roleAr = record?.roleAr || record?.role_ar || record?.role || record?.title || 'أخصائية';

  return {
    ...record,
    avatar,
    photo: avatar,
    profileImage: avatar,
    imageUrl: avatar,
    image: avatar,
    nameEn,
    nameAr,
    roleEn,
    roleAr
  };
};

export const normalizeEmployeeAvatarCollection = <T extends Record<string, any>>(employees: T[]): T[] => {
  return employees.map((employee) => normalizeEmployeeAvatarRecord(employee));
};
