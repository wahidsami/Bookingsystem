"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";

type BillingCycle = "monthly" | "sixMonth" | "annual";

interface PackageLimits {
  maxBookingsPerMonth?: number;
  maxStaff?: number;
  maxServices?: number;
  maxProducts?: number;
  storageGB?: number;
}

interface SubscriptionPackage {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: number | string;
  sixMonthPrice: number | string;
  annualPrice: number | string;
  platformCommission: number | string;
  isFeatured?: boolean;
  limits: PackageLimits;
}

interface CurrentSubscription {
  id: string;
  packageId: string;
  billingCycle: BillingCycle;
  amount: number | string;
  currency: string;
  status: string;
  currentPeriodEnd: string;
  nextBillingDate?: string;
  autoRenew: boolean;
  package: SubscriptionPackage;
}

interface UsageStatsResponse {
  usage?: {
    bookings?: { current: number; limit: number; unlimited: boolean; percentage: number };
    staff?: { current: number; limit: number; unlimited: boolean; percentage: number };
    services?: { current: number; limit: number; unlimited: boolean; percentage: number };
    products?: { current: number; limit: number; unlimited: boolean; percentage: number };
  };
  subscription?: {
    daysRemaining?: number | null;
  };
}

const BILLING_CYCLES: BillingCycle[] = ["monthly", "sixMonth", "annual"];

export default function SubscriptionPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const isRTL = locale === "ar";
  const t = useTranslations("Subscription");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [usage, setUsage] = useState<UsageStatsResponse["usage"] | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<Record<string, BillingCycle>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [currentRes, packagesRes, usageRes] = await Promise.allSettled([
        tenantApi.getCurrentSubscription(),
        tenantApi.getAvailableSubscriptionPackages(),
        tenantApi.getSubscriptionUsageStats()
      ]);

      if (currentRes.status === "fulfilled" && currentRes.value?.success) {
        const subscription = currentRes.value.subscription as CurrentSubscription;
        setCurrentSubscription(subscription);
        setSelectedBillingCycle((prev) => ({
          ...prev,
          [subscription.packageId]: subscription.billingCycle || "monthly"
        }));
      }

      if (packagesRes.status === "fulfilled" && packagesRes.value?.success) {
        const nextPackages = (packagesRes.value.packages || []) as SubscriptionPackage[];
        setPackages(nextPackages);
        setSelectedBillingCycle((prev) => {
          const updated = { ...prev };
          nextPackages.forEach((pkg) => {
            if (!updated[pkg.id]) updated[pkg.id] = "monthly";
          });
          return updated;
        });
      }

      if (usageRes.status === "fulfilled" && usageRes.value?.success) {
        setUsage(usageRes.value.usage || null);
        setDaysRemaining(usageRes.value.subscription?.daysRemaining ?? null);
      }

      if (
        currentRes.status === "rejected" &&
        packagesRes.status === "rejected" &&
        usageRes.status === "rejected"
      ) {
        throw new Error(t("loadError"));
      }
    } catch (err: any) {
      console.error("Failed to load subscription data:", err);
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const getPriceForCycle = (pkg: SubscriptionPackage, cycle: BillingCycle) => {
    const raw =
      cycle === "monthly"
        ? pkg.monthlyPrice
        : cycle === "sixMonth"
          ? pkg.sixMonthPrice
          : pkg.annualPrice;

    return Number(raw || 0);
  };

  const formatBillingCycle = (cycle: BillingCycle) => {
    switch (cycle) {
      case "monthly":
        return t("monthly");
      case "sixMonth":
        return t("sixMonth");
      case "annual":
        return t("annual");
      default:
        return cycle;
    }
  };

  const formatStatus = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    const lookup: Record<string, string> = {
      trial: t("statusTrial"),
      active: t("statusActive"),
      past_due: t("statusPastDue"),
      expired: t("statusExpired"),
      cancelled: t("statusCancelled"),
      suspended: t("statusSuspended")
    };
    return lookup[normalized] || status;
  };

  const formatLimit = (value?: number) => {
    if (value === undefined || value === null) return t("notAvailable");
    return value === -1 ? t("unlimited") : value.toString();
  };

  const requestChange = async (pkg: SubscriptionPackage) => {
    const billingCycle = selectedBillingCycle[pkg.id] || "monthly";
    const requestKey = `${pkg.id}:${billingCycle}`;

    try {
      setSubmitting(requestKey);
      setFeedback("");

      const response = await tenantApi.requestSubscriptionChange(pkg.id, billingCycle);
      setFeedback(response.message || t("requestSuccess"));
    } catch (err: any) {
      console.error("Failed to request subscription change:", err);
      setFeedback(err.message || t("requestError"));
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="spinner"></div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-start justify-between gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? "right" : "left" }}>
              {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
              {t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {feedback && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className={`mb-6 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <div style={{ textAlign: isRTL ? "right" : "left" }}>
              <p className="text-sm font-medium text-gray-500">{t("currentPlan")}</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {currentSubscription?.package?.name || t("noSubscription")}
              </h3>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {currentSubscription ? formatStatus(currentSubscription.status) : t("notAvailable")}
            </span>
          </div>

          {currentSubscription ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t("billingCycle")}</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {formatBillingCycle(currentSubscription.billingCycle)}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t("currentAmount")}</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  <Currency amount={Number(currentSubscription.amount || 0)} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t("renewalDate")}</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {currentSubscription.currentPeriodEnd
                    ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB")
                    : t("notAvailable")}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t("daysRemaining")}</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {daysRemaining ?? t("notAvailable")}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">
              {t("noSubscriptionDescription")}
            </div>
          )}

          {usage && (
            <div className="mt-8">
              <h4 className="mb-4 text-lg font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
                {t("usageOverview")}
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { key: "bookings", label: t("bookings"), value: usage.bookings },
                  { key: "staff", label: t("staff"), value: usage.staff },
                  { key: "services", label: t("services"), value: usage.services },
                  { key: "products", label: t("products"), value: usage.products }
                ].map((item) => (
                  <div key={item.key} className="rounded-2xl border border-gray-200 p-4">
                    <div className={`mb-3 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="font-semibold text-gray-900">{item.label}</span>
                      <span className="text-sm text-gray-500">
                        {item.value?.current || 0} / {item.value?.unlimited ? t("unlimited") : item.value?.limit ?? t("notAvailable")}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(item.value?.percentage || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 text-xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
            {t("billingNoticeTitle")}
          </h3>
          <div className="space-y-3 text-sm text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
            <p>{t("billingNoticeBody")}</p>
            <p>{t("billingNoticeHint")}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 card">
        <div className={`mb-6 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
          <div style={{ textAlign: isRTL ? "right" : "left" }}>
            <h3 className="text-2xl font-bold text-gray-900">{t("availablePackages")}</h3>
            <p className="mt-1 text-sm text-gray-500">{t("availablePackagesDescription")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {packages.map((pkg) => {
            const billingCycle = selectedBillingCycle[pkg.id] || "monthly";
            const price = getPriceForCycle(pkg, billingCycle);
            const isCurrent = currentSubscription?.packageId === pkg.id;
            const submitKey = `${pkg.id}:${billingCycle}`;

            return (
              <div
                key={pkg.id}
                className={`rounded-3xl border p-6 transition-shadow hover:shadow-lg ${
                  isCurrent ? "border-primary bg-primary/5" : "border-gray-200 bg-white"
                }`}
              >
                <div className={`mb-4 flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div style={{ textAlign: isRTL ? "right" : "left" }}>
                    <h4 className="text-xl font-bold text-gray-900">{pkg.name}</h4>
                    <p className="mt-2 text-sm text-gray-500">{pkg.description || t("noDescription")}</p>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      {t("current")}
                    </span>
                  )}
                </div>

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-medium text-gray-700">{t("billingCycle")}</label>
                  <select
                    value={billingCycle}
                    onChange={(e) =>
                      setSelectedBillingCycle((prev) => ({
                        ...prev,
                        [pkg.id]: e.target.value as BillingCycle
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-primary"
                  >
                    {BILLING_CYCLES.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {formatBillingCycle(cycle)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-5 rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">{t("price")}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    <Currency amount={price} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {t("commission")}: {Number(pkg.platformCommission || 0)}%
                  </p>
                </div>

                <ul className="mb-6 space-y-2 text-sm text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
                  <li>{t("bookings")}: {formatLimit(pkg.limits?.maxBookingsPerMonth)}</li>
                  <li>{t("staff")}: {formatLimit(pkg.limits?.maxStaff)}</li>
                  <li>{t("services")}: {formatLimit(pkg.limits?.maxServices)}</li>
                  <li>{t("products")}: {formatLimit(pkg.limits?.maxProducts)}</li>
                </ul>

                <button
                  type="button"
                  onClick={() => requestChange(pkg)}
                  disabled={submitting === submitKey}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    isCurrent
                      ? "bg-white text-primary border border-primary hover:bg-primary/5"
                      : "bg-primary text-white hover:bg-primary/90"
                  } disabled:opacity-60`}
                >
                  {submitting === submitKey
                    ? t("sendingRequest")
                    : isCurrent
                      ? t("requestRenewal")
                      : t("requestUpgrade")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </TenantLayout>
  );
}
