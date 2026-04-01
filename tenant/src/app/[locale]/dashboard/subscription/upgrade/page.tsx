'use client';

import { useState, useEffect } from 'react';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface Pkg {
  id: string;
  name: string;
  name_ar: string;
  description?: string;
  monthlyPrice: number;
  sixMonthPrice: number;
  annualPrice: number;
  slug: string;
  isActive: boolean;
  displayOrder: number;
}

export default function UpgradePlanPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/subscriptions/packages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.packages) {
          setPackages(data.packages.filter((p: Pkg) => p.isActive));
        }
      })
      .catch(() => setError('Failed to load packages'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = (pkg: Pkg, billingCycle: 'monthly' | 'sixMonth' | 'annual') => {
    setSubmitting(pkg.id);
    setError(null);
    tenantApi
      .requestUpgrade(pkg.id, billingCycle)
      .then((res: any) => {
        if (res.success && res.paymentUrl) {
          window.location.href = res.paymentUrl;
        } else {
          setError(res.message || (locale === 'ar' ? 'فشل طلب الترقية' : 'Upgrade request failed'));
        }
      })
      .catch(() => setError(locale === 'ar' ? 'فشل الاتصال' : 'Request failed'))
      .finally(() => setSubmitting(null));
  };

  const priceFor = (pkg: Pkg, cycle: string) => {
    const n =
      cycle === 'monthly'
        ? pkg.monthlyPrice
        : cycle === 'sixMonth'
          ? pkg.sixMonthPrice
          : pkg.annualPrice;
    return isNaN(n) ? 0 : n;
  };

  return (
    <TenantLayout>
      <div className="p-6">
        <div className="mb-6">
          <Link
            href={`/${locale}/dashboard/subscription`}
            className="text-purple-600 hover:underline text-sm font-medium"
          >
            ← {locale === 'ar' ? 'اشتراكي' : 'My Subscription'}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {locale === 'ar' ? 'ترقية الخطة' : 'Upgrade plan'}
        </h1>
        <p className="text-gray-600 mb-6">
          {locale === 'ar' ? 'اختر خطة جديدة وادفع خلال 48 ساعة لتفعيلها.' : 'Choose a new plan and pay within 48 hours to activate it.'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  {locale === 'ar' ? pkg.name_ar : pkg.name}
                </h2>
                <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                  {pkg.description || ''}
                </p>
                <div className="mt-4 space-y-2">
                    {(['monthly', 'sixMonth', 'annual'] as const).map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        disabled={!!submitting}
                        onClick={() => handleUpgrade(pkg, cycle)}
                        className="w-full py-2 px-3 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 font-medium text-sm disabled:opacity-50"
                      >
                        {submitting === pkg.id
                          ? (locale === 'ar' ? 'جاري التحميل...' : 'Loading...')
                          : cycle === 'monthly'
                          ? `${locale === 'ar' ? 'شهري' : 'Monthly'} — ${priceFor(pkg, cycle)} SAR`
                          : cycle === 'sixMonth'
                          ? `${locale === 'ar' ? '6 أشهر' : '6 months'} — ${priceFor(pkg, cycle)} SAR`
                          : `${locale === 'ar' ? 'سنوي' : 'Annual'} — ${priceFor(pkg, cycle)} SAR`}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
