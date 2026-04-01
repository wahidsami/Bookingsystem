'use client';

import { useState, useEffect } from 'react';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function SubscriptionPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tenantApi
      .getCurrentSubscription()
      .then((res) => {
        if (res.success && res.subscription) setSubscription(res.subscription);
        else setError('No subscription found');
      })
      .catch(() => setError('Failed to load subscription'))
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = locale === 'ar'
      ? { active: 'نشط', trial: 'تجريبي', past_due: 'متأخر', APPROVED_PENDING_PAYMENT: 'بانتظار الدفع', APPROVED_FREE_ACTIVE: 'نشط' }
      : { active: 'Active', trial: 'Trial', past_due: 'Past due', APPROVED_PENDING_PAYMENT: 'Pending payment', APPROVED_FREE_ACTIVE: 'Active' };
    return map[s] || s;
  };

  const daysUntilRenewal = subscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB') : '—');

  return (
    <TenantLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {locale === 'ar' ? 'اشتراكي' : 'My Subscription'}
        </h1>
        <p className="text-gray-600 mb-6">
          {locale === 'ar' ? 'تفاصيل خطتك وتجديدها.' : 'Your plan details and renewal.'}
        </p>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {subscription.package?.name || subscription.package?.name_ar || 'Plan'}
                </h2>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    subscription.status === 'active' || subscription.status === 'APPROVED_FREE_ACTIVE' || subscription.status === 'trial'
                      ? 'bg-green-100 text-green-800'
                      : subscription.status === 'APPROVED_PENDING_PAYMENT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {statusLabel(subscription.status)}
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">{locale === 'ar' ? 'دورة الفوترة' : 'Billing cycle'}</dt>
                  <dd className="font-medium text-gray-900">
                    {subscription.billingCycle === 'monthly'
                      ? locale === 'ar'
                        ? 'شهري'
                        : 'Monthly'
                      : subscription.billingCycle === 'sixMonth'
                      ? locale === 'ar'
                        ? 'كل 6 أشهر'
                        : '6 months'
                      : locale === 'ar'
                      ? 'سنوي'
                      : 'Annual'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{locale === 'ar' ? 'بداية الفترة' : 'Period start'}</dt>
                  <dd className="font-medium text-gray-900">{formatDate(subscription.currentPeriodStart)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{locale === 'ar' ? 'نهاية الفترة' : 'Period end'}</dt>
                  <dd className="font-medium text-gray-900">{formatDate(subscription.currentPeriodEnd)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{locale === 'ar' ? 'التجديد القادم' : 'Next renewal'}</dt>
                  <dd className="font-medium text-gray-900">{formatDate(subscription.nextBillingDate || subscription.currentPeriodEnd)}</dd>
                </div>
              </dl>
              {daysUntilRenewal !== null && (subscription.status === 'active' || subscription.status === 'APPROVED_FREE_ACTIVE' || subscription.status === 'trial') && (
                <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <p className="text-purple-900 font-medium">
                    {locale === 'ar' ? `التجديد خلال ${daysUntilRenewal} يوم` : `Renewal in ${daysUntilRenewal} days`}
                  </p>
                  <p className="text-purple-700 text-sm mt-1">
                    {locale === 'ar' ? 'التاريخ القادم للخصم' : 'Next billing date'}: {formatDate(subscription.nextBillingDate || subscription.currentPeriodEnd)}
                  </p>
                </div>
              )}
              {subscription.status === 'APPROVED_PENDING_PAYMENT' && (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-amber-900 font-medium">
                    {locale === 'ar' ? 'يرجى إتمام الدفع خلال 48 ساعة لتفعيل اشتراكك.' : 'Please complete payment within 48 hours to activate your subscription.'}
                  </p>
                  <Link
                    href={`/${locale}/dashboard/bills`}
                    className="inline-block mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                  >
                    {locale === 'ar' ? 'ادفع الآن' : 'Pay now'}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/dashboard/subscription/upgrade`}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200"
              >
                {locale === 'ar' ? 'ترقية الخطة' : 'Upgrade plan'}
              </Link>
              <Link
                href={`/${locale}/dashboard/bills`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
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
