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

type QueueTab = "all" | "appointments" | "orders" | "checked_in" | "overdue";
type QueueSort = "highest_due" | "oldest_first" | "upcoming_first" | "newest_first";

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
  online_payment_pending: locale === "ar" ? "دفع إلكتروني غير مكتمل" : "Online pending",
  pay_on_pickup: locale === "ar" ? "دفع عند الاستلام" : "Pay on pickup",
  cash_on_delivery: locale === "ar" ? "الدفع عند التوصيل" : "Cash on delivery",
}[intent] || intent);

const getTransactionTypeLabel = (type: PosTransaction["type"], locale: string) => ({
  deposit: locale === "ar" ? "عربون" : "Deposit",
  remainder: locale === "ar" ? "متبقي" : "Remainder",
  full: locale === "ar" ? "كامل" : "Full",
  refund: locale === "ar" ? "استرداد" : "Refund",
}[type] || type);

const normalizeCollectionMethod = (paymentMethod?: string | null) => {
  if (paymentMethod === "card_pos" || paymentMethod === "wallet" || paymentMethod === "bank_transfer" || paymentMethod === "cash") return paymentMethod;
  if (paymentMethod === "online" || paymentMethod === "online-full" || paymentMethod === "booking-fee") return "card_pos";
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
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<QueueTab>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<QueueSort>("highest_due");
  const [showClosingDrawer, setShowClosingDrawer] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PosQueueItem | null>(null);
  const [collectionMethod, setCollectionMethod] = useState("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardInfo, setGiftCardInfo] = useState<null | {
    remainingAmount: number;
    dueAmount: number;
    maxRedeemableAmount: number;
    currency: string;
  }>(null);
  const [validatingGiftCard, setValidatingGiftCard] = useState(false);

  const copy = useMemo(() => ({
    title: locale === "ar" ? "نقطة البيع / التحصيل" : "POS / Collections",
    subtitle: locale === "ar" ? "تحصيل المدفوعات المستحقة بسرعة ووضوح تشغيلي." : "Collect payments fast with operational clarity.",
    searchPlaceholder: locale === "ar" ? "ابحث بالعميل، المرجع، الجوال..." : "Search by customer, reference, phone...",
    dueQueue: locale === "ar" ? "قائمة التحصيل" : "Collection Queue",
    recentTransactions: locale === "ar" ? "آخر المعاملات" : "Recent Transactions",
    dailyClosing: locale === "ar" ? "ملخص اليوم" : "Today's Summary",
    dueNow: locale === "ar" ? "مستحق الآن" : "Due Now",
    appointmentDues: locale === "ar" ? "حجوزات مستحقة" : "Appointments Due",
    orderDues: locale === "ar" ? "طلبات مستحقة" : "Orders Due",
    checkedInDue: locale === "ar" ? "حاضر وباقي عليه" : "Checked-In Due",
    noQueue: locale === "ar" ? "لا يوجد مستحقات حالياً." : "No payments currently due.",
    noTransactions: locale === "ar" ? "لا توجد معاملات حديثة." : "No recent transactions yet.",
    collectPayment: locale === "ar" ? "تحصيل الدفع" : "Collect Payment",
    viewDetails: locale === "ar" ? "تفاصيل" : "Details",
    paid: locale === "ar" ? "مدفوع" : "Paid",
    remaining: locale === "ar" ? "المتبقي" : "Due",
    total: locale === "ar" ? "الإجمالي" : "Total",
    paymentMethod: locale === "ar" ? "طريقة الدفع" : "Payment Method",
    transactionReference: locale === "ar" ? "مرجع العملية" : "Transaction Reference",
    notes: locale === "ar" ? "ملاحظات" : "Notes",
    cancel: locale === "ar" ? "إلغاء" : "Cancel",
    confirmCollection: locale === "ar" ? "تأكيد التحصيل" : "Confirm Collection",
    refresh: locale === "ar" ? "تحديث" : "Refresh",
    exportClosing: locale === "ar" ? "تصدير الإغلاق" : "Export Closing CSV",
    downloadReceipt: locale === "ar" ? "سند PDF" : "Receipt PDF",
    liveAlerts: locale === "ar" ? "تنبيهات تشغيلية" : "Operational Alerts",
    closingSummary: locale === "ar" ? "Closing Summary" : "Closing Summary",
    newCollection: locale === "ar" ? "تحصيل جديد" : "New Collection",
  }), [locale]);

  const loadPosData = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [queueResponse, transactionsResponse, closingResponse, alertsResponse] = await Promise.allSettled([
        tenantApi.getPosQueue({ search: searchQuery, limit: 100 }),
        tenantApi.getPosTransactions({ search: searchQuery, startDate: closingDate, endDate: closingDate, page: 1, limit: 20 }),
        tenantApi.getPosClosingSummary({ date: closingDate }),
        tenantApi.getPosAlerts({ limit: 5 }),
      ]);

      const failedSections: string[] = [];
      if (queueResponse.status === "fulfilled" && queueResponse.value?.success) {
        setQueue(queueResponse.value.queue || []);
        setQueueSummary(queueResponse.value.summary || { totalDueCount: 0, appointmentDueCount: 0, orderDueCount: 0, totalDueAmount: 0, checkedInDueCount: 0 });
      } else {
        failedSections.push(locale === "ar" ? "الطابور" : "queue");
      }
      if (transactionsResponse.status === "fulfilled" && transactionsResponse.value?.success) {
        setTransactions(transactionsResponse.value.transactions || []);
      } else {
        failedSections.push(locale === "ar" ? "المعاملات" : "transactions");
      }
      if (closingResponse.status === "fulfilled" && closingResponse.value?.success) {
        setClosingSummary(closingResponse.value.summary || null);
      } else {
        failedSections.push(locale === "ar" ? "الإغلاق" : "closing");
      }
      if (alertsResponse.status === "fulfilled" && alertsResponse.value?.success) {
        setPosAlerts(Array.isArray(alertsResponse.value.alerts) ? alertsResponse.value.alerts : []);
      } else {
        failedSections.push(locale === "ar" ? "التنبيهات" : "alerts");
      }
      if (failedSections.length > 0) {
        setNotice(locale === "ar" ? `تعذر تحميل بعض الأقسام: ${failedSections.join("، ")}` : `Some POS sections failed: ${failedSections.join(", ")}`);
      }
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تحميل بيانات POS" : "Failed to load POS data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosData();
  }, [searchQuery, closingDate]);

  const tabCounts = useMemo(() => {
    const now = Date.now();
    const overdueCount = queue.filter((x) => x.dueAmount > 0 && new Date(x.scheduledAt).getTime() < now).length;
    return {
      all: queue.length,
      appointments: queue.filter((x) => x.entityType === "appointment").length,
      orders: queue.filter((x) => x.entityType === "order").length,
      checked_in: queueSummary.checkedInDueCount || queue.filter((x) => x.status === "checked_in").length,
      overdue: overdueCount,
    };
  }, [queue, queueSummary.checkedInDueCount]);

  const filteredQueue = useMemo(() => {
    const now = Date.now();
    let list = [...queue];
    if (activeTab === "appointments") list = list.filter((x) => x.entityType === "appointment");
    if (activeTab === "orders") list = list.filter((x) => x.entityType === "order");
    if (activeTab === "checked_in") list = list.filter((x) => x.status === "checked_in");
    if (activeTab === "overdue") list = list.filter((x) => x.dueAmount > 0 && new Date(x.scheduledAt).getTime() < now);
    if (intentFilter !== "all") list = list.filter((x) => x.paymentIntent === intentFilter);
    if (statusFilter !== "all") list = list.filter((x) => x.status === statusFilter);

    if (sortBy === "highest_due") list.sort((a, b) => b.dueAmount - a.dueAmount);
    if (sortBy === "oldest_first") list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    if (sortBy === "upcoming_first") list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    if (sortBy === "newest_first") list.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    return list;
  }, [queue, activeTab, intentFilter, statusFilter, sortBy]);

  useEffect(() => {
    if (!selectedItem && filteredQueue.length > 0) {
      const first = filteredQueue[0];
      setSelectedItem(first);
      setCollectionMethod(normalizeCollectionMethod(first.paymentMethod));
    }
  }, [filteredQueue, selectedItem]);

  const openCollectionPanel = (item: PosQueueItem) => {
    setSelectedItem(item);
    setCollectionMethod(normalizeCollectionMethod(item.paymentMethod));
    setTransactionRef("");
    setCollectionNotes("");
    setGiftCardCode("");
    setGiftCardInfo(null);
  };

  const handleDownloadReceipt = async (transactionId: string) => {
    try {
      const file = await tenantApi.downloadPosTransactionReceiptPdf(transactionId);
      downloadBlobFile(file);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تحميل السند" : "Failed to download receipt"));
    }
  };

  const handleExportClosing = async () => {
    try {
      const file = await tenantApi.downloadPosClosingSummaryCsv({ date: closingDate });
      downloadBlobFile(file);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تصدير الإغلاق" : "Failed to export closing summary"));
    }
  };

  const handleValidateGiftCard = async () => {
    if (!selectedItem || !giftCardCode.trim()) return;
    setValidatingGiftCard(true);
    try {
      const response = await tenantApi.validatePosGiftCard({ code: giftCardCode.trim(), entityType: selectedItem.entityType, entityId: selectedItem.entityId });
      setGiftCardInfo(response?.data || null);
    } catch (err: any) {
      setGiftCardInfo(null);
      setError(err.message || (locale === "ar" ? "تعذر التحقق من بطاقة الهدية" : "Failed to validate gift card"));
    } finally {
      setValidatingGiftCard(false);
    }
  };

  const handleCollectPayment = async () => {
    if (!selectedItem) return;
    setCollecting(true);
    setError("");
    try {
      if (selectedItem.entityType === "appointment") {
        if (collectionMethod === "gift_card") {
          await tenantApi.redeemPosGiftCard({ code: giftCardCode.trim(), entityType: "appointment", entityId: selectedItem.entityId, amount: selectedItem.dueAmount, transactionRef: transactionRef || undefined, notes: collectionNotes || undefined });
        } else if (selectedItem.paymentStatus === "deposit_paid") {
          await tenantApi.recordRemainderPayment(selectedItem.entityId, { amount: selectedItem.dueAmount, paymentMethod: collectionMethod, notes: collectionNotes || undefined, transactionRef: transactionRef || undefined });
        } else {
          await tenantApi.updatePaymentStatus(selectedItem.entityId, "fully_paid", collectionMethod, { transactionRef: transactionRef || undefined, notes: collectionNotes || undefined });
        }
      } else {
        if (collectionMethod === "gift_card") {
          await tenantApi.redeemPosGiftCard({ code: giftCardCode.trim(), entityType: "order", entityId: selectedItem.entityId, amount: selectedItem.dueAmount, transactionRef: transactionRef || undefined, notes: collectionNotes || undefined });
        } else {
          await tenantApi.updateOrderPaymentStatus(selectedItem.entityId, "paid", { paymentMethod: collectionMethod, transactionRef: transactionRef || undefined, notes: collectionNotes || undefined });
        }
      }
      await loadPosData();
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "تعذر تسجيل التحصيل" : "Failed to collect payment"));
    } finally {
      setCollecting(false);
    }
  };

  const tabDefs: Array<{ key: QueueTab; label: string; count: number }> = [
    { key: "all", label: locale === "ar" ? "الكل" : "All", count: tabCounts.all },
    { key: "appointments", label: locale === "ar" ? "حجوزات" : "Appointments", count: tabCounts.appointments },
    { key: "orders", label: locale === "ar" ? "طلبات" : "Orders", count: tabCounts.orders },
    { key: "checked_in", label: locale === "ar" ? "حاضر" : "Checked-In", count: tabCounts.checked_in },
    { key: "overdue", label: locale === "ar" ? "متأخر" : "Overdue", count: tabCounts.overdue },
  ];

  const statusOptions = Array.from(new Set(queue.map((x) => x.status))).filter(Boolean);

  return (
    <TenantLayout>
      <div className="space-y-5" style={{ background: "#FAF8FC" }}>
        <div className="sticky top-0 z-20 rounded-2xl border border-gray-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
            <div style={{ textAlign: isRTL ? "right" : "left" }}>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">{copy.title}</h1>
              <p className="text-sm text-gray-600">{copy.subtitle}</p>
            </div>
            <div className={`flex flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
              <button className="btn btn-primary" onClick={() => filteredQueue[0] && openCollectionPanel(filteredQueue[0])}>{copy.newCollection}</button>
              <button className="btn btn-secondary" onClick={loadPosData}>{copy.refresh}</button>
              <button className="btn btn-secondary" onClick={() => setShowClosingDrawer(true)}>{copy.closingSummary}</button>
            </div>
          </div>
        </div>

        {posAlerts.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <div className={`flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <p className="font-semibold text-amber-800">
                {locale === "ar" ? (posAlerts[0].title_ar || posAlerts[0].title) : posAlerts[0].title}
              </p>
              <Link href={`/${locale}${posAlerts[0].detailPath || "/dashboard/pos"}`} className="font-semibold text-primary">
                {locale === "ar" ? "عرض التنبيهات" : "View Alerts"}
              </Link>
            </div>
            <p className="text-amber-700">{locale === "ar" ? (posAlerts[0].message_ar || posAlerts[0].message) : posAlerts[0].message}</p>
          </div>
        )}

        {(notice || error) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {error || notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">{copy.dueNow}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900"><Currency amount={queueSummary.totalDueAmount} /></p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">{copy.appointmentDues}</p><p className="mt-2 text-3xl font-bold text-gray-900">{queueSummary.appointmentDueCount}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">{copy.orderDues}</p><p className="mt-2 text-3xl font-bold text-gray-900">{queueSummary.orderDueCount}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">{copy.checkedInDue}</p><p className="mt-2 text-3xl font-bold text-gray-900">{queueSummary.checkedInDueCount}</p></div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-10">
          <div className="xl:col-span-7 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className={`mb-3 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                <h3 className="text-2xl font-bold text-gray-900">{copy.dueQueue}</h3>
                <p className="text-sm text-gray-500">{filteredQueue.length} {locale === "ar" ? "عنصر" : "active items"}</p>
              </div>

              <div className={`mb-4 flex flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                {tabDefs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activeTab === tab.key ? "bg-primary text-white" : tab.key === "overdue" ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-700"}`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearchQuery(searchInput.trim());
                }}
                className={`mb-4 grid grid-cols-1 gap-2 md:grid-cols-5 ${isRTL ? "md:[direction:rtl]" : ""}`}
              >
                <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={copy.searchPlaceholder} className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
                <select className="rounded-xl border border-gray-300 px-3 py-2 text-sm" value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)}>
                  <option value="all">{locale === "ar" ? "كل نوايا الدفع" : "All intents"}</option>
                  <option value="deposit_remainder_due">{locale === "ar" ? "متبقي بعد العربون" : "Deposit remaining"}</option>
                  <option value="pay_at_center">{locale === "ar" ? "دفع بالمركز" : "Pay at center"}</option>
                  <option value="online_payment_pending">{locale === "ar" ? "أونلاين غير مكتمل" : "Online pending"}</option>
                </select>
                <select className="rounded-xl border border-gray-300 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">{locale === "ar" ? "كل الحالات" : "All statuses"}</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select className="rounded-xl border border-gray-300 px-3 py-2 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as QueueSort)}>
                  <option value="highest_due">{locale === "ar" ? "الأعلى مستحقاً" : "Highest Due"}</option>
                  <option value="oldest_first">{locale === "ar" ? "الأقدم أولاً" : "Oldest First"}</option>
                  <option value="upcoming_first">{locale === "ar" ? "الأقرب موعداً" : "Upcoming First"}</option>
                  <option value="newest_first">{locale === "ar" ? "الأحدث أولاً" : "Newest First"}</option>
                </select>
              </form>

              <div className="space-y-3">
                {loading ? <p className="py-8 text-center text-gray-500">{locale === "ar" ? "جاري التحميل..." : "Loading..."}</p> : null}
                {!loading && filteredQueue.length === 0 ? <p className="rounded-2xl bg-gray-50 py-8 text-center text-gray-500">{copy.noQueue}</p> : null}
                {!loading && filteredQueue.map((item) => {
                  const borderColor = item.entityType === "appointment" ? "border-l-primary" : "border-l-sky-500";
                  const dueLate = new Date(item.scheduledAt).getTime() < Date.now() && item.dueAmount > 0;
                  const cardBorder = dueLate ? "border-l-rose-500" : borderColor;
                  return (
                    <div key={item.id} className={`rounded-2xl border border-gray-200 border-l-4 bg-white p-4 shadow-sm ${cardBorder}`}>
                      <div className={`grid grid-cols-1 gap-3 lg:grid-cols-12 ${isRTL ? "lg:[direction:rtl]" : ""}`}>
                        <div className="lg:col-span-4">
                          <div className={`mb-1 flex flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{item.entityType === "appointment" ? (locale === "ar" ? "حجز" : "Appointment") : (locale === "ar" ? "طلب" : "Order")}</span>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{getIntentLabel(item.paymentIntent, locale)}</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900">{item.customerName}</p>
                          <p className="text-sm text-gray-600">{item.customerPhone || "-"}</p>
                        </div>
                        <div className="lg:col-span-4 text-sm text-gray-600">
                          <p className="font-semibold text-gray-900">{item.title}</p>
                          <p>{item.reference}</p>
                          <p>{formatDateTime(item.scheduledAt, locale)}</p>
                          <p>{item.employeeName || "-"}</p>
                        </div>
                        <div className="lg:col-span-2">
                          <p className="text-xs text-gray-500">{copy.total}</p>
                          <p className="font-semibold"><Currency amount={item.totalAmount} /></p>
                          <p className="mt-1 text-xs text-gray-500">{copy.paid}</p>
                          <p className="font-semibold text-green-700"><Currency amount={item.paidAmount} /></p>
                          <p className="mt-1 text-xs text-gray-500">{copy.remaining}</p>
                          <p className="text-3xl font-bold text-rose-700"><Currency amount={item.dueAmount} /></p>
                        </div>
                        <div className={`lg:col-span-2 flex flex-col gap-2 ${isRTL ? "items-start" : "items-end"}`}>
                          <button className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white" onClick={() => openCollectionPanel(item)}>{copy.collectPayment}</button>
                          <Link className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700" href={`/${locale}${item.detailPath}`}>{copy.viewDetails}</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className={`mb-3 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                <h3 className="text-2xl font-bold text-gray-900">{copy.recentTransactions}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "الوقت" : "Time"}</th>
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "العميل" : "Customer"}</th>
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "النوع" : "Type"}</th>
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "الطريقة" : "Method"}</th>
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "المبلغ" : "Amount"}</th>
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "الحالة" : "Status"}</th>
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "المرجع" : "Reference"}</th>
                      <th className="px-2 py-2 text-left">{locale === "ar" ? "إجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan={8} className="px-2 py-6 text-center text-gray-500">{copy.noTransactions}</td></tr>
                    ) : transactions.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-2 py-3">{formatDateTime(t.processedAt, locale)}</td>
                        <td className="px-2 py-3">{t.customerName}</td>
                        <td className="px-2 py-3">{getTransactionTypeLabel(t.type, locale)}</td>
                        <td className="px-2 py-3">{t.paymentMethodLabel}</td>
                        <td className="px-2 py-3"><Currency amount={t.amount} /></td>
                        <td className="px-2 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold">{t.status}</span></td>
                        <td className="px-2 py-3">{t.reference}</td>
                        <td className="px-2 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleDownloadReceipt(t.id)} className="rounded-lg border border-primary/20 px-2 py-1 text-xs font-semibold text-primary">{copy.downloadReceipt}</button>
                            {t.detailPath ? <Link href={`/${locale}${t.detailPath}`} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700">{copy.viewDetails}</Link> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 space-y-4">
            <div className="sticky top-28 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className={`mb-4 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                <h3 className="text-2xl font-bold text-gray-900">{locale === "ar" ? "تحصيل نشط" : "Active Collection"}</h3>
                {selectedItem ? <button className="text-gray-500" onClick={() => setSelectedItem(null)}>✕</button> : null}
              </div>
              {!selectedItem ? <p className="text-sm text-gray-500">{locale === "ar" ? "اختر عنصرًا من الطابور." : "Select a queue item."}</p> : (
                <div className="space-y-4 text-sm">
                  <div><p className="font-bold text-gray-900">{selectedItem.customerName}</p><p className="text-gray-600">{selectedItem.customerPhone || "-"}</p></div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="font-semibold text-gray-900">{selectedItem.title}</p>
                    <p className="text-gray-600">{formatDateTime(selectedItem.scheduledAt, locale)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-3">
                    <div className="flex justify-between"><span>{copy.total}</span><span><Currency amount={selectedItem.totalAmount} /></span></div>
                    <div className="mt-1 flex justify-between"><span>{copy.paid}</span><span className="text-green-700"><Currency amount={selectedItem.paidAmount} /></span></div>
                    <div className="mt-2 flex justify-between border-t pt-2"><span>{copy.remaining}</span><span className="text-2xl font-bold text-rose-700"><Currency amount={selectedItem.dueAmount} /></span></div>
                  </div>
                  <div>
                    <p className="mb-2 font-semibold text-gray-700">{copy.paymentMethod}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "cash", label: locale === "ar" ? "نقد" : "Cash" },
                        { key: "card_pos", label: locale === "ar" ? "بطاقة" : "Card POS" },
                        { key: "wallet", label: locale === "ar" ? "محفظة" : "Wallet" },
                        { key: "bank_transfer", label: locale === "ar" ? "تحويل" : "Bank Transfer" },
                        { key: "gift_card", label: locale === "ar" ? "هدية" : "Gift Card" },
                      ].map((m) => (
                        <button key={m.key} onClick={() => setCollectionMethod(m.key)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${collectionMethod === m.key ? "border-primary bg-primary/10 text-primary" : "border-gray-300 text-gray-700"}`}>{m.label}</button>
                      ))}
                    </div>
                  </div>
                  {collectionMethod === "gift_card" && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <div className="flex gap-2">
                        <input value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())} className="flex-1 rounded-lg border border-gray-300 px-3 py-2" placeholder={locale === "ar" ? "رمز بطاقة الهدية" : "Gift card code"} />
                        <button onClick={handleValidateGiftCard} disabled={validatingGiftCard || !giftCardCode.trim()} className="rounded-lg bg-white px-3 py-2 font-semibold text-primary border border-primary/20">{validatingGiftCard ? "..." : (locale === "ar" ? "تحقق" : "Validate")}</button>
                      </div>
                      {giftCardInfo ? <div className="mt-2 text-xs"><p>{locale === "ar" ? "الرصيد" : "Remaining"}: <Currency amount={giftCardInfo.remainingAmount} /></p><p>{locale === "ar" ? "أقصى استخدام" : "Max redeemable"}: <Currency amount={giftCardInfo.maxRedeemableAmount} /></p></div> : null}
                    </div>
                  )}
                  <input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder={copy.transactionReference} />
                  <textarea value={collectionNotes} onChange={(e) => setCollectionNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder={copy.notes} />
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {locale === "ar" ? "تغيير حالة الدفع" : "Payment Status Change"}: {selectedItem.paymentStatus} {"->"} {selectedItem.paymentStatus === "deposit_paid" ? "fully_paid" : (selectedItem.entityType === "order" ? "paid" : "fully_paid")}
                  </div>
                  <button disabled={collecting || (collectionMethod === "gift_card" && !giftCardCode.trim())} onClick={handleCollectPayment} className="w-full rounded-xl bg-gradient-to-r from-primary to-violet-500 px-4 py-3 text-base font-bold text-white disabled:opacity-60">
                    {collecting ? (locale === "ar" ? "جاري..." : "Saving...") : `${copy.confirmCollection} — ${selectedItem.dueAmount.toFixed(2)} SAR`}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className={`mb-3 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                <h3 className="text-xl font-bold text-gray-900">{copy.dailyClosing}</h3>
                <button onClick={() => setShowClosingDrawer(true)} className="text-sm font-semibold text-primary">{copy.closingSummary}</button>
              </div>
              <div className={`grid grid-cols-2 gap-3 ${isRTL ? "[direction:rtl]" : ""}`}>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{locale === "ar" ? "صافي التحصيل" : "Net Collected"}</p><p className="text-lg font-bold text-gray-900"><Currency amount={closingSummary?.netCollected || 0} /></p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{locale === "ar" ? "العمليات" : "Transactions"}</p><p className="text-lg font-bold text-gray-900">{closingSummary?.transactionCount || 0}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{locale === "ar" ? "المرتجعات" : "Refunds"}</p><p className="text-lg font-bold text-rose-700"><Currency amount={closingSummary?.refundsTotal || 0} /></p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{locale === "ar" ? "نقدي" : "Cash Collected"}</p><p className="text-lg font-bold text-gray-900"><Currency amount={(closingSummary?.totalsByMethod || []).find((x) => x.paymentMethod === "cash")?.collected || 0} /></p></div>
              </div>
            </div>
          </div>
        </div>

        {showClosingDrawer && (
          <div className="fixed inset-0 z-50 bg-black/50">
            <div className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-xl bg-white p-5 shadow-2xl`}>
              <div className={`mb-4 flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                <h3 className="text-2xl font-bold text-gray-900">{copy.closingSummary}</h3>
                <button onClick={() => setShowClosingDrawer(false)} className="text-gray-500">✕</button>
              </div>
              <div className="mb-3 flex gap-2">
                <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2" />
                <button onClick={handleExportClosing} className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">{copy.exportClosing}</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-green-50 p-3"><p className="text-xs text-green-700">{locale === "ar" ? "صافي التحصيل" : "Net Collected"}</p><p className="text-2xl font-bold text-green-900"><Currency amount={closingSummary?.netCollected || 0} /></p></div>
                <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{locale === "ar" ? "إجمالي" : "Gross"}</p><p className="font-bold"><Currency amount={closingSummary?.grossCollected || 0} /></p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{locale === "ar" ? "مرتجعات" : "Refunds"}</p><p className="font-bold"><Currency amount={closingSummary?.refundsTotal || 0} /></p></div></div>
                <div className="rounded-xl border border-gray-200 p-3"><p className="font-semibold">{locale === "ar" ? "عدد العمليات" : "Transaction Count"}: {closingSummary?.transactionCount || 0}</p></div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="mb-2 font-semibold">{locale === "ar" ? "حسب طريقة الدفع" : "Payment Methods"}</p>
                  {(closingSummary?.totalsByMethod || []).map((entry) => (
                    <div key={entry.paymentMethod} className="flex justify-between py-1"><span>{entry.paymentMethodLabel}</span><span><Currency amount={entry.collected - entry.refunded} /></span></div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="mb-2 font-semibold">{locale === "ar" ? "حسب الموظف" : "Cashier Breakdown"}</p>
                  {(closingSummary?.cashierBreakdown || []).map((entry) => (
                    <div key={entry.processorName} className="flex justify-between py-1"><span>{entry.processorName}</span><span><Currency amount={entry.collected} /></span></div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="mb-2 font-semibold">{locale === "ar" ? "المصادر" : "Totals by Source"}</p>
                  <div className="flex justify-between py-1"><span>{locale === "ar" ? "حجوزات" : "Appointments"}</span><span>{closingSummary?.totalsBySource?.appointments || 0}</span></div>
                  <div className="flex justify-between py-1"><span>{locale === "ar" ? "طلبات" : "Orders"}</span><span>{closingSummary?.totalsBySource?.orders || 0}</span></div>
                  <div className="flex justify-between py-1"><span>{locale === "ar" ? "مرتجعات" : "Refunds"}</span><span>{closingSummary?.totalsBySource?.refunds || 0}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
