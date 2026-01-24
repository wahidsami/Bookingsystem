"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { CalendarView } from "@/components/CalendarView";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

interface Service {
  id: string;
  name_en: string;
  name_ar: string;
}

interface Employee {
  id: string;
  name: string;
  photo?: string;
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
  price: number;
  rawPrice?: number;
  taxAmount?: number;
  platformFee?: number;
  tenantRevenue?: number;
  employeeCommission?: number;
  notes?: string;
  service: Service;
  staff: Employee;
  user?: User;
}

export default function AppointmentsPage() {
  const t = useTranslations("Appointments");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of current month
    return date.toISOString().split('T')[0];
  });
  const [filterStaffId, setFilterStaffId] = useState<string>("");
  const [filterServiceId, setFilterServiceId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    loadServices();
    loadEmployees();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [startDate, endDate, filterStaffId, filterServiceId, filterStatus]);

  // When calendar view is selected, adjust date range to selected date
  // Use local date to avoid timezone issues
  // Set endDate to end of day to ensure we get all appointments for that day
  useEffect(() => {
    if (viewMode === 'calendar') {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      setStartDate(dateStr);
      // Set endDate to end of day (23:59:59) to include all appointments for that day
      setEndDate(`${dateStr}T23:59:59.999`);
    }
  }, [viewMode, selectedDate]);

  const loadServices = async () => {
    try {
      const response = await tenantApi.getServices();
      if (response.success) {
        setServices(response.services || []);
      }
    } catch (err) {
      console.error("Failed to load services:", err);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await tenantApi.getEmployees(undefined, true);
      if (response.success) {
        setEmployees(response.employees || []);
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError("");
      
      const params: any = {
        startDate,
        endDate,
        limit: 100
      };
      if (filterStaffId) params.staffId = filterStaffId;
      if (filterServiceId) params.serviceId = filterServiceId;
      if (filterStatus) params.status = filterStatus;

      const response = await tenantApi.getAppointments(params);
      
      if (response.success) {
        setAppointments(response.appointments || []);
      } else {
        setError(response.message || t("loadError"));
      }
    } catch (err: any) {
      console.error("Failed to load appointments:", err);
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'refunded': return 'bg-red-100 text-red-800';
      case 'partially_refunded': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const response = await tenantApi.updateAppointmentStatus(id, newStatus);
      if (response.success) {
        loadAppointments();
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert(err.message || t("updateError"));
    }
  };

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("subtitle")}
            </p>
          </div>
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t("listView")}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t("calendarView")}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`card mb-6 ${isRTL ? 'text-right' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t("filters")}
        </h3>
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 ${isRTL ? 'md:grid-cols-2 lg:grid-cols-5' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("startDate")}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("endDate")}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("employee")}
            </label>
            <select
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="">{t("allEmployees")}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("service")}
            </label>
            <select
              value={filterServiceId}
              onChange={(e) => setFilterServiceId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="">{t("allServices")}</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {locale === 'ar' ? service.name_ar : service.name_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("statusLabel")}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="">{t("allStatuses")}</option>
              <option value="pending">{t("pending")}</option>
              <option value="confirmed">{t("confirmed")}</option>
              <option value="completed">{t("completed")}</option>
              <option value="cancelled">{t("cancelled")}</option>
              <option value="no_show">{t("noShow")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noAppointments")}</h3>
          <p className="text-gray-600">{t("noAppointmentsDesc")}</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="space-y-4">
          {appointments.map((appointment) => {
            const start = formatDateTime(appointment.startTime);
            const end = formatDateTime(appointment.endTime);
            const userName = appointment.user 
              ? `${appointment.user.firstName} ${appointment.user.lastName}`.trim()
              : t("unknownCustomer");

            return (
              <div key={appointment.id} className="card hover:shadow-lg transition-shadow">
                <div className={`flex flex-col md:flex-row gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                  {/* Left: Date & Time */}
                  <div className="flex-shrink-0">
                    <div className="text-center p-4 bg-primary/10 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{start.date.split(' ')[1]}</div>
                      <div className="text-sm text-gray-600">{start.date.split(' ')[0]}</div>
                      <div className="text-sm text-gray-600 mt-1">{start.time} - {end.time}</div>
                    </div>
                  </div>

                  {/* Middle: Details */}
                  <div className="flex-1">
                    <div className="mb-2">
                      <h3 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? appointment.service.name_ar : appointment.service.name_en}
                      </h3>
                      <p className="text-sm text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t("with")} {appointment.staff.name}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                        {getStatusLabel(appointment.status)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getPaymentStatusColor(appointment.paymentStatus)}`}>
                        {getPaymentStatusLabel(appointment.paymentStatus)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p>{t("customer")}: {userName}</p>
                      {appointment.user?.phone && (
                        <p>{t("phone")}: {appointment.user.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Right: Price & Actions */}
                  <div className="flex-shrink-0 text-right" style={{ textAlign: isRTL ? 'left' : 'right' }}>
                    <div className="mb-2">
                      <div className="text-xl font-bold text-primary">
                        <Currency amount={appointment.price} />
                      </div>
                    </div>
                    <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
                      <Link
                        href={`/${locale}/dashboard/appointments/${appointment.id}`}
                        className="btn btn-sm btn-secondary"
                      >
                        {t("viewDetails")}
                      </Link>
                      {appointment.status === 'pending' && (
                        <button
                          onClick={() => handleStatusUpdate(appointment.id, 'confirmed')}
                          className="btn btn-sm btn-primary"
                        >
                          {t("confirm")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Calendar View */
        <CalendarView
          appointments={appointments}
          employees={employees}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          locale={locale}
          isRTL={isRTL}
          t={t}
        />
      )}
    </TenantLayout>
  );
}

