"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import { getImageUrl, tenantApi } from "@/lib/api";

export interface AppointmentItem {
  id: string;
  bookingNumber?: string | null;
  bookingReference?: string | null;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "checked_in" | "in_service" | "completed" | "cancelled" | "no_show";
  paymentStatus: "pending" | "deposit_paid" | "fully_paid" | "paid" | "refunded" | "partially_refunded";
  paymentMethod?: string | null;
  price: number;
  rawPrice?: number;
  taxAmount?: number;
  platformFee?: number;
  tenantRevenue?: number;
  employeeCommission?: number;
  remainderAmount?: number;
  notes?: string;
  serviceVariantId?: string | null;
  serviceVariantName?: string | null;
  serviceVariantDescription?: string | null;
  serviceVariantDuration?: number | null;
  service: {
    id: string;
    name_en: string;
    name_ar: string;
    duration: number;
  };
  staff: {
    id: string;
    name: string;
    photo?: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    photo?: string;
    profileImage?: string | null;
  };
  createdAt?: string;
}

interface CustomerAppointmentHistoryItem {
  id: string;
  service?: {
    id?: string;
    name_en?: string;
    name_ar?: string;
  };
  staff?: {
    id?: string;
    name?: string;
    photo?: string | null;
  };
  date: string;
  endTime?: string | null;
  status: AppointmentItem["status"];
  paymentStatus: AppointmentItem["paymentStatus"];
  paymentMethod?: string | null;
  price?: number;
  notes?: string;
  bookingReference?: string | null;
  serviceVariantName?: string | null;
  serviceVariantDuration?: number | null;
}

interface CustomerOrderHistoryItem {
  id: string;
  orderNumber?: string;
  items?: Array<{
    id?: string;
    quantity?: number;
    productName?: string;
    productNameAr?: string;
    productImage?: string | null;
  }>;
  status: string;
  paymentStatus: string;
  totalAmount?: number;
  deliveryType?: string | null;
  shippingAddress?: string | null;
  trackingNumber?: string | null;
  date: string;
  expectedDeliveryDate?: string | null;
}

interface CustomerTransactionRecord {
  id: string;
  source: 'transaction' | 'ledger';
  entityType: 'appointment' | 'order';
  entityId: string | null;
  reference: string;
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  paymentMethod: string | null;
  paymentMethodLabel: string;
  transactionRef: string | null;
  notes: string | null;
  processedAt: string;
  processorName: string | null;
  detailPath: string | null;
}

interface CustomerTransactionsSummary {
  totalTransactions: number;
  completedTotal: number;
  refundedTotal: number;
  netTotal: number;
  appointmentCount: number;
  orderCount: number;
}

interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileImage?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  preferredLanguage?: string;
  joinedAt?: string;
  totalBookings?: number;
  totalOrders?: number;
  completedBookings?: number;
  totalSpent?: number;
  averageBookingValue?: number;
  firstVisit?: string | null;
  lastVisit?: string | null;
  noShowCount?: number;
  cancellationCount?: number;
  favoriteServices?: { name: string; count: number }[];
  favoriteProducts?: { name: string; count: number }[];
  preferredStaff?: { name: string; count: number }[];
  preferredTime?: string;
  preferredDeliveryType?: string;
  loyaltyTier?: string;
  loyaltyPoints?: number;
  tags?: string[];
  notes?: string;
  customerType?: "service_only" | "product_only" | "both";
  allAppointments?: CustomerAppointmentHistoryItem[];
  allOrders?: CustomerOrderHistoryItem[];
  recentAppointments?: CustomerAppointmentHistoryItem[];
  recentOrders?: CustomerOrderHistoryItem[];
}

interface AppointmentDetailsDrawerProps {
  open: boolean;
  appointmentId: string | null;
  locale: string;
  isRTL: boolean;
  onClose: () => void;
  onRebook: (appointment: AppointmentItem) => void;
}

function avatarUrl(path: string | undefined | null): string {
  if (!path) return "";
  return path.startsWith("http") ? path : getImageUrl(path.startsWith("/") ? path.slice(1) : path);
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  return date.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusLabel(status: string, locale: string) {
  switch (status) {
    case "pending":
      return locale === "ar" ? "قيد الانتظار" : "Pending";
    case "confirmed":
      return locale === "ar" ? "مؤكد" : "Confirmed";
    case "checked_in":
      return locale === "ar" ? "تم الحضور" : "Checked in";
    case "in_service":
      return locale === "ar" ? "قيد التنفيذ" : "In service";
    case "completed":
      return locale === "ar" ? "مكتمل" : "Completed";
    case "cancelled":
      return locale === "ar" ? "ملغي" : "Cancelled";
    case "no_show":
      return locale === "ar" ? "لم يحضر" : "No show";
    default:
      return status;
  }
}

function getPaymentStatusLabel(status: string, locale: string) {
  switch (status) {
    case "pending":
      return locale === "ar" ? "بانتظار الدفع" : "Payment pending";
    case "deposit_paid":
      return locale === "ar" ? "مدفوع عربون" : "Deposit paid";
    case "fully_paid":
    case "paid":
      return locale === "ar" ? "مدفوع بالكامل" : "Paid";
    case "refunded":
      return locale === "ar" ? "مسترد" : "Refunded";
    case "partially_refunded":
      return locale === "ar" ? "مسترد جزئياً" : "Partially refunded";
    default:
      return status;
  }
}

export function AppointmentDetailsDrawer({
  open,
  appointmentId,
  locale,
  isRTL,
  onClose,
  onRebook
}: AppointmentDetailsDrawerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [appointment, setAppointment] = useState<AppointmentItem | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerTransactions, setCustomerTransactions] = useState<CustomerTransactionRecord[]>([]);
  const [customerTransactionsSummary, setCustomerTransactionsSummary] = useState<CustomerTransactionsSummary | null>(null);
  const [customerTransactionsLoading, setCustomerTransactionsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"appointment" | "customer">("appointment");
  const [customerTab, setCustomerTab] = useState<"overview" | "appointments" | "transactions">("overview");

  useEffect(() => {
    if (!open || !appointmentId) {
      setAppointment(null);
      setCustomerProfile(null);
      setCustomerTransactions([]);
      setCustomerTransactionsSummary(null);
      setCustomerTransactionsLoading(false);
      setViewMode("appointment");
      setCustomerTab("overview");
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadAppointment = async () => {
      try {
        setLoading(true);
        setError("");
        setCustomerProfile(null);
        setCustomerTransactions([]);
        setCustomerTransactionsSummary(null);
        setCustomerTransactionsLoading(false);
        const response = await tenantApi.getAppointment(appointmentId);
        if (!cancelled) {
          if (response.success && response.appointment) {
            setAppointment(response.appointment);
          } else {
            setAppointment(null);
            setError(response.message || (locale === "ar" ? "تعذر تحميل الموعد." : "Failed to load appointment."));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Failed to load appointment drawer:", err);
          setError(err.message || (locale === "ar" ? "تعذر تحميل الموعد." : "Failed to load appointment."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAppointment();

    return () => {
      cancelled = true;
    };
  }, [open, appointmentId, locale]);

  useEffect(() => {
    if (!open || viewMode !== "customer" || !appointment?.user?.id) {
      return;
    }

    if (customerProfile?.id === appointment.user.id) {
      return;
    }

    let cancelled = false;

    const loadCustomer = async () => {
      try {
        setCustomerLoading(true);
        const response = await tenantApi.getCustomer(appointment.user!.id);
        if (!cancelled && response.success) {
          setCustomerProfile(response.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load customer profile:", err);
        }
      } finally {
        if (!cancelled) {
          setCustomerLoading(false);
        }
      }
    };

    loadCustomer();

    return () => {
      cancelled = true;
    };
  }, [open, appointment?.user?.id, viewMode, customerProfile?.id]);

  useEffect(() => {
    if (!open || viewMode !== "customer" || customerTab !== "transactions" || !appointment?.user?.id || !customerProfile) {
      return;
    }

    let cancelled = false;

    const loadTransactions = async () => {
      try {
        setCustomerTransactionsLoading(true);
        const response = await tenantApi.getCustomerTransactions(appointment.user!.id, { limit: 100 });
        if (!cancelled && response.success) {
          setCustomerTransactions(response.data?.transactions || []);
          setCustomerTransactionsSummary(response.data?.summary || null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load customer transactions:", err);
        }
      } finally {
        if (!cancelled) {
          setCustomerTransactionsLoading(false);
        }
      }
    };

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [open, viewMode, customerTab, appointment?.user?.id, customerProfile?.id]);

  const serviceName = useMemo(() => {
    if (!appointment) return "";
    return locale === "ar" ? appointment.service.name_ar : appointment.service.name_en;
  }, [appointment, locale]);

  const customerFullName = useMemo(() => {
    if (!customerProfile) return "";
    return `${customerProfile.firstName} ${customerProfile.lastName}`.trim();
  }, [customerProfile]);

  const customerAppointments = useMemo(() => {
    return customerProfile?.allAppointments || customerProfile?.recentAppointments || [];
  }, [customerProfile]);

  const handleReschedule = () => {
    if (!appointment) return;
    onClose();
    router.push(`/${locale}/dashboard/appointments/${appointment.id}?reschedule=1`);
  };

  const handleRebook = () => {
    if (!appointment) return;
    onRebook(appointment);
  };

  if (!open) {
    return null;
  }

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "إجمالي الحجوزات" : "Total bookings"}
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{customerProfile?.totalBookings ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "إجمالي المدفوع" : "Total spent"}
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            <Currency amount={Number(customerProfile?.totalSpent || 0)} />
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "أول زيارة" : "First visit"}
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {customerProfile?.firstVisit ? formatDateTime(customerProfile.firstVisit, locale) : "-"}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "آخر زيارة" : "Last visit"}
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {customerProfile?.lastVisit ? formatDateTime(customerProfile.lastVisit, locale) : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "البريد الإلكتروني" : "Email"}
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-gray-900">{customerProfile?.email || "-"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "الهاتف" : "Phone"}
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-900">{customerProfile?.phone || "-"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "النوع" : "Gender"}
          </p>
          <p className="mt-2 text-sm font-semibold capitalize text-gray-900">{customerProfile?.gender || "-"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "اللغة المفضلة" : "Preferred language"}
          </p>
          <p className="mt-2 text-sm font-semibold capitalize text-gray-900">{customerProfile?.preferredLanguage || "-"}</p>
        </div>
      </div>

      {(customerProfile?.notes || (customerProfile?.tags && customerProfile.tags.length > 0)) && (
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {locale === "ar" ? "ملاحظات" : "Notes"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {customerProfile?.notes || (locale === "ar" ? "لا توجد ملاحظات." : "No notes yet.")}
          </p>
          {customerProfile?.tags && customerProfile.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {customerProfile.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderAppointments = () => (
    <div className="space-y-3">
      {customerAppointments.length > 0 ? customerAppointments.map((item) => (
        <div key={item.id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {locale === "ar" ? "موعد" : "Appointment"}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {getStatusLabel(item.status, locale)}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {getPaymentStatusLabel(item.paymentStatus, locale)}
                </span>
              </div>
              <h5 className="text-base font-bold text-gray-900">
                {locale === "ar"
                  ? item.service?.name_ar || item.service?.name_en || "-"
                  : item.service?.name_en || item.service?.name_ar || "-"}
              </h5>
              <p className="text-sm text-gray-500">
                {formatDateTime(item.date, locale)}
                {item.endTime ? ` → ${formatDateTime(item.endTime, locale)}` : ""}
              </p>
              <p className="text-sm text-gray-600">{item.staff?.name || "-"}</p>
              {item.serviceVariantName && (
                <p className="text-sm text-gray-600">
                  {locale === "ar" ? "النوع" : "Variant"}: {item.serviceVariantName}
                </p>
              )}
            </div>
            <div className="text-right">
              <Currency amount={Number(item.price || 0)} className="text-lg font-bold text-gray-900" />
            </div>
          </div>
        </div>
      )) : (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          {locale === "ar" ? "لا توجد مواعيد متاحة." : "No appointments available."}
        </div>
      )}
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-3">
      {customerTransactionsLoading ? (
        <div className="flex items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : customerTransactions.length > 0 ? (
        <>
          {customerTransactionsSummary && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {locale === "ar" ? "عدد العمليات" : "Transactions"}
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{customerTransactionsSummary.totalTransactions}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {locale === "ar" ? "مدفوع" : "Completed"}
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  <Currency amount={customerTransactionsSummary.completedTotal} />
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {locale === "ar" ? "مسترد" : "Refunded"}
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  <Currency amount={customerTransactionsSummary.refundedTotal} />
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {locale === "ar" ? "الصافي" : "Net"}
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  <Currency amount={customerTransactionsSummary.netTotal} />
                </p>
              </div>
            </div>
          )}
          {customerTransactions.map((item) => (
            <div key={`${item.source}-${item.id}`} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {item.source === "ledger" ? (locale === "ar" ? "سجل الدفع" : "Ledger") : (locale === "ar" ? "عملية مالية" : "Transaction")}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {item.entityType === "appointment"
                        ? (locale === "ar" ? "حجز خدمة" : "Service")
                        : (locale === "ar" ? "طلب" : "Order")}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {getPaymentStatusLabel(item.status, locale)}
                    </span>
                  </div>
                  <h5 className="text-base font-bold text-gray-900">{item.title}</h5>
                  {item.subtitle && <p className="text-sm text-gray-600">{item.subtitle}</p>}
                  <p className="text-sm text-gray-500">{formatDateTime(item.processedAt, locale)}</p>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
                    {locale === "ar" ? "الطريقة" : "Method"}: {item.paymentMethodLabel}
                  </p>
                  {item.transactionRef && (
                    <p className="text-xs text-gray-500">
                      {locale === "ar" ? "المرجع" : "Ref"}: {item.transactionRef}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <Currency amount={Number(item.amount || 0)} className="text-lg font-bold text-gray-900" />
                </div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          {locale === "ar" ? "لا توجد معاملات متاحة." : "No transactions available."}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" onClick={onClose} />

      <aside
        className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-[56rem] bg-white shadow-2xl`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                {viewMode === "customer"
                  ? (locale === "ar" ? "مساحة العميل" : "Customer workspace")
                  : (locale === "ar" ? "تفاصيل الموعد" : "Appointment Details")}
              </p>
              <h3 className="mt-1 text-xl font-bold text-gray-900">
                {loading
                  ? (locale === "ar" ? "جارٍ التحميل..." : "Loading...")
                  : viewMode === "customer"
                    ? (customerFullName || serviceName)
                    : serviceName}
              </h3>
              {appointment && (
                <p className="mt-1 text-sm text-gray-500">
                  {appointment.bookingNumber || appointment.bookingReference || appointment.id.slice(0, 8).toUpperCase()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 10-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : appointment ? (
              <div className="space-y-4">
                {viewMode === "appointment" ? (
                  <>
                    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                          {getStatusLabel(appointment.status, locale)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                          {getPaymentStatusLabel(appointment.paymentStatus, locale)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {locale === "ar" ? "الوقت" : "Time"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {formatDateTime(appointment.startTime, locale)} → {formatDateTime(appointment.endTime, locale)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {locale === "ar" ? "الخدمة" : "Service"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{serviceName}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {locale === "ar" ? "الموظف" : "Employee"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{appointment.staff.name}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {locale === "ar" ? "السعر" : "Price"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            <Currency amount={Number(appointment.price || 0)} />
                          </p>
                        </div>
                      </div>
                    </div>

                    {appointment.user ? (
                      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className={`flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-gray-200">
                              {(appointment.user.photo || appointment.user.profileImage) ? (
                                <img
                                  src={avatarUrl(appointment.user.photo || appointment.user.profileImage || undefined)}
                                  alt={`${appointment.user.firstName} ${appointment.user.lastName}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                `${appointment.user.firstName?.[0] || ""}${appointment.user.lastName?.[0] || ""}`.toUpperCase() || "?"
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {appointment.user.firstName} {appointment.user.lastName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {locale === "ar" ? "عرض بيانات العميل في نفس اللوحة" : "View customer data in this drawer"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerTab("overview");
                              setViewMode("customer");
                            }}
                            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90"
                          >
                            {locale === "ar" ? "فتح الملف" : "Open profile"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {appointment.notes && (
                      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          {locale === "ar" ? "ملاحظات" : "Notes"}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{appointment.notes}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={handleRebook}
                        className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                      >
                        {locale === "ar" ? "إعادة الحجز" : "Rebook"}
                      </button>
                      <button
                        type="button"
                        onClick={handleReschedule}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                      >
                        {locale === "ar" ? "إعادة الجدولة" : "Reschedule"}
                      </button>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">
                          {locale === "ar" ? "فتح الصفحة الكاملة" : "Open full page"}
                        </p>
                        <Link
                          href={`/${locale}/dashboard/appointments/${appointment.id}`}
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-100"
                          onClick={onClose}
                        >
                          {locale === "ar" ? "عرض" : "View"}
                        </Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                      <div className={`flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <button
                          type="button"
                          onClick={() => setViewMode("appointment")}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          {locale === "ar" ? "رجوع" : "Back"}
                        </button>
                        <div className={`${isRTL ? "text-right" : "text-left"}`}>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                            {locale === "ar" ? "مساحة العميل" : "Customer workspace"}
                          </p>
                          <h4 className="mt-1 text-lg font-bold text-gray-900">{customerFullName}</h4>
                        </div>
                        <div className="h-12 w-12 overflow-hidden rounded-full bg-primary/10 ring-1 ring-gray-200">
                          {customerProfile?.profileImage ? (
                            <img
                              src={avatarUrl(customerProfile.profileImage)}
                              alt={customerFullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                              {(customerProfile?.firstName?.[0] || "")}{(customerProfile?.lastName?.[0] || "")}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(["overview", "appointments", "transactions"] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setCustomerTab(tab)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                              customerTab === tab
                                ? "bg-primary text-white"
                                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {tab === "overview"
                              ? (locale === "ar" ? "نظرة عامة" : "Overview")
                              : tab === "appointments"
                                ? (locale === "ar" ? "المواعيد" : "Appointments")
                                : (locale === "ar" ? "المدفوعات" : "Transactions")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {customerLoading ? (
                      <div className="flex items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 py-16">
                        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-primary" />
                      </div>
                    ) : customerProfile ? (
                      <>
                        {customerTab === "overview" && renderOverview()}
                        {customerTab === "appointments" && renderAppointments()}
                        {customerTab === "transactions" && renderTransactions()}
                      </>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        {locale === "ar" ? "لا توجد بيانات إضافية متاحة." : "No extra customer data is available yet."}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                {locale === "ar" ? "لم يتم العثور على بيانات الموعد." : "Appointment data was not found."}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
