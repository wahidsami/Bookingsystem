import React, { useCallback, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  Sparkles,
  XCircle
} from "lucide-react";
import { tenantApiAdapter } from "../../lib/tenantApiAdapter";
import { useTenantAuth } from "../../contexts/TenantAuthContext";
import { buildTenantPlanSummary, formatTenantPlanBillingAmount } from "../../lib/tenantSubscription";
import PlanSelectionModal from "./PlanSelectionModal";

type Lang = "ar" | "en";

interface SubscriptionWorkspaceProps {
  lang: Lang;
  darkMode?: boolean;
}

type EffectiveStatus = "active" | "expiring_soon" | "grace_period" | "expired" | string;

function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return String(iso);
  }
}

function StatusBadge({ status, lang }: { status: EffectiveStatus; lang: Lang }) {
  const isRtl = lang === "ar";
  type StatusKey = "active" | "expiring_soon" | "grace_period" | "expired";
  const cfg: Record<StatusKey, { cls: string; icon: React.ReactNode; ar: string; en: string }> = {
    active: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 size={13} />, ar: "نشط", en: "Active" },
    expiring_soon: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={13} />, ar: "ينتهي قريباً", en: "Expiring Soon" },
    grace_period: { cls: "bg-orange-50 text-orange-700 border-orange-200", icon: <AlertTriangle size={13} />, ar: "فترة السماح", en: "Grace Period" },
    expired: { cls: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle size={13} />, ar: "منتهي الصلاحية", en: "Expired" }
  };
  const resolved = cfg[status as StatusKey] ?? { cls: "bg-neutral-100 text-neutral-600 border-neutral-200", icon: <AlertCircle size={13} />, ar: status, en: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${resolved.cls}`}>
      {resolved.icon}
      {isRtl ? resolved.ar : resolved.en}
    </span>
  );
}

export default function SubscriptionWorkspace({ lang, darkMode }: SubscriptionWorkspaceProps) {
  const isRtl = lang === "ar";
  const { subscription, subscriptionUsage, packageEntitlements, tenant, tenantSettings, refreshSubscription } = useTenantAuth();

  const [renewalLoading, setRenewalLoading] = useState(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [renewalInfo, setRenewalInfo] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const planSummary = buildTenantPlanSummary({ locale: lang, tenant, tenantSettings, packageEntitlements, subscription, usageSnapshot: subscriptionUsage });

  const effectiveStatus: EffectiveStatus = (subscription as any)?.effectiveStatus || planSummary.status || "active";
  const daysRemaining: number | null = (subscription as any)?.daysRemaining ?? null;

  const handleRenew = useCallback(async () => {
    const packageId = (subscription as any)?.package?.id || (subscription as any)?.packageId;
    const billingCycle = (subscription as any)?.billingCycle || "monthly";
    if (!packageId) { setRenewalError(isRtl ? "لم يتم العثور على معرّف الباقة" : "Package ID not found"); return; }
    setRenewalLoading(true); setRenewalError(null); setRenewalInfo(null);
    try {
      const result = await tenantApiAdapter.requestSubscriptionChange({ packageId, billingCycle });
      if (result?.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else if (result?.bill?.paymentToken) {
        window.location.href = `/${lang}/payment?token=${result.bill.paymentToken}`;
      } else {
        await refreshSubscription();
        setRenewalInfo(isRtl ? "تم إنشاء فاتورة التجديد. انتقل إلى الفواتير للدفع." : "Renewal invoice created. Go to Billing & Invoices to complete payment.");
      }
    } catch (err: any) {
      setRenewalError(err?.message || (isRtl ? "فشل طلب التجديد" : "Renewal request failed"));
    } finally {
      setRenewalLoading(false);
    }
  }, [subscription, lang, isRtl, refreshSubscription]);

  const cardBase = darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-neutral-100 shadow-sm";

  const renderBanner = () => {
    if (effectiveStatus === "expired") return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm mb-5">
        <XCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
        <div>
          <p className="font-bold">{isRtl ? "انتهت صلاحية اشتراكك" : "Your subscription has expired"}</p>
          <p className="text-xs mt-1 text-rose-700">{isRtl ? `انتهى في ${fmtDate(planSummary.currentPeriodEnd, lang)}. جدّد الآن لاستعادة الوصول الكامل.` : `Expired on ${fmtDate(planSummary.currentPeriodEnd, lang)}. Renew now to restore full access.`}</p>
        </div>
      </div>
    );
    if (effectiveStatus === "grace_period") return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-sm mb-5">
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-orange-600" />
        <div>
          <p className="font-bold">{isRtl ? "أنت في فترة السماح" : "You are in a grace period"}</p>
          <p className="text-xs mt-1 text-orange-700">{isRtl ? "اشتراكك انتهى لكن لا يزال بإمكانك الوصول مؤقتاً. ادفع الآن لتفادي الانقطاع." : "Your subscription has lapsed but you still have temporary access. Pay now to avoid interruption."}</p>
        </div>
      </div>
    );
    if (effectiveStatus === "expiring_soon" && daysRemaining !== null) return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-5">
        <Clock size={18} className="shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-bold">{isRtl ? `ينتهي اشتراكك خلال ${daysRemaining} يوم` : `Subscription expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`}</p>
          <p className="text-xs mt-1 text-amber-700">{isRtl ? "جدّد الآن لضمان استمرارية الخدمة." : "Renew now to ensure uninterrupted service."}</p>
        </div>
      </div>
    );
    return null;
  };

  const billingCycleDisplay = (cycle: string | null) => {
    if (!cycle) return "—";
    if (cycle === "annual") return isRtl ? "سنوي" : "Annual";
    if (cycle === "monthly") return isRtl ? "شهري" : "Monthly";
    if (cycle === "sixMonth") return isRtl ? "كل 6 أشهر" : "Six Months";
    return cycle;
  };

  const rows = [
    { label: isRtl ? "سعر الاشتراك" : "Subscription Price", value: formatTenantPlanBillingAmount(planSummary.billingAmount, planSummary.currency, planSummary.billingCycle, lang) },
    { label: isRtl ? "دورة الفوترة" : "Billing Cycle", value: billingCycleDisplay(planSummary.billingCycle) },
    { label: isRtl ? "بداية الفترة الحالية" : "Current Period Start", value: fmtDate(planSummary.currentPeriodStart, lang) },
    { label: isRtl ? "نهاية الفترة الحالية" : "Current Period End", value: fmtDate(planSummary.currentPeriodEnd, lang) },
    ...(daysRemaining !== null && effectiveStatus !== "expired" && effectiveStatus !== "grace_period"
      ? [{ label: isRtl ? "الأيام المتبقية" : "Days Remaining", value: String(daysRemaining) }] : [])
  ];

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-6 ${cardBase}`}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 mb-5 border-b border-neutral-100 dark:border-zinc-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-1">{isRtl ? "باقة الاشتراك الحالية" : "Current Subscription Plan"}</p>
            <h2 className="text-xl font-extrabold">{isRtl ? planSummary.planNameAr : planSummary.planNameEn}</h2>
          </div>
          <StatusBadge status={effectiveStatus} lang={lang} />
        </div>

        {/* State banner */}
        {renderBanner()}

        {/* Details */}
        <div className="text-sm mb-6 space-y-0">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-2.5 border-b border-neutral-50 dark:border-zinc-800 last:border-0">
              <span className="text-neutral-500 font-medium">{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>

        {/* Feedback */}
        {renewalError && <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{renewalError}</div>}
        {renewalInfo && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">{renewalInfo}</div>}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            id="btn-renew-subscription"
            onClick={handleRenew}
            disabled={renewalLoading}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
              effectiveStatus === "expired" || effectiveStatus === "grace_period"
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-brand-600 hover:bg-brand-700 text-white"
            }`}
          >
            {renewalLoading ? <RefreshCw size={15} className="animate-spin" /> : <CreditCard size={15} />}
            {renewalLoading ? (isRtl ? "جارٍ المعالجة..." : "Processing...") : (isRtl ? "تجديد الاشتراك الحالي" : "Renew Current Subscription")}
          </button>

          <button
            id="btn-upgrade-plan"
            onClick={() => setShowUpgradeModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-neutral-200 dark:border-zinc-700 text-neutral-700 dark:text-zinc-200 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition-all"
          >
            <Sparkles size={15} className="text-brand-500" />
            {isRtl ? "ترقية / تغيير الباقة" : "Upgrade / Change Plan"}
          </button>
        </div>
      </div>

      {showUpgradeModal && (
        <PlanSelectionModal
          lang={lang}
          darkMode={darkMode}
          currentPackageId={(subscription as any)?.package?.id || (subscription as any)?.packageId}
          currentBillingCycle={(subscription as any)?.billingCycle || "monthly"}
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={async () => { setShowUpgradeModal(false); await refreshSubscription(); }}
        />
      )}
    </div>
  );
}
