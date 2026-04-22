"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { CalendarView } from "@/components/CalendarView";
import { AppointmentActionDrawer } from "@/components/AppointmentActionDrawer";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  FunnelIcon,
  PlusIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

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
  position?: string;
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

function getLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [showQuickDrawer, setShowQuickDrawer] = useState(false);
  const [quickDrawerMode, setQuickDrawerMode] = useState<'appointment' | 'blocked_time'>('appointment');
  const [drawerPrefill, setDrawerPrefill] = useState<{ staffId?: string; date?: string; time?: string }>({});
  const [boardContextMenu, setBoardContextMenu] = useState<{
    x: number;
    y: number;
    staffId: string;
    startTime: string;
    appointmentId?: string;
  } | null>(null);
  const requestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestKeyRef = useRef<string>("");

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

  const selectedDateKey = useMemo(() => getLocalDateKey(selectedDate), [selectedDate]);
  const requestKey = useMemo(() => {
    const filterKey = [
      viewMode,
      selectedDateKey,
      startDate,
      endDate,
      filterStaffId || '-',
      filterServiceId || '-',
      filterStatus || '-',
      filterPaymentStatus || '-'
    ].join('|');

    return filterKey;
  }, [viewMode, selectedDateKey, startDate, endDate, filterStaffId, filterServiceId, filterStatus, filterPaymentStatus]);

  useEffect(() => {
    if (requestTimerRef.current) {
      clearTimeout(requestTimerRef.current);
    }

    requestTimerRef.current = setTimeout(() => {
      if (lastRequestKeyRef.current === requestKey) {
        return;
      }

      lastRequestKeyRef.current = requestKey;

      if (viewMode === 'calendar') {
        loadAppointmentsBoard();
        return;
      }

      loadAppointments();
    }, viewMode === 'calendar' ? 180 : 120);

    return () => {
      if (requestTimerRef.current) {
        clearTimeout(requestTimerRef.current);
      }
    };
  }, [requestKey, viewMode]);

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
      const response = await tenantApi.getEmployees({ isActive: true, position: 'service_provider' });
      if (response.success) {
        const providerEmployees = (response.employees || []).filter((employee: Employee) => {
          const normalizedPosition = `${employee.position || ''}`.replace(/\s+/g, '_').toLowerCase();
          return normalizedPosition === 'service_provider';
        });
        setEmployees(providerEmployees);
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

  const handleReassignAppointment = async (appointmentId: string, staffId: string) => {
    try {
      const response = await tenantApi.reassignAppointmentStaff(appointmentId, staffId);
      if (response.success) {
        if (viewMode === 'calendar') {
          loadAppointmentsBoard();
        } else {
          loadAppointments();
        }
      } else {
        alert(response.message || t("updateError"));
      }
    } catch (err: any) {
      console.error("Failed to reassign appointment staff:", err);
      alert(err.message || t("updateError"));
    }
  };

  const openQuickAppointmentDrawer = (prefill?: { staffId?: string; date?: string; time?: string }) => {
    setDrawerPrefill(prefill || {});
    setQuickDrawerMode('appointment');
    setShowQuickDrawer(true);
    setShowFilters(false);
    setBoardContextMenu(null);
  };

  const openBlockedTimeDrawer = (prefill?: { staffId?: string; date?: string; time?: string }) => {
    setDrawerPrefill(prefill || {});
    setQuickDrawerMode('blocked_time');
    setShowQuickDrawer(true);
    setShowFilters(false);
    setBoardContextMenu(null);
  };

  const handleGridContextMenu = (payload: {
    clientX: number;
    clientY: number;
    staffId: string;
    startTime: string;
    appointmentId?: string;
  }) => {
    const start = new Date(payload.startTime);
    setBoardContextMenu({
      x: payload.clientX,
      y: payload.clientY,
      staffId: payload.staffId,
      startTime: start.toISOString(),
      appointmentId: payload.appointmentId
    });
  };

  const handleOpenAppointmentFromMenu = () => {
    if (!boardContextMenu) {
      return;
    }

    const start = new Date(boardContextMenu.startTime);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    openQuickAppointmentDrawer({
      staffId: boardContextMenu.staffId,
      date,
      time
    });
  };

  const handleOpenBlockedTimeFromMenu = () => {
    if (!boardContextMenu) {
      return;
    }

    const start = new Date(boardContextMenu.startTime);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    openBlockedTimeDrawer({
      staffId: boardContextMenu.staffId,
      date,
      time
    });
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
    <TenantLayout fullWidth>
      <div className="mb-6 flex items-start justify-end gap-4 animate-fade-in">
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="relative inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
          aria-label={locale === 'ar' ? 'فتح أدوات الجدول' : 'Open board tools'}
        >
          <Cog6ToothIcon className="h-5 w-5 text-gray-700" />
          <span>{locale === 'ar' ? 'الأدوات' : 'Tools'}</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className={`fixed inset-0 z-50 transition ${showFilters ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-slate-950/35 backdrop-blur-[1px] transition-opacity duration-300 ${showFilters ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setShowFilters(false)}
        />

        <aside
          className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} h-full w-full max-w-[28rem] border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${showFilters ? 'translate-x-0' : isRTL ? '-translate-x-full' : 'translate-x-full'}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{locale === 'ar' ? 'أدوات المواعيد' : 'Appointment Tools'}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {locale === 'ar'
                    ? 'الفلترة، التنقل اليومي، والإجراءات السريعة.'
                    : 'Filters, day navigation, and quick actions.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50"
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('calendar');
                    setShowFilters(false);
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${viewMode === 'calendar' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {locale === 'ar' ? 'اللوحة' : 'Board'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('list');
                    setShowFilters(false);
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {t("listView")}
                </button>
              </div>

              <button
                type="button"
                onClick={() => openQuickAppointmentDrawer()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
              >
                <PlusIcon className="h-5 w-5" />
                <span>{locale === 'ar' ? 'موعد جديد' : 'New Appointment'}</span>
              </button>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-primary" />
                    <p className="text-sm font-semibold text-gray-900">{locale === 'ar' ? 'التاريخ' : 'Date'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(new Date());
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {locale === 'ar' ? 'اليوم' : 'Today'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">{locale === 'ar' ? 'تنقّل بين الأيام' : 'Move between days'}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Date(selectedDate);
                      next.setDate(next.getDate() - 1);
                      setSelectedDate(next);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {isRTL ? '›' : '‹'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Date(selectedDate);
                      next.setDate(next.getDate() + 1);
                      setSelectedDate(next);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {isRTL ? '‹' : '›'}
                  </button>
                  <div className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-medium text-gray-900 ring-1 ring-gray-200">
                    {selectedDate.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === 'calendar') {
                      loadAppointmentsBoard();
                    } else {
                      loadAppointments();
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                  <span>{locale === 'ar' ? 'تحديث' : 'Refresh'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    if (viewMode === 'calendar') {
                      loadAppointmentsBoard();
                    } else {
                      loadAppointments();
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <FunnelIcon className="h-5 w-5" />
                  <span>{locale === 'ar' ? 'إعادة الضبط' : 'Reset'}</span>
                </button>
              </div>

              <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("startDate")}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("employee")}
                  </label>
                  <select
                    value={filterStaffId}
                    onChange={(e) => setFilterStaffId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="">{t("allEmployees")}</option>
                    {employees.map((emp) => (
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="">{t("allServices")}</option>
                    {services.map((service) => (
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="">{t("allPayments") || "All"}</option>
                    <option value="pending">{t("paymentPending")}</option>
                    <option value="deposit_paid">{t("remainderDue") || "Remainder due"}</option>
                    <option value="fully_paid">{t("paid")}</option>
                  </select>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">{locale === 'ar' ? 'الملخص' : 'Summary'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {filterSummary.map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">{locale === 'ar' ? 'الدليل' : 'Legend'}</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-gray-700">{locale === 'ar' ? 'مدفوع بالكامل' : 'Fully paid'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-gray-700">{locale === 'ar' ? 'عربون' : 'Deposit'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                    <span className="text-gray-700">{locale === 'ar' ? 'بانتظار الدفع' : 'Pending payment'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[10px] font-bold text-white">A</span>
                    <span className="text-gray-700">{locale === 'ar' ? 'تعيين تلقائي' : 'Auto-assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">S</span>
                    <span className="text-gray-700">{locale === 'ar' ? 'اختيار العميل للموظف' : 'Customer picked staff'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-[10px] font-bold text-rose-700">B</span>
                    <span className="text-gray-700">{locale === 'ar' ? 'استراحة' : 'Break'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {boardContextMenu && (
        <div
          className="fixed inset-0 z-[70]"
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => setBoardContextMenu(null)}
        >
          <div
            className="absolute min-w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl"
            style={{
              top: boardContextMenu.y,
              left: boardContextMenu.x
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleOpenAppointmentFromMenu}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <PlusIcon className="h-4 w-4 text-primary" />
              <span>{locale === 'ar' ? 'إضافة موعد جديد' : 'Add new appointment'}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenBlockedTimeFromMenu}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <CalendarDaysIcon className="h-4 w-4 text-primary" />
              <span>{locale === 'ar' ? 'إضافة وقت محجوز' : 'Add blocked time'}</span>
            </button>
          </div>
        </div>
      )}

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
          onReassignAppointment={handleReassignAppointment}
          onGridContextMenu={handleGridContextMenu}
          onAppointmentSettingsClick={(appointmentId) => router.push(`/${locale}/dashboard/appointments/${appointmentId}`)}
          locale={locale}
          isRTL={isRTL}
          t={t}
          sectionTitle={t("title")}
        />
      )}

      <AppointmentActionDrawer
        open={showQuickDrawer}
        mode={quickDrawerMode}
        locale={locale}
        isRTL={isRTL}
        services={services}
        employees={employees}
        defaultStaffId={drawerPrefill.staffId}
        defaultDate={drawerPrefill.date}
        defaultTime={drawerPrefill.time}
        onClose={() => setShowQuickDrawer(false)}
        onAppointmentCreated={() => {
          if (viewMode === 'calendar') {
            loadAppointmentsBoard();
          } else {
            loadAppointments();
          }
        }}
        onBreakCreated={() => {
          if (viewMode === 'calendar') {
            loadAppointmentsBoard();
          } else {
            loadAppointments();
          }
        }}
      />
    </TenantLayout>
  );
}
