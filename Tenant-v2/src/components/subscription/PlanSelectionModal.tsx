import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { tenantApiAdapter } from "../../lib/tenantApiAdapter";

type Lang = "ar" | "en";

interface PlanSelectionModalProps {
  lang: Lang;
  darkMode?: boolean;
  currentPackageId: string | undefined;
  currentBillingCycle: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const BILLING_CYCLES = [
  { key: "monthly", ar: "شهري", en: "Monthly" },
  { key: "sixMonth", ar: "كل 6 أشهر", en: "Six Months" },
  { key: "annual", ar: "سنوي", en: "Annual" }
];

function getAmount(pkg: any, cycle: string): number | null {
  const priceMap: Record<string, string> = {
    monthly: "monthlyPrice",
    sixMonth: "sixMonthPrice",
    annual: "annualPrice"
  };
  const field = priceMap[cycle] || "monthlyPrice";
  const raw = pkg?.[field] ?? pkg?.price ?? null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function fmtAmount(amount: number | null, currency: string, lang: Lang): string {
  if (amount === null) return "—";
  const n = new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return lang === "ar" ? `${n} ${currency}` : `${currency} ${n}`;
}

export default function PlanSelectionModal({ lang, darkMode, currentPackageId, currentBillingCycle, onClose, onSuccess }: PlanSelectionModalProps) {
  const isRtl = lang === "ar";
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(currentPackageId || "");
  const [selectedCycle, setSelectedCycle] = useState<string>(currentBillingCycle || "monthly");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    tenantApiAdapter.getSubscriptionPackages()
      .then((res: any) => {
        const pkgs = res?.packages || res?.data || (Array.isArray(res) ? res : []);
        setPackages(pkgs);
      })
      .catch(() => setLoadError(isRtl ? "فشل تحميل الباقات" : "Failed to load available plans"))
      .finally(() => setLoading(false));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedPackageId) { setSubmitError(isRtl ? "يرجى اختيار باقة" : "Please select a plan"); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const result = await tenantApiAdapter.requestSubscriptionChange({ packageId: selectedPackageId, billingCycle: selectedCycle });
      if (result?.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else if (result?.bill?.paymentToken) {
        window.location.href = `/${lang}/payment?token=${result.bill.paymentToken}`;
      } else {
        await onSuccess();
      }
    } catch (err: any) {
      setSubmitError(err?.message || (isRtl ? "فشل طلب تغيير الباقة" : "Plan change request failed"));
    } finally {
      setSubmitting(false);
    }
  }, [selectedPackageId, selectedCycle, lang, isRtl, onSuccess]);

  const overlay = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4";
  const panel = `relative w-full max-w-2xl rounded-2xl shadow-2xl p-6 ${darkMode ? "bg-zinc-900 text-zinc-100" : "bg-white text-neutral-900"}`;

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const selectedAmount = selectedPkg ? getAmount(selectedPkg, selectedCycle) : null;
  const currency = selectedPkg?.currency || "SAR";

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={panel}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-extrabold">{isRtl ? "ترقية / تغيير الباقة" : "Upgrade / Change Plan"}</h2>
          <button id="modal-close-btn" onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-all">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12 text-neutral-400 gap-2 text-sm">
            <Loader2 size={18} className="animate-spin" />
            {isRtl ? "جارٍ تحميل الباقات..." : "Loading plans..."}
          </div>
        )}
        {loadError && <div className="py-6 text-center text-sm text-rose-600">{loadError}</div>}

        {!loading && !loadError && (
          <>
            {/* Billing Cycle Selector */}
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{isRtl ? "دورة الفوترة" : "Billing Cycle"}</p>
              <div className="flex gap-2 flex-wrap">
                {BILLING_CYCLES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCycle(c.key)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedCycle === c.key ? "bg-brand-600 text-white border-brand-600" : "border-neutral-200 dark:border-zinc-700 text-neutral-600 dark:text-zinc-300 hover:bg-neutral-50 dark:hover:bg-zinc-800"}`}
                  >
                    {isRtl ? c.ar : c.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-64 overflow-y-auto pr-1">
              {packages.map((pkg) => {
                const amount = getAmount(pkg, selectedCycle);
                const cur = pkg.currency || "SAR";
                const isSelected = pkg.id === selectedPackageId;
                const isCurrent = pkg.id === currentPackageId;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`text-start p-4 rounded-xl border-2 transition-all ${isSelected ? "border-brand-600 bg-brand-50 dark:bg-brand-950/20" : "border-neutral-200 dark:border-zinc-700 hover:border-neutral-300 dark:hover:border-zinc-600"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm">{isRtl ? (pkg.name_ar || pkg.nameAr || pkg.name) : (pkg.name_en || pkg.nameEn || pkg.name)}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{fmtAmount(amount, cur, lang)}</p>
                      </div>
                      <div className="shrink-0">
                        {isSelected && <CheckCircle2 size={18} className="text-brand-600" />}
                        {isCurrent && !isSelected && <span className="text-[10px] font-bold bg-neutral-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-neutral-500">{isRtl ? "الحالية" : "Current"}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            {selectedPkg && (
              <div className={`p-4 rounded-xl mb-5 ${darkMode ? "bg-zinc-800" : "bg-neutral-50 border border-neutral-100"}`}>
                <p className="text-xs text-neutral-500 mb-2 font-semibold uppercase tracking-wide">{isRtl ? "ملخص الطلب" : "Order Summary"}</p>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{isRtl ? (selectedPkg.name_ar || selectedPkg.nameAr || selectedPkg.name) : (selectedPkg.name_en || selectedPkg.nameEn || selectedPkg.name)}</span>
                  <span className="font-bold">{fmtAmount(selectedAmount, currency, lang)}</span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">{BILLING_CYCLES.find(c => c.key === selectedCycle)?.[lang === "ar" ? "ar" : "en"] || selectedCycle}</p>
              </div>
            )}

            {submitError && <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{submitError}</div>}

            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold border border-neutral-200 dark:border-zinc-700 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition-all">{isRtl ? "إلغاء" : "Cancel"}</button>
              <button
                id="btn-confirm-plan-change"
                onClick={handleConfirm}
                disabled={submitting || !selectedPackageId}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? (isRtl ? "جارٍ المعالجة..." : "Processing...") : (isRtl ? "تأكيد والمتابعة للدفع" : "Confirm & Proceed to Payment")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
