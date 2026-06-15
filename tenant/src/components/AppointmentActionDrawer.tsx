"use client";

import { useEffect, useMemo, useState } from "react";
import { getImageUrl, tenantApi } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useAppDialog } from "@/components/AppDialogProvider";

interface ServiceEmployee {
  id: string;
  name: string;
  photo?: string | null;
  isActive?: boolean;
}

interface ServiceVariant {
  id: string;
  description: string;
  duration: number;
  finalPrice: number;
  isActive?: boolean;
}

interface ServiceItem {
  id: string;
  name_en: string;
  name_ar: string;
  image?: string | null;
  category?: string | null;
  parentName?: string | null;
  parentService?: string | null;
  duration: number;
  finalPrice?: number;
  paymentOptions?: string[] | string | null;
  variants?: ServiceVariant[] | string | null;
  employees?: ServiceEmployee[];
}

interface CustomerItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: string | null;
  profileImage?: string | null;
}

interface NewCustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
}

interface PrefillCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

interface ExistingBreakItem {
  id: string;
  staffId: string;
  type?: string;
  label?: string | null;
  specificDate?: string | null;
  startTime: string;
  endTime: string;
  isRecurring?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
}

interface BookingDraftItem {
  serviceId: string;
  variantId?: string | null;
  staffId?: string | null;
  startTime?: string | null;
  duration?: number | null;
  discountType?: "none" | "percent" | "fixed";
  discountValue?: number | null;
}

export interface AppointmentActionDrawerPrefill {
  customer?: PrefillCustomer | null;
  serviceId?: string;
  variantId?: string;
  staffId?: string;
  date?: string;
  time?: string;
  startStep?: number;
  paymentMethod?: string;
  notes?: string;
  bookingSessionId?: string | null;
  bookingReference?: string | null;
  queuedServices?: BookingDraftItem[];
}

type DrawerMode = "appointment" | "blocked_time";

interface AppointmentActionDrawerProps {
  open: boolean;
  mode: DrawerMode;
  locale: string;
  isRTL: boolean;
  services: ServiceItem[];
  employees: ServiceEmployee[];
  defaultStaffId?: string;
  defaultDate?: string;
  defaultTime?: string;
  prefill?: AppointmentActionDrawerPrefill;
  existingBreak?: ExistingBreakItem | null;
  onClose: () => void;
  onAppointmentCreated?: () => void;
  onBreakSaved?: () => void;
}

function parseArrayValue<T = any>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.trim()?.[0] || "";
  const last = lastName?.trim()?.[0] || "";
  return `${first}${last}`.toUpperCase() || "?";
}

function getTodayDateKey() {
  return new Date().toISOString().split("T")[0];
}

function formatAppointmentDateLabel(dateKey: string, locale: string) {
  if (!dateKey) {
    return "";
  }

  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(parsed);
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRoundedUpFiveMinuteTime(date = new Date()) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const rounded = Math.ceil((minutes + 1) / 5) * 5;
  next.setMinutes(rounded);
  return next;
}

function getTimeGuardMessage(locale: string, suggestedTimeLabel: string) {
  return locale === "ar"
    ? `لا يمكنك حجز الموعد في هذا الوقت اليوم لأنه قد مضى، جرّب وقتًا بعد ${suggestedTimeLabel}.`
    : `You can not book the appointment on this time today because it was passed, try something after ${suggestedTimeLabel}.`;
}

function getPastTodayTimeWarning(dateKey: string, timeKey: string, locale: string) {
  if (!dateKey || !timeKey) {
    return "";
  }

  const selected = new Date(`${dateKey}T${timeKey}:00`);
  if (Number.isNaN(selected.getTime())) {
    return "";
  }

  const now = new Date();
  if (selected.getTime() >= now.getTime()) {
    return "";
  }

  const suggestedTimeLabel = formatTime12Hour(
    getRoundedUpFiveMinuteTime(now).toTimeString().slice(0, 5),
    locale
  );
  return getTimeGuardMessage(locale, suggestedTimeLabel);
}

function getLocalDateKeyFromValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  const [hoursString, minutesString] = time.split(":");
  const base = new Date();
  base.setHours(Number(hoursString) || 0, Number(minutesString) || 0, 0, 0);
  base.setMinutes(base.getMinutes() + minutesToAdd);
  return base.toTimeString().slice(0, 5);
}

function normalizeTimeLabel(time?: string | null) {
  return `${time || ""}`.trim().slice(0, 5);
}

function extractTimeLabel(value?: string | null) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return "";
  }

  if (/^\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 5);
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toTimeString().slice(0, 5);
  }

  return raw.slice(0, 5);
}

function formatMinutesLabel(minutes: number, locale: string) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(5, Math.round(minutes)) : 30;
  return locale === "ar" ? `${safeMinutes} دقيقة` : `${safeMinutes} min`;
}

function resolveDiscountAmount(basePrice: number, discountType: string, discountValue: number) {
  const price = toSafeMoneyNumber(basePrice);
  const value = toSafeMoneyNumber(discountValue);
  const type = `${discountType || ""}`.trim().toLowerCase();

  if (!price || !type || type === "none" || value <= 0) {
    return 0;
  }

  if (type === "percent" || type === "percentage") {
    return Math.max(0, price * (value / 100));
  }

  return Math.max(0, Math.min(price, value));
}

function toSafeMoneyNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime12Hour(value: string, locale: string) {
  const [h, m] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? (locale === "ar" ? "م" : "PM") : (locale === "ar" ? "ص" : "AM");
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, index) => {
  const totalMinutes = index * 5;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return {
    value,
    labelEn: formatTime12Hour(value, "en"),
    labelAr: formatTime12Hour(value, "ar")
  };
});

export function AppointmentActionDrawer({
  open,
  mode,
  locale,
  isRTL,
  services,
  employees,
  defaultStaffId,
  defaultDate,
  defaultTime,
  prefill,
  existingBreak,
  onClose,
  onAppointmentCreated,
  onBreakSaved
}: AppointmentActionDrawerProps) {
  const dialog = useAppDialog();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [errorDebug, setErrorDebug] = useState<any>(null);
  const [customerMode, setCustomerMode] = useState<"existing" | "new" | "guest">("existing");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: ""
  });

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(getTodayDateKey());
  const [appointmentTime, setAppointmentTime] = useState("10:00");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [includeGroupGuest, setIncludeGroupGuest] = useState(false);
  const [groupGuest, setGroupGuest] = useState({ firstName: "", lastName: "", phone: "", serviceId: "", isFree: false });
  const [queuedServices, setQueuedServices] = useState<BookingDraftItem[]>([]);
  const [stagedServiceIds, setStagedServiceIds] = useState<string[]>([]);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("all");
  const [serviceDraft, setServiceDraft] = useState({
    serviceId: "",
    staffId: "",
    startTime: "10:00",
    duration: "30",
    discountType: "none" as "none" | "percent" | "fixed",
    discountValue: ""
  });

  const [breakEmployeeId, setBreakEmployeeId] = useState("");
  const [breakDate, setBreakDate] = useState(getTodayDateKey());
  const [breakRecurrenceMode, setBreakRecurrenceMode] = useState<"single" | "continues" | "range">("single");
  const [breakRangeStartDate, setBreakRangeStartDate] = useState(getTodayDateKey());
  const [breakRangeEndDate, setBreakRangeEndDate] = useState("");
  const [breakStartTime, setBreakStartTime] = useState("10:00");
  const [breakEndTime, setBreakEndTime] = useState("10:30");
  const [breakType, setBreakType] = useState<"lunch" | "prayer" | "cleaning" | "other">("other");
  const [breakLabel, setBreakLabel] = useState("");
  const isEditingBlockedTime = mode === "blocked_time" && Boolean(existingBreak);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");
    setErrorDebug(null);
    setSuccess("");

    if (mode === "appointment") {
      setCustomerMode("existing");
      setShowCustomerPicker(true);
      setCustomerSearch(prefill?.customer ? `${prefill.customer.firstName} ${prefill.customer.lastName}`.trim() : "");
      setCustomers([]);
      setSelectedCustomer(prefill?.customer ? {
        id: prefill.customer.id,
        firstName: prefill.customer.firstName,
        lastName: prefill.customer.lastName,
        email: prefill.customer.email || "",
        phone: prefill.customer.phone || ""
      } : null);
      setNewCustomer({
        firstName: locale === "ar" ? "عميل" : "Customer",
        lastName: "001",
        email: "",
        phone: "",
        gender: "",
        dateOfBirth: ""
      });
      const initialServices = prefill?.queuedServices?.length
        ? prefill.queuedServices
        : prefill?.serviceId
          ? [{
              serviceId: prefill.serviceId,
              variantId: prefill.variantId || null,
              staffId: prefill.staffId || defaultStaffId || null,
              startTime: prefill.time ? `${prefill.date || defaultDate || getTodayDateKey()}T${prefill.time}:00` : null,
              duration: null,
              discountType: "none" as const,
              discountValue: null
            }]
          : [];
      setQueuedServices(initialServices);
      setStagedServiceIds([]);
      setSelectedServiceId(initialServices[0]?.serviceId || "");
      setSelectedVariantId(initialServices[0]?.variantId || "");
      setSelectedStaffId(initialServices[0]?.staffId || defaultStaffId || "");
      setAppointmentDate(prefill?.date || defaultDate || getTodayDateKey());
      setAppointmentTime(prefill?.time || defaultTime || "10:00");
      setPaymentMethod(prefill?.paymentMethod || "");
      setNotes(prefill?.notes || "");
      setIncludeGroupGuest(false);
      setGroupGuest({ firstName: "", lastName: "", phone: "", serviceId: "", isFree: false });
      setShowServicePicker(true);
      setEditingServiceIndex(null);
      setServiceSearch("");
      setSelectedServiceCategory("all");
      setServiceDraft({
        serviceId: initialServices[0]?.serviceId || "",
        staffId: initialServices[0]?.staffId || defaultStaffId || "",
        startTime: prefill?.time || defaultTime || "10:00",
        duration: `${prefill?.queuedServices?.[0]?.duration || 30}`,
        discountType: prefill?.queuedServices?.[0]?.discountType || "none",
        discountValue: `${prefill?.queuedServices?.[0]?.discountValue || ""}`
      });
      return;
    }

    const breakDateValue =
      getLocalDateKeyFromValue(existingBreak?.specificDate) ||
      getLocalDateKeyFromValue(existingBreak?.startDateTime) ||
      defaultDate ||
      getTodayDateKey();

    setBreakEmployeeId(existingBreak?.staffId || defaultStaffId || "");
    setBreakDate(breakDateValue);
    setBreakRangeStartDate(existingBreak?.startDate || breakDateValue);
    setBreakRangeEndDate(existingBreak?.endDate || "");
    if (existingBreak?.isRecurring) {
      setBreakRecurrenceMode(existingBreak?.endDate ? "range" : "continues");
    } else {
      setBreakRecurrenceMode("single");
    }
    setBreakStartTime(existingBreak?.startTime?.slice(0, 5) || defaultTime || "10:00");
    setBreakEndTime(existingBreak?.endTime?.slice(0, 5) || addMinutesToTime(defaultTime || "10:00", 30));
    setBreakType((existingBreak?.type as any) || "other");
    setBreakLabel(existingBreak?.label || "");
  }, [open, mode, defaultStaffId, defaultDate, defaultTime, prefill, existingBreak]);

  const handleWalkInCustomer = () => {
    setError("");
    setCustomerMode("guest");
    setShowCustomerPicker(true);
    setCustomerSearch("");
    setSelectedCustomer(null);
    setNewCustomer({
      firstName: locale === "ar" ? "عميل" : "Customer",
      lastName: "001",
      email: "",
      phone: "",
      gender: "",
      dateOfBirth: ""
    });
  };

  useEffect(() => {
    if (!open || mode !== "appointment" || !showCustomerPicker || customerMode !== "existing") {
      return;
    }

    const query = customerSearch.trim();
    const timer = setTimeout(async () => {
      try {
        setCustomerLoading(true);
        const response = await tenantApi.getCustomers({ search: query || undefined, limit: 100 });
        if (response.success) {
          setCustomers(response.data?.customers || []);
        } else {
          setCustomers([]);
        }
      } catch (err) {
        console.error("Failed to search customers:", err);
        setCustomers([]);
      } finally {
        setCustomerLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, mode, showCustomerPicker, customerSearch, customerMode]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId]
  );
  const primaryServiceId = (editingServiceIndex !== null ? queuedServices[editingServiceIndex]?.serviceId : queuedServices[0]?.serviceId)
    || selectedServiceId
    || serviceDraft.serviceId;
  const activeServiceForPayment = useMemo(
    () => services.find((service) => service.id === primaryServiceId) || selectedService || null,
    [services, primaryServiceId, selectedService]
  );

  const serviceVariants = useMemo(
    () => parseArrayValue<ServiceVariant>(selectedService?.variants).filter((variant) => variant.isActive !== false),
    [selectedService]
  );

  const assignedEmployees = useMemo(
    () => (selectedService?.employees || []).filter((employee) => employee.isActive !== false),
    [selectedService]
  );

  const allowedPaymentMethods = useMemo(() => {
    return ["at-center"];
  }, []);

  useEffect(() => {
    if (!open || mode !== "appointment") {
      return;
    }

    if (!selectedService) {
      setSelectedVariantId("");
      setSelectedStaffId(defaultStaffId || "");
    }

    if (selectedVariantId && !serviceVariants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId("");
    }

    if (selectedStaffId && !assignedEmployees.some((employee) => employee.id === selectedStaffId)) {
      setSelectedStaffId("");
    } else if (!selectedStaffId && defaultStaffId && assignedEmployees.some((employee) => employee.id === defaultStaffId)) {
      setSelectedStaffId(defaultStaffId);
    }

    if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(allowedPaymentMethods[0] || "");
    }
  }, [
    open,
    mode,
    activeServiceForPayment,
    allowedPaymentMethods,
    assignedEmployees,
    serviceVariants,
    selectedVariantId,
    selectedStaffId,
    paymentMethod,
    defaultStaffId
  ]);

  useEffect(() => {
    if (!includeGroupGuest) {
      return;
    }

    setGroupGuest((prev) => {
      if (prev.serviceId) {
        return prev;
      }

      return {
        ...prev,
        serviceId: queuedServices[0]?.serviceId || selectedServiceId || ""
      };
    });
  }, [includeGroupGuest, queuedServices, selectedServiceId]);

  const selectedVariant = useMemo(
    () => serviceVariants.find((variant) => variant.id === selectedVariantId) || null,
    [serviceVariants, selectedVariantId]
  );
  const selectedStaff = useMemo(
    () => employees.find((employee) => employee.id === selectedStaffId) || null,
    [employees, selectedStaffId]
  );

  const displayServicePrice = toSafeMoneyNumber(selectedVariant?.finalPrice ?? selectedService?.finalPrice ?? 0);
  const displayDuration = selectedVariant?.duration ?? selectedService?.duration ?? 0;
  const selectedServiceName = locale === "ar"
    ? (selectedService?.name_ar || selectedService?.name_en || "")
    : (selectedService?.name_en || selectedService?.name_ar || "");
  const selectedVariantName = selectedVariant?.description || "";
  const selectedServiceParentLabel = (selectedService?.parentName || selectedService?.parentService || selectedService?.category || "").trim();
  const selectedCustomerName = customerMode === "existing"
    ? `${selectedCustomer?.firstName || ""} ${selectedCustomer?.lastName || ""}`.trim()
    : `${newCustomer.firstName || ""} ${newCustomer.lastName || ""}`.trim();
  const paymentMethodLabel = paymentMethod === "at-center"
    ? (locale === "ar" ? "الدفع عند المركز" : "Pay at Center")
    : paymentMethod === "online-full"
      ? (locale === "ar" ? "الدفع الكامل أونلاين" : "Pay in Full Online")
      : paymentMethod === "booking-fee"
        ? (locale === "ar" ? "عربون الحجز" : "Booking Fee")
        : paymentMethod;
  const customerModeLabel = customerMode === "existing"
    ? (locale === "ar" ? "عميل موجود" : "Existing customer")
    : customerMode === "new"
      ? (locale === "ar" ? "عميل جديد" : "New customer")
      : (locale === "ar" ? "ضيف" : "Guest");
  const appointmentSummaryTimeLabel = `${appointmentDate || "-"} ${appointmentTime ? formatTime12Hour(appointmentTime, locale) : "-"}`;
  const selectedGuestService = useMemo(
    () => services.find((service) => service.id === groupGuest.serviceId) || null,
    [services, groupGuest.serviceId]
  );
  const selectedGuestServiceName = selectedGuestService
    ? (locale === "ar" ? selectedGuestService.name_ar : selectedGuestService.name_en) || selectedGuestService.name_en || selectedGuestService.name_ar || ""
    : "";
  const guestServicePrice = includeGroupGuest
    ? (groupGuest.isFree ? 0 : toSafeMoneyNumber(selectedGuestService?.finalPrice ?? 0))
    : 0;
  const displayTotalPrice = toSafeMoneyNumber(displayServicePrice + guestServicePrice);
  const getQueueItemService = (item: BookingDraftItem) => {
    const service = services.find((entry) => entry.id === item.serviceId) || null;
    const variant = parseArrayValue<ServiceVariant>(service?.variants).find((entry) => entry.id === item.variantId) || null;
    return { service, variant };
  };

  const getQueueItemDuration = (item: BookingDraftItem) => {
    const { service, variant } = getQueueItemService(item);
    const overriddenDuration = Number(item.duration || 0);
    if (Number.isFinite(overriddenDuration) && overriddenDuration > 0) {
      return overriddenDuration;
    }
    return variant?.duration ?? service?.duration ?? 30;
  };

  const getQueueItemBasePrice = (item: BookingDraftItem) => {
    const { service, variant } = getQueueItemService(item);
    return toSafeMoneyNumber(variant?.finalPrice ?? service?.finalPrice ?? 0);
  };

  const getQueueItemAdjustedPrice = (item: BookingDraftItem) => {
    const basePrice = getQueueItemBasePrice(item);
    const discountAmount = resolveDiscountAmount(basePrice, item.discountType || "none", item.discountValue || 0);
    return toSafeMoneyNumber(basePrice - discountAmount);
  };

  const queueHasMissingRequiredStaff = useMemo(
    () =>
      queuedServices.some((item) => {
        const service = services.find((entry) => entry.id === item.serviceId);
        const serviceEmployees = (service?.employees || []).filter((employee) => employee.isActive !== false);
        return serviceEmployees.length > 0 && !item.staffId;
      }),
    [queuedServices, services]
  );

  const getQueueItemStartTime = (item: BookingDraftItem) => extractTimeLabel(item.startTime) || appointmentTime;

  const getQueueItemEndTime = (item: BookingDraftItem) => addMinutesToTime(getQueueItemStartTime(item), getQueueItemDuration(item));
  const hasQueuedServices = queuedServices.length > 0;
  const queuedServicesDurationTotal = queuedServices.reduce((sum, item) => sum + getQueueItemDuration(item), 0);
  const queuedServiceCount = queuedServices.length;
  const appointmentWorkspaceDateLabel = formatAppointmentDateLabel(appointmentDate || defaultDate || getTodayDateKey(), locale);
  const appointmentWorkspaceTimeLabel = formatTime12Hour(appointmentTime || defaultTime || "10:00", locale);
  const appointmentWorkspaceDurationLabel = formatMinutesLabel(queuedServicesDurationTotal || displayDuration || 30, locale);
  const groupedServices = useMemo(() => {
    const groupMap = new Map<string, { heading: string | null; items: ServiceItem[] }>();

    services.forEach((service) => {
      const parentLabel = (service.parentName || service.parentService || "").trim();
      const categoryLabel = (service.category || "").trim();
      const groupHeading = parentLabel || categoryLabel || null;
      const groupKey = groupHeading ? `group:${groupHeading}` : `service:${service.id}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { heading: groupHeading, items: [] });
      }

      groupMap.get(groupKey)?.items.push(service);
    });

    return Array.from(groupMap.values()).map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => {
        const aName = locale === "ar" ? a.name_ar : a.name_en;
        const bName = locale === "ar" ? b.name_ar : b.name_en;
        return aName.localeCompare(bName);
      })
    }));
  }, [services, locale]);
  const serviceCategoryTabs = useMemo(() => {
    const categories = new Set<string>();
    groupedServices.forEach((group) => {
      if (group.heading) {
        categories.add(group.heading);
      }
      group.items.forEach((service) => {
        const label = (service.category || service.parentName || service.parentService || "").trim();
        if (label) {
          categories.add(label);
        }
      });
    });
    return ["all", ...Array.from(categories)];
  }, [groupedServices]);
  const filteredServices = useMemo(
    () =>
      groupedServices
        .flatMap((group) => group.items)
        .filter((service) => {
          const serviceName = `${service.name_en} ${service.name_ar} ${service.category || ""} ${service.parentName || ""} ${service.parentService || ""}`.toLowerCase();
          const matchesSearch = !serviceSearch.trim() || serviceName.includes(serviceSearch.trim().toLowerCase());
          const serviceCategory = (service.category || service.parentName || service.parentService || "").trim();
          const matchesCategory = selectedServiceCategory === "all" || serviceCategory === selectedServiceCategory;
          return matchesSearch && matchesCategory;
        }),
    [groupedServices, selectedServiceCategory, serviceSearch]
  );
  const visibleCustomers = customers.slice(0, 6);
  const findQueuedServiceIndex = (serviceId: string) =>
    queuedServices.findIndex((item) => item.serviceId === serviceId);
  const toggleStagedService = (serviceId: string) => {
    setStagedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((item) => item !== serviceId)
        : [...current, serviceId]
    );
  };
  const clearStagedServices = () => setStagedServiceIds([]);
  const commitStagedServices = () => {
    if (!stagedServiceIds.length) {
      return;
    }

    const nextServices: BookingDraftItem[] = stagedServiceIds.map((serviceId) => ({
      serviceId,
      variantId: null,
      staffId: defaultStaffId || null,
      startTime: null,
      duration: null,
      discountType: "none",
      discountValue: null
    }));

    setQueuedServices(nextServices);
    setSelectedServiceId(nextServices[0]?.serviceId || "");
    setSelectedVariantId("");
    setSelectedStaffId(defaultStaffId || "");
    setShowServicePicker(false);
    setEditingServiceIndex(null);
    setStagedServiceIds([]);
  };

  const editingQueuedService = editingServiceIndex !== null ? queuedServices[editingServiceIndex] || null : null;
  const editingQueuedServiceRecord = editingQueuedService
    ? services.find((service) => service.id === editingQueuedService.serviceId) || null
    : null;
  const editingQueuedServicePrice = editingQueuedService ? getQueueItemBasePrice(editingQueuedService) : 0;
  const editingQueuedServiceDiscount = editingQueuedService
    ? resolveDiscountAmount(editingQueuedServicePrice, editingQueuedService.discountType || "none", editingQueuedService.discountValue || 0)
    : 0;
  const editingQueuedServiceTotal = toSafeMoneyNumber(editingQueuedServicePrice - editingQueuedServiceDiscount);
  const editingQueuedServiceWarning = editingQueuedService
    ? getPastTodayTimeWarning(
        getLocalDateKeyFromValue(editingQueuedService.startTime) || appointmentDate,
        getQueueItemStartTime(editingQueuedService),
        locale
      )
    : "";

  const queuedServicesSubtotal = useMemo(
    () => toSafeMoneyNumber(queuedServices.reduce((sum, item) => sum + getQueueItemAdjustedPrice(item), 0)),
    [queuedServices, services]
  );
  const queuedServicesBaseTotal = useMemo(
    () => toSafeMoneyNumber(queuedServices.reduce((sum, item) => sum + getQueueItemBasePrice(item), 0)),
    [queuedServices, services]
  );
  const queuedServicesDiscountTotal = toSafeMoneyNumber(Math.max(0, queuedServicesBaseTotal - queuedServicesSubtotal));
  const queuedServicesTotal = toSafeMoneyNumber(queuedServicesSubtotal + guestServicePrice);

  const addQueuedService = (serviceId: string, variantId?: string | null, staffId?: string | null) => {
    const trimmedServiceId = `${serviceId || ""}`.trim();
    if (!trimmedServiceId) {
      return -1;
    }

    const normalizedVariantId = variantId || null;
    const normalizedStaffId = staffId || null;
    const targetService = services.find((entry) => entry.id === trimmedServiceId) || null;
    const next = [...queuedServices];
    const existingIndex = next.findIndex((item) => item.serviceId === trimmedServiceId);
    if (existingIndex >= 0) {
      openQueuedServiceEditor(existingIndex);
      return existingIndex;
    }

    const lastItem = next[next.length - 1];
    const startTime = lastItem
      ? new Date(new Date(lastItem.startTime || `${appointmentDate}T${appointmentTime}:00`).getTime() + getQueueItemDuration(lastItem) * 60000).toISOString()
      : new Date(`${appointmentDate}T${appointmentTime}:00`).toISOString();

    next.push({
      serviceId: trimmedServiceId,
      variantId: normalizedVariantId,
      staffId: normalizedStaffId,
      startTime,
      duration: null,
      discountType: "none",
      discountValue: null
    });
    const createdIndex = next.length - 1;
    setQueuedServices(next);
    setEditingServiceIndex(createdIndex);
    setServiceDraft({
      serviceId: trimmedServiceId,
      staffId: normalizedStaffId || defaultStaffId || "",
      startTime: extractTimeLabel(startTime),
      duration: `${targetService?.duration || 30}`,
      discountType: "none",
      discountValue: ""
    });
    setShowServicePicker(false);
    return createdIndex;
  };

  const openQueuedServiceEditor = (index: number) => {
    const item = queuedServices[index];
    if (!item) {
      return;
    }

    setEditingServiceIndex(index);
    setShowServicePicker(false);
    setServiceDraft({
      serviceId: item.serviceId,
      staffId: item.staffId || defaultStaffId || "",
      startTime: getQueueItemStartTime(item),
      duration: `${getQueueItemDuration(item)}`,
      discountType: item.discountType || "none",
      discountValue: `${item.discountValue || ""}`
    });
  };

  const applyQueuedServiceEdit = () => {
    if (editingServiceIndex === null) {
      return;
    }

    const targetService = services.find((entry) => entry.id === serviceDraft.serviceId) || null;
    const sanitizedDuration = Math.max(5, Number(serviceDraft.duration || 0) || targetService?.duration || 30);
    const startTime = normalizeTimeLabel(serviceDraft.startTime) || appointmentTime;
    const nextStart = new Date(`${appointmentDate}T${startTime}:00`);

    setQueuedServices((current) => {
      const next = [...current];
      if (!next[editingServiceIndex]) {
        return current;
      }

      next[editingServiceIndex] = {
        ...next[editingServiceIndex],
        serviceId: serviceDraft.serviceId,
        staffId: serviceDraft.staffId || null,
        startTime: nextStart.toISOString(),
        duration: sanitizedDuration,
        discountType: serviceDraft.discountType,
        discountValue: serviceDraft.discountType === "none" ? 0 : toSafeMoneyNumber(serviceDraft.discountValue)
      };

      for (let index = editingServiceIndex + 1; index < next.length; index += 1) {
        const previous = next[index - 1];
        const previousDuration = getQueueItemDuration(previous);
        const previousStartTime = new Date(previous.startTime || `${appointmentDate}T${appointmentTime}:00`);
        const recalculatedStart = new Date(previousStartTime.getTime() + previousDuration * 60000);
        next[index] = {
          ...next[index],
          startTime: recalculatedStart.toISOString()
        };
      }

      return next;
    });

    setEditingServiceIndex(null);
    setServiceDraft({
      serviceId: "",
      staffId: "",
      startTime: appointmentTime,
      duration: "30",
      discountType: "none",
      discountValue: ""
    });
    setError("");
  };

  const removeQueuedServiceAt = (index: number) => {
    setQueuedServices((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setEditingServiceIndex((current) => {
      if (current === null) {
        return null;
      }
      if (current === index) {
        return null;
      }
      if (current > index) {
        return current - 1;
      }
      return current;
    });
  };

  const queuePreviewStartTime = queuedServices[0]?.startTime ? extractTimeLabel(queuedServices[0].startTime) : appointmentTime;
  const queuePreviewDate = queuedServices[0]?.startTime ? getLocalDateKeyFromValue(queuedServices[0].startTime) || appointmentDate : appointmentDate;
  const queuePreviewWarning = getPastTodayTimeWarning(queuePreviewDate, queuePreviewStartTime, locale);

  const applyDraftService = () => {
    applyQueuedServiceEdit();
  };

  const buildSequentialBookingItems = (resolvedPaymentMethod = paymentMethod) => {
    if (queuedServices.length === 0) {
      return [];
    }

    let cursor = new Date(`${appointmentDate}T${appointmentTime}`);

    return queuedServices.map((item, index) => {
      const duration = getQueueItemDuration(item);
      const startTime = index === 0 && item.startTime
        ? new Date(item.startTime)
        : item.startTime
          ? new Date(item.startTime)
          : new Date(cursor);

      if (Number.isNaN(startTime.getTime())) {
        throw new Error(locale === "ar" ? "تاريخ أو وقت غير صالح." : "Invalid date or time.");
      }

      cursor = new Date(startTime.getTime() + duration * 60000);

      return {
        serviceId: item.serviceId,
        variantId: item.variantId || null,
        staffId: item.staffId || null,
        requestedStaffId: item.staffId || null,
        startTime: startTime.toISOString(),
        paymentMethod: resolvedPaymentMethod,
        assignmentMode: item.staffId ? "tenant_reassigned" : "auto_assigned",
        duration,
        discountType: item.discountType || "none",
        discountValue: toSafeMoneyNumber(item.discountValue || 0)
      };
    });
  };

  const handleAppointmentSubmit = async (overridePaymentMethod?: string) => {
    setError("");
    setErrorDebug(null);
    setSuccess("");

    if (queuedServices.length === 0) {
      setError(locale === "ar" ? "الرجاء اختيار خدمة واحدة على الأقل." : "Please select at least one service.");
      return;
    }

    if (customerMode === "new") {
      const requiredFields = [
        newCustomer.firstName.trim(),
        newCustomer.lastName.trim()
      ];

      if (requiredFields.some((value) => !value)) {
        setError(locale === "ar" ? "الرجاء إدخال الاسم الأول والأخير للعميل." : "Please enter customer first and last name.");
        return;
      }
    }

    if (customerMode === "guest" && !newCustomer.firstName.trim() && !newCustomer.lastName.trim()) {
      setNewCustomer((current) => ({
        ...current,
        firstName: locale === "ar" ? "عميل" : "Customer",
        lastName: "001"
      }));
    }

    const bookingStartDate = queuePreviewDate || appointmentDate;
    const bookingStartTime = queuePreviewStartTime || appointmentTime;

    if (!bookingStartDate || !bookingStartTime) {
      setError(locale === "ar" ? "الرجاء اختيار التاريخ والوقت." : "Please choose a date and time.");
      return;
    }

    const timeGuardMessage = getPastTodayTimeWarning(bookingStartDate, bookingStartTime, locale);
    if (timeGuardMessage) {
      setError(timeGuardMessage);
      return;
    }

    if (queueHasMissingRequiredStaff) {
      setError(locale === "ar" ? "الرجاء اختيار مقدم الخدمة." : "Please choose a service provider.");
      return;
    }

    const resolvedPaymentMethod = overridePaymentMethod || paymentMethod;
    if (!resolvedPaymentMethod) {
      setError(locale === "ar" ? "الرجاء اختيار طريقة الدفع." : "Please choose a payment method.");
      return;
    }

    if (includeGroupGuest && (!groupGuest.firstName.trim() || !groupGuest.lastName.trim())) {
      setError(locale === "ar" ? "الرجاء إدخال الاسم الكامل للضيف الإضافي." : "Please enter the additional guest full name.");
      return;
    }

    if (includeGroupGuest && !groupGuest.serviceId.trim()) {
      setError(locale === "ar" ? "الرجاء اختيار خدمة الضيف الإضافي." : "Please choose the additional guest service.");
      return;
    }

    const resolvedCustomerMode = selectedCustomer
      ? "existing"
      : (customerMode === "new" ? "new" : "guest");

    const emailForConfirmation =
      resolvedCustomerMode === "existing"
        ? (selectedCustomer?.email || "").trim()
        : (newCustomer.email || "").trim();

    if (!emailForConfirmation) {
      const confirmedWithoutEmail = typeof window === "undefined"
        ? true
        : await dialog.confirm({
            title: locale === "ar" ? "تأكيد حفظ الموعد" : "Confirm appointment save",
            message: locale === "ar"
              ? "لم يتم إدخال بريد إلكتروني للعميل. لن يتم إرسال رسالة تأكيد الموعد عبر البريد الإلكتروني. هل تريد المتابعة وحفظ الموعد بدون إرسال تأكيد بريد؟"
              : "No customer email was entered. Appointment confirmation email will NOT be sent. Do you want to continue and save the appointment anyway?",
            confirmText: locale === "ar" ? "متابعة الحفظ" : "Continue",
            cancelText: locale === "ar" ? "إلغاء" : "Cancel"
          });
      if (!confirmedWithoutEmail) {
        return;
      }
    }

    setSaving(true);
    try {
      const startTime = new Date(`${appointmentDate}T${appointmentTime}`);
      if (Number.isNaN(startTime.getTime())) {
        throw new Error(locale === "ar" ? "تاريخ أو وقت غير صالح." : "Invalid date or time.");
      }

      const bookingItems = buildSequentialBookingItems(resolvedPaymentMethod);
      if (bookingItems.length === 0) {
        throw new Error(locale === "ar" ? "الرجاء اختيار خدمة واحدة على الأقل." : "Please choose at least one service.");
      }

      const payload = {
        notes: notes.trim() || undefined,
        paymentMethod: resolvedPaymentMethod,
        bookingSessionId: prefill?.bookingSessionId || undefined,
        bookingReference: prefill?.bookingReference || undefined,
        items: bookingItems,
        groupGuest: includeGroupGuest ? {
          firstName: groupGuest.firstName.trim(),
          lastName: groupGuest.lastName.trim(),
          phone: groupGuest.phone.trim() || undefined,
          serviceId: groupGuest.serviceId.trim() || undefined,
          isFree: Boolean(groupGuest.isFree),
          serviceName: (() => {
            const matchedService = services.find((service) => service.id === groupGuest.serviceId);
            if (!matchedService) {
              return undefined;
            }
            return (locale === "ar" ? matchedService.name_ar : matchedService.name_en) || matchedService.name_en || matchedService.name_ar || undefined;
          })()
        } : undefined,
        platformUserId: resolvedCustomerMode === "existing" ? selectedCustomer?.id : undefined,
        customer: resolvedCustomerMode === "new" || resolvedCustomerMode === "guest"
          ? {
              ...newCustomer,
              firstName: resolvedCustomerMode === "guest"
                ? (newCustomer.firstName.trim() || (locale === "ar" ? "عميل" : "Customer"))
                : newCustomer.firstName.trim(),
              lastName: resolvedCustomerMode === "guest"
                ? (newCustomer.lastName.trim() || "001")
                : newCustomer.lastName.trim(),
              email: resolvedCustomerMode === "guest" ? "" : newCustomer.email.trim(),
              phone: resolvedCustomerMode === "guest" ? "" : newCustomer.phone.trim(),
              isGuest: resolvedCustomerMode === "guest"
            }
          : null,
        assignmentMode: selectedStaffId ? "tenant_reassigned" : "auto_assigned"
      };

      const response = await tenantApi.createAppointment(payload);
      if (response.success) {
        setSuccess(locale === "ar" ? "تم إنشاء الموعد بنجاح." : "Appointment created successfully.");
        onAppointmentCreated?.();
        onClose();
      } else {
        setError(response.message || (locale === "ar" ? "فشل إنشاء الموعد." : "Failed to create appointment."));
      }
    } catch (err: any) {
      console.error("Failed to create appointment:", err);
      setErrorDebug(err?.data?.debug || null);
      const detailedValidationMessage = Array.isArray(err?.data?.errors) && err.data.errors.length > 0
        ? err.data.errors
            .map((entry: { field?: string; message?: string }) => {
              const fieldLabel = `${entry?.field || ""}`.trim();
              const message = `${entry?.message || ""}`.trim();
              return fieldLabel ? `${fieldLabel}: ${message}` : message;
            })
            .filter(Boolean)
            .join(" | ")
        : "";
      const rawMessage = `${err?.message || ''}`.toLowerCase();
      if (rawMessage.includes('conflict') || rawMessage.includes('time slot not available')) {
        setError(locale === "ar"
          ? "الموعد غير متاح في هذا الوقت بسبب تعارض. اختر وقتًا أو مقدم خدمة آخر."
          : "This time slot is not available due to a conflict. Please choose another time or provider.");
      } else if (rawMessage.includes('session expired') || rawMessage.includes('authentication failed')) {
        setError(locale === "ar"
          ? "انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى."
          : "Your session expired. Please login again.");
      } else {
        setError(
          detailedValidationMessage
            || err.message
            || (locale === "ar" ? "فشل إنشاء الموعد." : "Failed to create appointment.")
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBreakSubmit = async () => {
    setError("");
    setSuccess("");

    if (!breakEmployeeId) {
      setError(locale === "ar" ? "الرجاء اختيار الموظف." : "Please select an employee.");
      return;
    }

    if (!breakDate || !breakStartTime || !breakEndTime) {
      setError(locale === "ar" ? "الرجاء اختيار التاريخ والوقت." : "Please choose a date and time.");
      return;
    }

    if (breakEndTime <= breakStartTime) {
      setError(locale === "ar" ? "وقت الانتهاء يجب أن يكون بعد وقت البداية." : "End time must be after start time.");
      return;
    }

    setSaving(true);
    try {
      const isRecurringBreak = breakRecurrenceMode !== "single";
      const resolvedStartDate = breakRangeStartDate || breakDate;
      const resolvedEndDate = breakRecurrenceMode === "range" ? breakRangeEndDate : null;
      if (breakRecurrenceMode === "range" && (!resolvedStartDate || !resolvedEndDate)) {
        throw new Error(locale === "ar" ? "الرجاء تحديد فترة التكرار (من - إلى)." : "Please choose recurrence period (from-to).");
      }
      if (breakRecurrenceMode === "range" && resolvedEndDate && resolvedStartDate && resolvedEndDate < resolvedStartDate) {
        throw new Error(locale === "ar" ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية." : "End date must be after start date.");
      }
      const response = await tenantApi.createEmployeeBreak(breakEmployeeId, {
        specificDate: isRecurringBreak ? null : breakDate,
        startTime: breakStartTime,
        endTime: breakEndTime,
        type: breakType,
        label: breakLabel.trim() || undefined,
        isRecurring: isRecurringBreak,
        dayOfWeek: null,
        startDate: isRecurringBreak ? resolvedStartDate : undefined,
        endDate: isRecurringBreak ? (resolvedEndDate || null) : undefined,
        referenceDate: breakDate
      });

      if (response.success) {
        setSuccess(locale === "ar" ? "تم حفظ الوقت المحجوز." : "Blocked time saved successfully.");
        onBreakSaved?.();
        onClose();
      } else {
        setError(response.message || (locale === "ar" ? "فشل حفظ الوقت المحجوز." : "Failed to save blocked time."));
      }
    } catch (err: any) {
      console.error("Failed to create blocked time:", err);
      setError(err.message || (locale === "ar" ? "فشل حفظ الوقت المحجوز." : "Failed to save blocked time."));
    } finally {
      setSaving(false);
    }
  };

  const handleBreakDelete = async () => {
    if (!existingBreak) {
      return;
    }

    setError("");
    setSuccess("");

    const confirmed = typeof window === "undefined"
      ? true
      : await dialog.confirm({
          title: locale === "ar" ? "حذف الوقت المحجوز" : "Delete blocked time",
          message: locale === "ar" ? "هل تريد حذف الوقت المحجوز؟" : "Delete this blocked time?",
          confirmText: locale === "ar" ? "حذف" : "Delete",
          cancelText: locale === "ar" ? "إلغاء" : "Cancel",
          tone: "danger"
        });

    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      const response = await tenantApi.deleteEmployeeBreak(breakEmployeeId || existingBreak.staffId, existingBreak.id);
      if (response.success) {
        setSuccess(locale === "ar" ? "تم حذف الوقت المحجوز." : "Blocked time deleted successfully.");
        onBreakSaved?.();
        onClose();
      } else {
        setError(response.message || (locale === "ar" ? "فشل حذف الوقت المحجوز." : "Failed to delete blocked time."));
      }
    } catch (err: any) {
      console.error("Failed to delete blocked time:", err);
      setError(err.message || (locale === "ar" ? "فشل حذف الوقت المحجوز." : "Failed to delete blocked time."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} h-full w-full max-w-[76rem] bg-white shadow-2xl`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {mode === "appointment"
                  ? (locale === "ar" ? "مساحة الحجز" : "Booking workspace")
                  : (locale === "ar" ? "حظر وقت" : "Blocked Time")}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {mode === "appointment"
                  ? (locale === "ar" ? "أنشئ أو عدل الحجز من نفس اللوحة." : "Create or edit a booking from the same panel.")
                  : (locale === "ar" ? "احجز وقتًا محجوزًا لموظف." : "Reserve time for an employee.")}
              </p>
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

          <div className="flex-1 overflow-hidden px-5 py-5">
            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {errorDebug && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p className="font-semibold">{locale === "ar" ? "تفاصيل التشخيص" : "Debug details"}</p>
                <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(errorDebug, null, 2)}</pre>
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            {mode === "appointment" ? (
              <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="min-h-0">
                  <div className="h-full overflow-y-auto pr-1">
                    <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="rounded-[24px] border border-dashed border-gray-200 px-6 py-8 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500">
                        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19a6 6 0 10-6 0m6 0H9m6 0a3 3 0 013 3m-9-3a3 3 0 00-3 3" />
                        </svg>
                      </div>
                      <h4 className="mt-5 text-[24px] font-semibold tracking-tight text-gray-900">
                        {selectedCustomer
                          ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim()
                          : (locale === "ar" ? "اختر عميل" : "Select a client")}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {locale === "ar" ? "أو اتركه فارغًا للحجوزات الحضورية" : "Or leave empty for walk-ins"}
                      </p>
                    </div>

                    <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                      <span className="h-px flex-1 bg-gray-200" />
                      <span>OR</span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </div>

                    <button
                      type="button"
                      onClick={handleWalkInCustomer}
                      className="flex w-full items-center justify-between rounded-[22px] border border-gray-200 bg-white px-5 py-4 text-left transition hover:border-primary/40 hover:bg-purple-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-gray-900">{locale === "ar" ? "حجز حضوري" : "Walk-in booking"}</p>
                          <p className="mt-1 text-sm text-gray-500">{locale === "ar" ? "المتابعة بدون عميل" : "Continue without a client"}</p>
                        </div>
                      </div>
                      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>

                    <div className="mt-6">
                      <p className="mb-3 text-lg font-semibold tracking-tight text-gray-900">
                        {locale === "ar" ? "العملاء الحاليون" : "Recent clients"}
                      </p>
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setSelectedCustomer(null);
                          setCustomerMode("existing");
                          setShowCustomerPicker(true);
                          setCustomerSearch(e.target.value);
                        }}
                        placeholder={locale === "ar" ? "ابحث بالاسم أو الهاتف أو البريد..." : "Search clients by name, phone or email"}
                        className="w-full rounded-[20px] border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? "right" : "left" }}
                      />
                    </div>

                    <div className="mt-3 space-y-0 overflow-hidden rounded-[22px] border border-gray-200 bg-white">
                      {customerMode === "new" ? (
                        <div className="grid gap-3 bg-gray-50 p-4">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              value={newCustomer.firstName}
                              onChange={(e) => setNewCustomer((current) => ({ ...current, firstName: e.target.value }))}
                              placeholder={locale === "ar" ? "الاسم الأول" : "First name"}
                              className="rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                            />
                            <input
                              value={newCustomer.lastName}
                              onChange={(e) => setNewCustomer((current) => ({ ...current, lastName: e.target.value }))}
                              placeholder={locale === "ar" ? "اسم العائلة" : "Last name"}
                              className="rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              value={newCustomer.phone}
                              onChange={(e) => setNewCustomer((current) => ({ ...current, phone: e.target.value }))}
                              placeholder={locale === "ar" ? "الهاتف" : "Phone"}
                              className="rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                            />
                            <input
                              value={newCustomer.email}
                              onChange={(e) => setNewCustomer((current) => ({ ...current, email: e.target.value }))}
                              placeholder={locale === "ar" ? "البريد الإلكتروني" : "Email"}
                              className="rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>
                      ) : customerLoading ? (
                        <div className="p-4 text-sm text-gray-500">{locale === "ar" ? "جارٍ تحميل العملاء..." : "Loading customers..."}</div>
                      ) : visibleCustomers.length > 0 ? (
                        visibleCustomers.map((customer, index) => {
                          const active = selectedCustomer?.id === customer.id;
                          return (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerMode("existing");
                                setShowCustomerPicker(true);
                                setCustomerSearch(`${customer.firstName} ${customer.lastName}`.trim());
                              }}
                              className={`flex w-full items-center gap-4 px-4 py-4 text-left transition ${index > 0 ? "border-t border-gray-200" : ""} ${active ? "bg-purple-50" : "bg-white hover:bg-gray-50"}`}
                            >
                              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700">
                                {getInitials(customer.firstName, customer.lastName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-base font-semibold text-gray-900">{customer.firstName} {customer.lastName}</p>
                                <p className="mt-1 truncate text-sm text-gray-500">{customer.phone || customer.email}</p>
                              </div>
                              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-sm text-gray-500">
                          {customerSearch.trim()
                            ? (locale === "ar" ? "لا يوجد عميل مطابق." : "No customer found.")
                            : (locale === "ar" ? "ابدأ بالبحث عن عميل." : "Start by searching for a customer.")}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode("new");
                        setShowCustomerPicker(true);
                      }}
                      className="mt-4 flex w-full items-center gap-3 rounded-[22px] border border-gray-200 bg-white px-5 py-4 text-left transition hover:border-primary/40 hover:bg-purple-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-700">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                        </svg>
                      </div>
                      <span className="text-base font-semibold text-gray-900">{locale === "ar" ? "إضافة عميل جديد" : "Add new client"}</span>
                    </button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto pr-1">
                  <div className="space-y-5">
                  {!hasQueuedServices ? (
                    <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-5">
                        <h3 className="text-[32px] font-semibold tracking-tight text-gray-900">
                          {locale === "ar" ? "اختر خدمة" : "Select a service"}
                        </h3>
                        <button
                          type="button"
                          onClick={onClose}
                          className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          {locale === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                      </div>

                      <div className="space-y-5 px-6 py-5">
                        <input
                          type="text"
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          placeholder={locale === "ar" ? "ابحث عن الخدمات أو الفئات..." : "Search services, categories..."}
                          className="w-full rounded-[20px] border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        />

                        <div className="flex flex-wrap gap-2">
                          {serviceCategoryTabs.map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setSelectedServiceCategory(tab)}
                              className={`rounded-[18px] border px-5 py-2.5 text-sm font-semibold transition ${
                                selectedServiceCategory === tab
                                  ? "border-primary bg-white text-gray-900 shadow-sm"
                                  : "border-transparent bg-white text-gray-500 hover:border-gray-200 hover:text-gray-900"
                              }`}
                            >
                              {tab === "all" ? (locale === "ar" ? "الكل" : "All") : tab}
                            </button>
                          ))}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                          {filteredServices.map((service) => {
                            const serviceName = locale === "ar" ? (service.name_ar || service.name_en) : (service.name_en || service.name_ar);
                            const isSelected = stagedServiceIds.includes(service.id);
                            return (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => toggleStagedService(service.id)}
                                className={`rounded-[24px] border p-5 text-left transition ${
                                  isSelected
                                    ? "border-primary bg-purple-50 shadow-sm"
                                    : "border-gray-200 bg-white hover:border-primary/40 hover:bg-gray-50"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start gap-4">
                                      <span className="mt-1 h-12 w-1 rounded-full bg-gray-400/70" />
                                      <div className="min-w-0">
                                        <p className="truncate text-[26px] font-semibold tracking-tight text-gray-900">{serviceName}</p>
                                        <p className="mt-1 text-base text-gray-600">
                                          {service.parentName || service.parentService || service.category || ""}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-gray-600">
                                      <span>{formatMinutesLabel(service.duration, locale)}</span>
                                      <span>
                                        {service.employees?.length
                                          ? (locale === "ar" ? "متاح مع الموظفين المحددين" : "Available with selected staff")
                                          : (locale === "ar" ? "قد لا يتوفر مع الموظف الحالي" : "Staff member availability may vary")}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-4">
                                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-lg font-semibold text-gray-900">
                                      <Currency amount={toSafeMoneyNumber(service.finalPrice || 0)} />
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {!filteredServices.length ? (
                          <div className="rounded-[24px] border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
                            {locale === "ar" ? "لا توجد خدمات مطابقة للبحث الحالي." : "No services match the current search."}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                  {hasQueuedServices ? (
                    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                            {locale === "ar" ? "نظرة عامة" : "Appointment overview"}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold text-gray-900">
                            {locale === "ar" ? "ملخص الموعد" : "Appointment summary"}
                          </h4>
                          <p className="mt-1 text-sm text-gray-500">
                            {locale === "ar"
                              ? "راجع العميل والخدمة والمدة قبل الحفظ."
                              : "Review the client, services, and duration before saving."}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          {locale === "ar" ? "تعديل" : "Edit"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-medium text-gray-500">{locale === "ar" ? "العميل" : "Customer"}</p>
                          <p className="mt-2 truncate text-sm font-semibold text-gray-900">{selectedCustomerName || (locale === "ar" ? "حجز حضوري" : "Walk-in booking")}</p>
                          <p className="mt-1 text-xs text-gray-500">{customerModeLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-medium text-gray-500">{locale === "ar" ? "الموظف" : "Staff"}</p>
                          <p className="mt-2 truncate text-sm font-semibold text-gray-900">{selectedStaff?.name || (defaultStaffId || (locale === "ar" ? "تعيين تلقائي" : "Auto assign"))}</p>
                          <p className="mt-1 text-xs text-gray-500">{locale === "ar" ? "سيتم تطبيقه على الخدمات المختارة" : "Applied to the selected services"}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-medium text-gray-500">{locale === "ar" ? "الخدمات" : "Services"}</p>
                          <p className="mt-2 text-sm font-semibold text-gray-900">{queuedServiceCount} {locale === "ar" ? "خدمة" : queuedServiceCount === 1 ? "service" : "services"}</p>
                          <p className="mt-1 text-xs text-gray-500">{appointmentWorkspaceDurationLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-medium text-gray-500">{locale === "ar" ? "الوقت" : "Time"}</p>
                          <p className="mt-2 text-sm font-semibold text-gray-900">{appointmentWorkspaceDateLabel}</p>
                          <p className="mt-1 text-xs text-gray-500">{appointmentWorkspaceTimeLabel}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                          {locale === "ar" ? "الخدمات" : "Services"}
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-gray-900">
                          {hasQueuedServices
                            ? (locale === "ar" ? `${queuedServiceCount} خدمة` : `${queuedServiceCount} service${queuedServiceCount > 1 ? "s" : ""}`)
                            : (locale === "ar" ? "اختر خدمة" : "Select a service")}
                        </h4>
                        <p className="mt-1 text-sm text-gray-500">
                          {hasQueuedServices
                            ? (locale === "ar"
                              ? "أضف خدمات إضافية أو عدّل كل خدمة على حدة."
                              : "Add more services or customize each service individually.")
                            : (locale === "ar"
                              ? "ابدأ باختيار خدمة واحدة لإعداد الموعد."
                              : "Start by choosing a service to build the appointment.")}
                        </p>
                      </div>
                      {hasQueuedServices ? null : (
                        <button
                          type="button"
                          onClick={() => setShowServicePicker(true)}
                          className="rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
                        >
                          {locale === "ar" ? "إضافة خدمة" : "Add service"}
                        </button>
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      {queuedServices.length > 0 ? queuedServices.map((item, index) => {
                        const service = services.find((entry) => entry.id === item.serviceId) || null;
                        const variant = parseArrayValue<ServiceVariant>(service?.variants).find((entry) => entry.id === item.variantId) || null;
                        const serviceName = locale === "ar"
                          ? (service?.name_ar || service?.name_en || "")
                          : (service?.name_en || service?.name_ar || "");
                        const itemPrice = getQueueItemAdjustedPrice(item);
                        const itemStartTime = getQueueItemStartTime(item);
                        const itemDuration = getQueueItemDuration(item);
                        const isEditingThisService = editingServiceIndex === index;
                        return (
                          <div
                            key={`${item.serviceId}-${index}`}
                            className={`overflow-hidden rounded-2xl border text-left transition ${
                              isEditingThisService
                                ? "border-primary/50 bg-purple-50 shadow-sm"
                                : "border-gray-200 bg-gray-50 hover:border-primary/40 hover:bg-purple-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 p-4">
                              <button
                                type="button"
                                onClick={() => openQueuedServiceEditor(index)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="h-10 w-1.5 rounded-full bg-primary/70" />
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-gray-900">{serviceName || (locale === "ar" ? "خدمة" : "Service")}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                      {itemStartTime} • {formatMinutesLabel(itemDuration, locale)}{variant?.description ? ` • ${variant.description}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                                  <span className="rounded-full bg-white px-3 py-1 text-gray-600 ring-1 ring-gray-200">
                                    <Currency amount={itemPrice} />
                                  </span>
                                  {item.discountType && item.discountType !== "none" && item.discountValue ? (
                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-200">
                                      {item.discountType === "percent" ? `${item.discountValue}%` : <Currency amount={item.discountValue} />}
                                    </span>
                                  ) : null}
                                  {item.staffId ? (
                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 ring-1 ring-gray-200">
                                      {employees.find((employee) => employee.id === item.staffId)?.name || item.staffId}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 ring-1 ring-gray-200">
                                      {locale === "ar" ? "تعيين تلقائي" : "Auto assign"}
                                    </span>
                                  )}
                                </div>
                              </button>
                              <div className="flex flex-col items-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => isEditingThisService ? setEditingServiceIndex(null) : openQueuedServiceEditor(index)}
                                  className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
                                >
                                  {isEditingThisService
                                    ? (locale === "ar" ? "إغلاق" : "Close")
                                    : (locale === "ar" ? "تعديل" : "Edit")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeQueuedServiceAt(index)}
                                  className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition hover:border-red-200 hover:text-red-600"
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path d="M6 7a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm-1 3a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm2 3a1 1 0 100 2h4a1 1 0 100-2H7z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {isEditingThisService ? (
                              <div className="border-t border-primary/20 bg-white/80 p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                                      {locale === "ar" ? "تعديل الخدمة" : "Edit service"}
                                    </p>
                                    <h4 className="mt-1 text-lg font-semibold text-gray-900">
                                      {editingQueuedServiceRecord
                                        ? (locale === "ar"
                                          ? (editingQueuedServiceRecord.name_ar || editingQueuedServiceRecord.name_en)
                                          : (editingQueuedServiceRecord.name_en || editingQueuedServiceRecord.name_ar))
                                        : (locale === "ar" ? "خدمة" : "Service")}
                                    </h4>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setEditingServiceIndex(null)}
                                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                  >
                                    {locale === "ar" ? "إغلاق" : "Close"}
                                  </button>
                                </div>

                                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {editingQueuedServiceRecord
                                      ? (locale === "ar"
                                        ? (editingQueuedServiceRecord.name_ar || editingQueuedServiceRecord.name_en)
                                        : (editingQueuedServiceRecord.name_en || editingQueuedServiceRecord.name_ar))
                                      : (locale === "ar" ? "الخدمة المختارة" : "Selected service")}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {getQueueItemStartTime(editingQueuedService!)} • {formatMinutesLabel(getQueueItemDuration(editingQueuedService!), locale)} • <Currency amount={editingQueuedServicePrice} />
                                  </p>
                                </div>

                                <div className="mt-4 space-y-3">
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                      <span className="mb-2 block text-sm font-medium text-gray-700">{locale === "ar" ? "الموظف" : "Staff member"}</span>
                                      <select
                                        value={serviceDraft.staffId}
                                        onChange={(e) => setServiceDraft((current) => ({ ...current, staffId: e.target.value }))}
                                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                                      >
                                        <option value="">{locale === "ar" ? "تعيين تلقائي" : "Auto assign"}</option>
                                        {assignedEmployees.map((employee) => (
                                          <option key={employee.id} value={employee.id}>
                                            {employee.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="block">
                                      <span className="mb-2 block text-sm font-medium text-gray-700">{locale === "ar" ? "نوع الخصم" : "Discount"}</span>
                                      <select
                                        value={serviceDraft.discountType}
                                        onChange={(e) => setServiceDraft((current) => ({ ...current, discountType: e.target.value as "none" | "percent" | "fixed" }))}
                                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                                      >
                                        <option value="none">{locale === "ar" ? "بدون خصم" : "No discount"}</option>
                                        <option value="percent">{locale === "ar" ? "نسبة مئوية" : "Percent"}</option>
                                        <option value="fixed">{locale === "ar" ? "مبلغ ثابت" : "Fixed amount"}</option>
                                      </select>
                                    </label>
                                  </div>

                                  {serviceDraft.discountType !== "none" ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <label className="block">
                                        <span className="mb-2 block text-sm font-medium text-gray-700">{locale === "ar" ? "قيمة الخصم" : "Discount value"}</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          value={serviceDraft.discountValue}
                                          onChange={(e) => setServiceDraft((current) => ({ ...current, discountValue: e.target.value }))}
                                          placeholder={serviceDraft.discountType === "percent" ? "10" : "25"}
                                          className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                                        />
                                      </label>
                                    </div>
                                  ) : null}

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                      <span className="mb-2 block text-sm font-medium text-gray-700">{locale === "ar" ? "وقت البدء" : "Start time"}</span>
                                      <select
                                        value={serviceDraft.startTime}
                                        onChange={(e) => setServiceDraft((current) => ({ ...current, startTime: e.target.value }))}
                                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                                      >
                                        {TIME_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {locale === "ar" ? option.labelAr : option.labelEn}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="block">
                                      <span className="mb-2 block text-sm font-medium text-gray-700">{locale === "ar" ? "المدة" : "Duration"}</span>
                                      <input
                                        type="number"
                                        min="5"
                                        step="5"
                                        value={serviceDraft.duration}
                                        onChange={(e) => setServiceDraft((current) => ({ ...current, duration: e.target.value }))}
                                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                                      />
                                    </label>
                                  </div>
                                </div>

                                {editingQueuedServiceWarning ? (
                                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    {editingQueuedServiceWarning}
                                  </div>
                                ) : null}

                                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-gray-600">{locale === "ar" ? "السعر الأصلي" : "Original price"}</span>
                                    <span className="font-semibold text-gray-900"><Currency amount={editingQueuedServicePrice} /></span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                    <span className="text-gray-600">{locale === "ar" ? "الخصم" : "Discount"}</span>
                                    <span className="font-semibold text-gray-900">
                                      {editingQueuedServiceDiscount > 0
                                        ? (serviceDraft.discountType === "percent"
                                          ? `${serviceDraft.discountValue}%`
                                          : <Currency amount={editingQueuedServiceDiscount} />)
                                        : (locale === "ar" ? "بدون" : "None")}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3 text-base">
                                    <span className="font-semibold text-gray-900">{locale === "ar" ? "الإجمالي" : "Total"}</span>
                                    <span className="font-semibold text-primary"><Currency amount={editingQueuedServiceTotal} /></span>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => editingServiceIndex !== null && removeQueuedServiceAt(editingServiceIndex)}
                                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                                  >
                                    {locale === "ar" ? "حذف الخدمة" : "Delete service"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={applyDraftService}
                                    className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                                  >
                                    {locale === "ar" ? "تطبيق" : "Apply"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      }) : (
                        <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                          <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "ابدأ بإضافة خدمة" : "Start by adding a service"}</p>
                          <p className="mt-1 text-xs text-gray-500">{locale === "ar" ? "اضغط على إضافة خدمة لبدء الحجز" : "Use Add service to begin the booking"}</p>
                          <button
                            type="button"
                            onClick={() => setShowServicePicker(true)}
                            className="mt-4 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
                          >
                            {locale === "ar" ? "إضافة خدمة" : "Add service"}
                          </button>
                        </div>
                      )}
                    </div>

                    {hasQueuedServices && !showServicePicker ? (
                      <button
                        type="button"
                        onClick={() => setShowServicePicker(true)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-700 transition hover:border-primary/40 hover:bg-purple-50"
                      >
                        <span className="text-xl leading-none">+</span>
                        {locale === "ar" ? "إضافة خدمة أخرى" : "Add another service"}
                      </button>
                    ) : (
                      <div className="mt-4 rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            value={serviceSearch}
                            onChange={(e) => setServiceSearch(e.target.value)}
                            placeholder={locale === "ar" ? "ابحث عن خدمات أو فئات..." : "Search services, categories..."}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {serviceCategoryTabs.map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setSelectedServiceCategory(tab)}
                              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                                selectedServiceCategory === tab
                                  ? "border-primary bg-primary text-white"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-purple-50"
                              }`}
                            >
                              {tab === "all" ? (locale === "ar" ? "الكل" : "All") : tab}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 xl:grid-cols-2">
                          {groupedServices
                            .flatMap((group) => group.items)
                            .filter((service) => {
                              const serviceName = `${service.name_en} ${service.name_ar} ${service.category || ""} ${service.parentName || ""} ${service.parentService || ""}`.toLowerCase();
                              const matchesSearch = !serviceSearch.trim() || serviceName.includes(serviceSearch.trim().toLowerCase());
                              const serviceCategory = (service.category || service.parentName || service.parentService || "").trim();
                              const matchesCategory = selectedServiceCategory === "all" || serviceCategory === selectedServiceCategory;
                              return matchesSearch && matchesCategory;
                            })
                            .map((service) => {
                              const serviceName = locale === "ar" ? (service.name_ar || service.name_en) : (service.name_en || service.name_ar);
                              const isSelected = queuedServices.some((item) => item.serviceId === service.id);
                              return (
                                <button
                                  key={service.id}
                                  type="button"
                                  onClick={() => {
                                    addQueuedService(service.id, null, defaultStaffId || null);
                                  }}
                                  className={`rounded-2xl border bg-white p-4 text-left transition hover:border-primary/40 hover:bg-purple-50 ${isSelected ? "border-primary ring-1 ring-primary/20" : "border-gray-200"}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-gray-900">{serviceName}</p>
                                      <p className="mt-0.5 text-xs text-gray-500">
                                        {formatMinutesLabel(service.duration, locale)}
                                        {service.category || service.parentName || service.parentService ? ` • ${service.category || service.parentName || service.parentService}` : ""}
                                      </p>
                                    </div>
                                    <div className="text-sm font-semibold text-primary">
                                      <Currency amount={toSafeMoneyNumber(service.finalPrice || 0)} />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-500">
                                    <span className="rounded-full bg-gray-100 px-3 py-1 ring-1 ring-gray-200">
                                      {service.employees?.length ? (locale === "ar" ? "محدد" : "Available") : (locale === "ar" ? "تعيين تلقائي" : "Auto assign")}
                                    </span>
                                    <span className="text-gray-400">{isSelected ? (locale === "ar" ? "مضافة" : "Added") : (locale === "ar" ? "أضفها" : "Add")}</span>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                      </div>

                      {hasQueuedServices ? (
                        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                                {locale === "ar" ? "ملخص الدفع" : "Payment summary"}
                              </p>
                              <h4 className="mt-1 text-lg font-semibold text-gray-900">
                                {paymentMethodLabel || (locale === "ar" ? "اختر طريقة الدفع" : "Choose payment method")}
                              </h4>
                              <p className="mt-1 text-sm text-gray-500">
                                {locale === "ar"
                                  ? "راجع المبالغ واختر طريقة الدفع المناسبة."
                                  : "Review the amounts and choose a payment method."}
                              </p>
                            </div>
                            <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                              {locale === "ar" ? "مطلوب" : "Required"}
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600">{locale === "ar" ? "المجموع الفرعي" : "Subtotal"}</span>
                              <span className="font-semibold text-gray-900"><Currency amount={queuedServicesBaseTotal} /></span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600">{locale === "ar" ? "الخصم" : "Discount"}</span>
                              <span className="font-semibold text-gray-900">
                                {queuedServicesDiscountTotal > 0 ? <Currency amount={queuedServicesDiscountTotal} /> : (locale === "ar" ? "بدون" : "None")}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600">{locale === "ar" ? "الضريبة (0%)" : "Tax (0%)"}</span>
                              <span className="font-semibold text-gray-900"><Currency amount={0} /></span>
                            </div>
                            <div className="mt-3 border-t border-gray-200 pt-3">
                              <div className="flex items-center justify-between gap-3 text-base">
                                <span className="font-semibold text-gray-900">{locale === "ar" ? "الإجمالي" : "Total"}</span>
                                <span className="font-semibold text-primary"><Currency amount={queuedServicesTotal} /></span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                <span className="font-semibold text-gray-900">{locale === "ar" ? "المتبقي للدفع" : "To pay"}</span>
                                <span className="font-semibold text-gray-900"><Currency amount={queuedServicesTotal} /></span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {allowedPaymentMethods.map((method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setPaymentMethod(method)}
                                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                  paymentMethod === method
                                    ? "border-primary bg-primary text-white"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-purple-50"
                                }`}
                              >
                                {method === "at-center"
                                  ? (locale === "ar" ? "الدفع عند المركز" : "Pay at Center")
                                  : method === "online-full"
                                    ? (locale === "ar" ? "الدفع الكامل أونلاين" : "Pay Online")
                                    : method === "booking-fee"
                                      ? (locale === "ar" ? "عربون الحجز" : "Booking Fee")
                                      : method}
                              </button>
                            ))}
                          </div>

                          <p className="mt-3 text-xs text-gray-500">
                            {locale === "ar"
                              ? "إذا لم تحدد طريقة، سنستخدم أول خيار متاح."
                              : "If you do not choose one, we will use the first available option."}
                          </p>
                        </div>
                      ) : null}

                    </>
                  )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full space-y-5 overflow-y-auto pr-1">
                <div className="rounded-3xl border border-gray-200 bg-white p-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {locale === "ar" ? "الموظف" : "Employee"}
                  </label>
                  <select
                    value={breakEmployeeId}
                    onChange={(e) => setBreakEmployeeId(e.target.value)}
                    disabled={isEditingBlockedTime}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="">{locale === "ar" ? "اختر الموظف" : "Choose employee"}</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  {isEditingBlockedTime && (
                    <p className="mt-2 text-xs text-gray-500">
                      {locale === "ar" ? "لا يمكن تغيير الموظف أثناء تعديل الوقت المحجوز." : "The employee stays fixed while editing blocked time."}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={breakDate}
                      onChange={(e) => setBreakDate(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
                    <select
                      value={breakType}
                      onChange={(e) => setBreakType(e.target.value as any)}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    >
                      <option value="lunch">{locale === "ar" ? "غداء" : "Lunch"}</option>
                      <option value="prayer">{locale === "ar" ? "صلاة" : "Prayer"}</option>
                      <option value="cleaning">{locale === "ar" ? "تنظيف" : "Cleaning"}</option>
                      <option value="other">{locale === "ar" ? "أخرى" : "Other"}</option>
                    </select>
                    <select
                      value={breakStartTime}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setBreakStartTime(nextStart);
                        setBreakEndTime(addMinutesToTime(nextStart, 30));
                      }}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {locale === "ar" ? option.labelAr : option.labelEn}
                        </option>
                      ))}
                    </select>
                    <select
                      value={breakEndTime}
                      onChange={(e) => setBreakEndTime(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {locale === "ar" ? option.labelAr : option.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-2 text-sm font-medium text-gray-700">{locale === "ar" ? "تكرار الوقت المحجوز" : "Blocked time recurrence"}</p>
                    <div className={`inline-flex rounded-full border border-gray-200 bg-white p-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button
                        type="button"
                        onClick={() => setBreakRecurrenceMode("single")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${breakRecurrenceMode === "single" ? 'bg-primary text-white' : 'text-gray-700'}`}
                      >
                        {locale === "ar" ? "مرة واحدة" : "Single"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBreakRecurrenceMode("continues");
                          setBreakRangeStartDate((current) => current || breakDate);
                          setBreakRangeEndDate("");
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${breakRecurrenceMode === "continues" ? 'bg-primary text-white' : 'text-gray-700'}`}
                      >
                        {locale === "ar" ? "مستمر" : "Continues"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBreakRecurrenceMode("range");
                          setBreakRangeStartDate((current) => current || breakDate);
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${breakRecurrenceMode === "range" ? 'bg-primary text-white' : 'text-gray-700'}`}
                      >
                        {locale === "ar" ? "من - إلى" : "From - To"}
                      </button>
                    </div>

                    {breakRecurrenceMode !== "single" ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={breakRangeStartDate}
                          onChange={(e) => setBreakRangeStartDate(e.target.value)}
                          className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        />
                        <input
                          type="date"
                          value={breakRangeEndDate}
                          onChange={(e) => setBreakRangeEndDate(e.target.value)}
                          disabled={breakRecurrenceMode === "continues"}
                          className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                        />
                      </div>
                    ) : null}
                  </div>

                  <input
                    value={breakLabel}
                    onChange={(e) => setBreakLabel(e.target.value)}
                    placeholder={locale === "ar" ? "عنوان الحظر" : "Blocked time label"}
                    className="mt-4 w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 px-5 py-4">
            {mode === "appointment" ? (
              hasQueuedServices ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {locale === "ar" ? "المزيد" : "More"}
                  </button>
                  <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void handleAppointmentSubmit("at-center")}
                      disabled={saving || Boolean(queuePreviewWarning)}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saving
                        ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                        : (locale === "ar" ? "ادفع الآن" : "Pay now")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAppointmentSubmit("online-full")}
                      disabled={saving || Boolean(queuePreviewWarning)}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saving
                        ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                        : (locale === "ar" ? "الدفع" : "Checkout")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAppointmentSubmit()}
                      disabled={saving || Boolean(queuePreviewWarning)}
                      className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saving
                        ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                        : (locale === "ar" ? "حفظ الموعد" : "Save appointment")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="hidden xl:block" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={clearStagedServices}
                      disabled={!stagedServiceIds.length}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {locale === "ar" ? "مسح" : "Clear"}
                    </button>
                    <div className="text-sm font-medium text-gray-500">
                      {locale === "ar"
                        ? `${stagedServiceIds.length} خدمة محددة`
                        : `${stagedServiceIds.length} service selected${stagedServiceIds.length === 1 ? "" : "s"}`}
                    </div>
                    <button
                      type="button"
                      onClick={commitStagedServices}
                      disabled={!stagedServiceIds.length}
                      className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {locale === "ar" ? "إضافة إلى الموعد" : "Add to appointment"}
                    </button>
                  </div>
                </div>
              )
            ) : mode === "blocked_time" && existingBreak ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBreakDelete}
                  disabled={saving}
                  className="flex-1 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving
                    ? (locale === "ar" ? "جارٍ الحذف..." : "Deleting...")
                    : (locale === "ar" ? "حذف الوقت المحجوز" : "Delete Blocked Time")}
                </button>
                <button
                  type="button"
                  onClick={handleBreakSubmit}
                  disabled={saving}
                  className="flex-[1.4] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving
                    ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                    : (locale === "ar" ? "حفظ التغييرات" : "Save Changes")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleBreakSubmit}
                disabled={saving}
                className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving
                  ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                  : (locale === "ar" ? "حفظ الوقت المحجوز" : "Save Blocked Time")}
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
