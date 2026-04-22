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
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'deposit_paid' | 'fully_paid' | 'paid' | 'refunded' | 'partially_refunded';
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

interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileImage?: string | null;
  gender?: string | null;
  totalBookings?: number;
  totalSpent?: number;
  firstVisit?: string | null;
  lastVisit?: string | null;
  notes?: string;
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
  const [customerExpanded, setCustomerExpanded] = useState(false);

  useEffect(() => {
    if (!open || !appointmentId) {
      setAppointment(null);
      setCustomerProfile(null);
      setCustomerExpanded(false);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadAppointment = async () => {
      try {
        setLoading(true);
        setError("");
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
    if (!open || !appointment?.user?.id || !customerExpanded) {
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
  }, [open, appointment, customerExpanded, customerProfile?.id]);

  const serviceName = useMemo(() => {
    if (!appointment) return "";
    return locale === "ar" ? appointment.service.name_ar : appointment.service.name_en;
  }, [appointment, locale]);

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

  return (
    <div className="fixed inset-0 z-[65]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" onClick={onClose} />

      <aside
        className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-[38rem] bg-white shadow-2xl`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                {locale === "ar" ? "تفاصيل الموعد" : "Appointment Details"}
              </p>
              <h3 className="mt-1 text-xl font-bold text-gray-900">
                {appointment ? `${serviceName}` : (locale === "ar" ? "جارٍ التحميل..." : "Loading...")}
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
                    <button
                      type="button"
                      onClick={() => setCustomerExpanded((current) => !current)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-1 text-left transition hover:bg-gray-50 ${isRTL ? "flex-row-reverse text-right" : ""}`}
                    >
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
                            {locale === "ar" ? "اضغط لعرض بيانات العميل" : "Tap to view customer data"}
                          </p>
                        </div>
                      </div>
                      <svg
                        className={`h-5 w-5 text-gray-400 transition ${customerExpanded ? "rotate-180" : ""}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.18l3.71-3.95a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {customerExpanded && (
                      <div className="mt-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200">
                        {customerLoading ? (
                          <div className="text-sm text-gray-500">
                            {locale === "ar" ? "جارٍ تحميل بيانات العميل..." : "Loading customer data..."}
                          </div>
                        ) : customerProfile ? (
                          <div className="space-y-3">
                            <div className={`flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  {locale === "ar" ? "ملف العميل" : "Customer profile"}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                  {customerProfile.firstName} {customerProfile.lastName}
                                </p>
                              </div>
                              <Link
                                href={`/${locale}/dashboard/customers/${customerProfile.id}`}
                                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90"
                              >
                                {locale === "ar" ? "فتح الملف" : "Open profile"}
                              </Link>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  {locale === "ar" ? "البريد" : "Email"}
                                </p>
                                <p className="mt-1 break-all text-sm text-gray-900">{customerProfile.email}</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  {locale === "ar" ? "الهاتف" : "Phone"}
                                </p>
                                <p className="mt-1 text-sm text-gray-900">{customerProfile.phone}</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  {locale === "ar" ? "النوع" : "Gender"}
                                </p>
                                <p className="mt-1 text-sm capitalize text-gray-900">{customerProfile.gender || "-"}</p>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                                  {locale === "ar" ? "إجمالي الحجوزات" : "Total bookings"}
                                </p>
                                <p className="mt-1 text-sm text-gray-900">{customerProfile.totalBookings ?? 0}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">
                            {locale === "ar" ? "لا توجد بيانات إضافية متاحة." : "No extra customer data is available yet."}
                          </div>
                        )}
                      </div>
                    )}
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
