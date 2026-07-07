"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Currency } from "@/components/Currency";
import { getImageUrl, tenantApi } from "@/lib/api";
import { extractAppointmentGuestCards, sanitizeAppointmentNotes } from "@/lib/appointmentNotes";

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
  depositAmount?: number | null;
  totalPaid?: number | null;
  outstandingAmount?: number | null;
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
  bookingSession?: AppointmentBookingSession | null;
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

interface AppointmentSessionItem {
  id: string;
  bookingItemIndex?: number | null;
  startTime: string;
  endTime: string;
  status: AppointmentItem["status"];
  paymentStatus: AppointmentItem["paymentStatus"];
  price: number;
  rawPrice?: number;
  taxAmount?: number;
  platformFee?: number;
  totalPaid?: number;
  notes?: string;
  serviceVariantId?: string | null;
  serviceVariantName?: string | null;
  serviceVariantDescription?: string | null;
  serviceVariantDuration?: number | null;
  service: AppointmentItem["service"];
  staff: AppointmentItem["staff"];
  user?: AppointmentItem["user"];
}

interface AppointmentBookingSession {
  id: string;
  bookingReference?: string | null;
  itemCount?: number | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  platformFee?: number | null;
  totalAmount?: number | null;
  paymentMethod?: string | null;
  appointments?: AppointmentSessionItem[];
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
  paymentMethod: "online" | "cash" | "card_pos" | "wallet" | "bank_transfer" | "gift_card_code";
  status: "pending" | "completed" | "failed" | "refunded" | "cancelled";
  transactionRef?: string | null;
  notes?: string | null;
  processedAt: string;
  processor?: {
    id: string;
    name: string;
  } | null;
}

type PaymentCollectionMethod = "cash" | "card_pos" | "wallet" | "bank_transfer" | "gift_card_code";

interface PaymentCollectionRow {
  id: string;
  paymentMethod: PaymentCollectionMethod;
  amount: string;
  giftCardCode: string;
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
  estimatedDeliveryDate?: string | null;
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
  walletSummary?: {
    currentBalance: number;
    walletLedgerCount: number;
    sentGiftCardCount: number;
    receivedGiftCardCount: number;
  };
  walletLedgerEntries?: Array<{
    id: string;
    type: string;
    direction: "credit" | "debit";
    amount: number;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    referenceType?: string | null;
    referenceId?: string | null;
    metadata?: Record<string, any>;
    createdAt: string;
  }>;
  giftCardTransactions?: Array<{
    id: string;
    packageTitle: string;
    purchaseAmount: number;
    creditAmount: number;
    bonusAmount: number;
    totalCreditAmount: number;
    status: string;
    deliveryChannel: string;
    senderPlatformUserId?: string | null;
    recipientPlatformUserId?: string | null;
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    deliveryMode?: string | null;
    createdAt: string;
    claimedAt?: string | null;
  }>;
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
  onAppointmentSettingsClick?: (appointmentId: string) => void;
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
    <section className={`rounded-3xl border border-gray-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-2">{children}</div>
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

function toTimeInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "00:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function withLocalTime(baseDateTime: string, timeValue: string) {
  const baseDate = new Date(baseDateTime);
  if (Number.isNaN(baseDate.getTime())) return baseDateTime;
  const [hoursRaw, minutesRaw] = `${timeValue || ""}`.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return baseDateTime;
  baseDate.setHours(hours, minutes, 0, 0);
  return baseDate.toISOString();
}

export function AppointmentDetailsDrawer({
  open,
  appointmentId,
  locale,
  isRTL,
  onClose,
  onRebook,
  onAddService,
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
  const [paymentCollectionOpen, setPaymentCollectionOpen] = useState(false);
  const [paymentCollectionMode, setPaymentCollectionMode] = useState<"full" | "remainder">("full");
  const [paymentCollectionRows, setPaymentCollectionRows] = useState<PaymentCollectionRow[]>([]);
  const [paymentCollectionSubmitting, setPaymentCollectionSubmitting] = useState(false);
  const [pendingStatusAfterPayment, setPendingStatusAfterPayment] = useState<AppointmentItem["status"] | null>(null);
  const [customerTab, setCustomerTab] = useState<"overview" | "wallet" | "profile" | "appointments" | "transactions" | "reviews">("overview");
  const [recordRemainderMethod, setRecordRemainderMethod] = useState("cash");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"all" | "appointment" | "order" | "ledger">("all");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<"all" | "completed" | "pending" | "refunded" | "failed" | "cancelled">("all");
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [moreActionsMenuStyle, setMoreActionsMenuStyle] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const moreActionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [customerActionsOpen, setCustomerActionsOpen] = useState(false);
  const [customerActionsMenuStyle, setCustomerActionsMenuStyle] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const customerActionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceStartTime, setEditingServiceStartTime] = useState("");
  const [editingServiceSubmitting, setEditingServiceSubmitting] = useState(false);
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
      setPaymentCollectionOpen(false);
      setPaymentCollectionMode("full");
      setPaymentCollectionRows([]);
      setPaymentCollectionSubmitting(false);
      setPendingStatusAfterPayment(null);
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
      setMoreActionsOpen(false);
      setMoreActionsMenuStyle(null);
      setCustomerActionsOpen(false);
      setCustomerActionsMenuStyle(null);
      setEditingServiceId(null);
      setEditingServiceStartTime("");
      setEditingServiceSubmitting(false);
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
        const [customerResult, walletResult, transactionsResult] = await Promise.allSettled([
          tenantApi.getCustomer(customerId),
          tenantApi.getCustomerWalletHistory(customerId),
          tenantApi.getCustomerTransactions(customerId, { limit: 100 })
        ]);

        if (!cancelled && customerResult.status === "fulfilled" && customerResult.value.success) {
          setCustomerProfile(customerResult.value.data || null);
        }

        if (!cancelled && walletResult.status === "fulfilled" && walletResult.value.success) {
          setCustomerProfile((current) => ({
            ...(current || {}),
            ...(walletResult.value.data || {})
          } as CustomerProfile));
        }

        if (!cancelled && customerResult.status === "rejected") {
          console.error("Failed to load customer profile:", customerResult.reason);
        }

        if (!cancelled && walletResult.status === "rejected") {
          console.error("Failed to load customer wallet history:", walletResult.reason);
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
  const guestCards = useMemo(() => extractAppointmentGuestCards(appointment || undefined), [appointment]);

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
        setMoreActionsOpen(false);
        setMoreActionsMenuStyle(null);
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

  const openCustomerWorkspace = () => {
    setViewMode("customer");
    setCustomerTab("overview");
    setMoreActionsOpen(false);
    setMoreActionsMenuStyle(null);
  };

  const toggleMoreActionsMenu = () => {
    if (moreActionsOpen) {
      setMoreActionsOpen(false);
      setMoreActionsMenuStyle(null);
      return;
    }

    const buttonRect = moreActionsButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;

    setMoreActionsMenuStyle(
      isRTL
        ? { top: buttonRect.bottom + 8, right: Math.max(12, window.innerWidth - buttonRect.right) }
        : { top: buttonRect.bottom + 8, left: buttonRect.left }
    );
    setMoreActionsOpen(true);
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
      setAppointment((current) => preferMoreSettledAppointmentState(current, refreshed.appointment));
    }
  };

  const preferMoreSettledAppointmentState = (
    current: AppointmentItem | null,
    next: AppointmentItem
  ): AppointmentItem => {
    if (!current) return next;

    const currentPaymentScore = getPaymentStateScore(current);
    const nextPaymentScore = getPaymentStateScore(next);

    if (nextPaymentScore > currentPaymentScore) {
      return next;
    }

    if (nextPaymentScore < currentPaymentScore) {
      return current;
    }

    const currentPaid = Number(current.totalPaid ?? 0);
    const nextPaid = Number(next.totalPaid ?? 0);
    if (nextPaid > currentPaid + 0.01) {
      return next;
    }
    if (nextPaid < currentPaid - 0.01) {
      return current;
    }

    const currentOutstanding = Number(current.outstandingAmount ?? current.remainderAmount ?? 0);
    const nextOutstanding = Number(next.outstandingAmount ?? next.remainderAmount ?? 0);
    if (nextOutstanding < currentOutstanding - 0.01) {
      return next;
    }
    if (nextOutstanding > currentOutstanding + 0.01) {
      return current;
    }

    return next;
  };

  const getPaymentStateScore = (item: AppointmentItem): number => {
    const status = resolveEffectivePaymentStatus(item);
    if (status === "fully_paid" || status === "paid") return 3;
    if (status === "deposit_paid") return 2;
    if (Number(item.totalPaid ?? 0) > 0) return 1;
    return 0;
  };

  const updateCustomerProfileAfterPayment = (paymentAmount: number, walletAmount: number = 0) => {
    const safePaymentAmount = Number.isFinite(paymentAmount) ? Math.max(0, Number(paymentAmount)) : 0;
    const safeWalletAmount = Number.isFinite(walletAmount) ? Math.max(0, Number(walletAmount)) : 0;
    if (safePaymentAmount <= 0 && safeWalletAmount <= 0) return;

    const roundMoney = (value: number) => Number.parseFloat(Number(value || 0).toFixed(2));

    setCustomerProfile((current) => {
      if (!current) return current;

      const previousWalletBalance = Number(current.walletBalance ?? current.walletSummary?.currentBalance ?? 0);
      const nextWalletBalance = safeWalletAmount > 0
        ? Math.max(0, roundMoney(previousWalletBalance - safeWalletAmount))
        : previousWalletBalance;
      const nextTotalSpent = safePaymentAmount > 0
        ? roundMoney(Number(current.totalSpent || 0) + safePaymentAmount)
        : Number(current.totalSpent || 0);

      return {
        ...current,
        walletBalance: nextWalletBalance,
        totalSpent: nextTotalSpent,
        walletSummary: current.walletSummary
          ? {
              ...current.walletSummary,
              currentBalance: nextWalletBalance
            }
          : current.walletSummary
      };
    });

    if (appointment?.user?.id) {
      window.dispatchEvent(new CustomEvent('rifah:customer-wallet-updated', {
        detail: {
          customerId: appointment.user.id,
          walletBalance: safeWalletAmount > 0
            ? Math.max(0, roundMoney(Number(customerProfile?.walletBalance ?? customerProfile?.walletSummary?.currentBalance ?? 0) - safeWalletAmount))
            : Number(customerProfile?.walletBalance ?? customerProfile?.walletSummary?.currentBalance ?? 0),
          totalSpent: safePaymentAmount > 0
            ? roundMoney(Number(customerProfile?.totalSpent || 0) + safePaymentAmount)
            : Number(customerProfile?.totalSpent || 0)
        }
      }));
    }
  };

  const beginServiceEdit = (item: AppointmentItem) => {
    setActionNotice(null);
    setEditingServiceId((current) => (current === item.id ? null : item.id));
    setEditingServiceStartTime(toTimeInputValue(item.startTime));
  };

  const cancelServiceEdit = () => {
    setEditingServiceId(null);
    setEditingServiceStartTime("");
  };

  const saveServiceEdit = async (item: AppointmentItem) => {
    if (!appointment || editingServiceSubmitting) return;

    const nextStartTime = withLocalTime(item.startTime, editingServiceStartTime);
    if (!nextStartTime) {
      setActionNotice({
        kind: "error",
        message: locale === "ar" ? "وقت البدء غير صالح." : "Invalid start time."
      });
      return;
    }

    try {
      setEditingServiceSubmitting(true);
      const response = await tenantApi.reassignRescheduleAppointment(appointment.id, {
        staffId: item.staff.id,
        startTime: nextStartTime,
        notifyCustomer: true
      });

      if (!response?.success) {
        setActionNotice({
          kind: "error",
          message: response?.message || (locale === "ar" ? "تعذر حفظ تعديل الخدمة." : "Failed to save service edit.")
        });
        return;
      }

      await refreshAppointment();
      cancelServiceEdit();
      setMoreActionsOpen(false);
      setMoreActionsMenuStyle(null);
      setActionNotice({
        kind: "success",
        message: locale === "ar" ? "تم تحديث الخدمة داخل البطاقة." : "Service updated inline."
      });
    } catch (err: any) {
      console.error("Failed to save inline service edit:", err);
      setActionNotice({
        kind: "error",
        message: err?.message || (locale === "ar" ? "تعذر حفظ تعديل الخدمة." : "Failed to save service edit.")
      });
    } finally {
      setEditingServiceSubmitting(false);
    }
  };

  const handleMarkFullyPaid = async (paymentMethod = "cash") => {
    if (!appointment || paymentUpdating) return;
    try {
      setPaymentUpdating(true);
      const paymentAmount = Number((appointment as any).outstandingAmount ?? appointment.price ?? 0);
      const walletAmount = paymentMethod === "wallet" ? paymentAmount : 0;
      const response = await tenantApi.updatePaymentStatus(appointment.id, "fully_paid", paymentMethod, {
        amount: paymentAmount > 0 ? paymentAmount : undefined
      });
      if (!response?.success) {
        setActionNotice({
          kind: "error",
          message: response?.message || (locale === "ar" ? "تعذر تحديث الدفع." : "Failed to update payment.")
        });
        return;
      }
      if (response?.appointment) {
        setAppointment((current) => preferMoreSettledAppointmentState(current, response.appointment));
      }
      updateCustomerProfileAfterPayment(paymentAmount, walletAmount);
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

  const customerId = customerProfile?.id || appointment?.user?.id || null;
  const customerDisplayName = customerProfile
    ? `${customerProfile.firstName} ${customerProfile.lastName}`.trim()
    : appointment?.user
      ? `${appointment.user.firstName} ${appointment.user.lastName}`.trim()
      : (locale === "ar" ? "عميل غير محدد" : "Unknown customer");
  const customerPhone = customerProfile?.phone || appointment?.user?.phone || "";
  const customerEmail = customerProfile?.email || appointment?.user?.email || "";
  const customerAvatarSrc = customerProfile?.profileImage
    ? avatarUrl(customerProfile.profileImage)
    : appointment?.user?.photo || appointment?.user?.profileImage
      ? avatarUrl(appointment.user.photo || appointment.user.profileImage || undefined)
      : "";
  const customerProfileLink = customerId
    ? `/${locale}/dashboard/customers/${customerId}`
    : `/${locale}/dashboard/customers`;
  const customerIsWalkIn = !appointment?.user?.id;
  const appointmentDateLabel = appointment ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(appointment.startTime)) : "";
  const customerWalletLedgerEntries = customerProfile?.walletLedgerEntries || [];
  const customerGiftCardTransactions = customerProfile?.giftCardTransactions || [];
  const customerReviews = customerProfile?.reviews || [];
  const walletRechargeEntries = customerWalletLedgerEntries.filter((entry) => {
    const normalizedType = `${entry.type || ""}`.toLowerCase();
    return normalizedType.includes("recharge") || normalizedType.includes("topup") || normalizedType.includes("top_up") || normalizedType.includes("credit");
  });
  const walletDebitEntries = customerWalletLedgerEntries.filter((entry) => {
    const normalizedType = `${entry.type || ""}`.toLowerCase();
    return normalizedType.includes("debit") || normalizedType.includes("payment") || normalizedType.includes("purchase");
  });
  const giftCardsSent = customerGiftCardTransactions.filter((tx) => tx.senderPlatformUserId === customerProfile?.id);
  const giftCardsReceived = customerGiftCardTransactions.filter((tx) => tx.recipientPlatformUserId === customerProfile?.id);

  const toggleCustomerActionsMenu = () => {
    if (customerActionsOpen) {
      setCustomerActionsOpen(false);
      setCustomerActionsMenuStyle(null);
      return;
    }

    const buttonRect = customerActionsButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;

    setCustomerActionsMenuStyle(
      isRTL
        ? { top: buttonRect.bottom + 8, right: Math.max(12, window.innerWidth - buttonRect.right) }
        : { top: buttonRect.bottom + 8, left: buttonRect.left }
    );
    setCustomerActionsOpen(true);
  };

  const openCustomerFullProfile = () => {
    if (!customerProfileLink) return;
    onClose();
    window.location.href = customerProfileLink;
  };

  const openCustomerWhatsApp = () => {
    const phoneValue = (customerPhone || "").replace(/[^\d+]/g, "");
    if (!phoneValue) {
      setActionNotice({
        kind: "error",
        message: locale === "ar" ? "لا يوجد رقم هاتف للعميل." : "No customer phone number is available."
      });
      return;
    }
    const digits = phoneValue.replace(/\D/g, "");
    if (!digits) {
      return;
    }
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    setCustomerActionsOpen(false);
    setCustomerActionsMenuStyle(null);
  };

  const callCustomer = () => {
    const phoneValue = (customerPhone || "").trim();
    if (!phoneValue) {
      setActionNotice({
        kind: "error",
        message: locale === "ar" ? "لا يوجد رقم هاتف للعميل." : "No customer phone number is available."
      });
      return;
    }
    window.location.href = `tel:${phoneValue}`;
    setCustomerActionsOpen(false);
    setCustomerActionsMenuStyle(null);
  };

  const jumpToCustomerNotes = () => {
    setCustomerTab("overview");
    const notesSection = document.getElementById("customer-overview-notes");
    notesSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCustomerActionsOpen(false);
    setCustomerActionsMenuStyle(null);
  };

  useEffect(() => {
    if (!moreActionsOpen) return;

    const handleCloseMoreActions = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;

      const target = event.target as Node | null;
      if (
        target &&
        (moreActionsButtonRef.current?.contains(target) ||
          document.getElementById("appointment-more-actions-menu")?.contains(target))
      ) {
        return;
      }

      setMoreActionsOpen(false);
      setMoreActionsMenuStyle(null);
    };

    window.addEventListener("mousedown", handleCloseMoreActions);
    window.addEventListener("keydown", handleCloseMoreActions);
    return () => {
      window.removeEventListener("mousedown", handleCloseMoreActions);
      window.removeEventListener("keydown", handleCloseMoreActions);
    };
  }, [moreActionsOpen]);

  useEffect(() => {
    if (!customerActionsOpen) return;

    const handleCloseCustomerActions = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;

      const target = event.target as Node | null;
      if (
        target &&
        (customerActionsButtonRef.current?.contains(target) ||
          document.getElementById("customer-actions-menu")?.contains(target))
      ) {
        return;
      }

      setCustomerActionsOpen(false);
      setCustomerActionsMenuStyle(null);
    };

    window.addEventListener("mousedown", handleCloseCustomerActions);
    window.addEventListener("keydown", handleCloseCustomerActions);
    return () => {
      window.removeEventListener("mousedown", handleCloseCustomerActions);
      window.removeEventListener("keydown", handleCloseCustomerActions);
    };
  }, [customerActionsOpen]);

  const renderAppointmentWorkspace = () => {
    if (!appointment) return null;

  const currentPaymentStatus = resolveEffectivePaymentStatus(appointment);
  const hasTrueRemainderBalance = Boolean(
    Number(appointment.totalPaid ?? 0) > 0 &&
    Number(appointment.remainderAmount ?? 0) > 0 &&
    (appointment.paymentStatus === "deposit_paid" || Number(appointment.depositAmount ?? 0) > 0)
  );
    const appointmentDateTime = new Date(appointment.startTime);
    const appointmentEndDateTime = new Date(appointment.endTime);
    const durationMinutes = Math.max(
      0,
      Math.round((appointmentEndDateTime.getTime() - appointmentDateTime.getTime()) / 60000)
    );
    const customerProfileLink = customerId
      ? `/${locale}/dashboard/customers/${customerId}`
      : `/${locale}/dashboard/customers`;
    const sessionAppointments = appointment.bookingSession?.appointments || [];
    const hasSessionAppointments = sessionAppointments.length > 0;
    const summedSessionTotals = hasSessionAppointments
      ? sessionAppointments.reduce(
          (acc, sessionAppointment) => {
            acc.subtotal += Number(sessionAppointment.rawPrice ?? 0);
            acc.taxAmount += Number(sessionAppointment.taxAmount ?? 0);
            acc.platformFee += Number(sessionAppointment.platformFee ?? 0);
            acc.totalAmount += Number(sessionAppointment.price ?? 0);
            acc.paidAmount += Number(sessionAppointment.totalPaid ?? 0);
            return acc;
          },
          { subtotal: 0, taxAmount: 0, platformFee: 0, totalAmount: 0, paidAmount: 0 }
        )
      : null;
    const sessionTotals = appointment.bookingSession || null;
    const subtotalAmount = Number(
      summedSessionTotals?.subtotal ??
      sessionTotals?.subtotal ??
      appointment.rawPrice ??
      appointment.price ??
      0
    );
    const taxAmount = Number(
      summedSessionTotals?.taxAmount ??
      sessionTotals?.taxAmount ??
      appointment.taxAmount ??
      0
    );
    const depositAmount = Number(appointment.depositAmount || 0);
    const paidAmount = Number(
      summedSessionTotals?.paidAmount ??
      appointment.totalPaid ??
      0
    );
    const platformFeeAmount = Number(
      summedSessionTotals?.platformFee ??
      sessionTotals?.platformFee ??
      appointment.platformFee ??
      0
    );
    const totalAmount = Number(
      summedSessionTotals?.totalAmount ??
      sessionTotals?.totalAmount ??
      appointment.price ??
      (subtotalAmount + taxAmount + platformFeeAmount)
    );
    const outstandingAmount = hasSessionAppointments
      ? Math.max(0, totalAmount - paidAmount)
      : Math.max(0, Number(appointment.outstandingAmount ?? (totalAmount - paidAmount)));
    const remainingAmount = currentPaymentStatus === "deposit_paid"
      ? Math.max(0, Number(appointment.remainderAmount ?? outstandingAmount))
      : outstandingAmount;
    const paymentDueAmount = Math.max(
      0,
      currentPaymentStatus === "deposit_paid"
        ? remainingAmount
        : outstandingAmount
    );
    const checkoutFlowStage = appointment.status === "completed"
      ? "confirmed"
      : paymentDueAmount > 0
        ? "payment"
        : "review";
    const checkoutFlowStageLabel = checkoutFlowStage === "review"
      ? (locale === "ar" ? "مراجعة" : "Review")
      : checkoutFlowStage === "payment"
        ? (locale === "ar" ? "الدفع" : "Payment")
        : (locale === "ar" ? "تأكيد" : "Confirmation");
    const primaryCheckoutActionLabel = paymentDueAmount > 0
      ? (locale === "ar" ? "ادفع الآن" : "Pay now")
      : (locale === "ar" ? "إنهاء" : "Checkout");
    const serviceCards = (() => {
      if (!sessionAppointments.length) {
        return [appointment];
      }

      return sessionAppointments
        .slice()
        .sort((left, right) => {
          const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
          const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
          if (leftIndex !== rightIndex) {
            return leftIndex - rightIndex;
          }
          return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
        });
    })();

    const servicePricingDetails = serviceCards.map((item) => {
      const itemServiceName = locale === "ar" ? item.service.name_ar : item.service.name_en;
      const itemBasePrice = Number(item.rawPrice ?? item.price ?? 0);
      const itemFinalPrice = Number(item.price ?? 0);
      const itemDiscountAmount = Math.max(0, itemBasePrice - itemFinalPrice);
      const itemDiscountPercent = itemBasePrice > 0 ? Math.round((itemDiscountAmount / itemBasePrice) * 100) : 0;

      return {
        id: item.id,
        item,
        itemServiceName,
        itemBasePrice,
        itemFinalPrice,
        itemDiscountAmount,
        itemDiscountPercent
      };
    });
    const discountAmount = servicePricingDetails.reduce((sum, entry) => sum + entry.itemDiscountAmount, 0);
    const discountedServiceCount = servicePricingDetails.filter((entry) => entry.itemDiscountAmount > 0).length;

    const triggerMoreAction = (action: "rebook" | "reschedule" | "mark_refunded" | "open_full_page") => {
      setMoreActionsOpen(false);
      setMoreActionsMenuStyle(null);
      if (action === "rebook") {
        handleRebook();
        return;
      }
      if (action === "reschedule") {
        handleReschedule();
        return;
      }
      if (action === "mark_refunded") {
        void handleMarkRefunded();
        return;
      }
      if (action === "open_full_page") {
        window.open(`/${locale}/dashboard/appointments/${appointment.id}`, "_blank", "noopener,noreferrer");
      }
    };

    const handlePayNow = async () => {
      if (paymentDueAmount > 0) {
        setPendingStatusAfterPayment(null);
        openPaymentCollection();
        return;
      }
      await handleMarkFullyPaid(recordRemainderMethod);
    };

  const handleCheckout = async () => {
    if (remainingAmount > 0) {
      setPendingStatusAfterPayment("completed");
      openPaymentCollection(hasTrueRemainderBalance ? "remainder" : "full", "completed");
      setActionNotice({
        kind: "success",
        message: locale === "ar"
          ? "أكمل تحصيل الدفع أولاً ثم سننهي الموعد."
          : "Collect payment first, then we will complete the appointment."
      });
      return;
    }
    await handleQuickStatusUpdate("completed");
  };

  const toggleCustomerActionsMenu = () => {
    if (customerActionsOpen) {
      setCustomerActionsOpen(false);
      setCustomerActionsMenuStyle(null);
      return;
    }

    const buttonRect = customerActionsButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;

    setCustomerActionsMenuStyle(
      isRTL
        ? { top: buttonRect.bottom + 8, right: Math.max(12, window.innerWidth - buttonRect.right) }
        : { top: buttonRect.bottom + 8, left: buttonRect.left }
    );
    setCustomerActionsOpen(true);
  };

  const openCustomerFullProfile = () => {
    if (!customerProfileLink) return;
    onClose();
    window.location.href = customerProfileLink;
  };

  const openCustomerWhatsApp = () => {
    const phoneValue = (customerPhone || "").replace(/[^\d+]/g, "");
    if (!phoneValue) {
      setActionNotice({
        kind: "error",
        message: locale === "ar" ? "لا يوجد رقم هاتف للعميل." : "No customer phone number is available."
      });
      return;
    }
    const digits = phoneValue.replace(/\D/g, "");
    if (!digits) {
      return;
    }
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    setCustomerActionsOpen(false);
    setCustomerActionsMenuStyle(null);
  };

  const callCustomer = () => {
    const phoneValue = (customerPhone || "").trim();
    if (!phoneValue) {
      setActionNotice({
        kind: "error",
        message: locale === "ar" ? "لا يوجد رقم هاتف للعميل." : "No customer phone number is available."
      });
      return;
    }
    window.location.href = `tel:${phoneValue}`;
    setCustomerActionsOpen(false);
    setCustomerActionsMenuStyle(null);
  };

  const jumpToCustomerNotes = () => {
    setCustomerTab("overview");
    const notesSection = document.getElementById("customer-overview-notes");
    notesSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCustomerActionsOpen(false);
    setCustomerActionsMenuStyle(null);
  };

    const paymentMethodOptions: Array<{ value: PaymentCollectionMethod; label: string }> = [
      { value: "cash", label: locale === "ar" ? "نقداً" : "Cash" },
      { value: "card_pos", label: locale === "ar" ? "بطاقة عند المركز" : "Card POS" },
      { value: "wallet", label: locale === "ar" ? "المحفظة" : "Wallet" },
      { value: "bank_transfer", label: locale === "ar" ? "تحويل بنكي" : "Bank transfer" },
      { value: "gift_card_code", label: locale === "ar" ? "رمز بطاقة هدية" : "Gift card code" }
    ];

    const createPaymentRow = (overrides?: Partial<PaymentCollectionRow>): PaymentCollectionRow => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentMethod: overrides?.paymentMethod || (recordRemainderMethod as PaymentCollectionMethod) || "cash",
      amount: overrides?.amount || `${paymentDueAmount.toFixed(2)}`,
      giftCardCode: overrides?.giftCardCode || ""
    });

    const openPaymentCollection = (
      mode: "full" | "remainder" = currentPaymentStatus === "deposit_paid" ? "remainder" : "full",
      afterStatus: AppointmentItem["status"] | null = null
    ) => {
      if (paymentDueAmount <= 0) {
        setActionNotice({
          kind: "error",
          message: locale === "ar"
            ? "لا يوجد مبلغ متبقٍ للتحصيل."
            : "There is no remaining amount to collect."
        });
        return;
      }

      setPendingStatusAfterPayment(afterStatus);
      setPaymentCollectionMode(mode);
      setPaymentCollectionRows([createPaymentRow()]);
      setPaymentCollectionOpen(true);
      setActionNotice(null);
    };

    const closePaymentCollection = () => {
      setPaymentCollectionOpen(false);
      setPaymentCollectionRows([]);
      setPendingStatusAfterPayment(null);
    };

    const updatePaymentCollectionRow = (rowId: string, patch: Partial<PaymentCollectionRow>) => {
      setPaymentCollectionRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    };

    const addPaymentCollectionRow = () => {
      setPaymentCollectionRows((current) => [...current, createPaymentRow()]);
    };

    const removePaymentCollectionRow = (rowId: string) => {
      setPaymentCollectionRows((current) => (current.length > 1 ? current.filter((row) => row.id !== rowId) : current));
    };

    const paymentCollectionTotal = paymentCollectionRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paymentCollectionDifference = paymentCollectionTotal - paymentDueAmount;
    const paymentCollectionRemaining = Math.max(0, paymentDueAmount - paymentCollectionTotal);
    const paymentCollectionProgress = paymentDueAmount > 0 ? Math.min(1, paymentCollectionTotal / paymentDueAmount) : 0;
    const paymentCollectionMismatch = Math.abs(paymentCollectionDifference) > 0.01;
    const paymentCollectionDifferenceLabel = `${paymentCollectionDifference > 0 ? "+" : ""}${paymentCollectionDifference.toFixed(2)}`;
    const paymentCollectionStatus = paymentCollectionMismatch
      ? (paymentCollectionDifference > 0
        ? (locale === "ar" ? "فائض" : "Overpaid")
        : (locale === "ar" ? "جزئي" : "Partial"))
      : (paymentCollectionTotal > 0
        ? (locale === "ar" ? "مدفوع" : "Paid")
        : (locale === "ar" ? "غير مدفوع" : "Unpaid"));

    const submitPaymentCollection = async () => {
      if (!appointment || paymentCollectionSubmitting) return;
      if (paymentDueAmount <= 0) {
        setActionNotice({
          kind: "error",
          message: locale === "ar"
            ? "لا يوجد مبلغ متبقٍ للتحصيل."
            : "There is no remaining amount to collect."
        });
        return;
      }

      const normalizedRows = paymentCollectionRows
        .map((row) => ({
          paymentMethod: row.paymentMethod,
          amount: Number(row.amount || 0),
          giftCardCode: row.paymentMethod === "gift_card_code" ? row.giftCardCode.trim() : undefined
        }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0);

      if (!normalizedRows.length) {
        setActionNotice({
          kind: "error",
          message: locale === "ar"
            ? "أضف طريقة دفع واحدة على الأقل."
            : "Add at least one payment method."
        });
        return;
      }

      const allocationsTotal = normalizedRows.reduce((sum, row) => sum + row.amount, 0);
      if (Math.abs(allocationsTotal - paymentDueAmount) > 0.01) {
        setActionNotice({
          kind: "error",
          message: locale === "ar"
            ? "يجب أن يساوي مجموع الدفعات المبلغ المستحق."
            : "The payment split must match the amount due."
        });
        return;
      }

      if (normalizedRows.some((row) => row.paymentMethod === "gift_card_code" && !row.giftCardCode)) {
        setActionNotice({
          kind: "error",
          message: locale === "ar"
            ? "أدخل رمز بطاقة الهدية لكل سطر يستخدم هذه الطريقة."
            : "Enter a gift card code for every gift card payment row."
        });
        return;
      }

      try {
        setPaymentCollectionSubmitting(true);
        const payload = {
          amount: paymentDueAmount,
          paymentMethod: normalizedRows.length === 1 ? normalizedRows[0].paymentMethod : "cash",
          notes: locale === "ar" ? "تحصيل دفع من لوحة التفاصيل" : "Collected payment from details drawer",
          paymentAllocations: normalizedRows.map((row) => ({
            paymentMethod: row.paymentMethod,
            amount: row.amount,
            giftCardCode: row.giftCardCode || undefined
          }))
        };

        const response = paymentCollectionMode === "remainder" || hasTrueRemainderBalance
          ? await tenantApi.recordRemainderPayment(appointment.id, {
              ...payload,
              transactionRef: undefined
            })
          : await tenantApi.updatePaymentStatus(appointment.id, "fully_paid", payload.paymentMethod, {
              amount: payload.amount,
              notes: payload.notes,
              paymentAllocations: payload.paymentAllocations
            });

        if (!response?.success) {
          setActionNotice({
            kind: "error",
            message: response?.message || (locale === "ar" ? "تعذر تسجيل الدفعة." : "Failed to record payment.")
          });
          return;
        }

        if (response?.appointment) {
          setAppointment((current) => preferMoreSettledAppointmentState(current, response.appointment));
        }

        const walletAllocationTotal = normalizedRows
          .filter((row) => row.paymentMethod === "wallet")
          .reduce((sum, row) => sum + Number(row.amount || 0), 0);
        updateCustomerProfileAfterPayment(paymentDueAmount, walletAllocationTotal);

        if (pendingStatusAfterPayment && appointment?.status !== pendingStatusAfterPayment) {
          try {
            const statusResponse = await tenantApi.updateAppointmentStatus(appointment.id, pendingStatusAfterPayment);
            if (statusResponse?.success && statusResponse?.appointment) {
              setAppointment((prev) => prev ? { ...prev, status: statusResponse.appointment.status } : prev);
            }
          } catch (statusErr) {
            console.warn("Failed to apply pending appointment status after payment:", statusErr);
          }
        }

        await refreshAppointment();
        closePaymentCollection();
        setPendingStatusAfterPayment(null);
        setActionNotice({
          kind: "success",
          message: locale === "ar" ? "تم تسجيل الدفعة بنجاح." : "Payment recorded successfully."
        });
      } catch (err: any) {
        console.error("Failed to submit payment collection:", err);
        setActionNotice({
          kind: "error",
          message: err?.message || (locale === "ar" ? "تعذر تسجيل الدفعة." : "Failed to record payment.")
        });
      } finally {
        setPaymentCollectionSubmitting(false);
      }
    };

    const renderCustomerPanel = () => (
      <div className="space-y-3 overflow-y-auto pr-2">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
            aria-label={locale === "ar" ? "إغلاق" : "Close"}
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 10-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white px-3 py-3.5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900">
              {customerAvatarSrc ? (
                <img src={customerAvatarSrc} alt={customerDisplayName} className="h-full w-full object-cover" />
              ) : (
                (customerDisplayName?.[0] || "?").toUpperCase()
              )}
            </div>
            <p className="mt-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">
              {locale === "ar" ? "العميل" : "Client"}
            </p>
            <h4 className="mt-1.5 truncate text-lg font-bold text-gray-900">{customerDisplayName}</h4>
            <div className="mt-1.5 space-y-0.5 text-sm text-gray-600">
              <p className="truncate">{customerEmail || (locale === "ar" ? "لا يوجد بريد" : "No email")}</p>
              <p>{customerPhone || (locale === "ar" ? "لا يوجد هاتف" : "No phone")}</p>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              {customerProfile?.loyaltyTier ? (
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                  {customerProfile.loyaltyTier}
                </span>
              ) : null}
              {customerIsWalkIn ? (
                <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                  {locale === "ar" ? "حضور مباشر" : "Walk-in"}
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={openCustomerWorkspace}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                {locale === "ar" ? "الملف" : "Workspace"}
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={openCustomerWorkspace}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                {locale === "ar" ? "الملف" : "Profile"}
              </button>
            </div>
              </div>
            </div>

        {customerIsWalkIn ? (
          <WorkspacePanel
            title={locale === "ar" ? "حالة الحضور المباشر" : "Walk-in state"}
            className="bg-white"
          >
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3.5">
              <p className="text-sm font-semibold text-gray-900">
                {locale === "ar" ? "حجز حضوري" : "Walk-in appointment"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {locale === "ar" ? "لم يتم تعيين عميل بعد" : "No customer assigned"}
              </p>
              <Link
                href={customerProfileLink}
                onClick={onClose}
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                {locale === "ar" ? "تعيين عميل" : "Assign customer"}
              </Link>
            </div>
          </WorkspacePanel>
        ) : null}
      </div>
    );

    return (
      <div className="h-full p-3 lg:p-4">
        <div className="grid h-full gap-3 overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            {renderCustomerPanel()}
          </aside>

          <section className="min-h-0 overflow-y-auto pr-1">
            <div className="sticky top-0 z-30 -mx-3 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur lg:-mx-4 lg:px-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[180px]">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {locale === "ar" ? "الحالة" : "Status"}
                    </label>
                    <select
                      value={appointment.status}
                      disabled={statusUpdating || ["completed", "cancelled", "no_show"].includes(appointment.status)}
                      onChange={(event) => {
                        const nextStatus = event.target.value as AppointmentItem["status"];
                        if (nextStatus === appointment.status) return;
                        if (nextStatus === "checked_in" && paymentDueAmount > 0) {
                          setPendingStatusAfterPayment("checked_in");
                          openPaymentCollection(currentPaymentStatus === "deposit_paid" ? "remainder" : "full", "checked_in");
                          setActionNotice({
                            kind: "success",
                            message: locale === "ar"
                              ? "أكمل تحصيل الدفع أولاً ثم سنثبت حالة الوصول."
                              : "Collect payment first, then we will mark the appointment as arrived."
                          });
                          return;
                        }
                        void handleQuickStatusUpdate(nextStatus);
                      }}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {getManualStatusOptions(appointment.status).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="hidden h-11 w-px bg-gray-200 sm:block" />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRebook}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "إعادة الحجز" : "Rebook"}
                    </button>
                    <button
                      type="button"
                      onClick={handleReschedule}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "إعادة الجدولة" : "Reschedule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePayNow()}
                      className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                    >
                      {locale === "ar" ? "الدفع" : "Checkout"}
                    </button>
                    <button
                      type="button"
                      onClick={toggleMoreActionsMenu}
                      ref={moreActionsButtonRef}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "إجراءات سريعة" : "Quick actions"}
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {locale === "ar" ? "إغلاق" : "Close"}
                </button>
              </div>
              {moreActionsOpen && moreActionsMenuStyle ? (
                <div
                  id="appointment-more-actions-menu"
                  className="fixed z-[9999] w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
                  style={{
                    top: `${moreActionsMenuStyle.top}px`,
                    left: moreActionsMenuStyle.left != null ? `${moreActionsMenuStyle.left}px` : undefined,
                    right: moreActionsMenuStyle.right != null ? `${moreActionsMenuStyle.right}px` : undefined
                  }}
                >
                  <button
                    type="button"
                    onClick={() => triggerMoreAction("rebook")}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {locale === "ar" ? "إعادة الحجز" : "Rebook"}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerMoreAction("reschedule")}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {locale === "ar" ? "إعادة الجدولة" : "Reschedule"}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerMoreAction("mark_refunded")}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {locale === "ar" ? "إرجاع المبلغ" : "Refund"}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerMoreAction("open_full_page")}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {locale === "ar" ? "فتح الصفحة الكاملة" : "Open full page"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 pb-4 pt-3">
              <WorkspacePanel
                title={locale === "ar" ? "تفاصيل الموعد" : "Appointment details"}
                subtitle={appointment.bookingReference || appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePayNow()}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "ادفع الآن" : "Pay now"}
                    </button>
                  </div>
                }
              >
                <div className="rounded-[22px] border border-primary/20 bg-primary/5 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
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

                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "تاريخ الخدمة" : "Service date"}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-900">{appointmentDateLabel}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "الحالة الحالية" : "Current status"}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {getStatusLabel(appointment.status, locale)}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "الحالة المالية" : "Payment status"}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        {getPaymentStatusLabel(currentPaymentStatus, locale)}
                      </p>
                    </div>
                  </div>
                </div>
              </WorkspacePanel>

              <WorkspacePanel
                title={locale === "ar" ? "الخدمات" : "Services"}
                subtitle={locale === "ar" ? `${serviceCards.length} خدمة مرتبطة` : `${serviceCards.length} service(s) attached`}
                action={
                  onAddService ? (
                    <button
                      type="button"
                      onClick={() => onAddService(appointment)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "إضافة خدمة أخرى" : "Add another service"}
                    </button>
                  ) : null
                }
                >
              <div className="space-y-2">
                {servicePricingDetails.map(({ item, itemServiceName, itemBasePrice, itemFinalPrice, itemDiscountAmount, itemDiscountPercent }) => {
                    const itemVariant = item.serviceVariantName?.trim() || item.serviceVariantDescription?.trim() || "";
                    const itemDuration = item.serviceVariantDuration || item.service.duration || durationMinutes;
                    const isEditingThisService = editingServiceId === item.id;
                    const itemStatusLabel = getStatusLabel(item.status, locale);
                    const hasDiscount = itemDiscountAmount > 0;
                    return (
                      <div
                        key={item.id}
                        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                          isEditingThisService ? "border-primary/30 ring-1 ring-primary/20" : "border-gray-200"
                        }`}
                      >
                        <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold leading-6 text-gray-900">{itemServiceName}</p>
                              {itemVariant ? (
                                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200">
                                  {itemVariant}
                                </span>
                              ) : null}
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                                {itemStatusLabel}
                              </span>
                            </div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold ring-1 ring-gray-200">
                                  {item.staff.name}
                                </span>
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold ring-1 ring-gray-200">
                                  {itemDuration} {locale === "ar" ? "دقيقة" : "min"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 sm:justify-end">
                                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                                  {locale === "ar" ? "السعر" : "Price"}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${hasDiscount ? "bg-primary/10 text-primary ring-primary/20" : "bg-gray-100 text-gray-900 ring-gray-200"}`}>
                                    <Currency amount={itemFinalPrice} />
                                  </span>
                                  {hasDiscount ? (
                                    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                      -<Currency amount={itemDiscountAmount} />
                                      <span className="ml-1 opacity-80">
                                        ({itemDiscountPercent}%)
                                      </span>
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => beginServiceEdit(item)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                isEditingThisService
                                  ? "border-primary bg-primary text-white hover:bg-primary/90"
                                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {isEditingThisService ? (locale === "ar" ? "إغلاق" : "Close") : (locale === "ar" ? "تعديل" : "Edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActionNotice({
                                kind: "error",
                                message: locale === "ar" ? "حذف الخدمة غير مفعل بعد." : "Service deletion is not wired yet."
                              })}
                              className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              {locale === "ar" ? "حذف" : "Delete"}
                            </button>
                          </div>
                        </div>
                        {isEditingThisService ? (
                          <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4">
                            <div className="flex items-start justify-between gap-2.5">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70">
                                  {locale === "ar" ? "تعديل الخدمة" : "Edit service"}
                                </p>
                                <h4 className="mt-0.5 text-base font-semibold text-gray-900">{itemServiceName}</h4>
                                <p className="mt-0.5 text-[11px] text-gray-500">
                                  {locale === "ar"
                                    ? "تعديل داخل نفس البطاقة حتى لا يحتاج المستخدم للتمرير للأسفل."
                                    : "Edit inline from this card so the workspace stays close to the service."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={cancelServiceEdit}
                                className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-50"
                              >
                                {locale === "ar" ? "إغلاق" : "Close"}
                              </button>
                            </div>

                            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                              <label className="block">
                                <span className="mb-1.5 block text-xs font-medium text-gray-700">
                                  {locale === "ar" ? "وقت البدء" : "Start time"}
                                </span>
                                <input
                                  type="time"
                                  value={editingServiceStartTime}
                                  onChange={(event) => setEditingServiceStartTime(event.target.value)}
                                  className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                                />
                              </label>

                              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2">
                                <span className="block text-xs font-medium text-gray-700">
                                  {locale === "ar" ? "المدة" : "Duration"}
                                </span>
                                <div className="mt-1 text-sm font-semibold text-gray-900">
                                  {itemDuration} {locale === "ar" ? "دقيقة" : "min"}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2">
                                <span className="block text-xs font-medium text-gray-700">
                                  {locale === "ar" ? "الموظف" : "Staff"}
                                </span>
                                <div className="mt-1 text-sm font-semibold text-gray-900">{item.staff.name}</div>
                              </div>
                              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2">
                                <span className="block text-xs font-medium text-gray-700">
                                  {locale === "ar" ? "السعر" : "Price"}
                                </span>
                                <div className="mt-1 text-sm font-semibold text-gray-900">
                                  <Currency amount={itemFinalPrice} />
                                </div>
                              </div>
                              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2">
                                <span className="block text-xs font-medium text-gray-700">
                                  {locale === "ar" ? "الحالة" : "Status"}
                                </span>
                                <div className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                  {itemStatusLabel}
                                </div>
                              </div>
                            </div>

                            {hasDiscount ? (
                              <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold">
                                    {locale === "ar" ? "خصم الخدمة" : "Service discount"}
                                  </span>
                                  <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
                                    -<Currency amount={itemDiscountAmount} />
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] opacity-90">
                                  {locale === "ar"
                                    ? `تم خصم ${itemDiscountPercent}% من السعر الأصلي ${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(itemBasePrice)}`
                                    : `Saved ${itemDiscountPercent}% from the original ${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(itemBasePrice)}`}
                                </p>
                              </div>
                            ) : null}

                            <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                              {locale === "ar"
                                ? "المدة تتبع إعدادات الخدمة. يتم حفظ وقت البدء الحالي فقط داخل هذه الواجهة."
                                : "Duration follows the service setup. This inline edit currently saves the start time in-place."}
                            </div>

                            <div className="mt-2.5 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelServiceEdit}
                                className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
                              >
                                {locale === "ar" ? "إلغاء" : "Cancel"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveServiceEdit(item)}
                                disabled={editingServiceSubmitting}
                                className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {editingServiceSubmitting
                                  ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                                  : (locale === "ar" ? "تطبيق" : "Apply")}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </WorkspacePanel>

              {guestCards.length > 0 ? (
                <WorkspacePanel
                  title={locale === "ar" ? "بيانات الضيوف" : "Guest details"}
                  subtitle={guestCards.length > 1
                    ? (locale === "ar" ? `${guestCards.length} ضيوف` : `${guestCards.length} guests`)
                    : (locale === "ar" ? "ضيف واحد" : "1 guest")}
                >
                  <div className="space-y-3">
                    {guestCards.map((guest, index) => (
                      <div
                        key={`${guest.id}-${index}`}
                        className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-gray-900">{guest.fullName}</p>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200">
                                {guest.isFree ? (locale === "ar" ? "مجاني" : "Free") : (locale === "ar" ? "مدفوع" : "Paid")}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                              {guest.phone ? (
                                <a href={`tel:${guest.phone}`} className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-gray-200 hover:bg-gray-50">
                                  {guest.phone}
                                </a>
                              ) : null}
                              {guest.email ? (
                                <a href={`mailto:${guest.email}`} className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-gray-200 hover:bg-gray-50">
                                  {guest.email}
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-700">
                              {locale === "ar" ? "السعر" : "Price"}
                            </p>
                            <p className="mt-1 text-sm font-bold text-fuchsia-800">
                              {guest.isFree ? (locale === "ar" ? "مجاني" : "Free") : <Currency amount={Number(guest.servicePrice || 0)} />}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white bg-white px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                              {locale === "ar" ? "الخدمة" : "Service"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {guest.serviceName || (locale === "ar" ? "غير محددة" : "Not set")}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                              {locale === "ar" ? "الموظف" : "Provider"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {guest.staffName || (locale === "ar" ? "تعيين تلقائي" : "Auto assign")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </WorkspacePanel>
              ) : null}

              <WorkspacePanel title={locale === "ar" ? "ملخص الدفع" : "Payment summary"}>
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
                        {locale === "ar" ? "الحالة المالية" : "Financial state"}
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-gray-900">
                        {getPaymentStatusLabel(currentPaymentStatus, locale)}
                      </h4>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                      {locale === "ar"
                        ? `${Math.max(0, Math.round((paidAmount / Math.max(totalAmount, 1)) * 100))}% مدفوع`
                        : `${Math.max(0, Math.round((paidAmount / Math.max(totalAmount, 1)) * 100))}% paid`}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { key: "review", label: locale === "ar" ? "مراجعة" : "Review" },
                        { key: "payment", label: locale === "ar" ? "الدفع" : "Payment" },
                        { key: "confirmed", label: locale === "ar" ? "تأكيد" : "Confirmation" }
                      ].map((step, index) => {
                        const active = checkoutFlowStage === step.key;
                        return (
                          <div key={step.key} className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                                active
                                  ? "bg-primary text-white ring-primary"
                                  : "bg-gray-100 text-gray-600 ring-gray-200"
                              }`}
                            >
                              {step.label}
                            </span>
                            {index < 2 ? <span className="h-px w-6 bg-gray-200" /> : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span>
                        {locale === "ar" ? "المرحلة الحالية" : "Current stage"}
                      </span>
                      <span className="font-semibold text-gray-700">{checkoutFlowStageLabel}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                        {locale === "ar" ? "الخدمات" : "Services"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        <Currency amount={subtotalAmount} />
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">
                        {locale === "ar" ? "الخصومات" : "Discounts"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        {discountAmount > 0 ? <Currency amount={discountAmount} /> : (locale === "ar" ? "بدون" : "None")}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {discountedServiceCount > 0
                          ? (locale === "ar"
                            ? `${discountedServiceCount} خدمة عليها خصم فعلي`
                            : `${discountedServiceCount} discounted service${discountedServiceCount === 1 ? "" : "s"}`)
                          : (locale === "ar" ? "لا توجد خصومات محفوظة" : "No saved discounts")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                        {locale === "ar" ? "المدفوع" : "Paid"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        <Currency amount={paidAmount} />
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                        {locale === "ar" ? "المتبقي" : "Remaining"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        <Currency amount={remainingAmount} />
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-600">{locale === "ar" ? "الضريبة" : "Tax"}</span>
                      <Currency amount={taxAmount} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-600">{locale === "ar" ? "العربون" : "Deposit"}</span>
                      <Currency amount={depositAmount} />
                    </div>
                    <div className="mt-2 border-t border-gray-200 pt-2">
                      <div className="flex items-center justify-between gap-3 text-base">
                        <span className="font-semibold text-gray-900">{locale === "ar" ? "الإجمالي النهائي" : "Final total"}</span>
                        <Currency amount={totalAmount} className="text-sm font-bold" />
                      </div>
                    </div>
                  </div>

                  {discountAmount > 0 ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                            {locale === "ar" ? "تفصيل الخصم" : "Discount breakdown"}
                          </p>
                          <p className="mt-1 text-sm text-amber-900">
                            {locale === "ar"
                              ? "تظهر التخفيضات المحفوظة لكل خدمة حتى يظل السعر النهائي واضحًا."
                              : "Saved discounts are shown per service so the final total stays obvious."}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                          -<Currency amount={discountAmount} />
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {servicePricingDetails
                          .filter((entry) => entry.itemDiscountAmount > 0)
                          .slice(0, 3)
                          .map((entry) => (
                            <span key={entry.id} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                              {entry.itemServiceName} • -<Currency amount={entry.itemDiscountAmount} />
                            </span>
                          ))}
                        {discountedServiceCount > 3 ? (
                          <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                            +{discountedServiceCount - 3}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </WorkspacePanel>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
                <WorkspacePanel title={locale === "ar" ? "سجل النشاط" : "Activity timeline"}>
                  <div className="space-y-2.5">
                    {timelineAuditEntries.length > 0 ? (
                      timelineAuditEntries.map((entry, index) => (
                        <div key={`${entry.label}-${entry.timestamp}-${index}`} className="flex gap-3">
                          <div className="flex flex-col items-center pt-0.5">
                            <span className={`h-3 w-3 rounded-full ring-4 ring-white ${entry.tone.includes("blue") ? "bg-blue-500" : entry.tone.includes("emerald") ? "bg-emerald-500" : entry.tone.includes("sky") ? "bg-sky-500" : entry.tone.includes("rose") ? "bg-rose-500" : "bg-gray-800"}`} />
                            {index !== timelineAuditEntries.length - 1 ? <span className="h-full w-px bg-gray-200" /> : null}
                          </div>
                          <div className={`flex-1 rounded-2xl border px-3 py-3 shadow-sm ${entry.tone}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold">{entry.label}</p>
                                <p className="mt-1 text-xs opacity-80">{entry.value}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600 ring-1 ring-white/80">
                                {formatDateTime(entry.timestamp, locale)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-7 text-center text-sm text-gray-500">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M5 4a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2V8.5L13.5 4H5zm0 2h7v3h3v5H5V6z" />
                          </svg>
                        </div>
                        <p className="mt-3 font-medium text-gray-700">{locale === "ar" ? "لا يوجد نشاط بعد." : "No activity yet."}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {locale === "ar"
                            ? "ستظهر هنا عمليات تغيير الحالة، إعادة الجدولة، والدفع فور حدوثها."
                            : "Status changes, reschedules, and payments will appear here as they happen."}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Link
                      href={`/${locale}/dashboard/appointments/${appointment.id}`}
                      onClick={onClose}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "عرض كل النشاط" : "View all activity"}
                    </Link>
                  </div>
                </WorkspacePanel>

                <WorkspacePanel
                  title={locale === "ar" ? "ملاحظات" : "Notes"}
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        const notesSection = document.getElementById("appointment-notes-section");
                        notesSection?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "إضافة ملاحظة" : "Add note"}
                    </button>
                  }
                >
                  <div id="appointment-notes-section" className="rounded-2xl border border-gray-200 bg-gray-50 p-3.5">
                    {cleanAppointmentNotes ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{cleanAppointmentNotes}</p>
                    ) : (
                      <p className="text-sm text-gray-500">{locale === "ar" ? "لا توجد ملاحظات." : "No notes yet."}</p>
                    )}
                  </div>
                </WorkspacePanel>
              </div>

              {paymentCollectionOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/30 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-2xl">
                    <div className="border-b border-gray-200 bg-gradient-to-br from-violet-50 via-white to-rose-50 px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500 ring-1 ring-violet-100">
                          {locale === "ar" ? "تحصيل الدفع" : "Collect payment"}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-gray-900">
                          {locale === "ar" ? "اختر طريقة أو أكثر للدفع" : "Choose one or more payment methods"}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {locale === "ar"
                            ? "يمكنك الدفع بطريقة واحدة أو تقسيم المبلغ بين أكثر من وسيلة."
                            : "You can pay with one method or split the amount across multiple methods."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closePaymentCollection}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
                        aria-label={locale === "ar" ? "إغلاق" : "Close"}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 10-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                              {locale === "ar" ? "حالة التوزيع" : "Allocation status"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{paymentCollectionStatus}</p>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            paymentCollectionMismatch
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          }`}>
                            {paymentCollectionMismatch
                              ? (locale === "ar" ? "بحاجة لضبط" : "Needs adjustment")
                              : (locale === "ar" ? "جاهز" : "Ready")}
                          </div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={`h-full rounded-full transition-all ${
                              paymentCollectionMismatch ? "bg-amber-400" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, paymentCollectionProgress * 100))}%` }}
                          />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                              {locale === "ar" ? "المبلغ المستحق" : "Amount due"}
                            </p>
                            <p className="mt-1 text-sm font-bold text-gray-900">
                              <Currency amount={paymentDueAmount} />
                            </p>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                              {locale === "ar" ? "المجموع الحالي" : "Current total"}
                            </p>
                            <p className="mt-1 text-sm font-bold text-gray-900">
                              <Currency amount={paymentCollectionTotal} />
                            </p>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                              {locale === "ar" ? "المتبقي" : "Remaining"}
                            </p>
                            <p className="mt-1 text-sm font-bold text-gray-900">
                              <Currency amount={paymentCollectionRemaining} />
                            </p>
                          </div>
                        </div>
                        <div
                          className={`mt-3 rounded-2xl border px-3 py-2 text-xs font-semibold ${
                            paymentCollectionMismatch
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {paymentCollectionMismatch
                            ? (
                              locale === "ar"
                                ? `الفرق الحالي ${paymentCollectionDifferenceLabel} SAR. عدّل المبالغ حتى يساوي الإجمالي المبلغ المستحق.`
                                : `Current difference is ${paymentCollectionDifferenceLabel} SAR. Adjust the rows until the total matches the amount due.`
                            )
                            : (
                              locale === "ar"
                                ? "الإجمالي يطابق المبلغ المستحق."
                                : "The split total matches the amount due."
                            )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {paymentCollectionRows.map((row, index) => (
                          <div key={row.id} className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm transition hover:border-primary/20">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                                {index + 1}
                              </div>
                              <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
                                <label className="block">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                    {locale === "ar" ? "طريقة الدفع" : "Payment method"}
                                  </span>
                                  <select
                                    value={row.paymentMethod}
                                    onChange={(event) => updatePaymentCollectionRow(row.id, { paymentMethod: event.target.value as PaymentCollectionMethod })}
                                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  >
                                    {paymentMethodOptions.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                    {locale === "ar" ? "المبلغ" : "Amount"}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.amount}
                                    onChange={(event) => updatePaymentCollectionRow(row.id, { amount: event.target.value })}
                                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  />
                                </label>
                              </div>
                              <div className="flex items-center gap-2">
                                {paymentCollectionRows.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => removePaymentCollectionRow(row.id)}
                                    className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                  >
                                    {locale === "ar" ? "حذف" : "Remove"}
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {row.paymentMethod === "gift_card_code" ? (
                              <label className="mt-3 block">
                                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  {locale === "ar" ? "رمز بطاقة الهدية" : "Gift card code"}
                                </span>
                                <input
                                  type="text"
                                  value={row.giftCardCode}
                                  onChange={(event) => updatePaymentCollectionRow(row.id, { giftCardCode: event.target.value })}
                                  placeholder={locale === "ar" ? "أدخل الرمز" : "Enter code"}
                                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </label>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={addPaymentCollectionRow}
                          className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-primary/40 hover:bg-purple-50"
                        >
                          {locale === "ar" ? "إضافة طريقة" : "Add method"}
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={closePaymentCollection}
                            className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                          >
                            {locale === "ar" ? "إلغاء" : "Cancel"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitPaymentCollection()}
                            disabled={paymentCollectionSubmitting || paymentCollectionMismatch}
                            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {paymentCollectionSubmitting
                              ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                              : (locale === "ar" ? "تطبيق الدفع" : "Apply payment")}
                          </button>
                        </div>
                      </div>

                      {paymentCollectionMismatch ? (
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                          {locale === "ar"
                            ? "لا يمكن تطبيق الدفع قبل أن يساوي الإجمالي المبلغ المستحق."
                            : "You cannot apply payment until the total matches the amount due."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="sticky bottom-0 z-20 border-t border-gray-200 bg-white/95 pt-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-gray-200 bg-white px-3.5 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {locale === "ar" ? "الإجراء الأساسي" : "Primary action"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {primaryCheckoutActionLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePayNow()}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                        paymentDueAmount > 0
                          ? "bg-violet-600 text-white shadow-sm hover:bg-violet-500"
                          : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      {locale === "ar" ? "ادفع الآن" : "Pay now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCheckout()}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                        paymentDueAmount <= 0
                          ? "bg-gray-900 text-white shadow-sm hover:bg-gray-800"
                          : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      {locale === "ar" ? "إنهاء" : "Checkout"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void refreshAppointment();
                        setActionNotice({
                          kind: "success",
                          message: locale === "ar" ? "تم حفظ التغييرات." : "Changes saved."
                        });
                      }}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "حفظ التغييرات" : "Save changes"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
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
      { key: "wallet", label: locale === "ar" ? "المحفظة" : "Wallet" },
      { key: "profile", label: locale === "ar" ? "الملف" : "Profile" },
      { key: "appointments", label: locale === "ar" ? "المواعيد" : "Appointments" },
      { key: "transactions", label: locale === "ar" ? "المعاملات" : "Transactions" },
      { key: "reviews", label: locale === "ar" ? "المراجعات" : "Reviews" }
    ];

    const renderCustomerTabContent = () => {
      switch (customerTab) {
        case "overview":
          return renderOverview();
        case "wallet":
          return renderWallet();
        case "profile":
          return renderProfile();
        case "appointments":
          return renderAppointments();
        case "transactions":
          return renderTransactions();
        case "reviews":
          return renderReviews();
      }
    };

    return (
      <div className="h-full p-3 lg:p-4">
        <div className="grid h-full gap-4 xl:grid-cols-[340px_260px_minmax(0,1fr)]">
          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <WorkspacePanel
              title={locale === "ar" ? "الملف الشخصي" : "Customer profile"}
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
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <div className={`flex flex-col items-center text-center ${isRTL ? "rtl" : ""}`}>
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-bold text-primary ring-1 ring-gray-200">
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
                  <p className="mt-3 truncate text-xl font-bold text-gray-900">{customerFullName}</p>
                  <p className="mt-1 truncate text-sm text-gray-600">{customerProfile?.email || "-"}</p>
                  <p className="mt-0.5 truncate text-sm text-gray-600">{customerProfile?.phone || "-"}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {customerProfile?.loyaltyTier ? (
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                        {customerProfile.loyaltyTier}
                      </span>
                    ) : null}
                    {customerIsWalkIn ? (
                      <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                        {locale === "ar" ? "حضور مباشر" : "Walk-in"}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex w-full items-center gap-2">
                    <button
                      type="button"
                      ref={customerActionsButtonRef}
                      onClick={toggleCustomerActionsMenu}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "إجراءات" : "Actions"}
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={openCustomerWorkspace}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                    >
                      {locale === "ar" ? "الملف" : "Profile"}
                    </button>
                  </div>
                  <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "الانضمام" : "Joined"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-900">
                        {customerProfile?.joinedAt ? formatDateTime(customerProfile.joinedAt, locale).split(",")[0] || "-" : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "اللغة" : "Language"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-900">
                        {customerProfile?.preferredLanguage ? customerProfile.preferredLanguage.toUpperCase() : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "النوع" : "Gender"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-900 capitalize">{customerProfile?.gender || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "الحجوزات" : "Bookings"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-900">{customerProfile?.totalBookings ?? 0}</p>
                    </div>
                  </div>
                  {customerActionsOpen && customerActionsMenuStyle ? (
                    <div
                      id="customer-actions-menu"
                      className="fixed z-[9999] w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
                      style={{
                        top: `${customerActionsMenuStyle.top}px`,
                        left: customerActionsMenuStyle.left != null ? `${customerActionsMenuStyle.left}px` : undefined,
                        right: customerActionsMenuStyle.right != null ? `${customerActionsMenuStyle.right}px` : undefined
                      }}
                    >
                      <button
                        type="button"
                        onClick={openCustomerFullProfile}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        {locale === "ar" ? "عرض الملف الكامل" : "View full profile"}
                      </button>
                      <button
                        type="button"
                        onClick={openCustomerWhatsApp}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        {locale === "ar" ? "إرسال واتساب" : "Send WhatsApp"}
                      </button>
                      <button
                        type="button"
                        onClick={callCustomer}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        {locale === "ar" ? "اتصال" : "Call customer"}
                      </button>
                      <button
                        type="button"
                        onClick={jumpToCustomerNotes}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        {locale === "ar" ? "إضافة ملاحظة" : "Add note"}
                      </button>
                    </div>
                  ) : null}
              </div>
            </div>

              {guestCards.length > 0 ? (
                <WorkspacePanel
                  title={locale === "ar" ? "الضيوف" : "Guests"}
                  subtitle={guestCards.length > 1
                    ? (locale === "ar" ? `${guestCards.length} ضيوف مرتبطون` : `${guestCards.length} related guests`)
                    : (locale === "ar" ? "ضيف مرتبط" : "Related guest")}
                >
                  <div className="space-y-3">
                    {guestCards.map((guest, index) => (
                      <div key={`${guest.id}-${index}`} className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{guest.fullName}</p>
                            <p className="mt-1 text-xs text-gray-600">
                              {guest.serviceName || (locale === "ar" ? "الخدمة" : "Service")}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200">
                            {guest.isFree ? (locale === "ar" ? "مجاني" : "Free") : <Currency amount={Number(guest.servicePrice || 0)} />}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                          {guest.phone ? <span className="rounded-full bg-white px-2.5 py-1 text-gray-600 ring-1 ring-gray-200">{guest.phone}</span> : null}
                          {guest.email ? <span className="rounded-full bg-white px-2.5 py-1 text-gray-600 ring-1 ring-gray-200">{guest.email}</span> : null}
                          <span className="rounded-full bg-white px-2.5 py-1 text-gray-600 ring-1 ring-gray-200">
                            {guest.staffName || (locale === "ar" ? "تعيين تلقائي" : "Auto assign")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </WorkspacePanel>
              ) : null}

              <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "تفاصيل سريعة" : "Quick details"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {locale === "ar" ? "الرصيد" : "Wallet"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      <Currency amount={Number(customerProfile?.walletBalance || 0)} />
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {locale === "ar" ? "الحجوزات" : "Bookings"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900">{customerProfile?.totalBookings ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {locale === "ar" ? "المدفوع" : "Spent"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      <Currency amount={Number(customerProfile?.totalSpent || 0)} />
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {locale === "ar" ? "اللغة" : "Language"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {customerProfile?.preferredLanguage ? customerProfile.preferredLanguage.toUpperCase() : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {locale === "ar" ? "النوع" : "Gender"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900 capitalize">{customerProfile?.gender || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {locale === "ar" ? "الإنشاء" : "Joined"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      {customerProfile?.joinedAt ? formatDateTime(customerProfile.joinedAt, locale).split(",")[0] || "-" : "-"}
                    </p>
                  </div>
                </div>
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
            </WorkspacePanel>
          </div>

          <div className="xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-3xl border border-gray-200 bg-white/95 p-2.5 shadow-sm backdrop-blur">
              <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {locale === "ar" ? "التنقل" : "Navigation"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {locale === "ar" ? "مساحات CRM" : "CRM workspace"}
                  </p>
                </div>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">
                  {locale === "ar" ? "ثابت" : "Sticky"}
                </span>
              </div>
              <div className="grid gap-1.5">
                {customerTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCustomerTab(tab.key)}
                    className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold transition ${
                      customerTab === tab.key
                        ? "bg-primary text-white shadow-sm ring-1 ring-primary/20"
                        : "bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "المحتوى" : "Content"}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {customerTabs.find((tab) => tab.key === customerTab)?.label || ""}
                </p>
              </div>
              <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                CRM
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4">
            {customerWorkspaceLoading ? (
              <div className="grid gap-4 xl:grid-cols-[340px_260px_minmax(0,1fr)]">
                <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-gray-200" />
                  <div className="mx-auto h-5 w-40 animate-pulse rounded-full bg-gray-200" />
                  <div className="mx-auto h-4 w-28 animate-pulse rounded-full bg-gray-200" />
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="h-14 animate-pulse rounded-2xl bg-gray-100" />
                    ))}
                  </div>
                </div>
                <div className="space-y-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200" />
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="h-10 animate-pulse rounded-2xl bg-gray-100" />
                  ))}
                </div>
                <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="h-4 w-32 animate-pulse rounded-full bg-gray-200" />
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
                    ))}
                  </div>
                  <div className="h-32 animate-pulse rounded-3xl bg-gray-100" />
                </div>
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
        </div>
      </div>
    );
  };
  if (!open) {
    return null;
  }

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-bold text-gray-900">{locale === "ar" ? "نظرة عامة" : "Overview"}</h3>
        <Link
          href={customerProfile ? `/${locale}/dashboard/customers/${customerProfile.id}/wallet` : customerProfileLink}
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
        >
          {locale === "ar" ? "عرض المحفظة" : "View wallet"}
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 5h8v8M15 5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">{locale === "ar" ? "المحفظة" : "Wallet"}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              {locale === "ar" ? "الرصيد الحالي" : "Current balance"}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              <Currency amount={Number(customerProfile?.walletBalance || 0)} />
            </p>
          </div>
          <Link
            href={customerProfileLink}
            onClick={onClose}
            className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            {locale === "ar" ? "المحفظة" : "Wallet"}
          </Link>
        </div>
      </div>

      {(() => {
        const reviewRatings = (customerProfile?.reviews || [])
          .map((review) => Number(review.rating || 0))
          .filter((rating) => Number.isFinite(rating) && rating > 0);
        const averageRating = reviewRatings.length
          ? reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length
          : 0;
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricTile label={locale === "ar" ? "المواعيد" : "Appointments"} value={customerProfile?.totalBookings ?? 0} />
            <MetricTile
              label={locale === "ar" ? "التقييم" : "Rating"}
              value={averageRating ? `${averageRating.toFixed(1)} ★` : "-"}
            />
            <MetricTile
              label={locale === "ar" ? "الإلغاءات" : "Canceled"}
              value={customerProfile?.cancellationCount ?? 0}
            />
            <MetricTile
              label={locale === "ar" ? "عدم الحضور" : "No show"}
              value={customerProfile?.noShowCount ?? 0}
            />
          </div>
        );
      })()}

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
          <div id="customer-overview-notes">
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
        </WorkspacePanel>
      )}
    </div>
  );

  const renderWallet = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-bold text-gray-900">{locale === "ar" ? "المحفظة" : "Wallet"}</h3>
        <Link
          href={customerProfile ? `/${locale}/dashboard/customers/${customerProfile.id}/wallet` : customerProfileLink}
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
        >
          {locale === "ar" ? "فتح المحفظة" : "Open wallet"}
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 5h8v8M15 5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile label={locale === "ar" ? "الرصيد" : "Balance"} value={<Currency amount={Number(customerProfile?.walletBalance || 0)} />} />
        <MetricTile label={locale === "ar" ? "إيداعات" : "Recharges"} value={walletRechargeEntries.length} />
        <MetricTile label={locale === "ar" ? "بطاقات الهدايا" : "Gift cards"} value={customerGiftCardTransactions.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">
              $
            </span>
            <h4 className="text-lg font-semibold text-gray-900">
              {locale === "ar" ? "نشاط المحفظة" : "Wallet activity"}
            </h4>
          </div>
          <div className="space-y-3">
            {customerWalletLedgerEntries.length > 0 ? customerWalletLedgerEntries.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {entry.type.split('_').join(' ')}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDateTime(entry.createdAt, locale)}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {locale === "ar" ? "قبل" : "Before"} <Currency amount={entry.balanceBefore} /> {' '}
                      {locale === "ar" ? "بعد" : "after"} <Currency amount={entry.balanceAfter} />
                    </p>
                    {(entry.referenceType || entry.referenceId) && (
                      <p className="mt-1 text-xs text-gray-500">
                        {entry.referenceType || '-'}
                        {entry.referenceId ? ` #${entry.referenceId}` : ''}
                      </p>
                    )}
                  </div>
                    <div className={`text-sm font-bold ${entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {entry.direction === 'credit' ? '+' : '-'}<Currency amount={entry.amount} />
                  </div>
                </div>
              </article>
            )) : (
              <p className="text-sm text-gray-500">
                {locale === "ar" ? "لا توجد حركات محفظة حتى الآن." : "No wallet activity yet."}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">
              G
            </span>
            <h4 className="text-lg font-semibold text-gray-900">
              {locale === "ar" ? "بطاقات الهدايا" : "Gift cards"}
            </h4>
          </div>
          <div className="space-y-3">
            {customerGiftCardTransactions.length > 0 ? customerGiftCardTransactions.map((tx) => {
              const isSent = tx.senderPlatformUserId === customerProfile?.id;
              return (
                <article key={tx.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{tx.packageTitle}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {isSent ? (locale === "ar" ? "مرسلة" : "Sent") : (locale === "ar" ? "مستلمة" : "Received")}
                        {' • '}
                        {formatDateTime(tx.createdAt, locale)}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {locale === "ar" ? "الحالة" : "Status"}: {tx.status}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {locale === "ar" ? "القناة" : "Channel"}: {tx.deliveryChannel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        <Currency amount={tx.totalCreditAmount} />
                      </p>
                      {tx.claimedAt ? (
                        <p className="mt-1 text-xs text-emerald-600">
                          {locale === "ar" ? "تم الاستلام" : "Claimed"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            }) : (
              <p className="text-sm text-gray-500">
                {locale === "ar" ? "لا توجد بطاقات هدايا حتى الآن." : "No gift cards yet."}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-bold text-gray-900">{locale === "ar" ? "الملف" : "Profile"}</h3>
        <Link
          href={customerProfileLink}
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
        >
          {locale === "ar" ? "فتح الملف الكامل" : "Open full profile"}
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 5h8v8M15 5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-bold text-primary ring-1 ring-gray-200">
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
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-xl font-bold text-gray-900">{customerFullName}</h4>
            <p className="mt-1 truncate text-sm text-gray-600">{customerProfile?.email || "-"}</p>
            <p className="mt-0.5 truncate text-sm text-gray-600">{customerProfile?.phone || "-"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {customerProfile?.loyaltyTier ? (
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                  {customerProfile.loyaltyTier}
                </span>
              ) : null}
              {customerIsWalkIn ? (
                <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                  {locale === "ar" ? "حضور مباشر" : "Walk-in"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricTile label={locale === "ar" ? "البريد الإلكتروني" : "Email"} value={customerProfile?.email || "-"} />
        <MetricTile label={locale === "ar" ? "الهاتف" : "Phone"} value={customerProfile?.phone || "-"} />
        <MetricTile label={locale === "ar" ? "النوع" : "Gender"} value={customerProfile?.gender || "-"} />
        <MetricTile
          label={locale === "ar" ? "تاريخ الميلاد" : "Date of birth"}
          value={customerProfile?.dateOfBirth ? formatDateTime(customerProfile.dateOfBirth, locale).split(",")[0] || "-" : "-"}
        />
        <MetricTile
          label={locale === "ar" ? "اللغة المفضلة" : "Preferred language"}
          value={customerProfile?.preferredLanguage ? customerProfile.preferredLanguage.toUpperCase() : "-"}
        />
        <MetricTile
          label={locale === "ar" ? "تاريخ الإنشاء" : "Joined"}
          value={customerProfile?.joinedAt ? formatDateTime(customerProfile.joinedAt, locale).split(",")[0] || "-" : "-"}
        />
      </div>

      {(customerProfile?.notes || (customerProfile?.tags && customerProfile.tags.length > 0)) && (
        <WorkspacePanel title={locale === "ar" ? "ملاحظات" : "Notes"}>
          <div id="customer-overview-notes">
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
        </WorkspacePanel>
      )}
    </div>
  );

  const renderReviews = () => {
    const reviewRatings = customerReviews
      .map((review) => Number(review.rating || 0))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    const averageRating = reviewRatings.length
      ? reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length
      : 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-bold text-gray-900">{locale === "ar" ? "المراجعات" : "Reviews"}</h3>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            {customerReviews.length} {locale === "ar" ? "مراجعة" : "reviews"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile label={locale === "ar" ? "المعدل" : "Average"} value={averageRating ? `${averageRating.toFixed(1)} ★` : "-"} />
          <MetricTile label={locale === "ar" ? "الموجودة" : "Available"} value={customerReviews.length} />
          <MetricTile label={locale === "ar" ? "الخدمات" : "Services"} value={customerReviews.length ? "Yes" : "-"} />
        </div>

        <div className="space-y-3">
          {customerReviews.length > 0 ? customerReviews.map((review) => (
            <article key={review.id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                      {locale === "ar" ? "مراجعة" : "Review"}
                    </span>
                    {review.rating ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {review.rating} ★
                      </span>
                    ) : null}
                  </div>
                  <h4 className="mt-2 text-base font-bold text-gray-900">{review.serviceName || "-"}</h4>
                  <p className="mt-1 text-sm text-gray-500">{review.date ? formatDateTime(review.date, locale) : "-"}</p>
                  {review.comment ? <p className="mt-3 text-sm leading-6 text-gray-700">{review.comment}</p> : null}
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.602-.921 1.902 0l1.058 3.25a1 1 0 00.95.69h3.416c.969 0 1.371 1.24.588 1.81l-2.765 2.009a1 1 0 00-.364 1.118l1.058 3.25c.3.921-.755 1.688-1.54 1.118l-2.765-2.01a1 1 0 00-1.175 0l-2.765 2.01c-.785.57-1.84-.197-1.54-1.118l1.058-3.25a1 1 0 00-.364-1.118L2.497 8.677c-.783-.57-.38-1.81.588-1.81H6.5a1 1 0 00.95-.69l1.058-3.25z" />
                </svg>
              </div>
              <p className="mt-3 font-medium text-gray-700">{locale === "ar" ? "لا توجد مراجعات لهذا العميل." : "No reviews from this customer yet."}</p>
              <p className="mt-1 text-xs text-gray-500">
                {locale === "ar"
                  ? "ستظهر المراجعات هنا بعد أن يرسل العميل تقييمًا."
                  : "Reviews will appear here once the customer leaves feedback."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

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
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5 4a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2V8.5L13.5 4H5zm0 2h7v3h3v5H5V6z" />
            </svg>
          </div>
          <p className="mt-3 font-medium text-gray-700">{locale === "ar" ? "لا توجد مواعيد متاحة." : "No appointments available."}</p>
          <p className="mt-1 text-xs text-gray-500">
            {locale === "ar"
              ? "ستظهر هنا المواعيد السابقة واللاحقة للعميل."
              : "Past and upcoming appointments for this customer will appear here."}
          </p>
        </div>
      )}
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-3">
      {customerTransactionsLoading ? (
        <div className="space-y-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="h-3 w-40 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-56 animate-pulse rounded-full bg-gray-200" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-9 w-20 animate-pulse rounded-full bg-gray-100" />
                ))}
              </div>
            </div>
          </div>
          {[...Array(3)].map((_, index) => (
            <div key={index} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
                    <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                    <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                  </div>
                  <div className="h-4 w-48 animate-pulse rounded-full bg-gray-200" />
                  <div className="h-4 w-32 animate-pulse rounded-full bg-gray-100" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
                  <div className="h-3 w-20 animate-pulse rounded-full bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
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
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M4 4.5A2.5 2.5 0 016.5 2h7A2.5 2.5 0 0116 4.5V16a1 1 0 01-1.447.894L10 14.118l-4.553 2.776A1 1 0 014 16V4.5zm2.5-.5a.5.5 0 00-.5.5v9.717l3.553-2.166a1 1 0 011.042 0L14.5 14.217V4.5a.5.5 0 00-.5-.5h-7z" />
                </svg>
              </div>
              <p className="mt-3 font-medium text-gray-700">{locale === "ar" ? "لا توجد معاملات مطابقة للفلتر." : "No transactions match the selected filters."}</p>
              <p className="mt-1 text-xs text-gray-500">
                {locale === "ar"
                  ? "جرّب تغيير نوع المعاملة أو حالتها لعرض نتائج أكثر."
                  : "Try changing the transaction type or status to see more results."}
              </p>
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
        className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-[60rem] bg-white shadow-2xl lg:top-[88px] lg:h-[calc(100dvh-88px)] lg:w-[88vw] lg:max-w-[88vw] 2xl:w-[84vw] 2xl:max-w-[84vw]`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
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
              <div className="space-y-4 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-4 xl:grid-cols-[340px_260px_minmax(0,1fr)]">
                  <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-gray-200" />
                    <div className="mx-auto h-5 w-40 animate-pulse rounded-full bg-gray-200" />
                    <div className="mx-auto h-4 w-28 animate-pulse rounded-full bg-gray-200" />
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {[...Array(4)].map((_, index) => (
                        <div key={index} className="h-14 animate-pulse rounded-2xl bg-gray-100" />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200" />
                    <div className="space-y-2">
                      {[...Array(6)].map((_, index) => (
                        <div key={index} className="h-10 animate-pulse rounded-2xl bg-gray-100" />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="h-4 w-32 animate-pulse rounded-full bg-gray-200" />
                    <div className="space-y-3">
                      <div className="h-24 animate-pulse rounded-3xl bg-gray-100" />
                      <div className="h-24 animate-pulse rounded-3xl bg-gray-100" />
                      <div className="h-24 animate-pulse rounded-3xl bg-gray-100" />
                    </div>
                  </div>
                </div>
              </div>
            ) : appointment ? (
              <div className="h-full">
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
