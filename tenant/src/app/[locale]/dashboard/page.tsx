"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

interface DashboardStats {
  todaysBookings: number;
  totalRevenue: number;
  activeEmployees: number;
  totalCustomers: number;
}

interface Appointment {
  id: string;
  customerName: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: string;
  price: number;
}

interface PosAlert {
  id: string;
  title: string;
  title_ar?: string;
  message: string;
  message_ar?: string;
  amountDue: number;
  severity: string;
  detailPath?: string;
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todaysBookings: 0,
    totalRevenue: 0,
    activeEmployees: 0,
    totalCustomers: 0,
  });
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [paymentDueSummary, setPaymentDueSummary] = useState({
    totalDueCount: 0,
    checkedInDueCount: 0,
    totalDueAmount: 0,
  });
  const [paymentAlerts, setPaymentAlerts] = useState<PosAlert[]>([]);
  const [notice, setNotice] = useState("");

  const getAppointmentStatusMeta = (status: string) => {
    switch (status) {
      case 'confirmed':
        return {
          label: locale === 'ar' ? 'مؤكد' : 'Confirmed',
          badgeClass: 'badge-success',
        };
      case 'checked_in':
        return {
          label: locale === 'ar' ? 'تم تسجيل الوصول' : 'Checked In',
          badgeClass: 'badge-success',
        };
      case 'in_service':
        return {
          label: locale === 'ar' ? 'جاري التنفيذ' : 'In Service',
          badgeClass: 'badge-info',
        };
      case 'completed':
        return {
          label: locale === 'ar' ? 'مكتمل' : 'Completed',
          badgeClass: 'badge-info',
        };
      case 'cancelled':
        return {
          label: locale === 'ar' ? 'ملغي' : 'Cancelled',
          badgeClass: 'badge-error',
        };
      case 'no_show':
        return {
          label: locale === 'ar' ? 'لم يحضر' : 'No Show',
          badgeClass: 'badge-warning',
        };
      case 'pending':
      default:
        return {
          label: locale === 'ar' ? 'قيد الانتظار' : 'Pending',
          badgeClass: 'badge-warning',
        };
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setNotice("");
      
      // Fetch dashboard stats and today's appointments in parallel
      const [statsResponse, appointmentsResponse, posAlertsResponse] = await Promise.allSettled([
        tenantApi.getDashboardStats(),
        tenantApi.getTodaysAppointments(),
        tenantApi.getPosAlerts({ limit: 3 }).catch(() => null),
      ]);
      const failedSections: string[] = [];

      // Update stats
      if (statsResponse.status === 'fulfilled' && statsResponse.value.success && statsResponse.value.stats) {
        setStats({
          todaysBookings: statsResponse.value.stats.todaysBookings || 0,
          totalRevenue: statsResponse.value.stats.totalRevenue || 0,
          activeEmployees: statsResponse.value.stats.activeEmployees || 0,
          totalCustomers: statsResponse.value.stats.totalCustomers || 0,
        });
      } else {
        failedSections.push(locale === 'ar' ? 'الإحصاءات' : 'stats');
      }

      // Update today's appointments
      if (appointmentsResponse.status === 'fulfilled' && appointmentsResponse.value.success && appointmentsResponse.value.appointments) {
        const formattedAppointments = appointmentsResponse.value.appointments.map((apt: any) => ({
          id: apt.id,
          customerName: apt.customerName || 'Unknown Customer',
          serviceName: locale === 'ar' ? (apt.serviceName_ar || apt.serviceName) : apt.serviceName,
          startTime: apt.startTime,
          endTime: apt.endTime,
          status: apt.status,
          price: apt.price || 0,
        }));
        setTodaysAppointments(formattedAppointments);
      } else {
        setTodaysAppointments([]);
        failedSections.push(locale === 'ar' ? 'مواعيد اليوم' : "today's appointments");
      }

      if (posAlertsResponse.status === 'fulfilled' && posAlertsResponse.value?.success) {
        setPaymentDueSummary({
          totalDueCount: posAlertsResponse.value.summary?.totalDueCount || 0,
          checkedInDueCount: posAlertsResponse.value.summary?.checkedInDueCount || 0,
          totalDueAmount: posAlertsResponse.value.summary?.totalDueAmount || 0,
        });
        setPaymentAlerts(Array.isArray(posAlertsResponse.value.alerts) ? posAlertsResponse.value.alerts : []);
      } else {
        setPaymentDueSummary({
          totalDueCount: 0,
          checkedInDueCount: 0,
          totalDueAmount: 0,
        });
        setPaymentAlerts([]);
        failedSections.push(locale === 'ar' ? 'تنبيهات التحصيل' : 'collections alerts');
      }

      if (failedSections.length > 0) {
        setNotice(
          locale === 'ar'
            ? `تعذر تحميل بعض أقسام اللوحة: ${failedSections.join('، ')}`
            : `Some dashboard sections failed to load: ${failedSections.join(', ')}`
        );
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Set defaults on error
      setStats({
        todaysBookings: 0,
        totalRevenue: 0,
        activeEmployees: 0,
        totalCustomers: 0,
      });
      setTodaysAppointments([]);
      setPaymentDueSummary({
        totalDueCount: 0,
        checkedInDueCount: 0,
        totalDueAmount: 0,
      });
      setPaymentAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="spinner"></div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      {/* Welcome Message */}
      <div className="mb-8 animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t("welcome")} 👋
        </h2>
        <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {locale === 'ar' ? 'نظرة عامة على أداء صالونك اليوم' : "Here's an overview of your salon's performance today"}
        </p>
      </div>

      {notice && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          {notice}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Bookings */}
        <div className="card hover:shadow-xl transition-shadow">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-end' : ''}>
              <p className="text-gray-600 text-sm font-medium">{t("todaysBookings")}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.todaysBookings}</p>
            </div>
            <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-3xl">📅</span>
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="card hover:shadow-xl transition-shadow">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-end' : ''}>
              <p className="text-gray-600 text-sm font-medium">{t("totalRevenue")}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                <Currency amount={stats.totalRevenue} locale={locale === 'ar' ? 'ar-SA' : 'en-SA'} />
              </p>
            </div>
            <div className="w-14 h-14 bg-secondary/10 rounded-lg flex items-center justify-center">
              <span className="text-3xl">💰</span>
            </div>
          </div>
        </div>

        {/* Active Employees */}
        <div className="card hover:shadow-xl transition-shadow">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-end' : ''}>
              <p className="text-gray-600 text-sm font-medium">{t("activeEmployees")}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeEmployees}</p>
            </div>
            <div className="w-14 h-14 bg-accent/10 rounded-lg flex items-center justify-center">
              <span className="text-3xl">👥</span>
            </div>
          </div>
        </div>

        {/* Total Customers */}
        <div className="card hover:shadow-xl transition-shadow">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-end' : ''}>
              <p className="text-gray-600 text-sm font-medium">{t("totalCustomers")}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCustomers}</p>
            </div>
            <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-3xl">🤝</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payments Due */}
      <div className="card mb-8 overflow-hidden">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-rose-500 via-primary to-secondary" />
        <div className={`mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
          <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
              {locale === 'ar' ? 'تحصيلات مستحقة' : 'Payments Due Today'}
            </p>
            <h3 className="mt-2 text-2xl font-bold text-gray-900">
              {locale === 'ar' ? 'متابعة المدفوعات قبل وأثناء الوصول' : 'Track collections before and during check-in'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {locale === 'ar'
                ? `${paymentDueSummary.totalDueCount} حالة مستحقة، منها ${paymentDueSummary.checkedInDueCount} عميل وصل للمركز ويحتاج تحصيل.`
                : `${paymentDueSummary.totalDueCount} due item(s), including ${paymentDueSummary.checkedInDueCount} checked-in customer(s) awaiting collection.`}
            </p>

            {paymentAlerts.length > 0 ? (
              <div className="mt-4 space-y-2">
                {paymentAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => router.push(`/${locale}${alert.detailPath || '/dashboard/pos'}`)}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm transition-colors ${
                      alert.severity === 'high'
                        ? 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100'
                        : 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100'
                    }`}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <p className="font-bold">
                      {locale === 'ar' ? (alert.title_ar || alert.title) : alert.title}
                    </p>
                    <p className="mt-1 text-xs opacity-90">
                      {locale === 'ar' ? (alert.message_ar || alert.message) : alert.message}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
                {locale === 'ar'
                  ? 'لا توجد تحصيلات عاجلة حالياً.'
                  : 'No urgent collections right now.'}
              </p>
            )}
          </div>

          <div className="w-full max-w-xs rounded-3xl bg-gradient-to-br from-rose-50 to-primary/10 p-6">
            <p className="text-sm font-semibold text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'إجمالي المبالغ المستحقة' : 'Total due amount'}
            </p>
            <p className="mt-2 text-4xl font-bold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <Currency amount={paymentDueSummary.totalDueAmount} locale={locale === 'ar' ? 'ar-SA' : 'en-SA'} />
            </p>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/dashboard/pos`)}
              className="btn-primary mt-6 w-full"
            >
              {locale === 'ar' ? 'فتح نقطة البيع' : 'Open POS'}
            </button>
          </div>
        </div>
      </div>

      {/* Today's Appointments */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-xl font-bold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t("recentAppointments")}
          </h3>
        </div>

        {todaysAppointments.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-6xl mb-4 block">📅</span>
            <p className="text-gray-600">{locale === 'ar' ? 'لا توجد حجوزات لهذا اليوم' : 'No appointments for today'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todaysAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {(() => {
                  const statusMeta = getAppointmentStatusMeta(appointment.status);

                  return (
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-1 ${isRTL ? 'text-end' : ''}`}>
                    <h4 className="font-bold text-gray-900">{appointment.customerName}</h4>
                    <p className="text-sm text-gray-600">{appointment.serviceName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {appointment.startTime} - {appointment.endTime}
                    </p>
                  </div>
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className={`badge ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      <Currency amount={appointment.price} locale={locale === 'ar' ? 'ar-SA' : 'en-SA'} />
                    </span>
                  </div>
                </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <button 
            className="btn-primary w-full md:w-auto"
            onClick={() => router.push(`/${locale}/dashboard/appointments`)}
          >
            {t("viewAll")} →
          </button>
        </div>
      </div>
    </TenantLayout>
  );
}

