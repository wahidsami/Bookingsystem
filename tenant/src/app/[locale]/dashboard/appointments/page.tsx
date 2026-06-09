"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { CalendarView } from "@/components/CalendarView";
import { AppointmentActionDrawer, type AppointmentActionDrawerPrefill } from "@/components/AppointmentActionDrawer";
import { AppointmentDetailsDrawer, type AppointmentItem } from "@/components/AppointmentDetailsDrawer";
import { EmployeeWeeklyScheduleEditor } from "@/components/EmployeeWeeklyScheduleEditor";
import { useAppDialog } from "@/components/AppDialogProvider";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  FunnelIcon,
  PlusIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

interface Service {
  id: string;
  name_en: string;
  name_ar: string;
  duration: number;
  employees?: Array<{
    id: string;
    name: string;
    photo?: string | null;
    isActive?: boolean;
  }>;
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
  totalPaid?: number;
  outstandingAmount?: number;
  remainderAmount?: number;
  notes?: string;
  paymentMethod?: string | null;
  requestedStaffId?: string | null;
  assignmentMode?: 'unknown' | 'customer_selected' | 'auto_assigned' | 'tenant_reassigned';
  service: Service;
  staff: Employee;
  user?: User;
  updatedAt?: string;
}

interface EmployeeBreak {
  id: string;
  staffId: string;
  type: string;
  label?: string | null;
  isRecurring?: boolean;
  specificDate?: string | null;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  startDateTime?: string | null;
  endDateTime?: string | null;
}

type ShiftDraft = {
  id: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  startDate: string | null;
  endDate: string | null;
  label: string | null;
  isActive: boolean;
  isDraft?: boolean;
};

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

function parseClockToMinutes(value?: string | null) {
  if (!value || typeof value !== "string") return null;
  const [h, m] = value.split(":");
  const hours = Number(h);
  const minutes = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

function getRoundedUpFiveMinuteTime(date = new Date()) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const rounded = Math.ceil((minutes + 1) / 5) * 5;
  next.setMinutes(rounded);
  return next;
}

function formatTimeLabel(value: Date, locale: string) {
  return value.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getPastTimeBlockWarning(locale: string, suggestedTimeLabel: string) {
  return locale === "ar"
    ? `لا يمكنك حجز الموعد الآن. جرّب خانة بعد ${suggestedTimeLabel}.`
    : `You can not book an appointment now. Try a tile slot after ${suggestedTimeLabel}.`;
}

function getPastTodayTimeWarning(dateKey: string, timeKey: string, locale: string) {
  if (!dateKey || !timeKey) return "";

  const selected = new Date(`${dateKey}T${timeKey}:00`);
  if (Number.isNaN(selected.getTime())) return "";

  const now = new Date();
  if (selected.getTime() >= now.getTime()) return "";

  const suggestedTimeLabel = formatTimeLabel(getRoundedUpFiveMinuteTime(now), locale);
  return getPastTimeBlockWarning(locale, suggestedTimeLabel);
}

function resolveDisplayHoursFromWorkingHours(workingHours: any): { startHour: number; endHour: number } {
  const fallback = { startHour: 6, endHour: 22 };
  if (!workingHours || typeof workingHours !== "object") return fallback;

  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const opens: number[] = [];
  const closes: number[] = [];

  dayKeys.forEach((dayKey) => {
    const day = workingHours?.[dayKey];
    if (!day || day.isOpen === false) return;
    const openMinute = parseClockToMinutes(day.open || day.startTime || day.from);
    const closeMinute = parseClockToMinutes(day.close || day.endTime || day.to);
    if (openMinute !== null) opens.push(openMinute);
    if (closeMinute !== null) closes.push(closeMinute);
  });

  if (opens.length === 0 || closes.length === 0) return fallback;

  const startHour = Math.max(0, Math.floor(Math.min(...opens) / 60));
  const endHour = Math.min(24, Math.ceil(Math.max(...closes) / 60));
  if (endHour <= startHour) return fallback;
  return { startHour, endHour };
}

export default function AppointmentsPage() {
  const t = useTranslations("Appointments");
  const params = useParams();
  const dialog = useAppDialog();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const advancedDragEnabled = process.env.NEXT_PUBLIC_APPOINTMENTS_ADVANCED_DRAG !== "0";
  const [hydrated, setHydrated] = useState(false);

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
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'cancelled'>('calendar');
  const [calendarScope, setCalendarScope] = useState<'day' | 'week' | 'month'>('day');
  const [calendarFocusedStaffId, setCalendarFocusedStaffId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [showQuickDrawer, setShowQuickDrawer] = useState(false);
  const [quickDrawerMode, setQuickDrawerMode] = useState<'appointment' | 'blocked_time'>('appointment');
  const [drawerPrefill, setDrawerPrefill] = useState<AppointmentActionDrawerPrefill>({});
  const [selectedBreak, setSelectedBreak] = useState<EmployeeBreak | null>(null);
  const [showAppointmentDetailsDrawer, setShowAppointmentDetailsDrawer] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [gridHourHeight, setGridHourHeight] = useState(() => {
    if (typeof window === "undefined") {
      return 240;
    }

    const stored = window.localStorage.getItem("appointments-grid-hour-height");
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? Math.max(120, Math.min(360, parsed)) : 240;
  });
  const [boardDisplayHours, setBoardDisplayHours] = useState<{ startHour: number; endHour: number }>({
    startHour: 6,
    endHour: 22
  });
  const [boardContextMenu, setBoardContextMenu] = useState<{
    x: number;
    y: number;
    staffId: string;
    startTime: string;
    appointmentId?: string;
    mode?: "grid" | "staff";
    dateKey?: string;
  } | null>(null);
  const isContextSlotBlocked = useMemo(() => {
    if (!boardContextMenu) return false;
    const slotStart = new Date(boardContextMenu.startTime);
    const slotMs = slotStart.getTime();
    if (Number.isNaN(slotMs)) return false;

    return breaks.some((breakItem) => {
      if (breakItem.staffId !== boardContextMenu.staffId) return false;
      if (!breakItem.startDateTime || !breakItem.endDateTime) return false;
      const breakStartMs = new Date(breakItem.startDateTime).getTime();
      const breakEndMs = new Date(breakItem.endDateTime).getTime();
      if (Number.isNaN(breakStartMs) || Number.isNaN(breakEndMs)) return false;
      return slotMs >= breakStartMs && slotMs < breakEndMs;
    });
  }, [boardContextMenu, breaks]);
  const [showShiftEditorModal, setShowShiftEditorModal] = useState(false);
  const [shiftEditorStaffId, setShiftEditorStaffId] = useState<string | null>(null);
  const [shiftDraft, setShiftDraft] = useState<ShiftDraft[]>([]);
  const [shiftOriginal, setShiftOriginal] = useState<ShiftDraft[]>([]);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftSharedRange, setShiftSharedRange] = useState<{ startDate: string | null; endDate: string | null }>({ startDate: null, endDate: null });
  const [pendingDropChange, setPendingDropChange] = useState<null | {
    appointmentId: string;
    staffId: string;
    startTime: string;
    endTime: string;
    changedTime: boolean;
    changedStaff: boolean;
    oldStaffName: string;
    newStaffName: string;
    oldTimeLabel: string;
    newTimeLabel: string;
  }>(null);
  const [notifyCustomerOnDropChange, setNotifyCustomerOnDropChange] = useState(true);
  const [dropChangeSaving, setDropChangeSaving] = useState(false);
  const requestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestKeyRef = useRef<string>("");
  const refreshInFlightRef = useRef(false);

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
    loadBoardDisplayHours();
  }, []);

  const loadBoardDisplayHours = async () => {
    try {
      const settingsResponse = await tenantApi.getSettings();
      const workingHours = settingsResponse?.data?.business?.workingHours || settingsResponse?.data?.settings?.businessHours || null;
      setBoardDisplayHours(resolveDisplayHoursFromWorkingHours(workingHours));
    } catch (error) {
      console.warn("Failed to load board display hours from tenant settings:", error);
    }
  };

  useEffect(() => {
    setHydrated(true);
  }, []);

  const selectedDateKey = useMemo(() => getLocalDateKey(selectedDate), [selectedDate]);
  const serviceCapabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    services.forEach((service) => {
      const staffIds = (service.employees || [])
        .map((employee) => employee.id)
        .filter((id): id is string => Boolean(id));

      if (staffIds.length > 0) {
        map.set(service.id, new Set(staffIds));
      }
    });

    return map;
  }, [services]);
  const requestKey = useMemo(() => {
    const filterKey = [
      viewMode,
      calendarScope,
      calendarFocusedStaffId || '-',
      selectedDateKey,
      startDate,
      endDate,
      filterStaffId || '-',
      filterServiceId || '-',
      filterStatus || '-',
      filterPaymentStatus || '-'
    ].join('|');

    return filterKey;
  }, [viewMode, calendarScope, calendarFocusedStaffId, selectedDateKey, startDate, endDate, filterStaffId, filterServiceId, filterStatus, filterPaymentStatus]);

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

  const loadAppointments = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError("");

      const params: any = {
        startDate,
        endDate,
        limit: 100
      };
      if (filterStaffId) params.staffId = filterStaffId;
      if (filterServiceId) params.serviceId = filterServiceId;
      if (viewMode === 'cancelled') {
        params.status = 'cancelled';
      } else if (filterStatus) {
        params.status = filterStatus;
      }
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
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const getCalendarRange = (scope: 'day' | 'week' | 'month', baseDate: Date) => {
    const baseKey = getLocalDateKey(baseDate);
    if (scope === 'week') return getWeekRangeFromDateKey(baseKey);
    if (scope === 'month') return getMonthRangeFromDateKey(baseKey);
    return { start: baseKey, end: baseKey };
  };

  const loadAppointmentsBoard = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError("");

      if (calendarScope !== 'day') {
        const range = getCalendarRange(calendarScope, selectedDate);
        const response = await tenantApi.getAppointments({
          startDate: range.start,
          endDate: range.end,
          limit: 500,
          staffId: calendarFocusedStaffId || undefined,
          serviceId: filterServiceId || undefined,
          status: filterStatus || undefined
        });

        if (response.success) {
          setAppointments(response.appointments || []);
          setBreaks([]);
        } else {
          setError(response.message || t("loadError"));
        }
        return;
      }

      const date = getLocalDateKey(selectedDate);

      const response = await tenantApi.getAppointmentsBoard({
        date,
        staffId: calendarFocusedStaffId || filterStaffId || undefined,
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
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const refreshAppointments = async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    try {
      if (viewMode === 'calendar') {
        await loadAppointmentsBoard(true);
        return;
      }

      await loadAppointments(true);
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleFocus = () => {
      void refreshAppointments();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshAppointments();
      }
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshAppointments();
      }
    }, viewMode === 'calendar' ? 25000 : 40000);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [viewMode, calendarScope, calendarFocusedStaffId, selectedDateKey, startDate, endDate, filterStaffId, filterServiceId, filterStatus, filterPaymentStatus]);

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

  const resolveEffectivePaymentStatus = (appointment: {
    paymentStatus?: string | null;
    price?: number | null;
    totalPaid?: number | null;
    outstandingAmount?: number | null;
    remainderAmount?: number | null;
  }) => {
    const rawStatus = `${appointment.paymentStatus || ''}`.trim().toLowerCase();
    const price = Number(appointment.price || 0);
    const totalPaid = Number(appointment.totalPaid || 0);
    const explicitOutstanding = Number(appointment.outstandingAmount);
    const outstanding = Number.isFinite(explicitOutstanding)
      ? explicitOutstanding
      : Math.max(0, price - totalPaid);
    const remainderAmount = Number(appointment.remainderAmount || 0);

    if ((rawStatus === 'fully_paid' || rawStatus === 'paid') && outstanding > 0.009) {
      return 'deposit_paid';
    }
    if (rawStatus === 'deposit_paid' && outstanding <= 0.009 && remainderAmount <= 0.009) {
      return 'fully_paid';
    }

    return rawStatus || 'pending';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return locale === 'ar' ? 'محجوز' : 'Booked';
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
        if (viewMode === 'calendar') {
          loadAppointmentsBoard();
        } else {
          loadAppointments();
        }
      } else {
        await dialog.alert({
          title: locale === "ar" ? "تعذر التحديث" : "Update failed",
          message: response.message || t("updateError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر التحديث" : "Update failed",
        message: err.message || t("updateError"),
        tone: "danger"
      });
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
        await dialog.alert({
          title: locale === "ar" ? "تعذر التحديث" : "Update failed",
          message: response.message || t("updateError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to reassign appointment staff:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر التحديث" : "Update failed",
        message: err.message || t("updateError"),
        tone: "danger"
      });
    }
  };

  const handleDropAppointmentChange = async (payload: {
    appointmentId: string;
    staffId: string;
    startTime: string;
    endTime: string;
    changedTime: boolean;
    changedStaff: boolean;
  }) => {
    if (!payload.changedStaff && !payload.changedTime) {
      return;
    }

    if (payload.changedStaff && !payload.changedTime) {
      await handleReassignAppointment(payload.appointmentId, payload.staffId);
      return;
    }

    const appointment = appointments.find((item) => item.id === payload.appointmentId);
    if (!appointment) {
      return;
    }
    const targetStaff = employees.find((item) => item.id === payload.staffId);
    const oldStart = new Date(appointment.startTime);
    const newStart = new Date(payload.startTime);
    const oldTimeLabel = oldStart.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const newTimeLabel = newStart.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    setNotifyCustomerOnDropChange(true);
    setPendingDropChange({
      ...payload,
      oldStaffName: appointment.staff.name,
      newStaffName: targetStaff?.name || appointment.staff.name,
      oldTimeLabel,
      newTimeLabel
    });
  };

  const confirmDropAppointmentChange = async () => {
    if (!pendingDropChange) return;
    setDropChangeSaving(true);
    try {
      const response = await tenantApi.reassignRescheduleAppointment(pendingDropChange.appointmentId, {
        staffId: pendingDropChange.staffId,
        startTime: pendingDropChange.startTime,
        notifyCustomer: notifyCustomerOnDropChange
      });
      if (response.success) {
        if (viewMode === "calendar") {
          await loadAppointmentsBoard();
        } else {
          await loadAppointments();
        }
        setPendingDropChange(null);
      } else {
        await dialog.alert({
          title: locale === "ar" ? "تعذر التحديث" : "Update failed",
          message: response.message || t("updateError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to apply drag/drop appointment change:", err);
      await dialog.alert({
        title: locale === "ar" ? "تعذر التحديث" : "Update failed",
        message: err?.message || t("updateError"),
        tone: "danger"
      });
    } finally {
      setDropChangeSaving(false);
    }
  };

  const openQuickAppointmentDrawer = (prefill?: { staffId?: string; date?: string; time?: string }) => {
    setDrawerPrefill(prefill || {});
    setQuickDrawerMode('appointment');
    setSelectedBreak(null);
    setShowQuickDrawer(true);
    setShowAppointmentDetailsDrawer(false);
    setShowFilters(false);
    setBoardContextMenu(null);
  };

  const openBlockedTimeDrawer = (
    prefill?: { staffId?: string; date?: string; time?: string },
    breakItem?: EmployeeBreak | null
  ) => {
    setDrawerPrefill(prefill || {});
    setQuickDrawerMode('blocked_time');
    setSelectedBreak(breakItem || null);
    setShowQuickDrawer(true);
    setShowAppointmentDetailsDrawer(false);
    setShowFilters(false);
    setBoardContextMenu(null);
  };

  const handleOpenAppointmentDetails = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setShowAppointmentDetailsDrawer(true);
    setShowQuickDrawer(false);
    setShowFilters(false);
    setBoardContextMenu(null);
  };

  const handleRebookAppointment = (appointment: AppointmentItem) => {
    const start = new Date(appointment.startTime);
    setDrawerPrefill({
      customer: appointment.user
        ? {
            id: appointment.user.id,
            firstName: appointment.user.firstName,
            lastName: appointment.user.lastName,
            email: appointment.user.email,
            phone: appointment.user.phone
          }
        : undefined,
      serviceId: appointment.service?.id,
      variantId: appointment.serviceVariantId || undefined,
      staffId: appointment.staff?.id,
      date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
      paymentMethod: appointment.paymentMethod || undefined,
      notes: appointment.notes || undefined
    });
    setQuickDrawerMode('appointment');
    setSelectedBreak(null);
    setShowQuickDrawer(true);
    setShowAppointmentDetailsDrawer(false);
  };

  const handleOpenBlockedTime = (breakItem: EmployeeBreak) => {
    const start = breakItem.startDateTime ? new Date(breakItem.startDateTime) : new Date(`${selectedDateKey}T${breakItem.startTime}`);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    openBlockedTimeDrawer({
      staffId: breakItem.staffId,
      date,
      time
    }, breakItem);
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
      appointmentId: payload.appointmentId,
      mode: "grid",
      dateKey: getLocalDateKey(start)
    });
  };

  const handleGridTimeSlotClick = (payload: {
    staffId: string;
    startTime: string;
    dateKey: string;
  }) => {
    const start = new Date(payload.startTime);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

    if (getPastTodayTimeWarning(date, time, locale)) {
      void dialog.alert({
        title: locale === "ar" ? "لا يمكن الحجز" : "Booking not allowed",
        message: getPastTodayTimeWarning(date, time, locale),
        tone: "default"
      });
      return;
    }

    openQuickAppointmentDrawer({
      staffId: payload.staffId,
      date,
      time
    });
  };

  const handleStaffHeaderMenu = (payload: {
    clientX: number;
    clientY: number;
    staffId: string;
    date: string;
  }) => {
    const start = new Date(`${payload.date}T09:00:00`);
    setBoardContextMenu({
      x: payload.clientX,
      y: payload.clientY,
      staffId: payload.staffId,
      startTime: start.toISOString(),
      mode: "staff",
      dateKey: payload.date
    });
  };

  const handleOpenAppointmentFromMenu = () => {
    if (!boardContextMenu) {
      return;
    }

    const start = new Date(boardContextMenu.startTime);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

    if (getPastTodayTimeWarning(date, time, locale)) {
      void dialog.alert({
        title: locale === "ar" ? "لا يمكن الحجز" : "Booking not allowed",
        message: getPastTodayTimeWarning(date, time, locale),
        tone: "default"
      });
      return;
    }

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

  const getWeekRangeFromDateKey = (dateKey: string) => {
    const base = new Date(`${dateKey}T00:00:00`);
    const day = base.getDay();
    const diffToSunday = day;
    const start = new Date(base);
    start.setDate(base.getDate() - diffToSunday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: getLocalDateKey(start),
      end: getLocalDateKey(end)
    };
  };

  const getMonthRangeFromDateKey = (dateKey: string) => {
    const base = new Date(`${dateKey}T00:00:00`);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      start: getLocalDateKey(start),
      end: getLocalDateKey(end)
    };
  };

  const openShiftEditorFromMenu = async () => {
    if (!boardContextMenu) return;
    const staffId = boardContextMenu.staffId;
    setBoardContextMenu(null);
    setShiftEditorStaffId(staffId);
    setShiftLoading(true);
    setShowShiftEditorModal(true);

    try {
      const response = await tenantApi.getEmployeeShifts(staffId);
      const list = Array.isArray(response?.shifts)
        ? response.shifts
        : Array.isArray(response?.data?.shifts)
          ? response.data.shifts
          : [];
      const normalized = list.map((item: any) => ({
        id: `${item.id || crypto.randomUUID()}`,
        dayOfWeek: item.dayOfWeek ?? null,
        specificDate: item.specificDate ?? null,
        startTime: `${item.startTime || "09:00"}`.slice(0, 5),
        endTime: `${item.endTime || "18:00"}`.slice(0, 5),
        isRecurring: item.isRecurring !== false,
        startDate: item.startDate ?? null,
        endDate: item.endDate ?? null,
        label: item.label ?? null,
        isActive: item.isActive !== false,
        isDraft: false
      }));
      setShiftOriginal(normalized);
      setShiftDraft(normalized);
      const recurringWithRange = normalized.find((item: ShiftDraft) => item.isRecurring && (item.startDate || item.endDate));
      setShiftSharedRange({
        startDate: recurringWithRange?.startDate || null,
        endDate: recurringWithRange?.endDate || null
      });
    } catch (error) {
      console.error("Failed to load staff shifts for modal:", error);
      await dialog.alert({
        title: locale === "ar" ? "تعذر التحميل" : "Load failed",
        message: locale === "ar" ? "تعذر تحميل ورديات الموظف." : "Failed to load staff shifts.",
        tone: "danger"
      });
      setShowShiftEditorModal(false);
      setShiftEditorStaffId(null);
      setShiftOriginal([]);
      setShiftDraft([]);
    } finally {
      setShiftLoading(false);
    }
  };

  const saveShiftEditorChanges = async () => {
    if (!shiftEditorStaffId) return;

    const originalMap = new Map(shiftOriginal.map((item) => [item.id, item]));
    const currentMap = new Map(shiftDraft.map((item) => [item.id, item]));
    const toDelete = shiftOriginal.filter((item) => !currentMap.has(item.id));
    const toCreate = shiftDraft.filter((item) => item.isDraft || !originalMap.has(item.id) || item.id.startsWith("draft-") || item.id.startsWith("temp-"));
    const toUpdate = shiftDraft.filter((item) => {
      if (toCreate.some((createItem) => createItem.id === item.id)) {
        return false;
      }
      const prev = originalMap.get(item.id);
      if (!prev) return false;
      return JSON.stringify({
        dayOfWeek: item.dayOfWeek,
        specificDate: item.specificDate,
        startTime: item.startTime,
        endTime: item.endTime,
        isRecurring: item.isRecurring,
        startDate: item.startDate,
        endDate: item.endDate,
        label: item.label,
        isActive: item.isActive
      }) !== JSON.stringify({
        dayOfWeek: prev.dayOfWeek,
        specificDate: prev.specificDate,
        startTime: prev.startTime,
        endTime: prev.endTime,
        isRecurring: prev.isRecurring,
        startDate: prev.startDate,
        endDate: prev.endDate,
        label: prev.label,
        isActive: prev.isActive
      });
    });

    setShiftSaving(true);
    try {
      await Promise.all(toDelete.map((item) => tenantApi.deleteEmployeeShift(shiftEditorStaffId, item.id)));

      await Promise.all(toCreate.map((item) =>
        tenantApi.createEmployeeShift(shiftEditorStaffId, {
          dayOfWeek: item.isRecurring ? item.dayOfWeek : null,
          specificDate: item.isRecurring ? null : (item.specificDate || shiftSharedRange.startDate || null),
          startTime: item.startTime,
          endTime: item.endTime,
          isRecurring: item.isRecurring,
          startDate: item.isRecurring ? (shiftSharedRange.startDate || item.startDate || null) : null,
          endDate: item.isRecurring ? (shiftSharedRange.endDate || item.endDate || null) : null,
          label: item.label || undefined
        })
      ));

      await Promise.all(toUpdate.map((item) =>
        tenantApi.updateEmployeeShift(shiftEditorStaffId, item.id, {
          dayOfWeek: item.isRecurring ? item.dayOfWeek : null,
          specificDate: item.isRecurring ? null : (item.specificDate || shiftSharedRange.startDate || null),
          startTime: item.startTime,
          endTime: item.endTime,
          isRecurring: item.isRecurring,
          startDate: item.isRecurring ? (shiftSharedRange.startDate || item.startDate || null) : null,
          endDate: item.isRecurring ? (shiftSharedRange.endDate || item.endDate || null) : null,
          label: item.label || undefined
        })
      ));

      setShowShiftEditorModal(false);
      setShiftEditorStaffId(null);
      setShiftDraft([]);
      setShiftOriginal([]);
      await dialog.alert({
        title: locale === "ar" ? "تم الحفظ" : "Saved",
        message: locale === "ar" ? "تم حفظ التعديلات على الورديات." : "Shift changes saved.",
        tone: "success"
      });
    } catch (error: any) {
      console.error("Failed to save shift editor changes:", error);
      await dialog.alert({
        title: locale === "ar" ? "تعذر الحفظ" : "Save failed",
        message: error?.message || (locale === "ar" ? "تعذر حفظ الورديات." : "Failed to save shifts."),
        tone: "danger"
      });
    } finally {
      setShiftSaving(false);
    }
  };

  const discardShiftEditorChanges = () => {
    setShowShiftEditorModal(false);
    setShiftEditorStaffId(null);
    setShiftDraft([]);
    setShiftOriginal([]);
    setShiftSharedRange({ startDate: null, endDate: null });
  };

  const applyProviderViewFromMenu = (mode: "day" | "week" | "month") => {
    if (!boardContextMenu) return;
    const staffId = boardContextMenu.staffId;
    const dateKey = boardContextMenu.dateKey || selectedDateKey;
    setCalendarFocusedStaffId(staffId);
    setBoardContextMenu(null);

    setSelectedDate(new Date(`${dateKey}T00:00:00`));
    setCalendarScope(mode);
    setViewMode("calendar");
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("appointments-grid-hour-height", String(gridHourHeight));
  }, [gridHourHeight]);

  if (!hydrated) {
    return (
      <TenantLayout fullWidth>
        <div className="py-12 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout fullWidth>
      <div className={`fixed inset-0 z-[500] transition ${showFilters ? 'pointer-events-auto' : 'pointer-events-none'}`}>
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
              <div className="grid grid-cols-3 gap-3">
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
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('cancelled');
                    setShowFilters(false);
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${viewMode === 'cancelled' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {locale === 'ar' ? 'الملغاة' : 'Cancelled'}
                </button>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {locale === 'ar' ? 'حجم الشبكة' : 'Grid size'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {locale === 'ar' ? 'كبر أو صغر ارتفاع الجدول' : 'Increase or decrease the calendar row height'}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {gridHourHeight}px
                  </span>
                </div>
                <input
                  type="range"
                  min={120}
                  max={360}
                  step={15}
                  value={gridHourHeight}
                  onChange={(event) => setGridHourHeight(Number(event.target.value))}
                  className="mt-4 w-full accent-primary"
                />
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                  <span>{locale === 'ar' ? 'مضغوط' : 'Compact'}</span>
                  <span>{locale === 'ar' ? 'واسع' : 'Spacious'}</span>
                </div>
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                isContextSlotBlocked
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              <PlusIcon className={`h-4 w-4 ${isContextSlotBlocked ? "text-rose-500" : "text-primary"}`} />
              <span>{locale === 'ar' ? 'إضافة موعد جديد' : 'Add new appointment'}</span>
            </button>
            {isContextSlotBlocked ? (
              <div className="mt-1 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-700 bg-rose-50">
                {locale === 'ar'
                  ? 'هذه الفترة في الماضي. جرّب خانة بعد الوقت الحالي.'
                  : 'This slot is in the past. Try a tile after the current time.'}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleOpenBlockedTimeFromMenu}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <CalendarDaysIcon className="h-4 w-4 text-primary" />
              <span>{locale === 'ar' ? 'إضافة وقت محجوز' : 'Add blocked time'}</span>
            </button>
            <button
              type="button"
              onClick={openShiftEditorFromMenu}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <ChevronDownIcon className="h-4 w-4 text-primary" />
              <span>{locale === 'ar' ? 'تعديل الورديات' : 'Edit shift'}</span>
            </button>
            <button
              type="button"
              onClick={() => applyProviderViewFromMenu("week")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <CalendarDaysIcon className="h-4 w-4 text-primary" />
              <span>{locale === 'ar' ? 'عرض الأسبوع' : 'Week view'}</span>
            </button>
            <button
              type="button"
              onClick={() => applyProviderViewFromMenu("month")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <CalendarDaysIcon className="h-4 w-4 text-primary" />
              <span>{locale === 'ar' ? 'عرض الشهر' : 'Month view'}</span>
            </button>
          </div>
        </div>
      )}

      {showShiftEditorModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" onClick={discardShiftEditorChanges} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{locale === "ar" ? "تعديل الورديات" : "Edit shifts"}</h3>
                <p className="text-sm text-gray-500">
                  {locale === "ar" ? "عدّل جدول الموظف ثم احفظ أو تراجع." : "Adjust the provider schedule, then save or discard."}
                </p>
              </div>
              <button
                type="button"
                onClick={discardShiftEditorChanges}
                className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {shiftLoading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <EmployeeWeeklyScheduleEditor
                draftMode
                locale={locale}
                isRTL={isRTL}
                draftShifts={shiftDraft as any}
                onDraftShiftsChange={(next) => setShiftDraft(next as ShiftDraft[])}
                sharedStartDate={shiftSharedRange.startDate}
                sharedEndDate={shiftSharedRange.endDate}
                onSharedRangeChange={setShiftSharedRange}
              />
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={discardShiftEditorChanges}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={shiftSaving}
              >
                {locale === "ar" ? "تراجع" : "Discard"}
              </button>
              <button
                type="button"
                onClick={saveShiftEditorChanges}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                disabled={shiftSaving || shiftLoading}
              >
                {shiftSaving ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "حفظ" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDropChange && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" onClick={() => !dropChangeSaving && setPendingDropChange(null)} />
          <div className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">
              {locale === "ar" ? "تأكيد تعديل الموعد" : "Confirm appointment change"}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {locale === "ar"
                ? "تم تغيير وقت الموعد بالسحب. راجع التفاصيل قبل الحفظ."
                : "The appointment time changed after drag-and-drop. Review details before saving."}
            </p>

            <div className="mt-4 space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <p><span className="font-semibold">{locale === "ar" ? "الموظف:" : "Provider:"}</span> {pendingDropChange.oldStaffName} → {pendingDropChange.newStaffName}</p>
              <p><span className="font-semibold">{locale === "ar" ? "الوقت:" : "Time:"}</span> {pendingDropChange.oldTimeLabel} → {pendingDropChange.newTimeLabel}</p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={notifyCustomerOnDropChange}
                onChange={(event) => setNotifyCustomerOnDropChange(event.target.checked)}
                disabled={dropChangeSaving}
              />
              <span className="text-sm text-gray-700">
                {locale === "ar"
                  ? "إرسال إشعار للعميل بتغيير الموعد وتحديث وقت الموعد في تطبيق العميل."
                  : "Notify customer about this schedule change and update the appointment time in customer app."}
              </span>
            </label>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDropChange(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={dropChangeSaving}
              >
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={confirmDropAppointmentChange}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                disabled={dropChangeSaving}
              >
                {dropChangeSaving ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "تأكيد" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {(viewMode === 'list' || viewMode === 'cancelled') && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <FunnelIcon className="h-5 w-5" />
            <span>{locale === 'ar' ? 'أدوات المواعيد' : 'Appointment Tools'}</span>
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      ) : (viewMode === 'list' || viewMode === 'cancelled') && appointments.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noAppointments")}</h3>
          <p className="text-gray-600 mb-2">{t("noAppointmentsDesc")}</p>
          <p className="text-sm text-gray-500">
            {locale === 'ar' ? 'القائمة معروضة حسب تاريخ البداية والنهاية أعلاه. غيّر النطاق لرؤية حجوزات أخرى.' : 'List is filtered by the start/end dates above. Try a wider date range to see more appointments.'}
          </p>
        </div>
      ) : (viewMode === 'list' || viewMode === 'cancelled') ? (
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
                      {(() => {
                        const effectivePaymentStatus = resolveEffectivePaymentStatus(appointment);
                        return (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getPaymentStatusColor(effectivePaymentStatus)}`}>
                            {getPaymentStatusLabel(effectivePaymentStatus)}
                          </span>
                        );
                      })()}
                      {resolveEffectivePaymentStatus(appointment) === 'deposit_paid' && (
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
                      {viewMode === 'cancelled' && appointment.updatedAt && (
                        <p>
                          {locale === 'ar' ? 'وقت الإلغاء' : 'Cancelled at'}: {formatDateTime(appointment.updatedAt).date} {formatDateTime(appointment.updatedAt).time}
                        </p>
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
          onDropAppointmentChange={advancedDragEnabled ? handleDropAppointmentChange : undefined}
          onAppointmentClick={handleOpenAppointmentDetails}
          onGridContextMenu={handleGridContextMenu}
          onGridTimeSlotClick={handleGridTimeSlotClick}
          onStaffHeaderMenuRequest={handleStaffHeaderMenu}
          onBreakClick={handleOpenBlockedTime}
          onAppointmentSettingsClick={handleOpenAppointmentDetails}
          onOpenTools={() => setShowFilters(true)}
          onShowAllProviders={() => {
            setCalendarScope("day");
            setCalendarFocusedStaffId(null);
            setFilterStaffId("");
          }}
          activeFilterCount={activeFilterCount}
          serviceCapabilityMap={serviceCapabilityMap}
          locale={locale}
          isRTL={isRTL}
          t={t}
          sectionTitle={t("title")}
          hourHeight={gridHourHeight}
          calendarScope={calendarScope}
          focusedStaffId={calendarFocusedStaffId}
          startHour={boardDisplayHours.startHour}
          endHour={boardDisplayHours.endHour}
        />
      )}

      <AppointmentDetailsDrawer
        open={showAppointmentDetailsDrawer}
        appointmentId={selectedAppointmentId}
        locale={locale}
        isRTL={isRTL}
        onClose={() => {
          setShowAppointmentDetailsDrawer(false);
          setSelectedAppointmentId(null);
        }}
        onRebook={handleRebookAppointment}
      />

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
        prefill={drawerPrefill}
        existingBreak={selectedBreak}
        onClose={() => {
          setShowQuickDrawer(false);
          setSelectedBreak(null);
        }}
        onAppointmentCreated={() => {
          if (viewMode === 'calendar') {
            loadAppointmentsBoard();
          } else {
            loadAppointments();
          }
        }}
        onBreakSaved={() => {
          setSelectedBreak(null);
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
