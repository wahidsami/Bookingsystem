"use client";

import { useEffect, useMemo, useState } from "react";
import { getImageUrl, tenantApi } from "@/lib/api";
import { Currency } from "@/components/Currency";

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

export interface AppointmentActionDrawerPrefill {
  customer?: PrefillCustomer | null;
  serviceId?: string;
  variantId?: string;
  staffId?: string;
  date?: string;
  time?: string;
  paymentMethod?: string;
  notes?: string;
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
  const isToday = dateKey === getLocalDateKey(now);
  if (!isToday || selected.getTime() >= now.getTime()) {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [errorDebug, setErrorDebug] = useState<any>(null);
  const [appointmentStep, setAppointmentStep] = useState(0);

  const [customerMode, setCustomerMode] = useState<"existing" | "new" | "guest">("existing");
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
      setAppointmentStep(0);
      setCustomerMode(prefill?.customer ? "existing" : "existing");
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
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        gender: "",
        dateOfBirth: ""
      });
      setSelectedServiceId(prefill?.serviceId || "");
      setSelectedVariantId(prefill?.variantId || "");
      setSelectedStaffId(prefill?.staffId || defaultStaffId || "");
      setAppointmentDate(prefill?.date || defaultDate || getTodayDateKey());
      setAppointmentTime(prefill?.time || defaultTime || "10:00");
      setPaymentMethod(prefill?.paymentMethod || "");
      setNotes(prefill?.notes || "");
      setIncludeGroupGuest(false);
      setGroupGuest({ firstName: "", lastName: "", phone: "", serviceId: "", isFree: false });
      return;
    }

    setAppointmentStep(4);

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

  const appointmentStepLabels = [
    locale === "ar" ? "العميل" : "Customer",
    locale === "ar" ? "الخدمات" : "Services",
    locale === "ar" ? "الخدمة والموعد" : "Schedule",
    locale === "ar" ? "حجز جماعي" : "Group",
    locale === "ar" ? "الدفع" : "Payment",
    locale === "ar" ? "المراجعة" : "Review"
  ];

  const appointmentStepCount = appointmentStepLabels.length;
  function getAppointmentStepError(step: number) {
    if (step === 0) {
      if (customerMode === "existing" && !selectedCustomer) {
        return locale === "ar" ? "الرجاء اختيار عميل موجود." : "Please select an existing customer.";
      }

      if (customerMode === "new" && (!newCustomer.firstName.trim() || !newCustomer.lastName.trim())) {
        return locale === "ar" ? "الرجاء إدخال الاسم الأول والأخير للعميل." : "Please enter customer first and last name.";
      }

      if (customerMode === "guest" && (!newCustomer.firstName.trim() || !newCustomer.lastName.trim())) {
        return locale === "ar" ? "الرجاء إدخال اسم الضيف." : "Please enter guest name.";
      }
    }

    if (step === 1 && !selectedServiceId) {
      return locale === "ar" ? "الرجاء اختيار الخدمة." : "Please select a service.";
    }

    if (step === 2) {
      if (!appointmentDate || !appointmentTime) {
        return locale === "ar" ? "الرجاء اختيار التاريخ والوقت." : "Please choose a date and time.";
      }

      const timeGuardMessage = getPastTodayTimeWarning(appointmentDate, appointmentTime, locale);
      if (timeGuardMessage) {
        return timeGuardMessage;
      }

      if (assignedEmployees.length > 0 && !selectedStaffId) {
        return locale === "ar" ? "الرجاء اختيار مقدم الخدمة." : "Please choose a service provider.";
      }
    }

    if (step === 3 && includeGroupGuest) {
      if (!groupGuest.firstName.trim() || !groupGuest.lastName.trim()) {
        return locale === "ar" ? "الرجاء إدخال الاسم الكامل للضيف الإضافي." : "Please enter the additional guest full name.";
      }

      if (!groupGuest.serviceId.trim()) {
        return locale === "ar" ? "الرجاء اختيار خدمة الضيف الإضافي." : "Please choose the additional guest service.";
      }
    }

    if (step === 4) {
      if (!paymentMethod) {
        return locale === "ar" ? "الرجاء اختيار طريقة الدفع." : "Please choose a payment method.";
      }
    }

    return "";
  }

  const currentAppointmentStepLabel = appointmentStepLabels[appointmentStep] || "";
  const nextAppointmentStepLabel = appointmentStepLabels[appointmentStep + 1] || "";

  const goToNextAppointmentStep = () => {
    const stepError = getAppointmentStepError(appointmentStep);
    if (stepError) {
      setError(stepError);
      return;
    }

    setError("");
    setAppointmentStep((current) => Math.min(current + 1, appointmentStepCount - 1));
  };

  const goToPreviousAppointmentStep = () => {
    setError("");
    setAppointmentStep((current) => Math.max(current - 1, 0));
  };

  const handleWalkInCustomer = () => {
    setError("");
    setCustomerMode("guest");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setNewCustomer({
      firstName: locale === "ar" ? "ضيف" : "Walk",
      lastName: locale === "ar" ? "مؤقت" : "In Customer",
      email: "",
      phone: "",
      gender: "",
      dateOfBirth: ""
    });
    setAppointmentStep(1);
  };

  useEffect(() => {
    if (!open || mode !== "appointment" || appointmentStep !== 0 || customerMode !== "existing") {
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
  }, [open, mode, appointmentStep, customerSearch, customerMode]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId]
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
    const normalized = parseArrayValue<string>(selectedService?.paymentOptions);
    return normalized.length > 0 ? normalized : ["at-center", "online-full", "booking-fee"];
  }, [selectedService]);

  useEffect(() => {
    if (!open || mode !== "appointment") {
      return;
    }

    if (!selectedService) {
      setSelectedVariantId("");
      setSelectedStaffId(defaultStaffId || "");
      setPaymentMethod("");
      return;
    }

    if (selectedVariantId && !serviceVariants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId("");
    }

    if (selectedStaffId && !assignedEmployees.some((employee) => employee.id === selectedStaffId)) {
      setSelectedStaffId("");
    }

    if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(allowedPaymentMethods[0] || "");
    }
  }, [
    open,
    mode,
    selectedService,
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
        serviceId: selectedServiceId || ""
      };
    });
  }, [includeGroupGuest, selectedServiceId]);

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
  const currentAppointmentStepError = mode === "appointment" ? getAppointmentStepError(appointmentStep) : "";

  const handleAppointmentSubmit = async () => {
    setError("");
    setErrorDebug(null);
    setSuccess("");

    if (!selectedServiceId) {
      setError(locale === "ar" ? "الرجاء اختيار الخدمة." : "Please select a service.");
      return;
    }

    if (customerMode === "existing" && !selectedCustomer) {
      setError(locale === "ar" ? "الرجاء اختيار عميل موجود أو إنشاء عميل جديد." : "Please select an existing customer or create a new one.");
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

    if (customerMode === "guest") {
      if (!newCustomer.firstName.trim() || !newCustomer.lastName.trim()) {
        setError(locale === "ar" ? "الرجاء إدخال اسم الضيف." : "Please enter guest name.");
        return;
      }
    }

    if (!appointmentDate || !appointmentTime) {
      setError(locale === "ar" ? "الرجاء اختيار التاريخ والوقت." : "Please choose a date and time.");
      return;
    }

    const timeGuardMessage = getPastTodayTimeWarning(appointmentDate, appointmentTime, locale);
    if (timeGuardMessage) {
      setError(timeGuardMessage);
      return;
    }

    if (assignedEmployees.length > 0 && !selectedStaffId) {
      setError(locale === "ar" ? "الرجاء اختيار مقدم الخدمة." : "Please choose a service provider.");
      return;
    }

    if (!paymentMethod) {
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

    const emailForConfirmation =
      customerMode === "existing"
        ? (selectedCustomer?.email || "").trim()
        : (newCustomer.email || "").trim();

    if (!emailForConfirmation) {
      const confirmedWithoutEmail = typeof window === "undefined"
        ? true
        : window.confirm(
            locale === "ar"
              ? "لم يتم إدخال بريد إلكتروني للعميل. لن يتم إرسال رسالة تأكيد الموعد عبر البريد الإلكتروني. هل تريد المتابعة وحفظ الموعد بدون إرسال تأكيد بريد؟"
              : "No customer email was entered. Appointment confirmation email will NOT be sent. Do you want to continue and save the appointment anyway?"
          );
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

      const payload = {
        serviceId: selectedServiceId,
        variantId: selectedVariantId || null,
        staffId: selectedStaffId || null,
        requestedStaffId: selectedStaffId || null,
        startTime: startTime.toISOString(),
        notes: notes.trim() || undefined,
        paymentMethod,
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
        platformUserId: customerMode === "existing" ? selectedCustomer?.id : undefined,
        customer: customerMode === "new" || customerMode === "guest"
          ? {
              ...newCustomer,
              firstName: newCustomer.firstName.trim(),
              lastName: newCustomer.lastName.trim(),
              email: customerMode === "guest" ? "" : newCustomer.email.trim(),
              phone: customerMode === "guest" ? "" : newCustomer.phone.trim(),
              isGuest: customerMode === "guest"
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
        setError(err.message || (locale === "ar" ? "فشل إنشاء الموعد." : "Failed to create appointment."));
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
      : window.confirm(locale === "ar" ? "هل تريد حذف الوقت المحجوز؟" : "Delete this blocked time?");

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
        className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} h-full w-full max-w-[34rem] bg-white shadow-2xl`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {mode === "appointment"
                  ? (locale === "ar" ? "موعد جديد" : "New Appointment")
                  : (locale === "ar" ? "حظر وقت" : "Blocked Time")}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {mode === "appointment"
                  ? (locale === "ar" ? "أنشئ موعدًا من دون مغادرة اللوحة." : "Create an appointment without leaving the board.")
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

          <div className="flex-1 overflow-y-auto px-5 py-5">
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
              <div className="space-y-5">
                <div className={`rounded-2xl border border-gray-200 bg-white p-3 ${appointmentStep === 0 ? "" : "hidden"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {appointmentStepLabels.map((label, index) => (
                        <div
                          key={label}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                            index === appointmentStep
                              ? "bg-primary text-white"
                              : index < appointmentStep
                                ? "bg-primary/10 text-primary"
                                : "bg-gray-50 text-gray-500 ring-1 ring-gray-200"
                          }`}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
                      {appointmentStep + 1} / {appointmentStepCount}
                    </div>
                  </div>
                </div>

                <div className={`rounded-3xl border border-gray-200 bg-gray-50 p-4 ${appointmentStep === 0 ? "" : "hidden"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "العميل" : "Customer"}</p>
                      <p className="text-xs text-gray-500">
                        {locale === "ar" ? "ابحث عن عميل أو اختر عميلًا من القائمة." : "Search for a customer or pick one from the list."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleWalkInCustomer}
                    className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/10"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M10 3a2 2 0 100 4 2 2 0 000-4zM5.5 8.5A1.5 1.5 0 004 10v3.25A2.75 2.75 0 006.75 16h6.5A2.75 2.75 0 0016 13.25V10a1.5 1.5 0 00-1.5-1.5H5.5z" />
                    </svg>
                    <span>{locale === "ar" ? "عميل حضوري" : "Walk In Customer"}</span>
                  </button>
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setSelectedCustomer(null);
                        setCustomerSearch(e.target.value);
                        setCustomerMode("existing");
                        setAppointmentStep(0);
                      }}
                      placeholder={locale === "ar" ? "ابحث بالاسم أو الهاتف أو البريد..." : "Search by name, phone, or email..."}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      style={{ textAlign: isRTL ? "right" : "left" }}
                    />

                    {customerLoading ? (
                      <div className="text-xs text-gray-500">{locale === "ar" ? "جارٍ البحث..." : "Searching..."}</div>
                    ) : customers.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {customers.map((customer) => {
                          const active = selectedCustomer?.id === customer.id;
                          return (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerMode("existing");
                                setCustomerSearch(`${customer.firstName} ${customer.lastName}`.trim());
                              }}
                              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-primary bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300"}`}
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                                {getInitials(customer.firstName, customer.lastName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-gray-900">
                                  {customer.firstName} {customer.lastName}
                                </p>
                                <p className="truncate text-xs text-gray-500">{customer.email}</p>
                                <p className="truncate text-xs text-gray-500">{customer.phone}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : customerSearch.trim().length >= 1 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-600">
                        {locale === "ar"
                          ? "لا يوجد عميل مطابق. يمكنك استخدام عميل حضوري بدلاً من ذلك."
                          : "No customer found. You can use Walk In instead."}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-600">
                        {locale === "ar"
                          ? "ابدأ بالبحث عن عميل موجود بالاسم أو الهاتف أو البريد."
                          : "Start by searching for an existing customer by name, phone, or email."}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`rounded-3xl border border-gray-200 bg-white p-4 ${appointmentStep === 1 ? "" : "hidden"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        {locale === "ar" ? "الخدمات" : "Services"}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {locale === "ar"
                          ? "اختر الخدمة من القائمة العمودية، ثم اختر النسخة إن وجدت."
                          : "Choose a service from the vertical list, then pick a variant if it exists."}
                      </p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                      {selectedServiceName || (locale === "ar" ? "لم تُحدَّد خدمة" : "No service selected")}
                    </div>
                  </div>

                  <div className="mt-4 space-y-5">
                    {groupedServices.map((group) => (
                      <div key={group.heading || group.items[0]?.id} className="space-y-3">
                        {group.heading ? (
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-gray-200" />
                            <div className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600">
                              {group.heading}
                            </div>
                            <div className="h-px flex-1 bg-gray-200" />
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          {group.items.map((service) => {
                          const active = service.id === selectedServiceId;
                          const serviceName = locale === "ar" ? service.name_ar : service.name_en;
                          const serviceParent = (service.parentName || service.parentService || service.category || "").trim();
                          const serviceVariantsForCard = parseArrayValue<ServiceVariant>(service.variants).filter((variant) => variant.isActive !== false);
                          return (
                            <div key={service.id} className="space-y-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceId(service.id);
                                  setSelectedVariantId("");
                                  setPaymentMethod("");
                                }}
                                className={`group flex w-full items-stretch overflow-hidden rounded-3xl border text-left transition ${
                                  active
                                    ? "border-primary bg-purple-50 ring-2 ring-primary/20"
                                    : "border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm"
                                }`}
                              >
                                <div className="h-28 w-28 shrink-0 overflow-hidden bg-gray-100 sm:h-32 sm:w-32">
                                  {service.image ? (
                                    <img
                                      src={service.image.startsWith("http") ? service.image : getImageUrl(service.image)}
                                      alt={serviceName}
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                                      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <path d="M12 2a5 5 0 00-5 5c0 1.66.81 3.13 2.05 4.04A7 7 0 005 18v2h14v-2a7 7 0 00-4.05-6.96A5 5 0 0012 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <h5 className="truncate text-sm font-semibold text-gray-900">{serviceName}</h5>
                                      <p className="mt-1 text-xs text-gray-500">
                                        {serviceParent
                                          ? `${locale === "ar" ? "الفئة" : "Category"}: ${serviceParent}`
                                          : locale === "ar"
                                            ? "بدون فئة"
                                            : "No category"}
                                      </p>
                                    </div>
                                    {active && (
                                      <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-white">
                                        {locale === "ar" ? "محدد" : "Selected"}
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-gray-600">
                                    <span className="rounded-full bg-gray-50 px-2.5 py-1 ring-1 ring-gray-200">
                                      ⏱ {service.duration} {locale === "ar" ? "دقيقة" : "min"}
                                    </span>
                                    <span className="rounded-full bg-gray-50 px-2.5 py-1 ring-1 ring-gray-200">
                                      <Currency amount={toSafeMoneyNumber(service.finalPrice ?? 0)} />
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {serviceVariantsForCard.length > 0 ? (
                                <div className="ms-4 space-y-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3 sm:ms-8">
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    {locale === "ar" ? "النسخ" : "Variants"}
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {serviceVariantsForCard.map((variant) => {
                                      const activeVariant = active && selectedVariantId === variant.id;
                                      return (
                                        <button
                                          key={variant.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedServiceId(service.id);
                                            setSelectedVariantId(variant.id);
                                            setPaymentMethod("");
                                          }}
                                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                                            activeVariant
                                              ? "border-primary bg-white ring-2 ring-primary/20"
                                              : "border-gray-200 bg-white hover:border-primary/40"
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-semibold text-gray-900">
                                                {variant.description}
                                              </div>
                                              <div className="mt-1 text-xs text-gray-500">
                                                {variant.duration} {locale === "ar" ? "دقيقة" : "min"}
                                              </div>
                                            </div>
                                            <div className="text-sm font-bold text-primary">
                                              <Currency amount={toSafeMoneyNumber(variant.finalPrice ?? 0)} />
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedService && (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {locale === "ar" ? "الخدمة المحددة" : "Selected service"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {selectedVariantName || `${displayDuration} ${locale === "ar" ? "دقيقة" : "min"}`}
                          </p>
                          {selectedServiceParentLabel ? (
                            <p className="mt-1 text-xs text-gray-500">
                              {locale === "ar" ? "الفئة" : "Category"}: {selectedServiceParentLabel}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            <Currency amount={displayServicePrice} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`rounded-3xl border border-gray-200 bg-white p-4 ${appointmentStep === 2 ? "" : "hidden"}`}>
                  <h4 className="text-base font-semibold text-gray-900">
                    {locale === "ar" ? "الخدمة والموعد" : "Schedule"}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    {locale === "ar"
                      ? "راجع مقدم الخدمة والتاريخ والوقت إذا احتجت ذلك."
                      : "Review the provider, date, and time if you need to change them."}
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      disabled={!selectedService}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      <option value="">{locale === "ar" ? "تعيين تلقائي" : "Auto assign"}</option>
                      {assignedEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
                      <select
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      >
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {locale === "ar" ? option.labelAr : option.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {locale === "ar" ? "سعر الخدمة" : "Service price"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {locale === "ar" ? "المدة والسعر حسب الخدمة أو النسخة المختارة." : "Duration and price follow the selected service or variant."}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            <Currency amount={displayServicePrice} />
                          </div>
                          <div className="text-xs text-gray-500">
                            {displayDuration} {locale === "ar" ? "دقيقة" : "min"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-3xl border border-gray-200 bg-white p-4 ${appointmentStep === 4 ? "" : "hidden"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        {locale === "ar" ? "الدفع" : "Payment"}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {locale === "ar" ? "اختر طريقة الدفع المتاحة لهذه الخدمة." : "Choose one of the payment methods available for this service."}
                      </p>
                    </div>
                    <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-primary">
                      {allowedPaymentMethods.length}/3
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { id: "at-center", title: locale === "ar" ? "الدفع عند المركز" : "Pay at Center" },
                      { id: "online-full", title: locale === "ar" ? "الدفع الكامل أونلاين" : "Pay in Full Online" },
                      { id: "booking-fee", title: locale === "ar" ? "عربون الحجز" : "Booking Fee" }
                    ]
                      .filter((option) => allowedPaymentMethods.includes(option.id))
                      .map((option) => {
                        const active = paymentMethod === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setPaymentMethod(option.id)}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              active
                                ? 'border-primary bg-purple-50'
                                : 'border-gray-200 bg-white hover:border-purple-300'
                            }`}
                          >
                            <div className="text-sm font-semibold text-gray-900">{option.title}</div>
                          </button>
                        );
                      })}
                  </div>
                  {includeGroupGuest ? (
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-600">{locale === "ar" ? "سعر الخدمة الأساسية" : "Main service price"}</span>
                        <span className="font-semibold text-gray-900">
                          <Currency amount={displayServicePrice} />
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-600">{locale === "ar" ? "سعر خدمة الضيف" : "Guest service fee"}</span>
                        <span className="font-semibold text-gray-900">
                          <Currency amount={guestServicePrice} />
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
                        <span className="text-sm font-semibold text-gray-800">{locale === "ar" ? "الإجمالي" : "Total amount"}</span>
                        <span className="text-lg font-bold text-primary">
                          <Currency amount={displayTotalPrice} />
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={`rounded-3xl border border-gray-200 bg-white p-4 ${appointmentStep === 3 ? "" : "hidden"}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        {locale === "ar" ? "حجز جماعي" : "Group booking"}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {locale === "ar" ? "أضف ضيفًا إضافيًا على نفس الموعد." : "Add one extra guest on the same appointment."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIncludeGroupGuest((prev) => !prev)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${includeGroupGuest ? 'bg-primary text-white' : 'border border-gray-300 text-gray-700'}`}
                    >
                      {includeGroupGuest ? (locale === "ar" ? "مفعل" : "On") : (locale === "ar" ? "غير مفعل" : "Off")}
                    </button>
                  </div>
                  {includeGroupGuest ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <input
                          type="text"
                          value={groupGuest.firstName}
                          onChange={(e) => setGroupGuest((prev) => ({ ...prev, firstName: e.target.value }))}
                          placeholder={locale === "ar" ? "اسم الضيف الأول" : "Guest first name"}
                          className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        />
                        <input
                          type="text"
                          value={groupGuest.lastName}
                          onChange={(e) => setGroupGuest((prev) => ({ ...prev, lastName: e.target.value }))}
                          placeholder={locale === "ar" ? "اسم العائلة" : "Guest last name"}
                          className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        />
                        <input
                          type="tel"
                          value={groupGuest.phone}
                          onChange={(e) => setGroupGuest((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder={locale === "ar" ? "الجوال (اختياري)" : "Phone (optional)"}
                          className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {locale === "ar" ? "خدمة الضيف" : "Guest service"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {locale === "ar"
                                ? "اختر خدمة الضيف من القائمة العمودية."
                                : "Choose the guest service from the vertical list."}
                            </p>
                          </div>
                          {groupGuest.serviceId ? (
                            <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                              {locale === "ar" ? "محدد" : "Selected"}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-5">
                          {groupedServices.map((group) => (
                            <div key={`guest-${group.heading || group.items[0]?.id}`} className="space-y-3">
                              {group.heading ? (
                                <div className="flex items-center gap-3">
                                  <div className="h-px flex-1 bg-gray-200" />
                                  <div className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600">
                                    {group.heading}
                                  </div>
                                  <div className="h-px flex-1 bg-gray-200" />
                                </div>
                              ) : null}

                              <div className="space-y-3">
                                {group.items.map((service) => {
                                  const active = groupGuest.serviceId === service.id;
                                  const serviceName = locale === "ar" ? service.name_ar : service.name_en;
                                  const serviceParent = (service.parentName || service.parentService || service.category || "").trim();
                                  return (
                                    <button
                                      key={`guest-${service.id}`}
                                      type="button"
                                      onClick={() => setGroupGuest((prev) => ({ ...prev, serviceId: service.id }))}
                                      className={`group flex w-full items-stretch overflow-hidden rounded-3xl border text-left transition ${
                                        active
                                          ? "border-primary bg-purple-50 ring-2 ring-primary/20"
                                          : "border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm"
                                      }`}
                                    >
                                      <div className="h-24 w-24 shrink-0 overflow-hidden bg-gray-100 sm:h-28 sm:w-28">
                                        {service.image ? (
                                          <img
                                            src={service.image.startsWith("http") ? service.image : getImageUrl(service.image)}
                                            alt={serviceName}
                                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                                            <svg className="h-9 w-9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                              <path d="M12 2a5 5 0 00-5 5c0 1.66.81 3.13 2.05 4.04A7 7 0 005 18v2h14v-2a7 7 0 00-4.05-6.96A5 5 0 0012 2z" />
                                            </svg>
                                          </div>
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <h5 className="truncate text-sm font-semibold text-gray-900">{serviceName}</h5>
                                            <p className="mt-1 text-xs text-gray-500">
                                              {serviceParent
                                                ? `${locale === "ar" ? "الفئة" : "Category"}: ${serviceParent}`
                                                : locale === "ar"
                                                  ? "بدون فئة"
                                                  : "No category"}
                                            </p>
                                          </div>
                                          {active && (
                                            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-white">
                                              {locale === "ar" ? "محدد" : "Selected"}
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-gray-600">
                                          <span className="rounded-full bg-gray-50 px-2.5 py-1 ring-1 ring-gray-200">
                                            ⏱ {service.duration} {locale === "ar" ? "دقيقة" : "min"}
                                          </span>
                                          <span className="rounded-full bg-gray-50 px-2.5 py-1 ring-1 ring-gray-200">
                                            <Currency amount={toSafeMoneyNumber(service.finalPrice ?? 0)} />
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <label className="flex items-center gap-3 rounded-2xl border border-gray-300 px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={groupGuest.isFree}
                          onChange={(e) => setGroupGuest((prev) => ({ ...prev, isFree: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="font-medium text-gray-800">
                          {locale === "ar" ? "خدمة مجانية" : "Free service"}
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className={`space-y-4 rounded-3xl border border-gray-200 bg-white p-4 ${appointmentStep === 5 ? "" : "hidden"}`}>
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">
                      {locale === "ar" ? "المراجعة" : "Review"}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {locale === "ar" ? "راجع الحجز قبل الحفظ." : "Review the appointment before saving."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "العميل" : "Customer"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedCustomerName || (locale === "ar" ? "عميل غير محدد" : "No customer selected")}
                      </div>
                      {(customerMode === "existing" ? selectedCustomer?.email : newCustomer.email) ? (
                        <div className="mt-1 text-xs text-gray-500">
                          {(customerMode === "existing" ? selectedCustomer?.email : newCustomer.email) || ""}
                        </div>
                      ) : null}
                      {(customerMode === "existing" ? selectedCustomer?.phone : newCustomer.phone) ? (
                        <div className="mt-1 text-xs text-gray-500">
                          {(customerMode === "existing" ? selectedCustomer?.phone : newCustomer.phone) || ""}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "الخدمة" : "Service"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{selectedServiceName || "-"}</div>
                      {selectedVariantName ? (
                        <div className="mt-1 text-xs text-gray-500">{selectedVariantName}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-gray-500">
                        {displayDuration} {locale === "ar" ? "دقيقة" : "min"}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "الموعد" : "Schedule"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {appointmentDate} {appointmentTime}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {selectedStaff?.name || (locale === "ar" ? "تعيين تلقائي" : "Auto assign")}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "الدفع" : "Payment"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{paymentMethodLabel || "-"}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span><Currency amount={displayServicePrice} /></span>
                        {includeGroupGuest ? (
                          <>
                            <span>+</span>
                            <span>
                              {locale === "ar" ? "الضيف" : "guest"}: <Currency amount={guestServicePrice} />
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "سعر الخدمة الأساسية" : "Base service"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        <Currency amount={displayServicePrice} />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "سعر خدمة الضيف" : "Guest service"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        <Currency amount={guestServicePrice} />
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {includeGroupGuest
                          ? (groupGuest.isFree
                            ? (locale === "ar" ? "مجانية" : "Free")
                            : (locale === "ar" ? "مضافة للإجمالي" : "Included in total"))
                          : (locale === "ar" ? "غير مفعلة" : "Not enabled")}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "الإجمالي النهائي" : "Final total"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-primary">
                        <Currency amount={displayTotalPrice} />
                      </div>
                    </div>
                  </div>

                  {includeGroupGuest ? (
                    <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {locale === "ar" ? "الضيف الإضافي" : "Additional guest"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {`${groupGuest.firstName} ${groupGuest.lastName}`.trim()}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {selectedGuestServiceName || "-"}
                        {groupGuest.isFree ? ` • ${locale === "ar" ? "خدمة مجانية" : "Free service"}` : ""}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {locale === "ar" ? "ملاحظات" : "Notes"}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className={`rounded-3xl border border-gray-200 bg-white p-4 ${appointmentStep === 4 ? "" : "hidden"}`}>
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
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goToPreviousAppointmentStep}
                  disabled={appointmentStep === 0 || saving}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locale === "ar" ? "السابق" : "Previous"}
                </button>

                {appointmentStep < appointmentStepCount - 1 ? (
                  <button
                    type="button"
                    onClick={goToNextAppointmentStep}
                    disabled={saving || Boolean(currentAppointmentStepError)}
                    className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {locale === "ar"
                      ? `التالي${nextAppointmentStepLabel ? `: ${nextAppointmentStepLabel}` : ""}`
                      : `Next${nextAppointmentStepLabel ? `: ${nextAppointmentStepLabel}` : ""}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAppointmentSubmit}
                    disabled={saving}
                    className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving
                      ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                      : (locale === "ar" ? "حفظ الموعد" : "Save Appointment")}
                  </button>
                )}
              </div>
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
