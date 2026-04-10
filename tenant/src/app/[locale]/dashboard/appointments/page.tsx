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
  duration: number;
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
  bookingNumber?: string | null;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'deposit_paid' | 'fully_paid' | 'paid' | 'refunded' | 'partially_refunded';
  price: number;
  rawPrice?: number;
  taxAmount?: number;
  platformFee?: number;
  tenantRevenue?: number;
  employeeCommission?: number;
  remainderAmount?: number;
  notes?: string;
  paymentMethod?: string | null;
  requestedStaffId?: string | null;
  assignmentMode?: 'unknown' | 'customer_selected' | 'auto_assigned' | 'tenant_reassigned';
  service: Service;
  staff: Employee;
  user?: User;
}

interface EmployeeBreak {
  id: string;
  staffId: string;
  type: string;
  label?: string | null;
  startTime: string;
  endTime: string;
  startDateTime?: string | null;
  endDateTime?: string | null;
}

function getCurrentMonthRange() {
  const start = new Date();
  start.setDate(1);

  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

export default function AppointmentsPage() {
  const t = useTranslations("Appointments");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [breaks, setBreaks] = useState<EmployeeBreak[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");

  // Filters
  const [startDate, setStartDate] = useState(() => getCurrentMonthRange().start);
  const [endDate, setEndDate] = useState(() => getCurrentMonthRange().end);
  const [filterStaffId, setFilterStaffId] = useState<string>("");
  const [filterServiceId, setFilterServiceId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("");
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFilters, setShowFilters] = useState(false);

  const defaultMonthRange = getCurrentMonthRange();
  const hasActiveFilters =
    startDate !== defaultMonthRange.start ||
    endDate !== defaultMonthRange.end ||
    Boolean(filterStaffId) ||
    Boolean(filterServiceId) ||
    Boolean(filterStatus) ||
    Boolean(filterPaymentStatus);
  const activeFilterCount = [
    startDate !== defaultMonthRange.start,
    endDate !== defaultMonthRange.end,
    Boolean(filterStaffId),
    Boolean(filterServiceId),
    Boolean(filterStatus),
    Boolean(filterPaymentStatus)
  ].filter(Boolean).length;

  useEffect(() => {
    loadServices();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadAppointmentsBoard();
      return;
    }

    loadAppointments();
  }, [viewMode, selectedDate, startDate, endDate, filterStaffId, filterServiceId, filterStatus, filterPaymentStatus]);

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
      const response = await tenantApi.getEmployees({ isActive: true });
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
      if (filterPaymentStatus) params.paymentStatus = filterPaymentStatus;

      const response = await tenantApi.getAppointments(params);

      if (response.success) {
        setAppointments(response.appointments || []);
        setBreaks([]);
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

  const loadAppointmentsBoard = async () => {
    try {
      setLoading(true);
      setError("");

      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;

      const response = await tenantApi.getAppointmentsBoard({
        date,
        staffId: filterStaffId || undefined,
        serviceId: filterServiceId || undefined,
        status: filterStatus || undefined,
        paymentStatus: filterPaymentStatus || undefined
      });

      if (response.success) {
        setAppointments(response.appointments || []);
        setBreaks(response.breaks || []);
      } else {
        setError(response.message || t("loadError"));
      }
    } catch (err: any) {
      console.error("Failed to load appointments board:", err);
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
      case 'checked_in': return 'bg-sky-100 text-sky-800';
      case 'in_service': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'fully_paid': return 'bg-green-100 text-green-800';
      case 'deposit_paid': return 'bg-amber-100 text-amber-800';
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
      case 'checked_in': return t("checkedIn");
      case 'in_service': return t("inProgress");
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

  const filterSummary = [
    `${startDate} → ${endDate}`,
    filterStaffId ? employees.find((employee) => employee.id === filterStaffId)?.name || t("employee") : t("allEmployees"),
    filterServiceId ? (services.find((service) => service.id === filterServiceId)?.[locale === 'ar' ? 'name_ar' : 'name_en'] || t("allServices")) : t("allServices"),
    filterStatus ? getStatusLabel(filterStatus) : t("allStatuses"),
    filterPaymentStatus ? getPaymentStatusLabel(filterPaymentStatus) : (t("allPayments") || "All")
  ];

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

  const clearFilters = () => {
    const defaults = getCurrentMonthRange();
    setStartDate(defaults.start);
    setEndDate(defaults.end);
    setFilterStaffId("");
    setFilterServiceId("");
    setFilterStatus("");
    setFilterPaymentStatus("");
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
              className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'list'
                ? 'bg-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              {t("listView")}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'calendar'
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
      <div className={`card mb-4 ${isRTL ? 'text-right' : ''}`}>
        <div className="flex flex-col gap-3">
          <div className={`flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 ${isRTL ? 'xl:flex-row-reverse' : ''}`}>
            <div>
              <h3 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t("filters")}
              </h3>
              <p className="text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'قم بتوسيع الفلاتر عند الحاجة فقط لتوفير مساحة أكبر للجدول.' : 'Expand filters only when needed so the schedule stays spacious.'}
              </p>
            </div>
            <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'justify-end' : ''}`}>
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  showFilters
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{showFilters ? (locale === 'ar' ? 'إخفاء الفلاتر' : 'Hide filters') : (locale === 'ar' ? 'إظهار الفلاتر' : 'Show filters')}</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-[11px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {locale === 'ar' ? 'إعادة الضبط' : 'Reset'}
                </button>
              )}
            </div>
          </div>

          {!showFilters && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filterSummary.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                >
                  {item}
                </span>
              ))}
            </div>
          )}

          {showFilters && (
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6 ${isRTL ? 'md:grid-cols-2 lg:grid-cols-6' : ''}`}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("startDate")}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("endDate")}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("employee")}
                </label>
                <select
                  value={filterStaffId}
                  onChange={(e) => setFilterStaffId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  <option value="">{t("allEmployees")}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("service")}
                </label>
                <select
                  value={filterServiceId}
                  onChange={(e) => setFilterServiceId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
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
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("statusLabel")}
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  <option value="">{t("allStatuses")}</option>
                  <option value="pending">{t("pending")}</option>
                  <option value="confirmed">{t("confirmed")}</option>
                  <option value="checked_in">{t("checkedIn")}</option>
                  <option value="in_service">{t("inProgress")}</option>
                  <option value="completed">{t("completed")}</option>
                  <option value="cancelled">{t("cancelled")}</option>
                  <option value="no_show">{t("noShow")}</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t("paymentStatus") || "Payment"}
                </label>
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => setFilterPaymentStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  <option value="">{t("allPayments") || "All"}</option>
                  <option value="pending">{t("paymentPending")}</option>
                  <option value="deposit_paid">{t("remainderDue") || "Remainder due"}</option>
                  <option value="fully_paid">{t("paid")}</option>
                </select>
              </div>
            </div>
          )}
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
      ) : viewMode === 'list' && appointments.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noAppointments")}</h3>
          <p className="text-gray-600 mb-2">{t("noAppointmentsDesc")}</p>
          <p className="text-sm text-gray-500">
            {locale === 'ar' ? 'القائمة معروضة حسب تاريخ البداية والنهاية أعلاه. غيّر النطاق لرؤية حجوزات أخرى.' : 'List is filtered by the start/end dates above. Try a wider date range to see more appointments.'}
          </p>
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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {locale === 'ar' ? 'رقم الحجز' : 'Booking No.'} {appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}
                      </p>
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
                      {appointment.paymentStatus === 'deposit_paid' && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-amber-200 text-amber-900">
                          {t("remainderDue") || "Remainder due"}
                        </span>
                      )}
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
                      {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
                        <button
                          onClick={() => handleStatusUpdate(appointment.id, 'checked_in')}
                          className="btn btn-sm btn-secondary"
                        >
                          {t("checkIn")}
                        </button>
                      )}
                      {appointment.status === 'checked_in' && (
                        <button
                          onClick={() => handleStatusUpdate(appointment.id, 'in_service')}
                          className="btn btn-sm btn-secondary"
                        >
                          {t("startService")}
                        </button>
                      )}
                      {appointment.status === 'in_service' && (
                        <button
                          onClick={() => handleStatusUpdate(appointment.id, 'completed')}
                          className="btn btn-sm btn-primary"
                        >
                          {t("markCompleted")}
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
          breaks={breaks}
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
