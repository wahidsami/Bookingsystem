"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi, getImageUrl, API_BASE_URL } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

function avatarUrl(path: string | undefined): string {
  if (!path) return "";
  return path.startsWith("http") ? path : getImageUrl(path.startsWith("/") ? path.slice(1) : path);
}

interface Service {
  id: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  duration: number;
  category: string;
  image?: string;
  rawPrice?: number;
  taxRate?: number;
  commissionRate?: number;
  finalPrice?: number;
}

interface Employee {
  id: string;
  name: string;
  photo?: string;
  phone?: string;
  email?: string;
  commissionRate?: number;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo?: string;
  profileImage?: string; // API returns customer avatar as profileImage
}

interface Appointment {
  id: string;
  tenantId?: string;
  serviceId?: string;
  staffId?: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'started' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'deposit_paid' | 'fully_paid' | 'paid' | 'refunded' | 'partially_refunded';
  paymentMethod?: string;
  paidAt?: string;
  price: number;
  rawPrice?: number;
  taxAmount?: number;
  platformFee?: number;
  tenantRevenue?: number;
  employeeRevenue?: number;
  employeeCommissionRate?: number;
  employeeCommission?: number;
  depositAmount?: number;
  remainderAmount?: number;
  totalPaid?: number;
  depositPaid?: boolean;
  remainderPaid?: boolean;
  notes?: string;
  service: Service;
  staff: Employee;
  user?: User;
  createdAt: string;
}

interface SlotItem {
  startTime: string;
  endTime: string;
  available: boolean;
  staffId?: string;
  staffName?: string;
}

export default function AppointmentDetailsPage() {
  const t = useTranslations("Appointments");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [recordRemainderMethod, setRecordRemainderMethod] = useState<string>("cash");
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotItem[]>([]);
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<SlotItem | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadAppointment();
    }
  }, [id]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      setError("");
      
      const response = await tenantApi.getAppointment(id as string);
      
      if (response.success && response.appointment) {
        setAppointment(response.appointment);
      } else {
        setError(response.message || t("loadError"));
      }
    } catch (err: any) {
      console.error("Failed to load appointment:", err);
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!appointment) return;
    
    setUpdating(true);
    try {
      const response = await tenantApi.updateAppointmentStatus(appointment.id, newStatus);
      if (response.success) {
        loadAppointment();
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert(err.message || t("updateError"));
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentUpdate = async (paymentStatus: string, paymentMethod?: string) => {
    if (!appointment) return;
    
    setUpdating(true);
    try {
      const response = await tenantApi.updatePaymentStatus(appointment.id, paymentStatus, paymentMethod);
      if (response.success) {
        loadAppointment();
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update payment:", err);
      alert(err.message || t("updateError"));
    } finally {
      setUpdating(false);
    }
  };

  const handleRecordRemainder = async () => {
    if (!appointment) return;
    const remainder = Number(appointment.remainderAmount ?? 0);
    if (remainder <= 0) return;
    setUpdating(true);
    try {
      const response = await tenantApi.recordRemainderPayment(appointment.id, {
        amount: remainder,
        paymentMethod: recordRemainderMethod,
      });
      if (response.success) {
        loadAppointment();
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to record remainder:", err);
      alert(err.message || t("updateError"));
    } finally {
      setUpdating(false);
    }
  };

  const tenantId = appointment?.tenantId ?? (appointment?.service as any)?.tenantId;
  const hoursUntilStart = appointment
    ? (new Date(appointment.startTime).getTime() - Date.now()) / (60 * 60 * 1000)
    : 0;
  const canReschedule =
    appointment &&
    (appointment.status === "confirmed" || appointment.status === "pending") &&
    hoursUntilStart > 24;

  useEffect(() => {
    if (!rescheduleModalOpen || !rescheduleDate || !appointment || !tenantId) return;
    const serviceId = appointment.serviceId ?? appointment.service?.id;
    if (!serviceId) return;
    setRescheduleLoading(true);
    setRescheduleSlots([]);
    setRescheduleSelectedSlot(null);
    fetch(`${API_BASE_URL}/bookings/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        serviceId,
        date: rescheduleDate,
        staffId: appointment.staffId ?? appointment.staff?.id,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = (data.slots || []).filter((s: SlotItem) => s.available);
        setRescheduleSlots(list);
      })
      .catch((err) => {
        console.error("Failed to load slots", err);
        setRescheduleSlots([]);
      })
      .finally(() => setRescheduleLoading(false));
  }, [rescheduleModalOpen, rescheduleDate, appointment?.id, tenantId]);

  const handleRescheduleConfirm = async () => {
    if (!appointment || !rescheduleSelectedSlot) return;
    setRescheduleSubmitting(true);
    try {
      const response = await tenantApi.rescheduleAppointment(appointment.id, {
        startTime: rescheduleSelectedSlot.startTime,
        staffId: rescheduleSelectedSlot.staffId,
      });
      if (response.success) {
        setRescheduleModalOpen(false);
        setRescheduleDate("");
        setRescheduleSelectedSlot(null);
        loadAppointment();
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to reschedule", err);
      alert(err.message || t("updateError"));
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }),
      time: date.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'started': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      case 'no_show': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'fully_paid': return 'bg-green-100 text-green-800 border-green-300';
      case 'deposit_paid': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'refunded': return 'bg-red-100 text-red-800 border-red-300';
      case 'partially_refunded': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t("pending");
      case 'confirmed': return t("confirmed");
      case 'started': return t("inProgress");
      case 'completed': return t("completed");
      case 'cancelled': return t("cancelled");
      case 'no_show': return t("noShow");
      default: return status;
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t("paymentPending");
      case 'deposit_paid': return t("depositPaid") || "Deposit paid";
      case 'paid':
      case 'fully_paid': return t("paid");
      case 'refunded': return t("refunded");
      case 'partially_refunded': return t("partiallyRefunded");
      default: return status;
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </TenantLayout>
    );
  }

  if (error || !appointment) {
    return (
      <TenantLayout>
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("error")}</h3>
          <p className="text-gray-600 mb-6">{error || t("appointmentNotFound")}</p>
          <Link href={`/${locale}/dashboard/appointments`} className="btn btn-primary">
            {t("backToAppointments")}
          </Link>
        </div>
      </TenantLayout>
    );
  }

  const start = formatDateTime(appointment.startTime);
  const end = formatDateTime(appointment.endTime);
  const userName = appointment.user 
    ? `${appointment.user.firstName} ${appointment.user.lastName}`.trim()
    : t("unknownCustomer");

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("appointmentDetails")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {start.date} • {start.time} - {end.time}
            </p>
          </div>
          <Link href={`/${locale}/dashboard/appointments`} className="btn btn-secondary">
            {t("back")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Cards */}
          <div className={`grid grid-cols-2 gap-4 ${isRTL ? 'grid-cols-2' : ''}`}>
            <div className={`card border-2 ${getStatusColor(appointment.status)}`}>
              <div className="text-sm font-medium mb-1">{t("statusLabel")}</div>
              <div className="text-lg font-bold">{getStatusLabel(appointment.status)}</div>
            </div>
            <div className={`card border-2 ${getPaymentStatusColor(appointment.paymentStatus)}`}>
              <div className="text-sm font-medium mb-1">{t("paymentInfo")}</div>
              <div className="text-lg font-bold">{getPaymentStatusLabel(appointment.paymentStatus)}</div>
            </div>
          </div>

          {/* Service Details */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("serviceDetails")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("service")}
                </label>
                <p className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? appointment.service.name_ar : appointment.service.name_en}
                </p>
              </div>
              {appointment.service.description_en || appointment.service.description_ar ? (
                <div>
                  <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("description")}
                  </label>
                  <p className="text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? appointment.service.description_ar : appointment.service.description_en}
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("category")}
                  </label>
                  <p className="text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {appointment.service.category}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("duration")}
                  </label>
                  <p className="text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {appointment.service.duration} {t("minutes")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          {appointment.user && (() => {
            const customerAvatar = appointment.user.photo || appointment.user.profileImage;
            return (
            <div className="card overflow-hidden">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("customerDetails")}
              </h3>
              <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0 relative">
                  {customerAvatar ? (
                    <img
                      src={avatarUrl(customerAvatar)}
                      alt={userName}
                      className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-200 shadow-sm"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center ring-2 ring-gray-200 shadow-sm text-primary-700 font-semibold text-2xl"
                    style={{ display: customerAvatar ? 'none' : 'flex' }}
                  >
                    {appointment.user.firstName?.[0] || ''}{appointment.user.lastName?.[0] || '?'}
                  </div>
                </div>
                <div className="flex-1 min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <p className="text-lg font-semibold text-gray-900 truncate">{userName}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{t("name")}</p>
                  {(appointment.user.email || appointment.user.phone) && (
                    <div className="mt-3 space-y-2">
                      {appointment.user.email && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">{t("email")}</p>
                          <a href={`mailto:${appointment.user.email}`} className="text-sm text-primary-600 hover:underline break-all">
                            {appointment.user.email}
                          </a>
                        </div>
                      )}
                      {appointment.user.phone && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">{t("phone")}</p>
                          <a href={`tel:${appointment.user.phone}`} className="text-sm text-gray-900 hover:underline">
                            {appointment.user.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* Employee Details */}
          <div className="card overflow-hidden">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("employeeDetails")}
            </h3>
            <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="flex-shrink-0 relative">
                {appointment.staff.photo ? (
                  <img
                    src={avatarUrl(appointment.staff.photo)}
                    alt={appointment.staff.name}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-200 shadow-sm"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center ring-2 ring-gray-200 shadow-sm text-primary-700 font-semibold text-2xl"
                  style={{ display: appointment.staff.photo ? 'none' : 'flex' }}
                >
                  {appointment.staff.name?.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?'}
                </div>
              </div>
              <div className="flex-1 min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <p className="text-lg font-semibold text-gray-900 truncate">{appointment.staff.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{t("employee")}</p>
                {(appointment.staff.phone || appointment.staff.email) && (
                  <div className="mt-3 space-y-2">
                    {appointment.staff.phone && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">{t("phone")}</p>
                        <a href={`tel:${appointment.staff.phone}`} className="text-sm text-gray-900 hover:underline">
                          {appointment.staff.phone}
                        </a>
                      </div>
                    )}
                    {appointment.staff.email && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">{t("email")}</p>
                        <a href={`mailto:${appointment.staff.email}`} className="text-sm text-primary-600 hover:underline break-all">
                          {appointment.staff.email}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("notes")}
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {appointment.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Pricing & Actions */}
        <div className="space-y-6">
          {/* Price Breakdown: (raw + platform fee) → tax 15% of that → total */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("priceBreakdown")}
            </h3>
            <div className="space-y-3">
              {appointment.rawPrice != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("rawPrice")}</span>
                  <span className="font-semibold"><Currency amount={appointment.rawPrice} /></span>
                </div>
              )}
              {appointment.platformFee != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("platformFee")}</span>
                  <span className="font-semibold"><Currency amount={appointment.platformFee} /></span>
                </div>
              )}
              {(appointment.rawPrice != null || appointment.platformFee != null) && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{t("subtotalBeforeTax") || "Subtotal (raw + platform fee)"}</span>
                  <span><Currency amount={(Number(appointment.rawPrice) || 0) + (Number(appointment.platformFee) || 0)} /></span>
                </div>
              )}
              {appointment.taxAmount != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("tax")} (15% of subtotal)</span>
                  <span className="font-semibold"><Currency amount={appointment.taxAmount} /></span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="font-bold text-gray-900">{t("totalPrice")}</span>
                <span className="font-bold text-primary text-xl"><Currency amount={appointment.price} /></span>
              </div>
              {appointment.tenantRevenue && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">{t("tenantRevenue")}</span>
                  <span className="font-semibold text-green-600"><Currency amount={appointment.tenantRevenue} /></span>
                </div>
              )}
              {appointment.employeeCommission && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("employeeCommission")}</span>
                  <span className="font-semibold text-blue-600"><Currency amount={appointment.employeeCommission} /></span>
                </div>
              )}
            </div>
          </div>

          {/* Payment summary: total, paid online, remaining — simple and clear */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("paymentSummary")}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{t("totalPrice")}</span>
                <span className="font-bold text-gray-900"><Currency amount={appointment.price} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t("paidOnline")}</span>
                <span className="font-semibold text-green-700">
                  {appointment.paymentStatus === 'pending' ? (
                    <Currency amount={0} />
                  ) : appointment.paymentStatus === 'deposit_paid' || appointment.paymentStatus === 'fully_paid' || appointment.paymentStatus === 'paid' ? (
                    <Currency amount={Number(appointment.depositAmount ?? appointment.totalPaid ?? 0)} />
                  ) : (
                    <Currency amount={Number(appointment.totalPaid ?? appointment.price ?? 0)} />
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">{t("remaining")}</span>
                <span className={`font-bold ${(appointment.paymentStatus === 'deposit_paid' && Number(appointment.remainderAmount ?? 0) > 0) ? 'text-amber-700' : 'text-gray-700'}`}>
                  {appointment.paymentStatus === 'fully_paid' || appointment.paymentStatus === 'paid' ? (
                    t("paidInFull")
                  ) : (
                    <Currency amount={appointment.paymentStatus === 'deposit_paid' ? Number(appointment.remainderAmount ?? 0) : Number(appointment.price ?? 0)} />
                  )}
                </span>
              </div>
            </div>
            {/* Collect remaining at salon — only when deposit_paid */}
            {appointment.paymentStatus === 'deposit_paid' && Number(appointment.remainderAmount ?? 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <p className="text-sm font-medium text-amber-800" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("collectRemainingAtSalon")}
                </p>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("paymentMethod")}
                  </label>
                  <select
                    value={recordRemainderMethod}
                    onChange={(e) => setRecordRemainderMethod(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  >
                    <option value="cash">{t("cash")}</option>
                    <option value="card_pos">{t("cardPos")}</option>
                    <option value="wallet">{t("wallet")}</option>
                  </select>
                  <button
                    onClick={handleRecordRemainder}
                    disabled={updating}
                    className="w-full btn btn-success"
                  >
                    {t("recordRemainderPayment")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("actions")}
            </h3>
            <div className="space-y-3">
              {appointment.status === 'pending' && (
                <button
                  onClick={() => handleStatusUpdate('confirmed')}
                  disabled={updating}
                  className="w-full btn btn-primary"
                >
                  {t("confirm")}
                </button>
              )}
              {(appointment.status === 'confirmed' || appointment.status === 'started') && (
                <button
                  onClick={() => handleStatusUpdate('completed')}
                  disabled={updating}
                  className="w-full btn btn-primary"
                >
                  {t("markCompleted")}
                </button>
              )}
              {appointment.paymentStatus === 'pending' && (
                <button
                  onClick={() => handlePaymentUpdate('fully_paid', 'cash')}
                  disabled={updating}
                  className="w-full btn btn-success"
                >
                  {t("markAsPaid")}
                </button>
              )}
              {canReschedule && (
                <button
                  onClick={() => {
                    setRescheduleDate(new Date().toISOString().slice(0, 10));
                    setRescheduleModalOpen(true);
                  }}
                  disabled={updating}
                  className="w-full btn btn-secondary"
                >
                  {t("reschedule") || "Reschedule"}
                </button>
              )}
              {(appointment.status === 'pending' || appointment.status === 'confirmed' || appointment.status === 'started') && (
                <button
                  onClick={() => handleStatusUpdate('cancelled')}
                  disabled={updating}
                  className="w-full btn btn-error"
                >
                  {t("cancel")}
                </button>
              )}
            </div>
          </div>

          {/* Payment Info */}
          {(appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'fully_paid') && appointment.paidAt && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("paymentInfo")}
              </h3>
              <div className="space-y-2">
                {appointment.paymentMethod && (
                  <div>
                    <span className="text-sm text-gray-600">{t("paymentMethod")}: </span>
                    <span className="font-semibold">{appointment.paymentMethod}</span>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-600">{t("paidAt")}: </span>
                  <span className="font-semibold">
                    {new Date(appointment.paidAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reschedule modal */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? "right" : "left" }}>
                {t("reschedule") || "Reschedule"}
              </h3>
              <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? "right" : "left" }}>
                {t("date") || "Date"}
              </label>
              <input
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 mb-4"
              />
              <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? "right" : "left" }}>
                {t("time") || "Time"}
              </label>
              {rescheduleLoading ? (
                <p className="text-gray-500 py-4">{t("loading")}</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
                  {rescheduleSlots.map((slot) => {
                    const time = new Date(slot.startTime).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const selected = rescheduleSelectedSlot?.startTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setRescheduleSelectedSlot(slot)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                          selected
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-700 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                  {rescheduleSlots.length === 0 && !rescheduleLoading && (
                    <p className="text-gray-500 text-sm">{locale === "ar" ? "لا توجد أوقات متاحة" : "No available times"}</p>
                  )}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleModalOpen(false);
                    setRescheduleDate("");
                    setRescheduleSelectedSlot(null);
                  }}
                  className="btn btn-secondary"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleRescheduleConfirm}
                  disabled={!rescheduleSelectedSlot || rescheduleSubmitting}
                  className="btn btn-primary"
                >
                  {rescheduleSubmitting ? t("loading") : t("confirm") || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}

