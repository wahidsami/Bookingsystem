'use client';

import { useState, useEffect } from 'react';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTenantAuth } from '@/contexts/TenantAuthContext';
import {
  hasAIAssistantEntitlement,
  hasHotDealsEntitlement,
  hasInternalMessagingEntitlement,
  hasPayrollEntitlement,
  hasProductsAndOrdersEntitlement,
  hasPublicPageCustomizationEntitlement,
  hasPushNotificationsEntitlement,
  hasReportsEntitlement,
  isEntitlementEnabled
} from '@/lib/packageEntitlements';

const FEATURE_DEFINITIONS = [
  {
    key: 'productsAndOrders',
    icon: '🛍️',
    label: { ar: 'المنتجات والطلبات', en: 'Products & Orders' },
    description: {
      ar: 'بيع المنتجات وإدارة الطلبات من لوحة التحكم.',
      en: 'Sell products and manage customer orders from your dashboard.'
    },
    isEnabled: hasProductsAndOrdersEntitlement
  },
  {
    key: 'internalMessaging',
    icon: '📬',
    label: { ar: 'الرسائل الداخلية', en: 'Internal Messages' },
    description: {
      ar: 'إرسال رسائل لفريق العمل داخل النظام.',
      en: 'Send internal messages to your team members.'
    },
    isEnabled: hasInternalMessagingEntitlement
  },
  {
    key: 'pushNotifications',
    icon: '🔔',
    label: { ar: 'إشعارات العملاء', en: 'Customer Push Notifications' },
    description: {
      ar: 'إرسال حملات إشعارات تسويقية لعملائك.',
      en: 'Send marketing push campaigns to your customers.'
    },
    isEnabled: hasPushNotificationsEntitlement
  },
  {
    key: 'aiContentAssistant',
    icon: '✨',
    label: { ar: 'مساعد الذكاء الاصطناعي', en: 'AI Content Assistant' },
    description: {
      ar: 'توليد وترجمة محتوى الخدمات والمنتجات.',
      en: 'Generate and translate product/service content.'
    },
    isEnabled: hasAIAssistantEntitlement
  },
  {
    key: 'hotDeals',
    icon: '🔥',
    label: { ar: 'العروض الساخنة', en: 'Hot Deals' },
    description: {
      ar: 'إنشاء عروض ترويجية لزيادة المبيعات.',
      en: 'Create promotional deals to boost sales.'
    },
    isEnabled: hasHotDealsEntitlement
  },
  {
    key: 'reports',
    icon: '📈',
    label: { ar: 'التقارير والتحليلات', en: 'Reports & Analytics' },
    description: {
      ar: 'عرض مؤشرات الأداء والتقارير التشغيلية.',
      en: 'Review KPIs, trends, and operational reports.'
    },
    isEnabled: hasReportsEntitlement
  },
  {
    key: 'payroll',
    icon: '💳',
    label: { ar: 'إدارة الرواتب', en: 'Payroll Management' },
    description: {
      ar: 'متابعة رواتب الموظفين وحالات الدفع.',
      en: 'Manage employee payroll records and status.'
    },
    isEnabled: hasPayrollEntitlement
  },
  {
    key: 'publicPageCustomization',
    icon: '🌐',
    label: { ar: 'تخصيص الصفحة العامة', en: 'Public Page Customization' },
    description: {
      ar: 'التحكم بهوية وصفحة مركزك العامة.',
      en: 'Customize your public business page and branding.'
    },
    isEnabled: hasPublicPageCustomizationEntitlement
  }
];

const RESOURCE_DEFINITIONS = [
  {
    key: 'staff',
    icon: '👥',
    limitKey: 'maxStaff',
    label: { ar: 'الموظفون', en: 'Staff members' }
  },
  {
    key: 'services',
    icon: '✨',
    limitKey: 'maxServices',
    label: { ar: 'الخدمات', en: 'Services' }
  },
  {
    key: 'products',
    icon: '🧴',
    limitKey: 'maxProducts',
    label: { ar: 'المنتجات', en: 'Products' }
  },
  {
    key: 'bookings',
    icon: '📅',
    limitKey: 'maxBookingsPerMonth',
    label: { ar: 'حجوزات هذا الشهر', en: 'Monthly bookings' }
  }
];

const QUOTA_DEFINITIONS = [
  {
    key: 'aiContentAssistant',
    icon: '✨',
    label: { ar: 'رصيد الذكاء الاصطناعي', en: 'AI assistant quota' }
  },
  {
    key: 'inAppMarketingNotifications',
    icon: '🔔',
    label: { ar: 'إشعارات العملاء الشهرية', en: 'Monthly push notifications' }
  },
  {
    key: 'whatsappNotifications',
    icon: '💬',
    label: { ar: 'إشعارات واتساب', en: 'WhatsApp notifications' }
  },
  {
    key: 'promotionalEmails',
    icon: '📧',
    label: { ar: 'الإيميلات التسويقية', en: 'Promotional emails' }
  },
  {
    key: 'maxHotDeals',
    icon: '🔥',
    label: { ar: 'عدد العروض الساخنة', en: 'Hot Deals quota' }
  },
  {
    key: 'featuredProducts',
    icon: '🏷️',
    label: { ar: 'المنتجات المميزة', en: 'Featured products' }
  }
];

export default function SubscriptionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'ar';
  const { user } = useTenantAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [limitsResponse, setLimitsResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      tenantApi.getCurrentSubscription(),
      tenantApi.getSubscriptionLimits()
    ])
      .then(([subscriptionRes, limitsRes]) => {
        if (!isMounted) return;

        if (subscriptionRes.success && subscriptionRes.subscription) {
          setSubscription(subscriptionRes.subscription);
        } else {
          setError(locale === 'ar' ? 'لم يتم العثور على اشتراك' : 'No subscription found');
        }

        if (limitsRes.success) {
          setLimitsResponse(limitsRes);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError(locale === 'ar' ? 'فشل تحميل بيانات الاشتراك' : 'Failed to load subscription details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [locale]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = locale === 'ar'
      ? {
          active: 'نشط',
          trial: 'بانتظار التفعيل',
          past_due: 'متأخر',
          payment_pending: 'بانتظار الدفع',
          APPROVED_FREE_ACTIVE: 'نشط'
        }
      : {
          active: 'Active',
          trial: 'Pending activation',
          past_due: 'Past due',
          payment_pending: 'Pending payment',
          APPROVED_FREE_ACTIVE: 'Active'
        };
    return map[s] || s;
  };

  const billingCycleLabel = (cycle?: string) => {
    const labels: Record<string, string> = locale === 'ar'
      ? { monthly: 'شهري', sixMonth: 'كل 6 أشهر', annual: 'سنوي' }
      : { monthly: 'Monthly', sixMonth: '6 months', annual: 'Annual' };
    return labels[cycle || ''] || '—';
  };

  const formatDate = (dateValue?: string) =>
    dateValue ? new Date(dateValue).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB') : '—';

  const formatCurrency = (amount?: number | string | null) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return '—';

    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: subscription?.currency || 'SAR',
      maximumFractionDigits: 0
    }).format(numericAmount);
  };

  const formatLimitValue = (value: unknown) => {
    if (value === -1 || value === '-1') {
      return locale === 'ar' ? 'غير محدود' : 'Unlimited';
    }

    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  const getPlanAmount = () => {
    const pkg = subscription?.package;
    if (!pkg) return null;

    if (subscription?.billingCycle === 'monthly') return pkg.monthlyPrice;
    if (subscription?.billingCycle === 'sixMonth') return pkg.sixMonthPrice;
    if (subscription?.billingCycle === 'annual') return pkg.annualPrice;
    return null;
  };

  const displayStatus = user?.status === 'payment_pending' ? 'payment_pending' : subscription?.status;
  const isPaymentPending = user?.status === 'payment_pending';
  const lockedFeature = searchParams?.get('lockedFeature');
  const limits = limitsResponse?.limits || subscription?.package?.limits || {};
  const usageData = limitsResponse?.data || {};
  const lockedFeatures = FEATURE_DEFINITIONS.filter((feature) => !feature.isEnabled(limits));
  const lockedFeatureTitle = FEATURE_DEFINITIONS.find((feature) => feature.key === lockedFeature)?.label[locale === 'ar' ? 'ar' : 'en'];

  const daysUntilRenewal = subscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <TenantLayout>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm font-semibold text-primary mb-2">
            {locale === 'ar' ? 'تفاصيل الباقة والميزات' : 'Plan and entitlement details'}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {locale === 'ar' ? 'اشتراكي' : 'My Subscription'}
          </h1>
          <p className="text-gray-600">
            {locale === 'ar'
              ? 'راجع ما تتضمنه باقتك الحالية، استهلاك الموارد، والميزات التي يمكنك ترقيتها.'
              : 'Review your current package, resource usage, and features you can unlock by upgrading.'}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        )}

        {!loading && lockedFeatureTitle && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
            <p className="text-sm font-semibold text-amber-700 mb-1">
              {locale === 'ar' ? 'هذه الميزة غير مفعلة في باقتك الحالية' : 'This feature is not available in your current plan'}
            </p>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{lockedFeatureTitle}</h2>
            <p className="text-sm text-gray-700">
              {locale === 'ar'
                ? 'يمكنك الترقية إلى باقة أعلى لتفعيل هذه الميزة فوراً بعد إتمام الفاتورة.'
                : 'Upgrade to a higher package to activate this feature after completing the invoice payment.'}
            </p>
          </div>
        )}

        {error && !subscription && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6">
            {error}
            <div className="mt-2">
              <Link href={`/${locale}/dashboard/bills`} className="text-purple-600 hover:underline font-medium">
                {locale === 'ar' ? 'الفواتير' : 'My Bills'}
              </Link>
            </div>
          </div>
        )}

        {!loading && subscription && (
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] shadow-sm border border-gray-200 p-6 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{locale === 'ar' ? 'الباقة الحالية' : 'Current package'}</p>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {locale === 'ar'
                      ? subscription.package?.name_ar || subscription.package?.name || 'Plan'
                      : subscription.package?.name || subscription.package?.name_ar || 'Plan'}
                  </h2>
                </div>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    displayStatus === 'active' || displayStatus === 'trial' || displayStatus === 'APPROVED_FREE_ACTIVE'
                      ? 'bg-green-100 text-green-800'
                    : isPaymentPending
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {statusLabel(displayStatus)}
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <dt className="text-gray-500">{locale === 'ar' ? 'دورة الفوترة' : 'Billing cycle'}</dt>
                  <dd className="font-semibold text-gray-900 mt-1">{billingCycleLabel(subscription.billingCycle)}</dd>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <dt className="text-gray-500">{locale === 'ar' ? 'قيمة الاشتراك' : 'Package amount'}</dt>
                  <dd className="font-semibold text-gray-900 mt-1">{formatCurrency(getPlanAmount())}</dd>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <dt className="text-gray-500">{locale === 'ar' ? 'بداية الفترة' : 'Period start'}</dt>
                  <dd className="font-semibold text-gray-900 mt-1">{formatDate(subscription.currentPeriodStart)}</dd>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <dt className="text-gray-500">{locale === 'ar' ? 'نهاية الفترة' : 'Period end'}</dt>
                  <dd className="font-semibold text-gray-900 mt-1">{formatDate(subscription.currentPeriodEnd)}</dd>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 sm:col-span-2 lg:col-span-4">
                  <dt className="text-gray-500">{locale === 'ar' ? 'التجديد القادم' : 'Next renewal'}</dt>
                  <dd className="font-semibold text-gray-900 mt-1">
                    {formatDate(subscription.nextBillingDate || subscription.currentPeriodEnd)}
                  </dd>
                </div>
              </dl>
              {daysUntilRenewal !== null && !isPaymentPending && (subscription.status === 'active' || subscription.status === 'trial') && (
                <div className="mt-4 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                  <p className="text-purple-900 font-medium">
                    {locale === 'ar' ? `التجديد خلال ${daysUntilRenewal} يوم` : `Renewal in ${daysUntilRenewal} days`}
                  </p>
                  <p className="text-purple-700 text-sm mt-1">
                    {locale === 'ar' ? 'التاريخ القادم للخصم' : 'Next billing date'}: {formatDate(subscription.nextBillingDate || subscription.currentPeriodEnd)}
                  </p>
                </div>
              )}
              {isPaymentPending && (
                <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <p className="text-amber-900 font-medium">
                    {locale === 'ar' ? 'يرجى إتمام الدفع خلال 48 ساعة لتفعيل اشتراكك.' : 'Please complete payment within 48 hours to activate your subscription.'}
                  </p>
                  <Link
                    href={`/${locale}/payment`}
                    className="inline-block mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                  >
                    {locale === 'ar' ? 'ادفع الآن' : 'Pay now'}
                  </Link>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <section className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-primary mb-1">
                    {locale === 'ar' ? 'استخدام الموارد' : 'Resource usage'}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900">
                    {locale === 'ar' ? 'حدود الباقة والاستهلاك الحالي' : 'Plan limits and current usage'}
                  </h2>
                </div>

                <div className="space-y-4">
                  {RESOURCE_DEFINITIONS.map((resource) => {
                    const usage = usageData?.[resource.key] || {};
                    const currentValue = Number(usage.current || 0);
                    const limitValue = usage.limit ?? limits?.[resource.limitKey];
                    const isUnlimited = limitValue === -1 || limitValue === '-1';
                    const safeLimit = Number(limitValue);
                    const percentage = isUnlimited || !Number.isFinite(safeLimit) || safeLimit <= 0
                      ? 0
                      : Math.min(100, Math.round((currentValue / safeLimit) * 100));

                    return (
                      <div key={resource.key} className="rounded-3xl border border-gray-100 bg-gray-50/70 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{resource.icon}</span>
                            <span className="font-semibold text-gray-900">
                              {resource.label[locale === 'ar' ? 'ar' : 'en']}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-gray-700">
                            {currentValue} / {formatLimitValue(limitValue)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                            style={{ width: isUnlimited ? '100%' : `${percentage}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          {isUnlimited
                            ? (locale === 'ar' ? 'هذا المورد غير محدود في باقتك الحالية.' : 'This resource is unlimited in your current plan.')
                            : (locale === 'ar' ? `${percentage}% من الحد المتاح مستخدم حالياً.` : `${percentage}% of your package limit is currently used.`)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-primary mb-1">
                    {locale === 'ar' ? 'المزايا والكوته' : 'Features and quotas'}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900">
                    {locale === 'ar' ? 'ما الذي تتضمنه باقتك؟' : 'What is included in your package?'}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {QUOTA_DEFINITIONS.map((quota) => {
                    const value = limits?.[quota.key];
                    const enabled = isEntitlementEnabled(value);

                    return (
                      <div
                        key={quota.key}
                        className={`rounded-3xl border p-4 ${
                          enabled ? 'border-emerald-100 bg-emerald-50/60' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{quota.icon}</span>
                              <p className="text-sm font-semibold text-gray-900">
                                {quota.label[locale === 'ar' ? 'ar' : 'en']}
                              </p>
                            </div>
                            <p className={`text-xs font-medium ${enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
                              {enabled
                                ? (locale === 'ar' ? 'مفعلة ضمن الباقة' : 'Included in this plan')
                                : (locale === 'ar' ? 'غير مفعلة حالياً' : 'Not available in this plan')}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{formatLimitValue(value)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FEATURE_DEFINITIONS.map((feature) => {
                    const enabled = feature.isEnabled(limits);
                    return (
                      <div
                        key={feature.key}
                        className={`rounded-3xl border p-4 ${
                          enabled ? 'border-purple-100 bg-purple-50/40' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{feature.icon}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {feature.label[locale === 'ar' ? 'ar' : 'en']}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {feature.description[locale === 'ar' ? 'ar' : 'en']}
                            </p>
                            <p className={`text-xs font-semibold mt-2 ${enabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {enabled
                                ? (locale === 'ar' ? 'متاحة في خطتك الحالية' : 'Available in your current plan')
                                : (locale === 'ar' ? 'تحتاج إلى ترقية الباقة' : 'Requires a package upgrade')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {lockedFeatures.length > 0 && (
                  <div className="mt-5 rounded-3xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 p-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {locale === 'ar'
                        ? `يمكنك ترقية الباقة لفتح ${lockedFeatures.length} ميزة إضافية.`
                        : `Upgrade your package to unlock ${lockedFeatures.length} additional feature(s).`}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {lockedFeatures
                        .map((feature) => feature.label[locale === 'ar' ? 'ar' : 'en'])
                        .join(locale === 'ar' ? '، ' : ', ')}
                    </p>
                  </div>
                )}
              </section>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/dashboard/subscription/upgrade`}
                className="inline-flex items-center px-5 py-3 bg-primary text-white rounded-2xl font-semibold hover:bg-primary/90"
              >
                {locale === 'ar' ? 'ترقية الخطة' : 'Upgrade plan'}
              </Link>
              <Link
                href={`/${locale}/dashboard/bills`}
                className="inline-flex items-center px-5 py-3 border border-gray-300 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50"
              >
                {locale === 'ar' ? 'فواتيري' : 'My Bills'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
