"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Currency } from "@/components/Currency";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";

interface PosQueueItem {
  id: string;
  entityType: "appointment" | "order";
  entityId: string;
  reference: string;
  customerName: string;
  customerPhone?: string | null;
  title: string;
  employeeName?: string | null;
  scheduledAt: string;
  status: string;
  paymentStatus: string;
  paymentIntent:
    | "pay_at_center"
    | "deposit_remainder_due"
    | "online_payment_pending"
    | "pay_on_pickup"
    | "cash_on_delivery";
  paymentMethod: string;
  paymentMethodLabel: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  detailPath: string;
}

interface PosTransaction {
  id: string;
  entityType: "appointment" | "order";
  entityId: string;
  reference: string;
  customerName: string;
  title: string;
  amount: number;
  type: "deposit" | "remainder" | "full" | "refund";
  paymentMethod: string;
  paymentMethodLabel: string;
  status: string;
  transactionRef?: string | null;
  notes?: string | null;
  processedAt: string;
  processorName?: string | null;
  detailPath?: string | null;
}

interface PosClosingSummary {
  date: string;
  grossCollected: number;
  refundsTotal: number;
  netCollected: number;
  transactionCount: number;
  totalsByMethod: Array<{
    paymentMethod: string;
    paymentMethodLabel: string;
    collected: number;
    refunded: number;
    transactionCount: number;
  }>;
  totalsBySource: {
    appointments: number;
    orders: number;
    refunds: number;
  };
  cashierBreakdown: Array<{
    processorName: string;
    transactionCount: number;
    collected: number;
  }>;
}

interface PosAlert {
  id: string;
  title: string;
  title_ar?: string;
  message: string;
  message_ar?: string;
  severity: "low" | "medium" | "high";
  detailPath?: string;
}

const todayKey = () => new Date().toISOString().split("T")[0];

const formatDateTime = (value: string, locale: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getIntentLabel = (intent: PosQueueItem["paymentIntent"], locale: string) => ({
  pay_at_center: locale === "ar" ? "دفع عند الوصول" : "Pay at center",
  deposit_remainder_due: locale === "ar" ? "متبقي بعد العربون" : "Remainder due",
  online_payment_pending: locale === "ar" ? "دفع إلكتروني لم يكتمل" : "Online payment pending",
  pay_on_pickup: locale === "ar" ? "دفع عند الاستلام" : "Pay on pickup",
  cash_on_delivery: locale === "ar" ? "الدفع عند التوصيل" : "Cash on delivery",
}[intent] || intent);

const getTransactionTypeLabel = (type: PosTransaction["type"], locale: string) => ({
  deposit: locale === "ar" ? "عربون" : "Deposit",
  remainder: locale === "ar" ? "دفعة متبقية" : "Remainder",
  full: locale === "ar" ? "دفعة كاملة" : "Full payment",
  refund: locale === "ar" ? "استرداد" : "Refund",
}[type] || type);

const normalizeCollectionMethod = (paymentMethod?: string | null) => {
  if (paymentMethod === "card_pos" || paymentMethod === "wallet" || paymentMethod === "bank_transfer" || paymentMethod === "cash") {
    return paymentMethod;
  }

  if (paymentMethod === "online" || paymentMethod === "online-full" || paymentMethod === "booking-fee") {
    return "card_pos";
  }

  return "cash";
};

const downloadBlobFile = ({ blob, filename }: { blob: Blob; filename: string }) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function TenantPosPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const isRTL = locale === "ar";

  const [queue, setQueue] = useState<PosQueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState({
    totalDueCount: 0,
    appointmentDueCount: 0,
    orderDueCount: 0,
    totalDueAmount: 0,
    checkedInDueCount: 0,
  });
  const [transactions, setTransactions] = useState<PosTransaction[]>([]);
  const [closingSummary, setClosingSummary] = useState<PosClosingSummary | null>(null);
  const [posAlerts, setPosAlerts] = useState<PosAlert[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [closingDate, setClosingDate] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<PosQueueItem | null>(null);
  const [collectionMethod, setCollectionMethod] = useState("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");

  const copy = useMemo(() => ({
    title: locale === "ar" ? "نقطة البيع / التحصيل" : "POS / Collections",
    subtitle: locale === "ar"
      ? "تابع المدفوعات المستحقة، حصّل المتبقي، وراجع ملخص الإغلاق اليومي من شاشة واحدة."
      : "Track due payments, collect balances, and review today’s closing summary from one screen.",
    searchPlaceholder: locale === "ar"
      ? "ابحث برقم الطلب، رقم الحجز، اسم العميل، أو الجوال"
      : "Search by order number, booking ID, customer name, or phone",
    dueQueue: locale === "ar" ? "قائمة التحصيل" : "Collection Queue",
    recentTransactions: locale === "ar" ? "آخر معاملات الدفع" : "Recent Transactions",
    dailyClosing: locale === "ar" ? "ملخص الإغلاق اليومي" : "Daily Closing",
    dueNow: locale === "ar" ? "مبالغ مستحقة الآن" : "Due Now",
    appointmentDues: locale === "ar" ? "حجوزات تحتاج تحصيل" : "Appointments due",
    orderDues: locale === "ar" ? "طلبات تحتاج تحصيل" : "Orders due",
    checkedInDue: locale === "ar" ? "عملاء وصلوا وباقي عليهم دفع" : "Checked-in customers with due payment",
    noQueue: locale === "ar" ? "لا توجد مبالغ مستحقة حالياً." : "No due payments right now.",
    noTransactions: locale === "ar" ? "لا توجد معاملات دفع ضمن هذا البحث." : "No payment transactions found for this search.",
    collectPayment: locale === "ar" ? "تحصيل الدفع" : "Collect Payment",
    viewDetails: locale === "ar" ? "عرض التفاصيل" : "View Details",
    paid: locale === "ar" ? "مدفوع" : "Paid",
    remaining: locale === "ar" ? "المتبقي" : "Remaining",
    total: locale === "ar" ? "الإجمالي" : "Total",
    paymentMethod: locale === "ar" ? "طريقة الدفع" : "Payment Method",
    transactionReference: locale === "ar" ? "رقم المرجع / عملية مدى" : "Transaction reference / POS ref",
    notes: locale === "ar" ? "ملاحظات التحصيل" : "Collection notes",
    cancel: locale === "ar" ? "إلغاء" : "Cancel",
    confirmCollection: locale === "ar" ? "تأكيد التحصيل" : "Confirm Collection",
    collectedBy: locale === "ar" ? "تم التحصيل بواسطة" : "Collected by",
    reference: locale === "ar" ? "المرجع" : "Reference",
    grossCollected: locale === "ar" ? "إجمالي التحصيل" : "Gross Collected",
    refunds: locale === "ar" ? "المرتجعات" : "Refunds",
    netCollected: locale === "ar" ? "صافي التحصيل" : "Net Collected",
    txnCount: locale === "ar" ? "عدد العمليات" : "Transactions",
    appointments: locale === "ar" ? "حجوزات" : "Appointments",
    orders: locale === "ar" ? "طلبات" : "Orders",
    methodBreakdown: locale === "ar" ? "حسب طريقة الدفع" : "By payment method",
    cashierBreakdown: locale === "ar" ? "حسب الكاشير / الموظف" : "By cashier / staff",
    refresh: locale === "ar" ? "تحديث" : "Refresh",
    exportClosing: locale === "ar" ? "تصدير الإغلاق CSV" : "Export Closing CSV",
    downloadReceipt: locale === "ar" ? "تحميل السند" : "Receipt PDF",
    liveAlerts: locale === "ar" ? "تنبيهات التحصيل المباشرة" : "Live Collection Alerts",
  }), [locale]);

  const loadPosData = async () => {
    setLoading(true);
    setError("");
    try {
      const [queueResponse, transactionsResponse, closingResponse, alertsResponse] = await Promise.all([
        tenantApi.getPosQueue({ search: searchQuery, limit: 100 }),
        tenantApi.getPosTransactions({
          search: searchQuery,
          startDate: closingDate,
          endDate: closingDate,
          page: 1,
          limit: 20,
        }),
        tenantApi.getPosClosingSummary({ date: closingDate }),
        tenantApi.getPosAlerts({ limit: 5 }).catch(() => null),
      ]);

      setQueue(queueResponse.queue || []);
      setQueueSummary(queueResponse.summary || {
        totalDueCount: 0,
        appointmentDueCount: 0,
        orderDueCount: 0,
        totalDueAmount: 0,
        checkedInDueCount: 0,
      });
      setTransactions(transactionsResponse.transactions || []);
      setClosingSummary(closingResponse.summary || null);
      setPosAlerts(alertsResponse?.success && Array.isArray(alertsResponse.alerts)
        ? alertsResponse.alerts
        : []);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تحميل بيانات نقطة البيع" : "Failed to load POS data"));
      setQueue([]);
      setTransactions([]);
      setClosingSummary(null);
      setPosAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (transactionId: string) => {
    setError("");
    try {
      const file = await tenantApi.downloadPosTransactionReceiptPdf(transactionId);
      downloadBlobFile(file);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تحميل سند القبض" : "Failed to download receipt"));
    }
  };

  const handleExportClosing = async () => {
    setError("");
    try {
      const file = await tenantApi.downloadPosClosingSummaryCsv({ date: closingDate });
      downloadBlobFile(file);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تصدير الإغلاق" : "Failed to export closing summary"));
    }
  };

  useEffect(() => {
    loadPosData();
  }, [searchQuery, closingDate]);

  const openCollectionModal = (item: PosQueueItem) => {
    setSelectedItem(item);
    setCollectionMethod(normalizeCollectionMethod(item.paymentMethod));
    setTransactionRef("");
    setCollectionNotes("");
  };

  const handleCollectPayment = async () => {
    if (!selectedItem) return;

    setCollecting(true);
    setError("");
    try {
      if (selectedItem.entityType === "appointment") {
        if (selectedItem.paymentStatus === "deposit_paid") {
          await tenantApi.recordRemainderPayment(selectedItem.entityId, {
            amount: selectedItem.dueAmount,
            paymentMethod: collectionMethod,
            notes: collectionNotes || undefined,
            transactionRef: transactionRef || undefined,
          });
        } else {
          await tenantApi.updatePaymentStatus(
            selectedItem.entityId,
            "fully_paid",
            collectionMethod,
            {
              transactionRef: transactionRef || undefined,
              notes: collectionNotes || undefined,
            }
          );
        }
      } else {
        await tenantApi.updateOrderPaymentStatus(selectedItem.entityId, "paid", {
          paymentMethod: collectionMethod,
          transactionRef: transactionRef || undefined,
          notes: collectionNotes || undefined,
        });
      }

      setSelectedItem(null);
      await loadPosData();
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تسجيل التحصيل" : "Failed to collect payment"));
    } finally {
      setCollecting(false);
    }
  };

  return (
    <TenantLayout>
      <div className="mb-8 animate-fade-in">
        <div className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRTL ? "md:flex-row-reverse" : ""}`}>
          <div style={{ textAlign: isRTL ? "right" : "left" }}>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
              {locale === "ar" ? "RIFAH POS" : "RIFAH POS"}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-gray-600">{copy.subtitle}</p>
          </div>
          <button onClick={loadPosData} className="btn btn-secondary">
            {copy.refresh}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {posAlerts.length > 0 && (
        <div className="mb-6 card">
          <h3 className="text-xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
            {copy.liveAlerts}
          </h3>
          <div className="mt-4 space-y-3">
            {posAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/${locale}${alert.detailPath || "/dashboard/pos"}`}
                className={`block rounded-2xl border px-4 py-3 text-sm transition-colors ${
                  alert.severity === "high"
                    ? "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                    : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                }`}
                style={{ textAlign: isRTL ? "right" : "left" }}
              >
                <p className="font-bold">
                  {locale === "ar" ? (alert.title_ar || alert.title) : alert.title}
                </p>
                <p className="mt-1 text-xs opacity-90">
                  {locale === "ar" ? (alert.message_ar || alert.message) : alert.message}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[
          { label: copy.dueNow, value: <Currency amount={queueSummary.totalDueAmount} />, color: "from-primary to-primary/80" },
          { label: copy.appointmentDues, value: queueSummary.appointmentDueCount, color: "from-sky-500 to-sky-400" },
          { label: copy.orderDues, value: queueSummary.orderDueCount, color: "from-amber-500 to-orange-400" },
          { label: copy.checkedInDue, value: queueSummary.checkedInDueCount, color: "from-rose-500 to-pink-500" },
        ].map((card) => (
          <div key={card.label} className="card overflow-hidden">
            <div className={`h-1.5 rounded-full bg-gradient-to-r ${card.color}`} />
            <p className="mt-4 text-sm font-semibold text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="card">
            <div className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${isRTL ? "md:flex-row-reverse" : ""}`}>
              <h3 className="text-xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
                {copy.dueQueue}
              </h3>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearchQuery(searchInput.trim());
                }}
                className={`flex w-full max-w-xl gap-2 ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  style={{ textAlign: isRTL ? "right" : "left" }}
                />
                <button type="submit" className="btn btn-primary">
                  {locale === "ar" ? "بحث" : "Search"}
                </button>
              </form>
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="py-10 text-center text-gray-500">
                  {locale === "ar" ? "جاري التحميل..." : "Loading..."}
                </div>
              ) : queue.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 py-10 text-center text-sm text-gray-500">
                  {copy.noQueue}
                </div>
              ) : (
                queue.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-gray-200 bg-gradient-to-r from-white to-gray-50 p-5 shadow-sm">
                    <div className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
                      <div style={{ textAlign: isRTL ? "right" : "left" }}>
                        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                            {item.entityType === "appointment"
                              ? locale === "ar" ? "حجز خدمة" : "Appointment"
                              : locale === "ar" ? "طلب منتج" : "Order"}
                          </span>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            {getIntentLabel(item.paymentIntent, locale)}
                          </span>
                        </div>
                        <h4 className="mt-3 text-lg font-bold text-gray-900">{item.customerName}</h4>
                        <p className="mt-1 text-sm text-gray-600">{item.title}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {copy.reference}: {item.reference}
                          {item.customerPhone ? ` • ${item.customerPhone}` : ""}
                          {item.employeeName ? ` • ${item.employeeName}` : ""}
                          {" • "}
                          {formatDateTime(item.scheduledAt, locale)}
                        </p>
                      </div>

                      <div className="min-w-[220px] rounded-2xl bg-white p-4 text-sm shadow-inner" style={{ textAlign: isRTL ? "right" : "left" }}>
                        <div className="flex justify-between text-gray-600" style={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <span>{copy.total}</span>
                          <span className="font-semibold text-gray-900"><Currency amount={item.totalAmount} /></span>
                        </div>
                        <div className="mt-2 flex justify-between text-gray-600" style={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <span>{copy.paid}</span>
                          <span className="font-semibold text-green-700"><Currency amount={item.paidAmount} /></span>
                        </div>
                        <div className="mt-2 flex justify-between border-t border-dashed border-gray-200 pt-2 text-gray-700" style={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                          <span>{copy.remaining}</span>
                          <span className="font-bold text-rose-700"><Currency amount={item.dueAmount} /></span>
                        </div>
                        <div className={`mt-4 flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <button
                            onClick={() => openCollectionModal(item)}
                            className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                          >
                            {copy.collectPayment}
                          </button>
                          <Link
                            href={`/${locale}${item.detailPath}`}
                            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            {copy.viewDetails}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${isRTL ? "sm:flex-row-reverse" : ""}`}>
              <h3 className="text-xl font-bold text-gray-900">{copy.dailyClosing}</h3>
              <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(event) => setClosingDate(event.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleExportClosing}
                  className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20"
                >
                  {copy.exportClosing}
                </button>
              </div>
            </div>

            {closingSummary ? (
              <div className="mt-5 space-y-4" style={{ textAlign: isRTL ? "right" : "left" }}>
                <div className="rounded-2xl bg-green-50 p-4">
                  <p className="text-xs font-semibold uppercase text-green-700">{copy.netCollected}</p>
                  <p className="mt-2 text-2xl font-bold text-green-900"><Currency amount={closingSummary.netCollected} /></p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">{copy.grossCollected}</p>
                    <p className="mt-2 text-lg font-bold text-gray-900"><Currency amount={closingSummary.grossCollected} /></p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">{copy.refunds}</p>
                    <p className="mt-2 text-lg font-bold text-gray-900"><Currency amount={closingSummary.refundsTotal} /></p>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 p-4 text-sm">
                  <p className="font-semibold text-gray-900">{copy.methodBreakdown}</p>
                  <div className="mt-3 space-y-2">
                    {(closingSummary.totalsByMethod || []).map((entry) => (
                      <div
                        key={entry.paymentMethod}
                        className="flex justify-between text-gray-700"
                        style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
                      >
                        <span>{entry.paymentMethodLabel}</span>
                        <span className="font-semibold"><Currency amount={entry.collected - entry.refunded} /></span>
                      </div>
                    ))}
                    {(!closingSummary.totalsByMethod || closingSummary.totalsByMethod.length === 0) && (
                      <p className="text-gray-500">{locale === "ar" ? "لا توجد معاملات اليوم." : "No transactions today."}</p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 p-4 text-sm">
                  <p className="font-semibold text-gray-900">{copy.cashierBreakdown}</p>
                  <div className="mt-3 space-y-2">
                    {(closingSummary.cashierBreakdown || []).map((entry) => (
                      <div
                        key={entry.processorName}
                        className="flex justify-between text-gray-700"
                        style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
                      >
                        <span>{entry.processorName}</span>
                        <span className="font-semibold"><Currency amount={entry.collected} /></span>
                      </div>
                    ))}
                    {(!closingSummary.cashierBreakdown || closingSummary.cashierBreakdown.length === 0) && (
                      <p className="text-gray-500">{locale === "ar" ? "لا يوجد تحصيل مسجل." : "No cashier collections recorded."}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <h3 className="text-xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
              {copy.recentTransactions}
            </h3>
            <div className="mt-5 space-y-3">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? "right" : "left" }}>
                  {copy.noTransactions}
                </p>
              ) : (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className={`flex justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div style={{ textAlign: isRTL ? "right" : "left" }}>
                        <p className="text-sm font-bold text-gray-900">{transaction.customerName}</p>
                        <p className="mt-1 text-xs text-gray-600">{transaction.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {getTransactionTypeLabel(transaction.type, locale)} • {transaction.paymentMethodLabel}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{formatDateTime(transaction.processedAt, locale)}</p>
                        {transaction.processorName && (
                          <p className="mt-1 text-xs text-gray-500">
                            {copy.collectedBy}: {transaction.processorName}
                          </p>
                        )}
                      </div>
                      <div className="text-end">
                        <p className="text-sm font-bold text-gray-900">
                          <Currency amount={transaction.amount} />
                        </p>
                        <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                          {transaction.status}
                        </span>
                        <div className={`mt-3 flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <button
                            type="button"
                            onClick={() => handleDownloadReceipt(transaction.id)}
                            className="rounded-xl border border-primary/20 bg-white px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            {copy.downloadReceipt}
                          </button>
                          {transaction.detailPath ? (
                            <Link
                              href={`/${locale}${transaction.detailPath}`}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              {copy.viewDetails}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" style={{ textAlign: isRTL ? "right" : "left" }}>
            <h3 className="text-2xl font-bold text-gray-900">{copy.collectPayment}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {selectedItem.customerName} • {selectedItem.title}
            </p>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <div className="flex justify-between text-sm text-gray-600" style={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
                <span>{copy.remaining}</span>
                <span className="text-xl font-bold text-rose-700"><Currency amount={selectedItem.dueAmount} /></span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {copy.reference}: {selectedItem.reference}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">{copy.paymentMethod}</label>
                <select
                  value={collectionMethod}
                  onChange={(event) => setCollectionMethod(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                >
                  <option value="cash">{locale === "ar" ? "نقدًا" : "Cash"}</option>
                  <option value="card_pos">{locale === "ar" ? "بطاقة / مدى" : "Card POS"}</option>
                  <option value="wallet">{locale === "ar" ? "محفظة" : "Wallet"}</option>
                  <option value="bank_transfer">{locale === "ar" ? "تحويل بنكي" : "Bank transfer"}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">{copy.transactionReference}</label>
                <input
                  value={transactionRef}
                  onChange={(event) => setTransactionRef(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">{copy.notes}</label>
                <textarea
                  value={collectionNotes}
                  onChange={(event) => setCollectionNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                />
              </div>
            </div>

            <div className={`mt-6 flex gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <button
                onClick={handleCollectPayment}
                disabled={collecting}
                className="flex-1 rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {collecting ? (locale === "ar" ? "جاري الحفظ..." : "Saving...") : copy.confirmCollection}
              </button>
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                {copy.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
