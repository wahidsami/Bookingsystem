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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard stats and today's appointments in parallel
      const [statsResponse, appointmentsResponse] = await Promise.all([
        tenantApi.getDashboardStats(),
        tenantApi.getTodaysAppointments()
      ]);

      // Update stats
      if (statsResponse.success && statsResponse.stats) {
        setStats({
          todaysBookings: statsResponse.stats.todaysBookings || 0,
          totalRevenue: statsResponse.stats.totalRevenue || 0,
          activeEmployees: statsResponse.stats.activeEmployees || 0,
          totalCustomers: statsResponse.stats.totalCustomers || 0,
        });
      }

      // Update today's appointments
      if (appointmentsResponse.success && appointmentsResponse.appointments) {
        const formattedAppointments = appointmentsResponse.appointments.map((apt: any) => ({
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
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-1 ${isRTL ? 'text-end' : ''}`}>
                    <h4 className="font-bold text-gray-900">{appointment.customerName}</h4>
                    <p className="text-sm text-gray-600">{appointment.serviceName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {appointment.startTime} - {appointment.endTime}
                    </p>
                  </div>
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span
                      className={`badge ${
                        appointment.status === 'confirmed' ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {appointment.status === 'confirmed'
                        ? locale === 'ar' ? 'مؤكد' : 'Confirmed'
                        : locale === 'ar' ? 'قيد الانتظار' : 'Pending'}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      <Currency amount={appointment.price} locale={locale === 'ar' ? 'ar-SA' : 'en-SA'} />
                    </span>
                  </div>
                </div>
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

