"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";

type BillingCycle = "monthly" | "sixMonth" | "annual";

interface SubscriptionPackage {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  monthlyPrice: number | string;
  sixMonthPrice: number | string;
  annualPrice: number | string;
  platformCommission: number | string;
}

interface CurrentSubscription {
  packageId: string;
}

const BILLING_CYCLES: BillingCycle[] = ["monthly", "sixMonth", "annual"];

export default function UpgradeSubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<Record<string, BillingCycle>>({});

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [packagesRes, currentRes] = await Promise.all([
          tenantApi.getAvailableSubscriptionPackages(),
          tenantApi.getCurrentSubscription(),
        ]);

        if (!mounted) return;

        const nextPackages = (packagesRes?.packages || []) as SubscriptionPackage[];
        setPackages(nextPackages);
        setCurrentSubscription((currentRes?.subscription || null) as CurrentSubscription | null);

        const defaults: Record<string, BillingCycle> = {};
        nextPackages.forEach((pkg) => {
          defaults[pkg.id] = "monthly";
        });
        setSelectedBillingCycle(defaults);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || (locale === "ar" ? "تعذر تحميل الباقات" : "Failed to load packages"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [locale]);

  const getPrice = (pkg: SubscriptionPackage, cycle: BillingCycle) => {
    if (cycle === "annual") return Number(pkg.annualPrice || 0);
    if (cycle === "sixMonth") return Number(pkg.sixMonthPrice || 0);
    return Number(pkg.monthlyPrice || 0);
  };

  const submitChange = async (pkg: SubscriptionPackage) => {
    const billingCycle = selectedBillingCycle[pkg.id] || "monthly";
    const requestKey = `${pkg.id}:${billingCycle}`;

    try {
      setSubmitting(requestKey);
      const response = await tenantApi.requestSubscriptionChange(pkg.id, billingCycle);
      if (response?.paymentToken) {
        router.push(`/${locale}/payment?token=${encodeURIComponent(response.paymentToken)}`);
        return;
      }
      setError(response?.message || "");
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر إنشاء الفاتورة" : "Failed to create invoice"));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <TenantLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
          {locale === "ar" ? "ترقية أو تجديد الاشتراك" : "Upgrade or Renew Subscription"}
        </h2>
        <p className="mt-2 text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
          {locale === "ar"
            ? "اختر الباقة المناسبة وسيتم إنشاء فاتورة دفع مباشرة."
            : "Choose the package you want and we will create a direct payment invoice."}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card flex min-h-[260px] items-center justify-center">
          <div className="spinner" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {packages.map((pkg) => {
            const billingCycle = selectedBillingCycle[pkg.id] || "monthly";
            const requestKey = `${pkg.id}:${billingCycle}`;
            const isCurrent = currentSubscription?.packageId === pkg.id;
            const packageName = locale === "ar" ? pkg.name_ar || pkg.name : pkg.name || pkg.name_ar;

            return (
              <div key={pkg.id} className={`rounded-3xl border p-6 ${isCurrent ? "border-primary bg-primary/5" : "border-gray-200 bg-white"}`}>
                <div className={`mb-4 flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div style={{ textAlign: isRTL ? "right" : "left" }}>
                    <h3 className="text-xl font-bold text-gray-900">{packageName}</h3>
                    <p className="mt-2 text-sm text-gray-500">{pkg.description || ""}</p>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      {locale === "ar" ? "الباقة الحالية" : "Current"}
                    </span>
                  )}
                </div>

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {locale === "ar" ? "دورة الفوترة" : "Billing cycle"}
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) =>
                      setSelectedBillingCycle((prev) => ({
                        ...prev,
                        [pkg.id]: e.target.value as BillingCycle,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-primary"
                  >
                    {BILLING_CYCLES.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {cycle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-6 rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">{locale === "ar" ? "السعر" : "Price"}</p>
                  <div className="mt-2 text-2xl font-bold text-gray-900">
                    <Currency amount={getPrice(pkg, billingCycle)} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {locale === "ar" ? "عمولة المنصة" : "Platform commission"}: {Number(pkg.platformCommission || 0)}%
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => submitChange(pkg)}
                  disabled={submitting === requestKey}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting === requestKey
                    ? (locale === "ar" ? "جاري إنشاء الفاتورة..." : "Creating invoice...")
                    : isCurrent
                      ? (locale === "ar" ? "تجديد هذه الباقة" : "Renew this package")
                      : (locale === "ar" ? "الترقية إلى هذه الباقة" : "Upgrade to this package")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </TenantLayout>
  );
}
