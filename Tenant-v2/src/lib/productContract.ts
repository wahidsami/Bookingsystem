import { API_ORIGIN } from './apiConfig';

export type ProductCategoryOption = {
  id: string;
  labelAr: string;
  labelEn: string;
  slug: string;
};

export type ProductRecord = Record<string, any> & {
  id: string;
  tenantId?: string;
  nameAr: string;
  nameEn: string;
  name_ar: string;
  name_en: string;
  descriptionAr: string;
  descriptionEn: string;
  description_ar: string;
  description_en: string;
  category: string;
  categoryAr: string;
  categoryEn: string;
  image: string;
  imageUrl: string;
  primaryImage: string;
  images: string[];
  rawPrice: number;
  price: number;
  finalPrice: number;
  taxRate: number;
  commissionRate: number;
  stock: number;
  sku: string;
  brand: string;
  size: string;
  color: string;
  ingredients: string;
  ingredientsAr: string;
  ingredientsEn: string;
  howToUseAr: string;
  howToUseEn: string;
  featuresAr: string;
  featuresEn: string;
  isAvailable: boolean;
  isFeatured: boolean;
  allowsDelivery: boolean;
  allowsPickup: boolean;
  soldCount: number;
  usedAsGiftCount: number;
};

export type ProductSubmissionDraft = Record<string, any> & {
  id?: string;
  nameAr?: string;
  nameEn?: string;
  name_ar?: string;
  name_en?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  description_ar?: string;
  description_en?: string;
  category?: string;
  categoryAr?: string;
  categoryEn?: string;
  sku?: string;
  brand?: string;
  size?: string;
  color?: string;
  rawPrice?: number;
  finalPrice?: number;
  price?: number;
  stock?: number;
  ingredientsAr?: string;
  ingredientsEn?: string;
  ingredients_ar?: string;
  ingredients_en?: string;
  howToUseAr?: string;
  howToUseEn?: string;
  howToUse_ar?: string;
  howToUse_en?: string;
  featuresAr?: string;
  featuresEn?: string;
  features_ar?: string;
  features_en?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  allowsDelivery?: boolean;
  allowsPickup?: boolean;
  images?: any[];
  retainedImages?: any[];
};

export const PRODUCT_CATEGORY_OPTIONS: ProductCategoryOption[] = [
  { id: 'general', slug: 'general', labelAr: 'عام', labelEn: 'General' },
  { id: 'Hair Products', slug: 'hair-products', labelAr: 'منتجات الشعر', labelEn: 'Hair Products' },
  { id: 'Skincare Products', slug: 'skincare-products', labelAr: 'منتجات البشرة', labelEn: 'Skincare Products' },
  { id: 'Body Products', slug: 'body-products', labelAr: 'منتجات الجسم', labelEn: 'Body Products' },
  { id: 'Nail Products', slug: 'nail-products', labelAr: 'منتجات الأظافر', labelEn: 'Nail Products' },
  { id: 'Luxury Perfumes', slug: 'luxury-perfumes', labelAr: 'عطور فاخرة', labelEn: 'Luxury Perfumes' }
];

const isAbsoluteProductUrl = (value: string) => /^(https?:|data:|blob:)/i.test(value);

export const resolveProductImageUrl = (value: unknown): string => {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return '';
  }

  if (isAbsoluteProductUrl(raw)) {
    return raw;
  }

  const normalized = raw
    .replace(/^\.?\//, '')
    .replace(/^server\//, '')
    .replace(/^\/+/, '');

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('uploads/')) {
    return `${API_ORIGIN}/${normalized}`;
  }

  if (
    normalized.startsWith('tenants/')
    || normalized.startsWith('products/')
    || normalized.startsWith('catalog/')
    || normalized.startsWith('inventory/')
  ) {
    return `${API_ORIGIN}/uploads/${normalized}`;
  }

  return `${API_ORIGIN}/uploads/${normalized}`;
};

const toStringValue = (value: any, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  const normalized = `${value}`.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toNumber = (value: any, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toBoolean = (value: any, fallback = false): boolean => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
};

const parseCollection = (input: any): any[] => {
  if (Array.isArray(input)) {
    return input;
  }
  if (!input) {
    return [];
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const resolveCategory = (value: any) => {
  const raw = toStringValue(value, 'general');
  const lowered = raw.toLowerCase();
  return PRODUCT_CATEGORY_OPTIONS.find((option) => {
    return [
      option.id,
      option.slug,
      option.labelAr,
      option.labelEn
    ].some((candidate) => toStringValue(candidate, '').toLowerCase() === lowered);
  }) || PRODUCT_CATEGORY_OPTIONS[0];
};

export const normalizeProductRecord = (record: any): ProductRecord => {
  const categoryValue = toStringValue(record?.category ?? record?.categoryEn ?? record?.categoryAr ?? 'general', 'general');
  const categoryOption = resolveCategory(categoryValue);
  const images = parseCollection(record?.images)
    .map((image) => resolveProductImageUrl(image))
    .filter(Boolean);
  const legacyImage = resolveProductImageUrl(record?.image || record?.imageUrl || images[0] || '');
  const primaryImage = images[0] || legacyImage || '';
  const finalPrice = toNumber(record?.finalPrice ?? record?.price ?? 0, 0);
  const rawPrice = toNumber(record?.rawPrice ?? 0, 0);
  const sku = toStringValue(record?.sku, '');
  const nameAr = toStringValue(record?.name_ar ?? record?.nameAr ?? record?.name ?? '', '');
  const nameEn = toStringValue(record?.name_en ?? record?.nameEn ?? record?.name ?? '', '');
  const descriptionAr = toStringValue(record?.description_ar ?? record?.descriptionAr ?? '', '');
  const descriptionEn = toStringValue(record?.description_en ?? record?.descriptionEn ?? '', '');

  return {
    ...record,
    id: toStringValue(record?.id, ''),
    tenantId: record?.tenantId || record?.tenant_id,
    name_ar: nameAr,
    name_en: nameEn,
    nameAr,
    nameEn,
    description_ar: descriptionAr,
    description_en: descriptionEn,
    descriptionAr,
    descriptionEn,
    category: categoryValue,
    categoryAr: categoryOption.labelAr,
    categoryEn: categoryOption.labelEn,
    image: legacyImage,
    imageUrl: primaryImage,
    primaryImage,
    images: images.length > 0 ? images : (legacyImage ? [legacyImage] : []),
    rawPrice: parseFloat(rawPrice.toFixed(2)),
    price: parseFloat(finalPrice.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
    taxRate: toNumber(record?.taxRate, 0),
    commissionRate: toNumber(record?.commissionRate, 0),
    stock: toNumber(record?.stock ?? record?.stockQuantity ?? 0, 0),
    sku,
    brand: toStringValue(record?.brand, ''),
    size: toStringValue(record?.size, ''),
    color: toStringValue(record?.color, ''),
    ingredients: toStringValue(record?.ingredients, ''),
    ingredientsAr: toStringValue(record?.ingredients_ar ?? record?.ingredientsAr, ''),
    ingredientsEn: toStringValue(record?.ingredients_en ?? record?.ingredientsEn, ''),
    howToUseAr: toStringValue(record?.howToUse_ar ?? record?.howToUseAr, ''),
    howToUseEn: toStringValue(record?.howToUse_en ?? record?.howToUseEn, ''),
    featuresAr: toStringValue(record?.features_ar ?? record?.featuresAr, ''),
    featuresEn: toStringValue(record?.features_en ?? record?.featuresEn, ''),
    isAvailable: toBoolean(record?.isAvailable, true),
    isFeatured: toBoolean(record?.isFeatured, false),
    allowsDelivery: toBoolean(record?.allowsDelivery ?? record?.allows_delivery, true),
    allowsPickup: toBoolean(record?.allowsPickup ?? record?.allows_pickup, true),
    soldCount: toNumber(record?.soldCount, 0),
    usedAsGiftCount: toNumber(record?.usedAsGiftCount, 0)
  };
};

export const normalizeProductCollection = (products: any[]): ProductRecord[] => {
  return parseCollection(products).map((product) => normalizeProductRecord(product));
};

export const buildProductSubmissionPayload = (draft: ProductSubmissionDraft) => {
  const categoryOption = resolveCategory(draft?.categoryEn || draft?.category || draft?.categoryAr || 'general');
  const images = Array.isArray(draft?.images)
    ? draft.images
        .map((image) => `${image ?? ''}`.trim())
        .filter((image) => image.length > 0)
    : [];
  const retainedImages = Array.isArray(draft?.retainedImages)
    ? draft.retainedImages
        .map((image) => `${image ?? ''}`.trim())
        .filter((image) => image.length > 0)
    : [];
  const finalPrice = toNumber(draft?.finalPrice ?? draft?.price ?? 0, 0);
  const rawPrice = toNumber(draft?.rawPrice ?? 0, 0);

  return {
    id: draft?.id || undefined,
    name_en: toStringValue(draft?.name_en ?? draft?.nameEn ?? draft?.nameAr ?? '', ''),
    name_ar: toStringValue(draft?.name_ar ?? draft?.nameAr ?? draft?.nameEn ?? '', ''),
    description_en: toStringValue(draft?.description_en ?? draft?.descriptionEn ?? '', ''),
    description_ar: toStringValue(draft?.description_ar ?? draft?.descriptionAr ?? '', ''),
    rawPrice: parseFloat(rawPrice.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
    price: parseFloat(finalPrice.toFixed(2)),
    category: categoryOption.id,
    stock: Math.max(0, Math.round(toNumber(draft?.stock, 0))),
    sku: toStringValue(draft?.sku, ''),
    brand: toStringValue(draft?.brand, ''),
    size: toStringValue(draft?.size, ''),
    color: toStringValue(draft?.color, ''),
    ingredients: toStringValue(draft?.ingredients, ''),
    ingredients_en: toStringValue(draft?.ingredients_en ?? draft?.ingredientsEn, ''),
    ingredients_ar: toStringValue(draft?.ingredients_ar ?? draft?.ingredientsAr, ''),
    howToUse_en: toStringValue(draft?.howToUse_en ?? draft?.howToUseEn, ''),
    howToUse_ar: toStringValue(draft?.howToUse_ar ?? draft?.howToUseAr, ''),
    features_en: toStringValue(draft?.features_en ?? draft?.featuresEn, ''),
    features_ar: toStringValue(draft?.features_ar ?? draft?.featuresAr, ''),
    isAvailable: toBoolean(draft?.isAvailable, true),
    isFeatured: toBoolean(draft?.isFeatured, false),
    allowsDelivery: toBoolean(draft?.allowsDelivery, true),
    allowsPickup: toBoolean(draft?.allowsPickup, true),
    images,
    retainedImages
  };
};
