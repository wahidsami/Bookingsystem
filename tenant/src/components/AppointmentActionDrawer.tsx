"use client";

import { useEffect, useMemo, useState } from "react";
import { tenantApi } from "@/lib/api";
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

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerCustomers, setPickerCustomers] = useState<CustomerItem[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");

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

  const [breakEmployeeId, setBreakEmployeeId] = useState("");
  const [breakDate, setBreakDate] = useState(getTodayDateKey());
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
    setSuccess("");

    if (mode === "appointment") {
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
      setShowCustomerPicker(false);
      setPickerLoading(false);
      setPickerCustomers([]);
      setPickerSearch("");
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
      return;
    }

    const breakDateValue =
      getLocalDateKeyFromValue(existingBreak?.specificDate) ||
      getLocalDateKeyFromValue(existingBreak?.startDateTime) ||
      defaultDate ||
      getTodayDateKey();

    setBreakEmployeeId(existingBreak?.staffId || defaultStaffId || "");
    setBreakDate(breakDateValue);
    setBreakStartTime(existingBreak?.startTime?.slice(0, 5) || defaultTime || "10:00");
    setBreakEndTime(existingBreak?.endTime?.slice(0, 5) || addMinutesToTime(defaultTime || "10:00", 30));
    setBreakType((existingBreak?.type as any) || "other");
    setBreakLabel(existingBreak?.label || "");
  }, [open, mode, defaultStaffId, defaultDate, defaultTime, prefill, existingBreak]);

  useEffect(() => {
    if (!open || mode !== "appointment" || customerMode !== "existing" || !showCustomerPicker) {
      return;
    }

    const query = pickerSearch.trim();
    const timer = setTimeout(async () => {
      try {
        setPickerLoading(true);
        const response = await tenantApi.getCustomers({ search: query || undefined, limit: 100 });
        if (response.success) {
          setPickerCustomers(response.data?.customers || []);
        } else {
          setPickerCustomers([]);
        }
      } catch (err) {
        console.error("Failed to load customers for picker:", err);
        setPickerCustomers([]);
      } finally {
        setPickerLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [open, mode, customerMode, showCustomerPicker, pickerSearch]);

  useEffect(() => {
    if (!open || mode !== "appointment") {
      return;
    }

    const query = customerSearch.trim();
    if (customerMode !== "existing") {
      setCustomers([]);
      return;
    }

    if (selectedCustomer && query === `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim()) {
      return;
    }

    if (query.length < 1) {
      setCustomers([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCustomerLoading(true);
        const response = await tenantApi.getCustomers({ search: query, limit: 10 });
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
  }, [open, mode, customerSearch, customerMode, selectedCustomer]);

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

  const selectedVariant = useMemo(
    () => serviceVariants.find((variant) => variant.id === selectedVariantId) || null,
    [serviceVariants, selectedVariantId]
  );

  const displayServicePrice = selectedVariant?.finalPrice ?? selectedService?.finalPrice ?? 0;
  const displayDuration = selectedVariant?.duration ?? selectedService?.duration ?? 0;

  const handleAppointmentSubmit = async () => {
    setError("");
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
        newCustomer.lastName.trim(),
        newCustomer.email.trim(),
        newCustomer.phone.trim()
      ];

      if (requiredFields.some((value) => !value)) {
        setError(locale === "ar" ? "الرجاء إكمال بيانات العميل الجديد." : "Please complete the new customer details.");
        return;
      }
    }

    if (!appointmentDate || !appointmentTime) {
      setError(locale === "ar" ? "الرجاء اختيار التاريخ والوقت." : "Please choose a date and time.");
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
        platformUserId: customerMode === "existing" ? selectedCustomer?.id : undefined,
        customer: customerMode === "new"
          ? {
              ...newCustomer,
              firstName: newCustomer.firstName.trim(),
              lastName: newCustomer.lastName.trim(),
              email: newCustomer.email.trim(),
              phone: newCustomer.phone.trim()
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
      const isRecurringBreak = existingBreak?.isRecurring === true;
      const dayOfWeek = isRecurringBreak ? new Date(`${breakDate}T00:00:00`).getDay() : null;
      const response = await tenantApi.createEmployeeBreak(breakEmployeeId, {
        specificDate: isRecurringBreak ? null : breakDate,
        startTime: breakStartTime,
        endTime: breakEndTime,
        type: breakType,
        label: breakLabel.trim() || undefined,
        isRecurring: isRecurringBreak,
        dayOfWeek,
        startDate: isRecurringBreak ? breakDate : undefined,
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

            {success && (
              <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            {mode === "appointment" ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "العميل" : "Customer"}</p>
                      <p className="text-xs text-gray-500">
                        {locale === "ar" ? "ابحث عن عميل موجود أو أضف عميلًا جديدًا." : "Search for an existing customer or add a new one."}
                      </p>
                    </div>
                    <div className={`inline-flex rounded-full border border-gray-200 bg-white p-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button
                        type="button"
                        onClick={() => setCustomerMode("existing")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${customerMode === "existing" ? 'bg-primary text-white' : 'text-gray-700'}`}
                      >
                        {locale === "ar" ? "موجود" : "Existing"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerMode("new")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${customerMode === "new" ? 'bg-primary text-white' : 'text-gray-700'}`}
                      >
                        {locale === "ar" ? "جديد" : "New"}
                      </button>
                    </div>
                  </div>

                  {customerMode === "existing" ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(e) => {
                            setSelectedCustomer(null);
                            setCustomerSearch(e.target.value);
                          }}
                          placeholder={locale === "ar" ? "ابحث بالاسم أو الهاتف أو البريد..." : "Search by name, phone, or email..."}
                          className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                          style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCustomerPicker(true)}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gray-300 bg-white text-gray-700 transition hover:border-primary hover:text-primary"
                          title={locale === "ar" ? "اختيار من كل العملاء" : "Pick from all customers"}
                          aria-label={locale === "ar" ? "اختيار من كل العملاء" : "Pick from all customers"}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                            <path d="M6.25 7.25a2.75 2.75 0 115.5 0 2.75 2.75 0 01-5.5 0zM10.5 11.5a4.5 4.5 0 00-4.5 4.5.75.75 0 001.5 0 3 3 0 013-3h2.5a.75.75 0 000-1.5h-2.5z" />
                            <path d="M13.25 8.5a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zm2.893 6.198a3.25 3.25 0 00-2.893-1.698h-.75a.75.75 0 000 1.5h.75c.664 0 1.294.322 1.688.863a.75.75 0 001.205-.865z" />
                          </svg>
                        </button>
                      </div>

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
                                  setCustomerSearch(`${customer.firstName} ${customer.lastName}`.trim());
                                }}
                                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? 'border-primary bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'}`}
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
                            ? "لا يوجد عميل مطابق. يمكنك إنشاء عميل جديد من التبويب المجاور."
                            : "No customer found. You can create a new one from the adjacent tab."}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-600">
                          {locale === "ar"
                            ? "ابدأ بالبحث عن عميل موجود بالاسم أو الهاتف أو البريد."
                            : "Start by searching for an existing customer by name, phone, or email."}
                        </div>
                      )}

                      {selectedCustomer && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                              {getInitials(selectedCustomer.firstName, selectedCustomer.lastName)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {selectedCustomer.firstName} {selectedCustomer.lastName}
                              </p>
                              <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                              <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <input
                        value={newCustomer.firstName}
                        onChange={(e) => setNewCustomer((prev) => ({ ...prev, firstName: e.target.value }))}
                        placeholder={locale === "ar" ? "الاسم الأول" : "First name"}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <input
                        value={newCustomer.lastName}
                        onChange={(e) => setNewCustomer((prev) => ({ ...prev, lastName: e.target.value }))}
                        placeholder={locale === "ar" ? "الاسم الأخير" : "Last name"}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <input
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder={locale === "ar" ? "البريد الإلكتروني" : "Email"}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <input
                        type="tel"
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder={locale === "ar" ? "رقم الهاتف" : "Phone"}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <select
                        value={newCustomer.gender}
                        onChange={(e) => setNewCustomer((prev) => ({ ...prev, gender: e.target.value }))}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        <option value="">{locale === "ar" ? "الجنس" : "Gender"}</option>
                        <option value="male">{locale === "ar" ? "ذكر" : "Male"}</option>
                        <option value="female">{locale === "ar" ? "أنثى" : "Female"}</option>
                        <option value="other">{locale === "ar" ? "آخر" : "Other"}</option>
                      </select>
                      <input
                        type="date"
                        value={newCustomer.dateOfBirth}
                        onChange={(e) => setNewCustomer((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                        aria-label={locale === "ar" ? "تاريخ الميلاد" : "Date of birth"}
                        title={locale === "ar" ? "تاريخ الميلاد (اختياري)" : "Date of birth (optional)"}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}
                </div>

                {showCustomerPicker && (
                  <div className="fixed inset-0 z-[70]">
                    <div className="absolute inset-0 bg-slate-950/35" onClick={() => setShowCustomerPicker(false)} />
                    <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h5 className="text-base font-semibold text-gray-900">
                          {locale === "ar" ? "اختيار عميل" : "Select Customer"}
                        </h5>
                        <button
                          type="button"
                          onClick={() => setShowCustomerPicker(false)}
                          className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 10-1.06-1.06L10 8.94 6.28 5.22z" />
                          </svg>
                        </button>
                      </div>

                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder={locale === "ar" ? "ابحث داخل كل العملاء..." : "Search all customers..."}
                        className="mb-3 w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        style={{ textAlign: isRTL ? "right" : "left" }}
                      />

                      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                        {pickerLoading ? (
                          <p className="text-sm text-gray-500">{locale === "ar" ? "جارٍ التحميل..." : "Loading customers..."}</p>
                        ) : pickerCustomers.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                            {locale === "ar" ? "لا يوجد عملاء لعرضهم." : "No customers to show."}
                          </p>
                        ) : (
                          pickerCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerSearch(`${customer.firstName} ${customer.lastName}`.trim());
                                setShowCustomerPicker(false);
                              }}
                              className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition hover:border-primary hover:bg-purple-50"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                                {getInitials(customer.firstName, customer.lastName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-gray-900">
                                  {customer.firstName} {customer.lastName}
                                </p>
                                <p className="truncate text-xs text-gray-500">{customer.email || "-"}</p>
                                <p className="truncate text-xs text-gray-500">{customer.phone || "-"}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-gray-200 bg-white p-4">
                  <h4 className="text-base font-semibold text-gray-900">
                    {locale === "ar" ? "الخدمة والموعد" : "Service and Time"}
                  </h4>
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <select
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      <option value="">{locale === "ar" ? "اختر خدمة" : "Choose a service"}</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {locale === "ar" ? service.name_ar : service.name_en}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      disabled={!selectedService || serviceVariants.length === 0}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      <option value="">{locale === "ar" ? "الخدمة الأساسية" : "Base service"}</option>
                      {serviceVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.description} - {variant.duration} {locale === "ar" ? "دقيقة" : "min"}
                        </option>
                      ))}
                    </select>

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
                      <input
                        type="time"
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
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

                <div className="rounded-3xl border border-gray-200 bg-white p-4">
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
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-4">
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
            ) : (
              <div className="space-y-5">
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
                    <input
                      type="time"
                      value={breakStartTime}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setBreakStartTime(nextStart);
                        setBreakEndTime(addMinutesToTime(nextStart, 30));
                      }}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="time"
                      value={breakEndTime}
                      onChange={(e) => setBreakEndTime(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
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
            {mode === "blocked_time" && existingBreak ? (
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
                onClick={mode === "appointment" ? handleAppointmentSubmit : handleBreakSubmit}
                disabled={saving}
                className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving
                  ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                  : (mode === "appointment"
                    ? (locale === "ar" ? "حفظ الموعد" : "Save Appointment")
                    : (locale === "ar" ? "حفظ الوقت المحجوز" : "Save Blocked Time"))}
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
