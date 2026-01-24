"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

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
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partially_refunded';
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
  notes?: string;
  service: Service;
  staff: Employee;
  user?: User;
  createdAt: string;
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
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      case 'no_show': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-300';
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
      case 'completed': return t("completed");
      case 'cancelled': return t("cancelled");
      case 'no_show': return t("noShow");
      default: return status;
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t("paymentPending");
      case 'paid': return t("paid");
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
          {appointment.user && (
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("customerDetails")}
              </h3>
              <div className="space-y-4">
                {/* Customer Avatar and Name */}
                <div className={`flex items-center gap-4 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {appointment.user.photo ? (
                    <img
                      src={appointment.user.photo.startsWith('/') 
                        ? `http://localhost:5000${appointment.user.photo}` 
                        : `http://localhost:5000/uploads/${appointment.user.photo}`}
                      alt={userName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center border-2 border-gray-200 ${appointment.user.photo ? 'hidden' : ''}`}
                    style={{ display: appointment.user.photo ? 'none' : 'flex' }}
                  >
                    <span className="text-primary-600 font-semibold text-xl">
                      {appointment.user.firstName?.[0] || ''}{appointment.user.lastName?.[0] || ''}
                    </span>
                  </div>
                  <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <label className="text-sm font-medium text-gray-600 block">
                      {t("name")}
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {userName}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {appointment.user.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("email")}
                      </label>
                      <p className="text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {appointment.user.email}
                      </p>
                    </div>
                  )}
                  {appointment.user.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("phone")}
                      </label>
                      <p className="text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {appointment.user.phone}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Employee Details */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("employeeDetails")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("employee")}
                </label>
                <p className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {appointment.staff.name}
                </p>
              </div>
              {appointment.staff.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("phone")}
                  </label>
                  <p className="text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {appointment.staff.phone}
                  </p>
                </div>
              )}
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
          {/* Price Breakdown */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("priceBreakdown")}
            </h3>
            <div className="space-y-3">
              {appointment.rawPrice && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("rawPrice")}</span>
                  <span className="font-semibold"><Currency amount={appointment.rawPrice} /></span>
                </div>
              )}
              {appointment.taxAmount && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("tax")}</span>
                  <span className="font-semibold"><Currency amount={appointment.taxAmount} /></span>
                </div>
              )}
              {appointment.platformFee && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("platformFee")}</span>
                  <span className="font-semibold"><Currency amount={appointment.platformFee} /></span>
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
              {appointment.status === 'confirmed' && (
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
                  onClick={() => handlePaymentUpdate('paid', 'cash')}
                  disabled={updating}
                  className="w-full btn btn-success"
                >
                  {t("markAsPaid")}
                </button>
              )}
              {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
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
          {appointment.paymentStatus === 'paid' && appointment.paidAt && (
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
    </TenantLayout>
  );
}

