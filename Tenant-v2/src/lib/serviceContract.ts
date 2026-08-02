import { API_ORIGIN } from './apiConfig';

export type ServicePriceType = 'free' | 'fixed';
export type ServiceTargetGender = 'all' | 'female' | 'male';
export type ServicePaymentOption = 'at-center' | 'online-full' | 'booking-fee';

export type ServiceVariantRecord = {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  duration: number;
  rawPrice: number;
  finalPrice: number;
  isActive: boolean;
  nameAr?: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  description?: string;
  price?: number;
};

export type ServiceRecord = {
  id: string;
  tenantId?: string;
  category: string;
  categoryAr: string;
  categoryEn: string;
  name_ar: string;
  name_en: string;
  nameAr: string;
  nameEn: string;
  description_ar: string;
  description_en: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  includes: string[];
  priceType: ServicePriceType;
  targetGender: ServiceTargetGender;
  duration: number;
  rawPrice: number;
  finalPrice: number;
  taxRate: number;
  commissionRate: number;
  variants: ServiceVariantRecord[];
  paymentOptions: ServicePaymentOption[];
  hasOffer: boolean;
  offerDiscountPct?: number;
  offerDetails?: string | null;
  offerDetailsAr?: string;
  offerDetailsEn?: string;
  offerFrom?: string | null;
  offerTo?: string | null;
  hasGift: boolean;
  giftType?: 'product' | 'service' | null;
  giftDetails?: string | null;
  giftDetailsAr?: string;
  giftDetailsEn?: string;
  giftProductId?: string | null;
  employeeAssignments: string[];
  employeeCommissions?: Record<string, { enabled: boolean; type: 'percentage' | 'fixed'; value: number }>;
  isActive: boolean;
  availableInCenter: boolean;
  availableHomeVisit: boolean;
  allowReschedule: boolean;
  price: number;
};

export type ServiceDraft = {
  id: string;
  category: string;
  categoryAr: string;
  categoryEn: string;
  name_ar: string;
  name_en: string;
  nameAr: string;
  nameEn: string;
  description_ar: string;
  description_en: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  includes: string[];
  priceType: ServicePriceType;
  targetGender: ServiceTargetGender;
  duration: number;
  rawPrice: number;
  finalPrice: number;
  price: number;
  taxRate?: number;
  commissionRate?: number;
  variants: ServiceVariantRecord[];
  hasOffer: boolean;
  offerDiscountPct?: number;
  offerDetails?: string | null;
  offerDetailsAr?: string;
  offerDetailsEn?: string;
  offerFrom?: string | null;
  offerTo?: string | null;
  hasGift: boolean;
  giftType?: 'product' | 'service' | null;
  giftDetails?: string | null;
  giftDetailsAr?: string;
  giftDetailsEn?: string;
  giftProductId?: string | null;
  paymentOptions: ServicePaymentOption[];
  employeeAssignments: string[];
  employeeCommissions?: Record<string, { enabled: boolean; type: 'percentage' | 'fixed'; value: number }>;
  isActive: boolean;
  availableInCenter: boolean;
  availableHomeVisit: boolean;
  allowReschedule: boolean;
};

export type ServiceCategoryOption = {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  icon?: string | null;
  sortOrder?: number;
};

const DEFAULT_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=600&auto=format&fit=crop';

const isAbsoluteServiceUrl = (value: string) => /^(https?:|data:|blob:)/i.test(value);

export const resolveServiceImageUrl = (value: unknown): string => {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return DEFAULT_SERVICE_IMAGE;
  }

  if (isAbsoluteServiceUrl(raw)) {
    return raw;
  }

  const normalized = raw
    .replace(/^\.?\//, '')
    .replace(/^server\//, '')
    .replace(/^\/+/, '');

  if (!normalized) {
    return DEFAULT_SERVICE_IMAGE;
  }

  if (normalized.startsWith('uploads/')) {
    return `${API_ORIGIN}/${normalized}`;
  }

  if (
    normalized.startsWith('tenants/')
    || normalized.startsWith('services/')
    || normalized.startsWith('catalog/')
    || normalized.startsWith('appointments/')
  ) {
    return `${API_ORIGIN}/uploads/${normalized}`;
  }

  return `${API_ORIGIN}/uploads/${normalized}`;
};

const SERVICE_PRICE_TYPES: ServicePriceType[] = ['free', 'fixed'];
const SERVICE_TARGET_GENDERS: ServiceTargetGender[] = ['all', 'female', 'male'];
const SERVICE_PAYMENT_OPTIONS: ServicePaymentOption[] = ['at-center', 'online-full', 'booking-fee'];

const toStringValue = (value: any, fallback = '') => {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return `${value}`;
};

const toNumber = (value: any, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toBoolean = (value: any, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return Boolean(value);
};

const parseJsonArray = (input: any): any[] => {
  if (!input) {
    return [];
  }

  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const normalizeTextPair = (value: any) => {
  const text = toStringValue(value, '').trim();
  return {
    value: text,
    fallback: text
  };
};

export const normalizeServicePriceType = (value: any): ServicePriceType => {
  const normalized = toStringValue(value, 'fixed').trim().toLowerCase();
  return SERVICE_PRICE_TYPES.includes(normalized as ServicePriceType) ? (normalized as ServicePriceType) : 'fixed';
};

export const normalizeServiceTargetGender = (value: any): ServiceTargetGender => {
  const normalized = toStringValue(value, 'all').trim().toLowerCase();
  return SERVICE_TARGET_GENDERS.includes(normalized as ServiceTargetGender) ? (normalized as ServiceTargetGender) : 'all';
};

export const normalizeServicePaymentOptions = (paymentOptions: any): ServicePaymentOption[] => {
  const parsed = parseJsonArray(paymentOptions);
  const aliases: Record<string, ServicePaymentOption> = {
    center: 'at-center',
    at_center: 'at-center',
    atcenter: 'at-center',
    'at-center': 'at-center',
    online: 'online-full',
    online_full: 'online-full',
    'online-full': 'online-full',
    deposit: 'booking-fee',
    booking_fee: 'booking-fee',
    'booking-fee': 'booking-fee'
  };

  const normalized = parsed
    .map((value) => aliases[toStringValue(value, '').trim().toLowerCase()] || null)
    .filter((value): value is ServicePaymentOption => Boolean(value) && SERVICE_PAYMENT_OPTIONS.includes(value));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...SERVICE_PAYMENT_OPTIONS];
};

export const normalizeServiceVariantRecord = (variant: any): ServiceVariantRecord | null => {
  if (!variant || typeof variant !== 'object') {
    return null;
  }

  const descriptionAr = toStringValue(variant.description_ar ?? variant.descriptionAr ?? variant.description ?? '', '').trim();
  const descriptionEn = toStringValue(variant.description_en ?? variant.descriptionEn ?? variant.description ?? '', '').trim();
  const nameAr = toStringValue(variant.name_ar ?? variant.nameAr ?? variant.name ?? descriptionAr ?? descriptionEn ?? '', '').trim();
  const nameEn = toStringValue(variant.name_en ?? variant.nameEn ?? variant.name ?? descriptionEn ?? descriptionAr ?? '', '').trim();
  const duration = Math.max(5, Math.round(toNumber(variant.duration, 30) / 5) * 5);
  const rawPrice = toNumber(variant.rawPrice ?? variant.basePrice ?? variant.price ?? 0, 0);
  const finalPrice = toNumber(variant.finalPrice ?? variant.price ?? 0, 0);
  const providedId = toStringValue(variant.id ?? '', '').trim();

  return {
    id: providedId || `variant-${Math.abs(JSON.stringify({
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      duration,
      finalPrice,
      isActive: toBoolean(variant.isActive, true)
    }).split('').reduce((hash, char) => (((hash << 5) - hash) + char.charCodeAt(0)) | 0, 0)).toString(36)}`,
    name_ar: nameAr,
    name_en: nameEn,
    description_ar: descriptionAr,
    description_en: descriptionEn,
    duration,
    rawPrice: Number.isFinite(rawPrice) && rawPrice >= 0 ? parseFloat(rawPrice.toFixed(2)) : 0,
    finalPrice: Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0,
    isActive: toBoolean(variant.isActive, true),
    nameAr: nameAr,
    nameEn: nameEn,
    descriptionAr: descriptionAr,
    descriptionEn: descriptionEn,
    description: descriptionEn || descriptionAr || nameEn || nameAr,
    price: Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0
  };
};

export const normalizeServiceRecord = (service: any): ServiceRecord => {
  const category = toStringValue(service?.category ?? '', 'general').trim() || 'general';
  const categoryAr = toStringValue(service?.categoryAr ?? service?.category_ar ?? category, '').trim() || category;
  const categoryEn = toStringValue(service?.categoryEn ?? service?.category_en ?? category, '').trim() || category;
  const nameAr = toStringValue(service?.name_ar ?? service?.nameAr ?? service?.name ?? '', '').trim();
  const nameEn = toStringValue(service?.name_en ?? service?.nameEn ?? service?.name ?? '', '').trim();
  const descriptionAr = toStringValue(service?.description_ar ?? service?.descriptionAr ?? service?.description ?? '', '').trim();
  const descriptionEn = toStringValue(service?.description_en ?? service?.descriptionEn ?? service?.description ?? '', '').trim();
  const variants = parseJsonArray(service?.variants).map(normalizeServiceVariantRecord).filter(Boolean) as ServiceVariantRecord[];
  const finalPrice = toNumber(service?.finalPrice ?? service?.price ?? 0, 0);
  const rawPrice = toNumber(service?.rawPrice ?? service?.basePrice ?? 0, 0);
  const priceType = normalizeServicePriceType(service?.priceType);
  const targetGender = normalizeServiceTargetGender(service?.targetGender);

  return {
    id: toStringValue(service?.id ?? '', '').trim(),
    tenantId: toStringValue(service?.tenantId ?? '', '').trim() || undefined,
    category,
    categoryAr,
    categoryEn,
    name_ar: nameAr,
    name_en: nameEn,
    nameAr,
    nameEn,
    description_ar: descriptionAr,
    description_en: descriptionEn,
    descriptionAr,
    descriptionEn,
    image: resolveServiceImageUrl(service?.image ?? service?.photo ?? DEFAULT_SERVICE_IMAGE),
    includes: Array.isArray(service?.includes) ? service.includes : parseJsonArray(service?.includes),
    priceType,
    targetGender,
    duration: Math.max(0, Math.round(toNumber(service?.duration, 30))),
    rawPrice: Number.isFinite(rawPrice) && rawPrice >= 0 ? parseFloat(rawPrice.toFixed(2)) : 0,
    finalPrice: Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0,
    taxRate: toNumber(service?.taxRate, 15),
    commissionRate: toNumber(service?.commissionRate, 10),
    variants,
    paymentOptions: normalizeServicePaymentOptions(service?.paymentOptions),
    hasOffer: toBoolean(service?.hasOffer || service?.offerDiscountPct, false),
    offerDiscountPct: service?.offerDiscountPct !== undefined && service?.offerDiscountPct !== null
      ? toNumber(service.offerDiscountPct, 0)
      : undefined,
    offerDetails: service?.offerDetails ?? null,
    offerDetailsAr: toStringValue(service?.offerDetailsAr ?? '', '').trim(),
    offerDetailsEn: toStringValue(service?.offerDetailsEn ?? '', '').trim(),
    offerFrom: service?.offerFrom ?? null,
    offerTo: service?.offerTo ?? null,
    hasGift: toBoolean(service?.hasGift, false),
    giftType: service?.giftType ?? null,
    giftDetails: service?.giftDetails ?? null,
    giftDetailsAr: toStringValue(service?.giftDetailsAr ?? '', '').trim(),
    giftDetailsEn: toStringValue(service?.giftDetailsEn ?? '', '').trim(),
    giftProductId: service?.giftProductId ?? null,
    employeeAssignments: Array.isArray(service?.employeeAssignments)
      ? service.employeeAssignments
      : Array.isArray(service?.employees)
        ? service.employees.map((employee: any) => employee?.id).filter(Boolean)
        : [],
    employeeCommissions: service?.employeeCommissions ? { ...service.employeeCommissions } : {},
    isActive: toBoolean(service?.isActive, true),
    availableInCenter: toBoolean(service?.availableInCenter, true),
    availableHomeVisit: toBoolean(service?.availableHomeVisit, false),
    allowReschedule: toBoolean(service?.allowReschedule, true),
    price: Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0
  };
};

export const normalizeServiceCollection = (services: any[]): ServiceRecord[] => {
  return Array.isArray(services) ? services.map((service) => normalizeServiceRecord(service)) : [];
};

export const createEmptyServiceDraft = (defaultCategory?: ServiceCategoryOption | null): ServiceDraft => ({
  id: '',
  category: defaultCategory?.slug || 'general',
  categoryAr: defaultCategory?.labelAr || 'عام',
  categoryEn: defaultCategory?.labelEn || 'General',
  name_ar: '',
  name_en: '',
  nameAr: '',
  nameEn: '',
  description_ar: '',
  description_en: '',
  descriptionAr: '',
  descriptionEn: '',
  image: DEFAULT_SERVICE_IMAGE,
  includes: [],
  priceType: 'fixed',
  targetGender: 'all',
  duration: 60,
  rawPrice: 0,
  finalPrice: 0,
  price: 0,
  variants: [],
  hasOffer: false,
  offerDiscountPct: 0,
  offerDetails: null,
  offerDetailsAr: '',
  offerDetailsEn: '',
  offerFrom: null,
  offerTo: null,
  hasGift: false,
  giftType: null,
  giftDetails: null,
  giftDetailsAr: '',
  giftDetailsEn: '',
  giftProductId: null,
  paymentOptions: ['at-center', 'online-full'],
  employeeAssignments: [],
  employeeCommissions: {},
  isActive: true,
  availableInCenter: true,
  availableHomeVisit: false,
  allowReschedule: true
});

export const createEmptyServiceVariantDraft = (): ServiceVariantRecord => ({
  id: `variant-${Date.now()}`,
  name_ar: '',
  name_en: '',
  description_ar: '',
  description_en: '',
  duration: 30,
  rawPrice: 0,
  finalPrice: 0,
  isActive: true,
  nameAr: '',
  nameEn: '',
  descriptionAr: '',
  descriptionEn: '',
  description: '',
  price: 0
});

export const buildServicePayload = (draft: Partial<ServiceDraft>) => {
  const normalizedVariants = Array.isArray(draft.variants)
    ? draft.variants.map(normalizeServiceVariantRecord).filter(Boolean)
    : [];

  return {
    id: draft.id || undefined,
    name_ar: toStringValue(draft.name_ar || draft.nameAr || '', '').trim(),
    name_en: toStringValue(draft.name_en || draft.nameEn || '', '').trim(),
    description_ar: toStringValue(draft.description_ar || draft.descriptionAr || '', '').trim() || null,
    description_en: toStringValue(draft.description_en || draft.descriptionEn || '', '').trim() || null,
    rawPrice: draft.priceType === 'free' ? 0 : toNumber(draft.rawPrice ?? draft.price, 0),
    finalPrice: draft.priceType === 'free' ? 0 : toNumber(draft.finalPrice ?? draft.price, 0),
    priceType: normalizeServicePriceType(draft.priceType),
    targetGender: normalizeServiceTargetGender(draft.targetGender),
    category: toStringValue(draft.category, 'general').trim() || 'general',
    duration: Math.max(0, Math.round(toNumber(draft.duration, 30))),
    includes: Array.isArray(draft.includes) ? draft.includes : [],
    variants: normalizedVariants,
    paymentOptions: normalizeServicePaymentOptions(draft.paymentOptions),
    employeeAssignments: Array.isArray(draft.employeeAssignments) ? draft.employeeAssignments : [],
    hasOffer: Boolean(draft.hasOffer),
    offerDiscountPct: draft.offerDiscountPct !== undefined ? toNumber(draft.offerDiscountPct, 0) : undefined,
    offerDetails: draft.offerDetails || null,
    offerFrom: draft.offerFrom || null,
    offerTo: draft.offerTo || null,
    hasGift: Boolean(draft.hasGift),
    giftType: draft.giftType || null,
    giftDetails: draft.giftDetails || null,
    giftProductId: draft.giftProductId || null,
    isActive: Boolean(draft.isActive),
    availableInCenter: Boolean(draft.availableInCenter),
    availableHomeVisit: Boolean(draft.availableHomeVisit),
    allowReschedule: Boolean(draft.allowReschedule),
    employeeCommissions: draft.employeeCommissions || {}
  };
};

export const getServiceDisplayPrice = (service: Partial<ServiceRecord> & Record<string, any>) => {
  const finalPrice = toNumber(service?.finalPrice ?? service?.price ?? 0, 0);
  return Number.isFinite(finalPrice) ? parseFloat(finalPrice.toFixed(2)) : 0;
};

export const getServiceDisplayName = (service: Partial<ServiceRecord> & Record<string, any>, locale: 'ar' | 'en' = 'en') => {
  return locale === 'ar'
    ? toStringValue(service?.name_ar ?? service?.nameAr ?? service?.name ?? '', '').trim()
    : toStringValue(service?.name_en ?? service?.nameEn ?? service?.name ?? '', '').trim();
};

export const getServiceCategoryKey = (service: Partial<ServiceRecord> & Record<string, any>) => {
  return toStringValue(service?.category ?? service?.categoryKey ?? service?.categoryEn ?? service?.categoryAr ?? 'general', 'general').trim() || 'general';
};

export const getServiceCategoryLabel = (service: Partial<ServiceRecord> & Record<string, any>, locale: 'ar' | 'en' = 'en') => {
  const key = getServiceCategoryKey(service);
  return locale === 'ar'
    ? toStringValue(service?.categoryAr ?? service?.category_label_ar ?? key, '').trim() || key
    : toStringValue(service?.categoryEn ?? service?.category_label_en ?? key, '').trim() || key;
};

export const groupServicesByCategory = (services: any[]) => {
  const groups = new Map<string, { key: string; labelAr: string; labelEn: string; services: ServiceRecord[] }>();

  services.forEach((service) => {
    const normalized = normalizeServiceRecord(service);
    const key = getServiceCategoryKey(normalized);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        labelAr: getServiceCategoryLabel(normalized, 'ar'),
        labelEn: getServiceCategoryLabel(normalized, 'en'),
        services: [normalized]
      });
      return;
    }

    existing.services.push(normalized);
  });

  return Array.from(groups.values());
};
