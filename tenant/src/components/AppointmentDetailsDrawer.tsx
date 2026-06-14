"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Currency } from "@/components/Currency";
import { getImageUrl, tenantApi } from "@/lib/api";
import { parseGroupGuestFromNotes, sanitizeAppointmentNotes } from "@/lib/appointmentNotes";

export interface AppointmentItem {
  id: string;
  bookingNumber?: string | null;
  bookingReference?: string | null;
  bookingSessionId?: string | null;
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
  paymentTransactions?: PaymentTransaction[];
  events?: AppointmentEventItem[];
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

interface AppointmentEventItem {
  id: string;
  eventType: string;
  actorType?: string;
  actorId?: string | null;
  payload?: Record<string, any>;
  occurredAt?: string;
  createdAt?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    photo?: string | null;
  } | null;
}

interface PaymentTransaction {
  id: string;
  type: "deposit" | "remainder" | "full" | "refund";
  amount: number;
  paymentMethod: "online" | "cash" | "card_pos" | "wallet" | "bank_transfer";
  status: "pending" | "completed" | "failed" | "refunded" | "cancelled";
  transactionRef?: string | null;
  notes?: string | null;
  processedAt: string;
  processor?: {
    id: string;
    name: string;
  } | null;
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
  normalizedPaymentStatus?: AppointmentItem["paymentStatus"] | null;
  paidAmount?: number | null;
  paymentMethod?: string | null;
  price?: number;
  depositAmount?: number | null;
  remainderAmount?: number | null;
  totalPaid?: number | null;
  outstandingAmount?: number | null;
  paymentEvidenceSource?: "transaction" | "ledger" | "appointment" | "appointment_derived" | string | null;
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
  source: 'transaction' | 'ledger' | 'appointment';
  entityType: 'appointment' | 'order';
  entityId: string | null;
  reference: string;
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  normalizedPaymentStatus?: string | null;
  appointmentOutstandingAmount?: number | null;
  appointmentPaidAmount?: number | null;
  paymentEvidenceSource?: string | null;
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
  walletBalance?: number;
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
  reviews?: Array<{
    id: string;
    rating?: number | null;
    serviceName?: string | null;
    comment?: string | null;
    date?: string | null;
  }>;
}

interface AppointmentDetailsDrawerProps {
  open: boolean;
  appointmentId: string | null;
  locale: string;
  isRTL: boolean;
  onClose: () => void;
  onRebook: (appointment: AppointmentItem) => void;
  onAddService?: (appointment: AppointmentItem) => void;
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

interface WorkspacePanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

function WorkspacePanel({ title, subtitle, children, action, className = "" }: WorkspacePanelProps) {
  return (
    <section className={`rounded-3xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface MetricTileProps {
  label: string;
  value: ReactNode;
  className?: string;
}

function MetricTile({ label, value, className = "" }: MetricTileProps) {
  return (
    <div className={`rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-gray-200 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

type RescheduleAuditEntry = {
  at?: string;
  actor?: string;
  fromStartTime?: string;
  fromEndTime?: string;
  toStartTime?: string;
  toEndTime?: string;
};
type CancellationAuditEntry = {
  at?: string;
  actor?: string;
  reasonCode?: string;
  reasonText?: string;
};

const RESCHEDULE_AUDIT_MARKER = "[RESCHEDULE_AUDIT]";
const CANCELLATION_AUDIT_MARKER = "[CANCELLATION_AUDIT]";

function parseRescheduleAuditEntries(notes?: string) {
  const text = `${notes || ""}`;
  if (!text.includes(RESCHEDULE_AUDIT_MARKER)) return [] as RescheduleAuditEntry[];

  const entries: RescheduleAuditEntry[] = [];
  const regex = /\[RESCHEDULE_AUDIT\]\s*(\{.*\})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === "object") entries.push(parsed);
    } catch {
      // Ignore malformed marker payload.
    }
  }

  return entries;
}

function stripRescheduleAuditMarkers(notes?: string) {
  const text = `${notes || ""}`;
  if (!text) return "";
  return text
    .split("\n")
    .filter((line) => !line.includes(RESCHEDULE_AUDIT_MARKER))
    .join("\n")
    .trim();
}

function parseCancellationAuditEntries(notes?: string) {
  const text = `${notes || ""}`;
  if (!text.includes(CANCELLATION_AUDIT_MARKER)) return [] as CancellationAuditEntry[];

  const entries: CancellationAuditEntry[] = [];
  const regex = /\[CANCELLATION_AUDIT\]\s*(\{.*\})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === "object") entries.push(parsed);
    } catch {
      // Ignore malformed marker payload.
    }
  }

  return entries;
}

function getStatusLabel(status: string, locale: string) {
  switch (status) {
    case "pending":
      return locale === "ar" ? "محجوز" : "Booked";
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

function resolveEffectivePaymentStatus(item: {
  paymentStatus?: string | null;
  normalizedPaymentStatus?: string | null;
  price?: number | null;
  totalPaid?: number | null;
  outstandingAmount?: number | null;
  remainderAmount?: number | null;
}) {
  const normalizedStatus = `${item.normalizedPaymentStatus || ''}`.trim().toLowerCase();
  if (normalizedStatus) {
    return normalizedStatus;
  }

  const rawStatus = `${item.paymentStatus || ''}`.trim().toLowerCase();
  const price = Number(item.price || 0);
  const totalPaid = Number(item.totalPaid || 0);
  const explicitOutstanding = Number(item.outstandingAmount);
  const computedOutstanding = Number.isFinite(explicitOutstanding)
    ? explicitOutstanding
    : Math.max(0, price - totalPaid);
  const remainderAmount = Number(item.remainderAmount || 0);

  if ((rawStatus === 'fully_paid' || rawStatus === 'paid') && computedOutstanding > 0.009) {
    return 'deposit_paid';
  }

  if (rawStatus === 'deposit_paid' && computedOutstanding <= 0.009 && remainderAmount <= 0.009) {
    return 'fully_paid';
  }

  return rawStatus || 'pending';
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

function getTransactionTypeLabel(type: string, locale: string) {
  switch (type) {
    case "appointment":
    case "booking":
      return locale === "ar" ? "خدمة" : "Appointment";
    case "order":
      return locale === "ar" ? "طلب" : "Order";
    case "payment":
      return locale === "ar" ? "دفعة" : "Payment";
    case "refund":
      return locale === "ar" ? "استرداد" : "Refund";
    default:
      return type || (locale === "ar" ? "أخرى" : "Other");
  }
}

function getTransactionStatusLabel(status: string, locale: string) {
  switch (status) {
    case "completed":
    case "paid":
      return locale === "ar" ? "مكتمل" : "Completed";
    case "pending":
      return locale === "ar" ? "قيد الانتظار" : "Pending";
    case "refunded":
      return locale === "ar" ? "مسترد" : "Refunded";
    case "partially_refunded":
      return locale === "ar" ? "مسترد جزئياً" : "Partially refunded";
    case "failed":
      return locale === "ar" ? "فشل" : "Failed";
    case "cancelled":
      return locale === "ar" ? "ملغي" : "Cancelled";
    default:
      return status;
  }
}

function getTransactionStatusTone(status: string) {
  switch (status) {
    case "completed":
    case "paid":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "refunded":
    case "partially_refunded":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "failed":
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-gray-100 text-gray-700 ring-gray-200";
  }
}

export function AppointmentDetailsDrawer({
  open,
  appointmentId,
  locale,
  isRTL,
  onClose,
  onRebook,
}: AppointmentDetailsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [appointment, setAppointment] = useState<AppointmentItem | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerTransactions, setCustomerTransactions] = useState<CustomerTransactionRecord[]>([]);
  const [customerTransactionsSummary, setCustomerTransactionsSummary] = useState<CustomerTransactionsSummary | null>(null);
  const [customerTransactionsLoading, setCustomerTransactionsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"appointment" | "customer">("appointment");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [paymentUpdating, setPaymentUpdating] = useState(false);
  const [customerTab, setCustomerTab] = useState<"overview" | "appointments" | "transactions">("overview");
  const [recordRemainderMethod, setRecordRemainderMethod] = useState("cash");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"all" | "appointment" | "order" | "ledger">("all");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<"all" | "completed" | "pending" | "refunded" | "failed" | "cancelled">("all");
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const customerProfileRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !appointmentId) {
      setAppointment(null);
      setCustomerProfile(null);
      setCustomerTransactions([]);
      setCustomerTransactionsSummary(null);
      setCustomerTransactionsLoading(false);
      setViewMode("appointment");
      setPaymentUpdating(false);
      setCustomerTab("overview");
      setRecordRemainderMethod("cash");
      setTransactionTypeFilter("all");
      setTransactionStatusFilter("all");
      setExpandedTransactionId(null);
      setRescheduleOpen(false);
      setRescheduleValue("");
      setRescheduleSubmitting(false);
      setError("");
      setActionNotice(null);
      setLoading(false);
      customerProfileRequestRef.current = null;
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
      setPaymentUpdating(false);
      setExpandedTransactionId(null);
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
    const customerId = appointment?.user?.id;
    if (!open || !customerId) {
      return;
    }

    if (customerProfile?.id === customerId) {
      return;
    }

    if (customerProfileRequestRef.current === customerId) {
      return;
    }

    let cancelled = false;
    customerProfileRequestRef.current = customerId;

    const loadCustomer = async () => {
      try {
        setCustomerLoading(true);
        const [customerResult, transactionsResult] = await Promise.allSettled([
          tenantApi.getCustomer(customerId),
          tenantApi.getCustomerTransactions(customerId, { limit: 100 })
        ]);

        if (!cancelled && customerResult.status === "fulfilled" && customerResult.value.success) {
          setCustomerProfile(customerResult.value.data || null);
        }

        if (!cancelled && customerResult.status === "rejected") {
          console.error("Failed to load customer profile:", customerResult.reason);
        }

        if (!cancelled && transactionsResult.status === "fulfilled" && transactionsResult.value.success) {
          setCustomerTransactions(transactionsResult.value.data?.transactions || []);
          setCustomerTransactionsSummary(transactionsResult.value.data?.summary || null);
        }

        if (!cancelled && transactionsResult.status === "rejected") {
          console.error("Failed to load customer transactions:", transactionsResult.reason);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load customer profile:", err);
        }
      } finally {
        if (!cancelled) {
          setCustomerLoading(false);
          customerProfileRequestRef.current = null;
        }
      }
    };

    loadCustomer();

    return () => {
      cancelled = true;
      customerProfileRequestRef.current = null;
    };
  }, [open, appointment?.user?.id, customerProfile?.id]);

  useEffect(() => {
    if (!open || viewMode !== "customer" || customerTab !== "transactions" || !appointment?.user?.id || !customerProfile) {
      return;
    }

    if (customerTransactions.length > 0 && customerTransactionsSummary) {
      return;
    }

    let cancelled = false;

    const loadTransactions = async () => {
      try {
        setCustomerTransactionsLoading(true);
        setExpandedTransactionId(null);
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

  const filteredTransactions = useMemo(() => {
    return customerTransactions.filter((item) => {
      const matchesType =
        transactionTypeFilter === "all" ||
        (transactionTypeFilter === "ledger" ? item.source === "ledger" : item.entityType === transactionTypeFilter);

      const normalizedStatus = item.status?.toLowerCase?.() || "";
      const matchesStatus =
        transactionStatusFilter === "all" ||
        (transactionStatusFilter === "completed" && (normalizedStatus === "completed" || normalizedStatus === "paid")) ||
        (transactionStatusFilter === "pending" && normalizedStatus === "pending") ||
        (transactionStatusFilter === "refunded" && (normalizedStatus === "refunded" || normalizedStatus === "partially_refunded")) ||
        (transactionStatusFilter === "failed" && normalizedStatus === "failed") ||
        (transactionStatusFilter === "cancelled" && normalizedStatus === "cancelled");

      return matchesType && matchesStatus;
    });
  }, [customerTransactions, transactionStatusFilter, transactionTypeFilter]);

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

  const paymentSnapshot = useMemo(() => {
    const pendingAppointments = customerAppointments.filter((item) => {
      const paymentStatus = resolveEffectivePaymentStatus(item);
      return paymentStatus === "pending" || paymentStatus === "deposit_paid" || Number(item.outstandingAmount || 0) > 0;
    });

    const pendingOutstandingTotal = pendingAppointments.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0);
    const recordedPayments = customerTransactions.filter((item) => item.status === "completed" || item.status === "paid");
    const refundTransactions = customerTransactions.filter((item) =>
      item.type === "refund" || item.status === "refunded" || item.status === "partially_refunded"
    );
    const recordedPaymentsTotal = recordedPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const refundTotal = refundTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      pendingAppointments,
      pendingOutstandingTotal,
      recordedPayments,
      refundTransactions,
      recordedPaymentsTotal,
      refundTotal
    };
  }, [customerAppointments, customerTransactions]);

  const latestRescheduleAudit = useMemo(() => {
    if (!appointment?.notes) return null;
    const entries = parseRescheduleAuditEntries(appointment.notes);
    if (!entries.length) return null;
    return entries[entries.length - 1];
  }, [appointment?.notes]);

  const latestCancellationAudit = useMemo(() => {
    if (!appointment?.notes) return null;
    const entries = parseCancellationAuditEntries(appointment.notes);
    if (!entries.length) return null;
    return entries[entries.length - 1];
  }, [appointment?.notes]);

  const timelineAuditEntries = useMemo(() => {
    const rawEvents = Array.isArray(appointment?.events) ? appointment.events : [];
    const safeCreatedAt = appointment?.createdAt || appointment?.startTime || new Date().toISOString();
    const safeStartTime = appointment?.startTime || safeCreatedAt;
    const structuredEvents = rawEvents
      .map((event) => {
        const timestamp = event.occurredAt || event.createdAt || safeCreatedAt;
        const payload = event.payload || {};

        if (event.eventType === "tenant_status_changed") {
          return {
            label: locale === "ar" ? "تغيير الحالة" : "Status changed",
            value: locale === "ar"
              ? `${payload.fromStatus || getStatusLabel(appointment?.status || "pending", locale)} → ${payload.toStatus || getStatusLabel(appointment?.status || "pending", locale)}`
              : `${payload.fromStatus || getStatusLabel(appointment?.status || "pending", locale)} → ${payload.toStatus || getStatusLabel(appointment?.status || "pending", locale)}`,
            tone: "bg-blue-50 text-blue-700 ring-blue-200",
            timestamp
          };
        }

        if (event.eventType === "tenant_payment_status_changed") {
          return {
            label: locale === "ar" ? "تحديث الدفع" : "Payment updated",
            value: locale === "ar"
              ? `${payload.fromPaymentStatus || "pending"} → ${payload.toPaymentStatus || "pending"}`
              : `${payload.fromPaymentStatus || "pending"} → ${payload.toPaymentStatus || "pending"}`,
            tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
            timestamp
          };
        }

        if (event.eventType === "tenant_rescheduled" || event.eventType === "tenant_reassign_reschedule" || event.eventType === "customer_rescheduled") {
          return {
            label: locale === "ar" ? "إعادة الجدولة" : "Rescheduled",
            value: locale === "ar"
              ? `${formatDateTime(payload.toStartTime || timestamp, locale)}${payload.toStaffId ? ` • ${payload.toStaffId}` : ""}`
              : `${formatDateTime(payload.toStartTime || timestamp, locale)}${payload.toStaffId ? ` • ${payload.toStaffId}` : ""}`,
            tone: "bg-sky-50 text-sky-700 ring-sky-200",
            timestamp
          };
        }

        if (event.eventType === "customer_cancelled" || event.eventType === "tenant_cancelled") {
          return {
            label: locale === "ar" ? "إلغاء" : "Cancelled",
            value: locale === "ar"
              ? `${formatDateTime(timestamp, locale)}${payload.reasonText || payload.reasonCode ? ` • ${payload.reasonText || payload.reasonCode}` : ""}`
              : `${formatDateTime(timestamp, locale)}${payload.reasonText || payload.reasonCode ? ` • ${payload.reasonText || payload.reasonCode}` : ""}`,
            tone: "bg-rose-50 text-rose-700 ring-rose-200",
            timestamp
          };
        }

        return {
          label: event.eventType.replace(/_/g, " "),
          value: formatDateTime(timestamp, locale),
          tone: "bg-gray-50 text-gray-700 ring-gray-200",
          timestamp
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (structuredEvents.length > 0) {
      return structuredEvents;
    }

    const fallbackEntries = [];
    if (latestRescheduleAudit?.toStartTime) {
      fallbackEntries.push({
        label: locale === "ar" ? "إعادة الجدولة" : "Reschedule",
        value: locale === "ar"
          ? `${formatDateTime(latestRescheduleAudit.at || latestRescheduleAudit.toStartTime || safeStartTime, locale)} → ${formatDateTime(latestRescheduleAudit.toStartTime || safeStartTime, locale)}`
          : `${formatDateTime(latestRescheduleAudit.at || latestRescheduleAudit.toStartTime || safeStartTime, locale)} → ${formatDateTime(latestRescheduleAudit.toStartTime || safeStartTime, locale)}`,
        tone: "bg-sky-50 text-sky-700 ring-sky-200",
        timestamp: latestRescheduleAudit.at || latestRescheduleAudit.toStartTime || safeStartTime
      });
    }
    if (latestCancellationAudit) {
      fallbackEntries.push({
        label: locale === "ar" ? "الإلغاء" : "Cancellation",
        value: locale === "ar"
          ? `${formatDateTime(latestCancellationAudit.at || safeCreatedAt, locale)}${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode ? ` • ${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode}` : ""}`
          : `${formatDateTime(latestCancellationAudit.at || safeCreatedAt, locale)}${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode ? ` • ${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode}` : ""}`,
        tone: "bg-rose-50 text-rose-700 ring-rose-200",
        timestamp: latestCancellationAudit.at || safeCreatedAt
      });
    }

    return fallbackEntries;
  }, [appointment?.events, appointment?.createdAt, appointment?.startTime, appointment?.status, latestRescheduleAudit, latestCancellationAudit, locale]);

  const cleanAppointmentNotes = useMemo(() => {
    return sanitizeAppointmentNotes(stripRescheduleAuditMarkers(appointment?.notes));
  }, [appointment?.notes]);
  const groupGuest = useMemo(() => parseGroupGuestFromNotes(appointment?.notes), [appointment?.notes]);

  const handleReschedule = () => {
    if (!appointment) return;
    const start = new Date(appointment.startTime);
    const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}T${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    setRescheduleValue(localDate);
    setRescheduleOpen(true);
  };

  const handleRescheduleConfirm = async () => {
    if (!appointment || !rescheduleValue || rescheduleSubmitting) return;
    try {
      setRescheduleSubmitting(true);
      const response = await tenantApi.rescheduleAppointment(appointment.id, {
        startTime: new Date(rescheduleValue).toISOString(),
        staffId: appointment.staff?.id
      });

      if (!response?.success) {
        setActionNotice({
          kind: "error",
          message: response?.message || (locale === "ar" ? "تعذر إعادة الجدولة." : "Failed to reschedule.")
        });
        return;
      }

      const refreshed = await tenantApi.getAppointment(appointment.id);
      if (refreshed?.success && refreshed?.appointment) {
        setAppointment(refreshed.appointment);
      }

      setRescheduleOpen(false);
      setRescheduleValue("");
      setActionNotice({
        kind: "success",
        message: locale === "ar" ? "تمت إعادة الجدولة بنجاح." : "Rescheduled successfully."
      });
    } catch (err: any) {
      console.error("Failed to reschedule from drawer:", err);
      setActionNotice({
        kind: "error",
        message: err?.message || (locale === "ar" ? "تعذر إعادة الجدولة." : "Failed to reschedule.")
      });
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const handleRebook = () => {
    if (!appointment) return;
    onRebook(appointment);
  };

  const handleQuickStatusUpdate = async (nextStatus: AppointmentItem["status"]) => {
    if (!appointment || statusUpdating) return;
    if (nextStatus === "pending") return;
    if (nextStatus === "completed") {
      const effectivePaymentStatus = resolveEffectivePaymentStatus(appointment);
      const isPaid = effectivePaymentStatus === "fully_paid" || effectivePaymentStatus === "paid";
      if (!isPaid) {
        setActionNotice({
          kind: "error",
          message: locale === "ar"
            ? "لا يمكنك تغيير الحالة إلى مكتمل إلا بعد سداد مبلغ الحجز بالكامل."
            : "You can not change to completed unless the booking amount is paid."
        });
        return;
      }
    }
    try {
      setStatusUpdating(true);
      const response = await tenantApi.updateAppointmentStatus(appointment.id, nextStatus);
      if (response?.success && response?.appointment) {
        setAppointment((prev) => prev ? { ...prev, status: response.appointment.status } : prev);
      }
    } catch (err) {
      console.error("Failed to update appointment status from drawer:", err);
      setActionNotice({
        kind: "error",
        message: (err as any)?.message || (locale === "ar" ? "تعذر تحديث الحالة." : "Failed to update status.")
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const refreshAppointment = async () => {
    if (!appointment) return;
    const refreshed = await tenantApi.getAppointment(appointment.id);
    if (refreshed?.success && refreshed?.appointment) {
      setAppointment(refreshed.appointment);
    }
  };

  const handleMarkFullyPaid = async (paymentMethod = "cash") => {
    if (!appointment || paymentUpdating) return;
    try {
      setPaymentUpdating(true);
      const response = await tenantApi.updatePaymentStatus(appointment.id, "fully_paid", paymentMethod);
      if (!response?.success) {
        setActionNotice({
          kind: "error",
          message: response?.message || (locale === "ar" ? "تعذر تحديث الدفع." : "Failed to update payment.")
        });
        return;
      }
      await refreshAppointment();
      setActionNotice({
        kind: "success",
        message: locale === "ar" ? "تم تسجيل الموعد كمدفوع بالكامل." : "Marked as fully paid."
      });
    } catch (err: any) {
      console.error("Failed to mark appointment as fully paid:", err);
      setActionNotice({
        kind: "error",
        message: err?.message || (locale === "ar" ? "تعذر تحديث الدفع." : "Failed to update payment.")
      });
    } finally {
      setPaymentUpdating(false);
    }
  };

  const handleCollectRemainder = async () => {
    if (!appointment || paymentUpdating) return;
    const remainderAmount = Number(appointment.remainderAmount || 0);
    if (remainderAmount <= 0) return;
    try {
      setPaymentUpdating(true);
      const response = await tenantApi.recordRemainderPayment(appointment.id, {
        amount: remainderAmount,
        paymentMethod: recordRemainderMethod,
        notes: locale === "ar" ? "تم تحصيل المتبقي من داخل لوحة التفاصيل." : "Collected remainder from the details drawer."
      });
      if (!response?.success) {
        setActionNotice({
          kind: "error",
          message: response?.message || (locale === "ar" ? "تعذر تسجيل الدفعة المتبقية." : "Failed to record remainder payment.")
        });
        return;
      }
      await refreshAppointment();
      setActionNotice({
        kind: "success",
        message: locale === "ar" ? "تم تسجيل الدفعة المتبقية." : "Remainder payment recorded."
      });
    } catch (err: any) {
      console.error("Failed to record remainder payment from drawer:", err);
      setActionNotice({
        kind: "error",
        message: err?.message || (locale === "ar" ? "تعذر تسجيل الدفعة المتبقية." : "Failed to record remainder payment.")
      });
    } finally {
      setPaymentUpdating(false);
    }
  };

  const handleMarkRefunded = async () => {
    if (!appointment || paymentUpdating) return;
    try {
      setPaymentUpdating(true);
      const response = await tenantApi.updatePaymentStatus(appointment.id, "refunded", appointment.paymentMethod || undefined, {
        notes: locale === "ar" ? "تم وضع علامة مسترد من داخل لوحة التفاصيل." : "Marked refunded from the details drawer."
      });
      if (!response?.success) {
        setActionNotice({
          kind: "error",
          message: response?.message || (locale === "ar" ? "تعذر تحديث حالة الدفع إلى مسترد." : "Failed to mark payment as refunded.")
        });
        return;
      }
      await refreshAppointment();
      setActionNotice({
        kind: "success",
        message: locale === "ar" ? "تم تحديث حالة الدفع إلى مسترد." : "Payment marked as refunded."
      });
    } catch (err: any) {
      console.error("Failed to mark appointment as refunded:", err);
      setActionNotice({
        kind: "error",
        message: err?.message || (locale === "ar" ? "تعذر تحديث حالة الدفع إلى مسترد." : "Failed to mark payment as refunded.")
      });
    } finally {
      setPaymentUpdating(false);
    }
  };

  const getManualStatusOptions = (currentStatus: AppointmentItem["status"]) => {
    const options: Array<{ value: AppointmentItem["status"]; label: string }> = [];
    const push = (value: AppointmentItem["status"], label: string) => {
      if (!options.some((option) => option.value === value)) {
        options.push({ value, label });
      }
    };

    push("pending", locale === "ar" ? "محجوز" : "Booked");
    push("confirmed", locale === "ar" ? "مؤكد" : "Confirmed");
    push("checked_in", locale === "ar" ? "تم الوصول" : "Arrived");
    push("in_service", locale === "ar" ? "بدأت الخدمة" : "Started");
    push("completed", locale === "ar" ? "مكتمل" : "Completed");
    push("no_show", locale === "ar" ? "عدم حضور" : "No-show");
    push("cancelled", locale === "ar" ? "ملغي" : "Cancelled");

    if (["completed", "cancelled", "no_show"].includes(currentStatus)) {
      return options.filter((option) => option.value === currentStatus);
    }

    return options;
  };

  const renderAppointmentWorkspace = () => {
    if (!appointment) return null;

    const currentPaymentStatus = resolveEffectivePaymentStatus(appointment);
    const currentStatusOptions = getManualStatusOptions(appointment.status);
    return (
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
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

          <WorkspacePanel title={locale === "ar" ? "تفاصيل الموعد" : "Appointment details"} subtitle={appointment.bookingReference || appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile label={locale === "ar" ? "العميل" : "Customer"} value={customerFullName || (locale === "ar" ? "عميل مرتبط" : "Linked customer")} className="bg-white" />
              <MetricTile label={locale === "ar" ? "وقت البدء" : "Start time"} value={formatDateTime(appointment.startTime, locale)} className="bg-white" />
              <MetricTile label={locale === "ar" ? "وقت الانتهاء" : "End time"} value={formatDateTime(appointment.endTime, locale)} className="bg-white" />
              <MetricTile label={locale === "ar" ? "الخدمة" : "Service"} value={serviceName} className="bg-white" />
              <MetricTile label={locale === "ar" ? "الموظف" : "Staff"} value={appointment.staff.name} className="bg-white" />
              <MetricTile label={locale === "ar" ? "السعر" : "Price"} value={<Currency amount={Number(appointment.price || 0)} />} className="bg-white sm:col-span-2" />
            </div>
          </WorkspacePanel>

          {cleanAppointmentNotes && (
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                {locale === "ar" ? "ملاحظات" : "Notes"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{cleanAppointmentNotes}</p>
            </div>
          )}

          {groupGuest ? (
            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                {locale === "ar" ? "بيانات الضيف الإضافي" : "Additional guest details"}
              </p>
              <p className="mt-2 text-sm font-semibold text-indigo-950">{groupGuest.fullName}</p>
              {groupGuest.phone ? (
                <p className="mt-1 text-sm text-indigo-900">{groupGuest.phone}</p>
              ) : null}
              {groupGuest.serviceName ? (
                <p className="mt-1 text-sm text-indigo-900">
                  {locale === "ar" ? "الخدمة" : "Service"}: {groupGuest.serviceName}
                </p>
              ) : null}
              {groupGuest.isFree ? (
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {locale === "ar" ? "خدمة مجانية" : "Free service"}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                {getStatusLabel(appointment.status, locale)}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                {getPaymentStatusLabel(currentPaymentStatus, locale)}
              </span>
              {latestRescheduleAudit?.toStartTime ? (
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  {locale === "ar"
                    ? `أعيدت الجدولة ${formatDateTime(latestRescheduleAudit.at || latestRescheduleAudit.toStartTime, locale)} إلى ${formatDateTime(latestRescheduleAudit.toStartTime, locale)}`
                    : `Rescheduled ${formatDateTime(latestRescheduleAudit.at || latestRescheduleAudit.toStartTime, locale)} -> ${formatDateTime(latestRescheduleAudit.toStartTime, locale)}`}
                </span>
              ) : null}
              {latestCancellationAudit ? (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                  {locale === "ar"
                    ? `ألغي ${formatDateTime(latestCancellationAudit.at || appointment.createdAt || appointment.startTime, locale)}${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode ? ` • السبب: ${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode}` : ""}`
                    : `Cancelled ${formatDateTime(latestCancellationAudit.at || appointment.createdAt || appointment.startTime, locale)}${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode ? ` • Reason: ${latestCancellationAudit.reasonText || latestCancellationAudit.reasonCode}` : ""}`}
                </span>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-gray-200">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                {locale === "ar" ? "الجدولة" : "Schedule"}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {formatDateTime(appointment.startTime, locale)} → {formatDateTime(appointment.endTime, locale)}
              </p>
            </div>
          </div>

          <div className="sticky top-4 z-20 rounded-3xl border border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">
                {locale === "ar" ? "الإجراءات السريعة" : "Quick actions"}
              </p>
              <Link
                href={`/${locale}/dashboard/appointments/${appointment.id}`}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-100"
                onClick={onClose}
              >
                {locale === "ar" ? "فتح الصفحة الكاملة" : "Open full page"}
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">
              {locale === "ar" ? "الحالة" : "Status"}
            </p>
            <div className="mt-3">
              <select
                value={appointment.status}
                disabled={statusUpdating || ["completed", "cancelled", "no_show"].includes(appointment.status)}
                onChange={(event) => {
                  const nextStatus = event.target.value as AppointmentItem["status"];
                  if (nextStatus === appointment.status) return;
                  if (nextStatus === "confirmed" || nextStatus === "checked_in" || nextStatus === "in_service" || nextStatus === "completed" || nextStatus === "no_show" || nextStatus === "cancelled") {
                    void handleQuickStatusUpdate(nextStatus);
                    return;
                  }
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {currentStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                {locale === "ar"
                  ? "يمكن تحديث الحالة يدويًا من هنا، أو تتغير تلقائيًا عند تأكيد العميل."
                  : "Status can be changed manually here, and will also update automatically when customer confirms."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerWorkspace = () => {
    const customerWorkspaceLoading = customerLoading || (viewMode === "customer" && !!appointment?.user?.id && !customerProfile);

    if (!customerProfile && !customerWorkspaceLoading) {
      return (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {locale === "ar" ? "لا توجد بيانات إضافية متاحة." : "No extra customer data is available yet."}
        </div>
      );
    }

    const customerTabs: Array<{ key: typeof customerTab; label: string }> = [
      { key: "overview", label: locale === "ar" ? "نظرة عامة" : "Overview" },
      { key: "appointments", label: locale === "ar" ? "المواعيد" : "Appointments" },
      { key: "transactions", label: locale === "ar" ? "المعاملات" : "Transactions" }
    ];

    const renderCustomerTabContent = () => {
      switch (customerTab) {
        case "overview":
          return renderOverview();
        case "appointments":
          return renderAppointments();
        case "transactions":
          return renderTransactions();
      }
    };

    return (
      <div className="grid gap-5 xl:grid-cols-[340px_220px_minmax(0,1fr)]">
        <div className="space-y-4">
          <WorkspacePanel
            title={locale === "ar" ? "مساحة العميل" : "Customer workspace"}
            subtitle={customerFullName}
            action={
              <button
                type="button"
                onClick={() => setViewMode("appointment")}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                {locale === "ar" ? "رجوع" : "Back"}
              </button>
            }
          >
            <div className={`flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="min-w-0">
                <div className={`mt-4 flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-gray-200">
                    {customerProfile?.profileImage ? (
                      <img
                        src={avatarUrl(customerProfile.profileImage)}
                        alt={customerFullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      `${customerProfile?.firstName?.[0] || ""}${customerProfile?.lastName?.[0] || ""}`.toUpperCase() || "?"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{customerFullName}</p>
                    <p className="text-xs text-gray-500">
                      {locale === "ar" ? "مساحة العميل" : "Customer workspace"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile label={locale === "ar" ? "إجمالي الحجوزات" : "Total bookings"} value={customerProfile?.totalBookings ?? 0} />
              <MetricTile
                label={locale === "ar" ? "إجمالي المدفوع" : "Total spent"}
                value={<Currency amount={Number(customerProfile?.totalSpent || 0)} />}
              />
              <MetricTile
                label={locale === "ar" ? "أول زيارة" : "First visit"}
                value={customerProfile?.firstVisit ? formatDateTime(customerProfile.firstVisit, locale) : "-"}
              />
              <MetricTile
                label={locale === "ar" ? "آخر زيارة" : "Last visit"}
                value={customerProfile?.lastVisit ? formatDateTime(customerProfile.lastVisit, locale) : "-"}
              />
            </div>

            <WorkspacePanel title={locale === "ar" ? "ملف العميل" : "Customer profile"} className="mt-4 bg-gray-50">
              <div className="mt-3 grid grid-cols-1 gap-3">
                <MetricTile label={locale === "ar" ? "البريد الإلكتروني" : "Email"} value={customerProfile?.email || "-"} className="bg-white" />
                <MetricTile label={locale === "ar" ? "الهاتف" : "Phone"} value={customerProfile?.phone || "-"} className="bg-white" />
                <MetricTile
                  label={locale === "ar" ? "اللغة" : "Language"}
                  value={customerProfile?.preferredLanguage || "-"}
                  className="bg-white"
                />
              </div>
            </WorkspacePanel>

            {(customerProfile?.notes || (customerProfile?.tags && customerProfile.tags.length > 0)) && (
              <WorkspacePanel title={locale === "ar" ? "ملاحظات" : "Notes"}>
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
              </WorkspacePanel>
            )}
          </WorkspacePanel>
        </div>

        <div className="sticky top-4 z-10 rounded-3xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="space-y-2">
            {customerTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCustomerTab(tab.key)}
                  className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold transition ${
                    customerTab === tab.key
                      ? "bg-primary text-white"
                      : "bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {customerWorkspaceLoading ? (
            <div className="flex items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 py-16">
              <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : customerProfile ? (
            renderCustomerTabContent()
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              {locale === "ar" ? "لا توجد بيانات إضافية متاحة." : "No extra customer data is available yet."}
            </div>
          )}
        </div>
      </div>
    );
  };
  if (!open) {
    return null;
  }

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricTile label={locale === "ar" ? "إجمالي الحجوزات" : "Total bookings"} value={customerProfile?.totalBookings ?? 0} />
        <MetricTile
          label={locale === "ar" ? "إجمالي المدفوع" : "Total spent"}
          value={<Currency amount={Number(customerProfile?.totalSpent || 0)} />}
        />
        <MetricTile
          label={locale === "ar" ? "أول زيارة" : "First visit"}
          value={customerProfile?.firstVisit ? formatDateTime(customerProfile.firstVisit, locale) : "-"}
        />
        <MetricTile
          label={locale === "ar" ? "آخر زيارة" : "Last visit"}
          value={customerProfile?.lastVisit ? formatDateTime(customerProfile.lastVisit, locale) : "-"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricTile label={locale === "ar" ? "البريد الإلكتروني" : "Email"} value={customerProfile?.email || "-"} />
        <MetricTile label={locale === "ar" ? "الهاتف" : "Phone"} value={customerProfile?.phone || "-"} />
        <MetricTile label={locale === "ar" ? "النوع" : "Gender"} value={customerProfile?.gender || "-"} />
        <MetricTile
          label={locale === "ar" ? "اللغة المفضلة" : "Preferred language"}
          value={customerProfile?.preferredLanguage || "-"}
        />
      </div>

      {(customerProfile?.notes || (customerProfile?.tags && customerProfile.tags.length > 0)) && (
        <WorkspacePanel title={locale === "ar" ? "ملاحظات" : "Notes"}>
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
        </WorkspacePanel>
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
                  {getPaymentStatusLabel(resolveEffectivePaymentStatus(item), locale)}
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
      ) : (
        <>
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {locale === "ar" ? "تصفية المعاملات" : "Transaction filters"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {locale === "ar" ? "فلترة حسب النوع والحالة." : "Filter by type and status."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "all", label: locale === "ar" ? "الكل" : "All" },
                  { key: "appointment", label: locale === "ar" ? "المواعيد" : "Appointments" },
                  { key: "order", label: locale === "ar" ? "الطلبات" : "Orders" },
                  { key: "ledger", label: locale === "ar" ? "السجل" : "Ledger" }
                ] as const).map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setTransactionTypeFilter(chip.key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      transactionTypeFilter === chip.key
                        ? "bg-primary text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { key: "all", label: locale === "ar" ? "كل الحالات" : "All statuses" },
                { key: "completed", label: locale === "ar" ? "مكتمل" : "Completed" },
                { key: "pending", label: locale === "ar" ? "قيد الانتظار" : "Pending" },
                { key: "refunded", label: locale === "ar" ? "مسترد" : "Refunded" },
                { key: "failed", label: locale === "ar" ? "فشل" : "Failed" },
                { key: "cancelled", label: locale === "ar" ? "ملغي" : "Cancelled" }
              ] as const).map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setTransactionStatusFilter(chip.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    transactionStatusFilter === chip.key
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions.map((item) => {
                const isExpanded = expandedTransactionId === item.id;
                return (
                  <div key={`${item.source}-${item.id}`} className="rounded-3xl border border-gray-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setExpandedTransactionId(isExpanded ? null : item.id)}
                      className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            {item.source === "ledger"
                              ? (locale === "ar" ? "سجل الدفع" : "Ledger")
                              : item.source === "appointment"
                                ? (locale === "ar" ? "مدفوع من الموعد" : "Appointment payment")
                                : (locale === "ar" ? "عملية مالية" : "Transaction")}
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                            {getTransactionTypeLabel(item.entityType, locale)}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getTransactionStatusTone(item.status)}`}>
                            {getTransactionStatusLabel(item.status, locale)}
                          </span>
                        </div>
                        <h5 className="text-base font-bold text-gray-900">{item.title}</h5>
                        {item.subtitle && <p className="text-sm text-gray-600">{item.subtitle}</p>}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                          <span>{formatDateTime(item.processedAt, locale)}</span>
                          <span>{item.paymentMethodLabel}</span>
                          {item.transactionRef && <span>{item.transactionRef}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Currency amount={Number(item.amount || 0)} className="text-lg font-bold text-gray-900" />
                        <span className="text-xs font-semibold text-primary">
                          {isExpanded ? (locale === "ar" ? "إخفاء التفاصيل" : "Hide details") : (locale === "ar" ? "إظهار التفاصيل" : "Details")}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {locale === "ar" ? "المصدر" : "Source"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{item.source}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {locale === "ar" ? "الطريقة" : "Method"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{item.paymentMethodLabel}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {locale === "ar" ? "المعالج" : "Processor"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{item.processorName || "-"}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {locale === "ar" ? "المرجع" : "Reference"}
                            </p>
                            <p className="mt-1 break-all text-sm font-semibold text-gray-900">{item.reference}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {locale === "ar" ? "المعرف" : "Entity"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {item.entityType}
                              {item.entityId ? ` · ${item.entityId}` : ""}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {locale === "ar" ? "النوع" : "Type"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{item.type}</p>
                          </div>
                        </div>

                        {(item.notes || item.detailPath) && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                            <div className="min-w-0">
                              {item.notes ? (
                                <>
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                    {locale === "ar" ? "ملاحظات" : "Notes"}
                                  </p>
                                  <p className="mt-1 text-sm text-gray-700">{item.notes}</p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  {locale === "ar" ? "لا توجد ملاحظات إضافية." : "No extra notes."}
                                </p>
                              )}
                            </div>
                            {item.detailPath && (
                              <Link
                                href={`/${locale}${item.detailPath}`}
                                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
                              >
                                {locale === "ar" ? "فتح السجل" : "Open record"}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              {locale === "ar" ? "لا توجد معاملات مطابقة للفلتر." : "No transactions match the selected filters."}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" onClick={onClose} />

      <aside
        className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-[76rem] bg-white shadow-2xl`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex h-full flex-col">
            <div className="border-b border-gray-100 px-6 py-5 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
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

            {appointment && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {locale === "ar" ? "الوقت الحالي" : "Current time"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatDateTime(appointment.startTime, locale)} → {formatDateTime(appointment.endTime, locale)}
                  </p>
                </div>
                {viewMode === "appointment" ? (
                  <div className="min-w-[220px]">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {locale === "ar" ? "الحالة" : "Status"}
                    </p>
                    <select
                      value={appointment.status}
                      disabled={statusUpdating || ["completed", "cancelled", "no_show"].includes(appointment.status)}
                      onChange={(event) => {
                        const nextStatus = event.target.value as AppointmentItem["status"];
                        if (nextStatus === appointment.status) return;
                        if (nextStatus === "confirmed" || nextStatus === "checked_in" || nextStatus === "in_service" || nextStatus === "completed" || nextStatus === "no_show" || nextStatus === "cancelled") {
                          void handleQuickStatusUpdate(nextStatus);
                          return;
                        }
                      }}
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {getManualStatusOptions(appointment.status).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {getStatusLabel(appointment.status, locale)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
            {actionNotice && (
              <div
                className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                  actionNotice.kind === "success"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {actionNotice.message}
              </div>
            )}

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
                {viewMode === "appointment" ? renderAppointmentWorkspace() : renderCustomerWorkspace()}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                {locale === "ar" ? "لم يتم العثور على بيانات الموعد." : "Appointment data was not found."}
              </div>
            )}
          </div>
        </div>
      </aside>

      {rescheduleOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35" onClick={() => !rescheduleSubmitting && setRescheduleOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">
              {locale === "ar" ? "إعادة الجدولة" : "Reschedule"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {locale === "ar" ? "اختر التاريخ والوقت الجديدين." : "Choose the new date and time."}
            </p>
            <div className="mt-4">
              <input
                type="datetime-local"
                value={rescheduleValue}
                onChange={(event) => setRescheduleValue(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleOpen(false)}
                disabled={rescheduleSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleRescheduleConfirm}
                disabled={!rescheduleValue || rescheduleSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {rescheduleSubmitting ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "حفظ" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
