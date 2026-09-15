import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  X
} from "lucide-react";
import { tenantApiAdapter } from "../../lib/tenantApiAdapter";

type Lang = "ar" | "en";

interface BillingWorkspaceProps {
  lang: Lang;
  darkMode?: boolean;
}

type BillStatus = "paid" | "unpaid" | "pending" | "failed" | "void" | string;

function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", { year: "numeric", month: "short", day: "numeric" });
  } catch { return String(iso); }
}

function fmtAmount(amount: number | null | undefined, currency: string, lang: Lang): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "—";
  const formatted = new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return lang === "ar" ? `${formatted} ${currency || "SAR"}` : `${currency || "SAR"} ${formatted}`;
}

function getLocalized(val: any, lang: Lang): string {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (lang === "ar") return val.ar || val.name_ar || val.en || val.name_en || val.name || "—";
    if (lang === "en") return val.en || val.name_en || val.name || val.ar || val.name_ar || "—";
  }
  return String(val);
}

function StatusPill({ status, lang }: { status: BillStatus; lang: Lang }) {
  const isRtl = lang === "ar";
  const map: Record<string, { cls: string; ar: string; en: string }> = {
    paid:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", ar: "مدفوعة",          en: "Paid" },
    unpaid:  { cls: "bg-rose-50 text-rose-700 border-rose-200",         ar: "غير مدفوعة",       en: "Unpaid" },
    pending: { cls: "bg-amber-50 text-amber-700 border-amber-200",       ar: "قيد الانتظار",     en: "Pending" },
    failed:  { cls: "bg-orange-50 text-orange-700 border-orange-200",    ar: "فشل الدفع",        en: "Payment Failed" },
    void:    { cls: "bg-neutral-100 text-neutral-500 border-neutral-200", ar: "ملغاة",           en: "Void" }
  };
  const cfg = map[status?.toLowerCase()] || { cls: "bg-neutral-100 text-neutral-500 border-neutral-200", ar: status, en: status };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
      {isRtl ? cfg.ar : cfg.en}
    </span>
  );
}

/* ─── Invoice Detail Modal ───────────────────────────────── */
function InvoiceDetailModal({ bill, lang, darkMode, onClose }: { bill: any; lang: Lang; darkMode?: boolean; onClose: () => void }) {
  const isRtl = lang === "ar";
  const currency = bill.currency || "SAR";
  const totalAmount = bill.totalAmount ?? bill.amount ?? 0;
  const subtotal = bill.subtotalAmount ?? bill.amount ?? 0;
  const vat = bill.vatAmount ?? 0;
  const sellerName = getLocalized(bill.sellerSnapshot?.name || "Refah", lang);
  const buyerName = getLocalized(bill.buyerSnapshot?.name || bill.tenant?.name, lang);
  const buyerEmail = getLocalized(bill.buyerSnapshot?.email || bill.tenant?.email, lang);
  const lineItems: any[] = bill.lineItemsSnapshot || [];
  const planSnap = bill.planSnapshot || {};
  const billingPeriod = getLocalized(planSnap.billingCycleLabel || bill.subscription?.billingCycle, lang);
  const periodStart = planSnap.currentPeriodStart || bill.subscription?.currentPeriodStart || null;
  const periodEnd = planSnap.currentPeriodEnd || bill.subscription?.currentPeriodEnd || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`relative w-full max-w-xl rounded-2xl shadow-2xl p-6 ${darkMode ? "bg-zinc-900 text-zinc-100" : "bg-white text-neutral-900"} max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-0.5">{sellerName}</p>
            <h2 className="text-lg font-extrabold">{isRtl ? "تفاصيل الفاتورة" : "Invoice Details"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-all"><X size={18} /></button>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mb-5 pb-4 border-b border-neutral-100 dark:border-zinc-800">
          {[
            { label: isRtl ? "رقم الفاتورة" : "Invoice Number", value: bill.billNumber || bill.id },
            { label: isRtl ? "حالة الدفع" : "Payment Status", value: <StatusPill status={bill.status} lang={lang} /> },
            { label: isRtl ? "تاريخ الإصدار" : "Issue Date", value: fmtDate(bill.invoiceIssuedAt || bill.createdAt, lang) },
            { label: isRtl ? "تاريخ الاستحقاق" : "Due Date", value: fmtDate(bill.dueDate, lang) },
            { label: isRtl ? "العميل" : "Customer", value: buyerName },
            { label: isRtl ? "البريد الإلكتروني" : "Email", value: buyerEmail },
            { label: isRtl ? "فترة الفوترة" : "Billing Period", value: billingPeriod },
            ...(periodStart && periodEnd ? [{ label: isRtl ? "الفترة" : "Period", value: `${fmtDate(periodStart, lang)} – ${fmtDate(periodEnd, lang)}` }] : [])
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-neutral-400 font-semibold">{label}</p>
              <p className="font-bold mt-0.5">{value as any}</p>
            </div>
          ))}
        </div>

        {/* Line Items */}
        {lineItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">{isRtl ? "البنود" : "Line Items"}</p>
            <div className="space-y-1.5">
              {lineItems.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs py-1.5 border-b border-neutral-50 dark:border-zinc-800">
                  <span className="text-neutral-600 dark:text-zinc-400">{getLocalized(item.description || item.description_ar, lang)}</span>
                  <span className="font-semibold">{fmtAmount(item.amount, currency, lang)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className={`rounded-xl p-4 ${darkMode ? "bg-zinc-800" : "bg-neutral-50 border border-neutral-100"}`}>
          {[
            { label: isRtl ? "المبلغ قبل الضريبة" : "Subtotal", value: fmtAmount(subtotal, currency, lang) },
            { label: isRtl ? `ضريبة القيمة المضافة (${(bill.vatRate ?? 0) * 100}%)` : `VAT (${(bill.vatRate ?? 0) * 100}%)`, value: fmtAmount(vat, currency, lang) }
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-xs py-1 text-neutral-500">
              <span>{label}</span><span>{value}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-extrabold pt-2 mt-1 border-t border-neutral-200 dark:border-zinc-700">
            <span>{isRtl ? "الإجمالي" : "Total"}</span>
            <span>{fmtAmount(totalAmount, currency, lang)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main BillingWorkspace ────────────────────────────────── */
export default function BillingWorkspace({ lang, darkMode }: BillingWorkspaceProps) {
  const isRtl = lang === "ar";
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingBill, setViewingBill] = useState<any | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await tenantApiAdapter.getTenantBills();
      setBills((res?.bills || res?.data || []).filter((b: any) => b?.status !== "void"));
    } catch {
      setError(isRtl ? "فشل تحميل الفواتير" : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [isRtl]);

  useEffect(() => { loadBills(); }, [loadBills]);

  const isPayable = (status: string) => ["unpaid", "pending", "failed"].includes(status?.toLowerCase());

  const handlePay = useCallback(async (bill: any) => {
    setPayingId(bill.id);
    try {
      if (bill.paymentToken) {
        window.location.href = `/${lang}/payment?token=${bill.paymentToken}`;
        return;
      }
      // Fetch fresh bill to get token
      const res = await tenantApiAdapter.getBillDetails(bill.id);
      const freshBill = res?.bill || res;
      if (freshBill?.paymentToken) {
        window.location.href = `/${lang}/payment?token=${freshBill.paymentToken}`;
      } else {
        // fallback — request renewal to generate token
        const sub = bill.subscription;
        if (sub?.package?.id) {
          const change = await tenantApiAdapter.requestSubscriptionChange({ packageId: sub.package.id, billingCycle: sub.billingCycle || "monthly" });
          if (change?.paymentUrl) { window.location.href = change.paymentUrl; return; }
        }
      }
    } catch { /* silent */ } finally {
      setPayingId(null);
    }
  }, [lang]);

  const handleDownload = useCallback(async (bill: any) => {
    setDownloadingId(bill.id);
    try {
      const blob = await tenantApiAdapter.downloadInvoicePdf(bill.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = `invoice-${bill.billNumber || bill.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("Failed to download PDF", e);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const unpaid = bills.filter((b) => isPayable(b.status));
  const paid = bills.filter((b) => !isPayable(b.status));

  const cardBase = darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-neutral-100 shadow-sm";

  const renderBillRow = (bill: any) => {
    const currency = bill.currency || "SAR";
    const planName = getLocalized(bill.planSnapshot?.packageName || bill.subscription?.package?.name, lang);
    const periodStart = bill.planSnapshot?.currentPeriodStart || bill.subscription?.currentPeriodStart || null;
    const periodEnd   = bill.planSnapshot?.currentPeriodEnd   || bill.subscription?.currentPeriodEnd   || null;
    const canPay = isPayable(bill.status);
    const isDownloading = downloadingId === bill.id;
    const isPaying = payingId === bill.id;

    return (
      <div key={bill.id} className={`p-4 rounded-xl border transition-all ${darkMode ? "border-zinc-800 hover:border-zinc-700" : "border-neutral-100 hover:border-neutral-200"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-bold text-sm">{planName}</p>
            <p className="text-xs text-neutral-400 mt-0.5 font-mono">{bill.billNumber || bill.id}</p>
          </div>
          <StatusPill status={bill.status} lang={lang} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-neutral-500 mb-3">
          <div><span className="font-medium">{isRtl ? "المبلغ الإجمالي" : "Total"}</span><br /><span className="font-bold text-neutral-800 dark:text-zinc-100">{fmtAmount(bill.totalAmount ?? bill.amount, currency, lang)}</span></div>
          <div><span className="font-medium">{isRtl ? "تاريخ الإصدار" : "Issued"}</span><br /><span className="font-semibold">{fmtDate(bill.invoiceIssuedAt || bill.createdAt, lang)}</span></div>
          <div><span className="font-medium">{isRtl ? "تاريخ الاستحقاق" : "Due"}</span><br /><span className="font-semibold">{fmtDate(bill.dueDate, lang)}</span></div>
          {periodStart && periodEnd && (
            <div className="col-span-2 sm:col-span-3"><span className="font-medium">{isRtl ? "فترة الاشتراك" : "Subscription Period"}</span><br /><span className="font-semibold">{fmtDate(periodStart, lang)} – {fmtDate(periodEnd, lang)}</span></div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-50 dark:border-zinc-800">
          {/* View */}
          <button
            id={`btn-view-invoice-${bill.id}`}
            onClick={() => setViewingBill(bill)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-neutral-200 dark:border-zinc-700 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition-all"
          >
            <Eye size={13} />{isRtl ? "عرض" : "View"}
          </button>

          {/* Download */}
          <button
            id={`btn-download-invoice-${bill.id}`}
            onClick={() => handleDownload(bill)}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-neutral-200 dark:border-zinc-700 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
            {isRtl ? "تنزيل PDF" : "Download PDF"}
          </button>

          {/* Pay Now (only for payable) */}
          {canPay && (
            <button
              id={`btn-pay-invoice-${bill.id}`}
              onClick={() => handlePay(bill)}
              disabled={isPaying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all disabled:opacity-60"
            >
              {isPaying ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
              {isRtl ? "ادفع الآن" : "Pay Now"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Outstanding */}
      {unpaid.length > 0 && (
        <div className={`rounded-2xl border p-5 ${darkMode ? "bg-zinc-900 border-rose-900/40" : "bg-rose-50/30 border-rose-100"}`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-rose-600" />
            <h3 className="text-sm font-extrabold text-rose-700 dark:text-rose-400">{isRtl ? "فواتير مستحقة / تتطلب إجراء" : "Outstanding / Action Required"}</h3>
          </div>
          <div className="space-y-3">{unpaid.map(renderBillRow)}</div>
        </div>
      )}

      {/* Invoice History */}
      <div className={`rounded-2xl border p-5 ${cardBase}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-brand-600" />
            <h3 className="text-sm font-extrabold">{isRtl ? "سجل الفواتير" : "Invoice History"}</h3>
          </div>
          <button onClick={loadBills} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-all" title={isRtl ? "تحديث" : "Refresh"}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {error && <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 mb-4">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-neutral-400 gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />{isRtl ? "جارٍ التحميل..." : "Loading invoices..."}
          </div>
        ) : paid.length === 0 && unpaid.length === 0 ? (
          <p className="text-center text-sm text-neutral-400 py-8">{isRtl ? "لا توجد فواتير حتى الآن." : "No invoices yet."}</p>
        ) : paid.length === 0 ? (
          <p className="text-center text-sm text-neutral-400 py-4">{isRtl ? "لا توجد فواتير مدفوعة." : "No paid invoices yet."}</p>
        ) : (
          <div className="space-y-3">{paid.map(renderBillRow)}</div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {viewingBill && (
        <InvoiceDetailModal
          bill={viewingBill}
          lang={lang}
          darkMode={darkMode}
          onClose={() => setViewingBill(null)}
        />
      )}
    </div>
  );
}
