import { PackageEntitlements, normalizePackageEntitlements } from './tenantEntitlements';

type Locale = 'ar' | 'en';

export type TenantSubscriptionSnapshot = Record<string, any> | null | undefined;
export type TenantSubscriptionUsage = Record<string, any> | null | undefined;

export interface TenantPlanSummary {
  planCode: string;
  planNameAr: string;
  planNameEn: string;
  billingCycle: string | null;
  status: string | null;
  effectiveStatus: string | null;
  daysRemaining: number | null;
  currency: string;
  billingAmount: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  paymentDueAt: string | null;
  packageLimits: Record<string, any> | null;
  usage: {
    staff: { current: number | null; limit: number | null; allowed: boolean | null } | null;
    services: { current: number | null; limit: number | null; allowed: boolean | null } | null;
    products: { current: number | null; limit: number | null; allowed: boolean | null } | null;
    bookings: { current: number | null; limit: number | null; allowed: boolean | null } | null;
    storage: { current: number | null; limit: number | null; allowed: boolean | null } | null;
  };
  subscription: TenantSubscriptionSnapshot;
  usageSnapshot: TenantSubscriptionUsage;
  entitlements: Record<string, any> | null;
}

function toNumber(value: any, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: any, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeLimitValue(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUsageBucket(bucket: any): { current: number | null; limit: number | null; allowed: boolean | null } | null {
  if (!bucket || typeof bucket !== 'object') return null;

  return {
    current: normalizeLimitValue(bucket.current),
    limit: normalizeLimitValue(bucket.limit),
    allowed: typeof bucket.allowed === 'boolean' ? bucket.allowed : null
  };
}

function billingCycleLabel(cycle: string | null | undefined, lang: Locale): string {
  const normalized = toText(cycle, '').toLowerCase();

  if (normalized === 'annual') {
    return lang === 'ar' ? 'سنوي' : 'Annual';
  }
  if (normalized === 'sixmonth' || normalized === 'six_month' || normalized === 'six-month') {
    return lang === 'ar' ? 'كل 6 أشهر' : 'Six months';
  }
  if (normalized === 'monthly') {
    return lang === 'ar' ? 'شهري' : 'Monthly';
  }

  return lang === 'ar' ? 'الاشتراك' : 'Billing';
}

function formatCurrency(amount: number | null, currency: string, locale: Locale, billingCycle: string | null): string {
  if (amount === null || !Number.isFinite(amount)) {
    return locale === 'ar' ? 'غير متاح' : 'Unavailable';
  }

  const resolvedCurrency = toText(currency, 'SAR');
  const number = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  const cycle = billingCycleLabel(billingCycle, locale);

  if (locale === 'ar') {
    return `${number} ${resolvedCurrency} / ${cycle}`;
  }

  return `${resolvedCurrency} ${number} / ${cycle}`;
}

function resolvePlanName(subscription: TenantSubscriptionSnapshot, usageSnapshot: TenantSubscriptionUsage, locale: Locale): string {
  const packageRecord = subscription?.package || {};
  const usagePackageName = usageSnapshot?.data?.packageName || usageSnapshot?.packageName || '';
  const tenantTier = toText(subscription?.tenant?.plan || subscription?.plan || subscription?.tenantPlan || '', '');
  const fallbackMap: Record<string, { ar: string; en: string }> = {
    basic: { ar: 'الباقة الأساسية', en: 'Basic Plan' },
    pro: { ar: 'الباقة الاحترافية', en: 'Pro Plan' },
    premium: { ar: 'الباقة المميزة', en: 'Premium Plan' },
    free_trial: { ar: 'الفترة التجريبية', en: 'Free Trial' },
    free: { ar: 'الخطة المجانية', en: 'Free Plan' }
  };

  const resolved = locale === 'ar'
    ? toText(
        packageRecord.name_ar ||
        packageRecord.nameAr ||
        usagePackageName ||
        fallbackMap[tenantTier]?.ar ||
        tenantTier,
        'الباقة الحالية'
      )
    : toText(
        packageRecord.name ||
        packageRecord.nameEn ||
        usagePackageName ||
        fallbackMap[tenantTier]?.en ||
        tenantTier,
        'Current Plan'
      );

  return resolved || (locale === 'ar' ? 'الباقة الحالية' : 'Current Plan');
}

export function normalizeTenantSubscriptionSnapshot(response: any): TenantSubscriptionSnapshot {
  const subscription = response?.subscription || response?.data?.subscription || response?.data || response || null;
  if (!subscription || typeof subscription !== 'object') {
    return null;
  }

  return {
    ...subscription,
    effectiveStatus: subscription.effectiveStatus ?? subscription.status ?? null,
    daysRemaining: typeof subscription.daysRemaining === 'number' ? subscription.daysRemaining : null,
    package: subscription.package
      ? {
          ...subscription.package,
          limits: normalizePackageEntitlements(subscription.package.limits || {})
        }
      : subscription.package || null
  };
}

export function normalizeTenantSubscriptionUsage(response: any): TenantSubscriptionUsage {
  const payload = response?.data || response || null;
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return {
    ...payload,
    data: payload.data || payload
  };
}

export function buildTenantPlanSummary(options: {
  locale?: Locale;
  tenant?: Record<string, any> | null;
  tenantSettings?: Record<string, any> | null;
  packageEntitlements?: PackageEntitlements;
  subscription?: TenantSubscriptionSnapshot;
  usageSnapshot?: TenantSubscriptionUsage;
}): TenantPlanSummary {
  const locale = options.locale || 'en';
  const subscription = options.subscription || null;
  const usageSnapshot = options.usageSnapshot || null;
  const packageRecord = subscription?.package || {};
  const limitsFromPackage = normalizePackageEntitlements(packageRecord.limits || {});
  const limitsFromEntitlements = normalizePackageEntitlements(options.packageEntitlements || {});
  const mergedLimits = normalizePackageEntitlements({
    ...(limitsFromEntitlements || {}),
    ...(limitsFromPackage || {})
  });

  const usage = usageSnapshot?.data || usageSnapshot || {};
  const staff = normalizeUsageBucket(usage?.staff);
  const services = normalizeUsageBucket(usage?.services);
  const products = normalizeUsageBucket(usage?.products);
  const bookings = normalizeUsageBucket(usage?.bookings);
  const storage = normalizeUsageBucket(usage?.storage);

  const billingCycle = toText(subscription?.billingCycle || subscription?.billing_cycle || null, null as any) || null;
  const billingAmount = subscription?.amount !== undefined && subscription?.amount !== null
    ? toNumber(subscription.amount, null as any)
    : null;

  const currentPeriodStart = subscription?.currentPeriodStart || subscription?.current_period_start || null;
  const currentPeriodEnd = subscription?.currentPeriodEnd || subscription?.current_period_end || null;
  const paymentDueAt = options.tenant?.paymentDueAt || options.tenant?.payment_due_at || null;
  const currency = toText(subscription?.currency || options.tenantSettings?.currency || 'SAR', 'SAR');

  const planCode = toText(
    packageRecord.slug ||
    subscription?.plan ||
    options.tenant?.plan ||
    options.tenantSettings?.subscriptionTier ||
    packageRecord.name ||
    'current_plan',
    'current_plan'
  );

  return {
    planCode,
    planNameAr: resolvePlanName(subscription, usageSnapshot, 'ar'),
    planNameEn: resolvePlanName(subscription, usageSnapshot, 'en'),
    billingCycle,
    status: toText(subscription?.status || options.tenant?.status || null, null as any) || null,
    effectiveStatus: toText(subscription?.effectiveStatus || null, null as any) || null,
    daysRemaining: subscription?.daysRemaining ?? null,
    currency,
    billingAmount,
    currentPeriodStart: currentPeriodStart ? String(currentPeriodStart) : null,
    currentPeriodEnd: currentPeriodEnd ? String(currentPeriodEnd) : null,
    paymentDueAt: paymentDueAt ? String(paymentDueAt) : null,
    packageLimits: mergedLimits,
    usage: {
      staff,
      services,
      products,
      bookings,
      storage
    },
    subscription,
    usageSnapshot,
    entitlements: mergedLimits
  };
}

export function formatTenantPlanBillingAmount(
  amount: number | null,
  currency: string,
  billingCycle: string | null,
  locale: Locale = 'en'
): string {
  return formatCurrency(amount, currency, locale, billingCycle);
}

export function formatTenantPlanLimit(
  limit: number | null | undefined,
  locale: Locale = 'en'
): string {
  if (limit === null || limit === undefined) {
    return locale === 'ar' ? 'غير متاح' : 'Unavailable';
  }

  if (limit === -1) {
    return locale === 'ar' ? 'غير محدود' : 'Unlimited';
  }

  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-GB').format(limit);
}

export function getTenantPlanUsageCount(
  bucket: TenantPlanSummary['usage'][keyof TenantPlanSummary['usage']],
  fallback = 0
): number {
  if (!bucket) return fallback;
  return Number.isFinite(bucket.current ?? NaN) ? Number(bucket.current) : fallback;
}

