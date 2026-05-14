"use client";

import { useEffect, useMemo, useState } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
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

export default function NewAppointmentPage() {
  const t = useTranslations("Appointments");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const isRTL = locale === "ar";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdInviteLink, setCreatedInviteLink] = useState("");

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(getTodayDateKey());
  const [appointmentTime, setAppointmentTime] = useState("10:00");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: ""
  });

  useEffect(() => {
    const loadServices = async () => {
      try {
        const response = await tenantApi.getServices({ isActive: true });
        if (response.success) {
          setServices(response.services || []);
        }
      } catch (err) {
        console.error("Failed to load services:", err);
      }
    };

    loadServices();
  }, []);

  useEffect(() => {
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
  }, [customerSearch, customerMode, selectedCustomer]);

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
    const options = normalized.length > 0
      ? normalized
      : ["at-center", "online-full", "booking-fee"];
    return options;
  }, [selectedService]);

  useEffect(() => {
    if (!selectedService) {
      setSelectedVariantId("");
      setSelectedStaffId("");
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
  }, [selectedServiceId, selectedService, allowedPaymentMethods, assignedEmployees, serviceVariants, selectedVariantId, selectedStaffId, paymentMethod]);

  const selectedVariant = useMemo(
    () => serviceVariants.find((variant) => variant.id === selectedVariantId) || null,
    [serviceVariants, selectedVariantId]
  );

  const displayServicePrice = selectedVariant?.finalPrice ?? selectedService?.finalPrice ?? 0;
  const displayDuration = selectedVariant?.duration ?? selectedService?.duration ?? 0;

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    setCreatedInviteLink("");

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
        setCreatedInviteLink(response?.appointmentInvite?.link || "");
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

  return (
    <TenantLayout>
      <div className="mb-6 animate-fade-in">
        <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'موعد جديد' : 'New Appointment'}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar'
                ? 'أنشئ موعدًا من لوحة التحكم واختر العميل والخدمة ومقدم الخدمة وموعد الحجز.'
                : 'Create an appointment from the dashboard and choose the customer, service, provider, and booking time.'}
            </p>
          </div>

          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ الموعد' : 'Save Appointment')}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          <div className="flex flex-col gap-3">
            <span>{success}</span>
            {createdInviteLink && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-green-800">
                  {locale === "ar" ? "رابط تأكيد الموعد للعميل" : "Customer appointment confirmation link"}
                </label>
                <div className="flex gap-2">
                  <input
                    value={createdInviteLink}
                    readOnly
                    className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-xs text-gray-800"
                    style={{ direction: "ltr" }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary whitespace-nowrap"
                    onClick={async () => {
                      await navigator.clipboard.writeText(createdInviteLink);
                      setSuccess(locale === "ar" ? "تم نسخ الرابط. يمكنك إرساله عبر واتساب أو البريد." : "Link copied. You can send it via WhatsApp or email.");
                    }}
                  >
                    {locale === "ar" ? "نسخ الرابط" : "Copy link"}
                  </button>
                </div>
              </div>
            )}
            <div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => router.push(`/${locale}/dashboard/appointments`)}
              >
                {locale === "ar" ? "العودة إلى المواعيد" : "Back to appointments"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)] gap-6">
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'العميل' : 'Customer'}
                </h3>
                <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar'
                    ? 'ابحث عن عميل موجود أو أضف عميلًا جديدًا.'
                    : 'Search for an existing customer or add a new one.'}
                </p>
              </div>
              <div className={`inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  onClick={() => setCustomerMode("existing")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    customerMode === "existing" ? 'bg-primary text-white' : 'text-gray-700'
                  }`}
                >
                  {locale === 'ar' ? 'عميل موجود' : 'Existing'}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("new")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    customerMode === "new" ? 'bg-primary text-white' : 'text-gray-700'
                  }`}
                >
                  {locale === 'ar' ? 'عميل جديد' : 'New'}
                </button>
              </div>
            </div>

            {customerMode === "existing" ? (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setSelectedCustomer(null);
                      setCustomerSearch(e.target.value);
                    }}
                    placeholder={locale === 'ar' ? 'ابحث بالاسم أو الهاتف أو البريد...' : 'Search by name, phone, or email...'}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                {customerLoading ? (
                  <div className="text-sm text-gray-500">{locale === 'ar' ? 'جارٍ البحث...' : 'Searching...'}</div>
                ) : customers.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                            active ? 'border-primary bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'
                          }`}
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                            {getInitials(customer.firstName, customer.lastName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 truncate">
                              {customer.firstName} {customer.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                            <p className="text-xs text-gray-500 truncate">{customer.phone}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : customerSearch.trim().length >= 1 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    {locale === 'ar'
                      ? 'لا يوجد عميل مطابق. يمكنك إنشاء عميل جديد من التبويب المجاور.'
                      : 'No customer found. You can create a new one from the adjacent tab.'}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    {locale === 'ar'
                      ? 'ابدأ بالبحث عن عميل موجود بالاسم أو الهاتف أو البريد.'
                      : 'Start by searching for an existing customer by name, phone, or email.'}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {getInitials(selectedCustomer.firstName, selectedCustomer.lastName)}
                      </div>
                      <div className="flex-1">
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الاسم الأول' : 'First name'} *
                  </label>
                  <input
                    value={newCustomer.firstName}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الاسم الأخير' : 'Last name'} *
                  </label>
                  <input
                    value={newCustomer.lastName}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("email")} *
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("phone")} *
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الجنس' : 'Gender'}
                  </label>
                  <select
                    value={newCustomer.gender}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, gender: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <option value="">{locale === 'ar' ? 'اختر' : 'Select'}</option>
                    <option value="male">{locale === 'ar' ? 'ذكر' : 'Male'}</option>
                    <option value="female">{locale === 'ar' ? 'أنثى' : 'Female'}</option>
                    <option value="other">{locale === 'ar' ? 'آخر' : 'Other'}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'تاريخ الميلاد' : 'Date of birth'}
                  </label>
                  <p className="mb-2 text-xs text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'اختياري - بصيغة يوم/شهر/سنة' : 'Optional - day/month/year format'}
                  </p>
                  <input
                    type="date"
                    value={newCustomer.dateOfBirth}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'الخدمة والموعد' : 'Service and Time'}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'الخدمة' : 'Service'} *
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  <option value="">{locale === 'ar' ? 'اختر خدمة' : 'Choose a service'}</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {locale === 'ar' ? service.name_ar : service.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'النسخة / النوع' : 'Variant'} 
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  disabled={!selectedService || serviceVariants.length === 0}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  <option value="">{locale === 'ar' ? 'الخدمة الأساسية' : 'Base service'}</option>
                  {serviceVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.description} - {variant.duration} {locale === 'ar' ? 'دقيقة' : 'min'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'مقدم الخدمة' : 'Service provider'} *
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  disabled={!selectedService}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  <option value="">{locale === 'ar' ? 'تعيين تلقائي' : 'Auto assign'}</option>
                  {assignedEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'التاريخ' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'الوقت' : 'Time'} *
                  </label>
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'الدفع' : 'Payment'}
                </h3>
                <p className="text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar'
                    ? 'اختر طريقة الدفع المتاحة لهذه الخدمة.'
                    : 'Choose one of the payment methods available for this service.'}
                </p>
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-primary">
                {allowedPaymentMethods.length}/3
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { id: 'at-center', title: locale === 'ar' ? 'الدفع عند المركز' : 'Pay at Center' },
                { id: 'online-full', title: locale === 'ar' ? 'الدفع الكامل أونلاين' : 'Pay in Full Online' },
                { id: 'booking-fee', title: locale === 'ar' ? 'عربون الحجز' : 'Booking Fee' }
              ]
                .filter((option) => allowedPaymentMethods.includes(option.id))
                .map((option) => {
                  const active = paymentMethod === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPaymentMethod(option.id)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        active ? 'border-primary bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                    >
                      <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="font-semibold text-gray-900">{option.title}</span>
                        <span className={`h-4 w-4 rounded-full border ${active ? 'border-primary bg-primary' : 'border-gray-300'}`} />
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>

          <section className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'ملاحظات' : 'Notes'}
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
              placeholder={locale === 'ar' ? 'أضف ملاحظات للحجز...' : 'Add booking notes...'}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="card sticky top-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'ملخص' : 'Summary'}
            </h3>

            <div className="space-y-4 text-sm text-gray-700">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">{locale === 'ar' ? 'العميل' : 'Customer'}</p>
                <p className="font-semibold text-gray-900">
                  {customerMode === "existing" && selectedCustomer
                    ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
                    : customerMode === "new"
                      ? `${newCustomer.firstName || '-'} ${newCustomer.lastName || ''}`.trim()
                      : locale === 'ar' ? 'غير محدد' : 'Not selected'}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">{locale === 'ar' ? 'الخدمة' : 'Service'}</p>
                <p className="font-semibold text-gray-900">
                  {selectedService ? (locale === 'ar' ? selectedService.name_ar : selectedService.name_en) : (locale === 'ar' ? 'غير محددة' : 'Not selected')}
                </p>
                {selectedVariant && (
                  <p className="mt-1 text-gray-600">{selectedVariant.description}</p>
                )}
                {selectedService && (
                  <p className="mt-1 text-gray-600">
                    {displayDuration} {locale === 'ar' ? 'دقيقة' : 'min'} • <Currency amount={displayServicePrice} />
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">{locale === 'ar' ? 'مقدم الخدمة' : 'Provider'}</p>
                <p className="font-semibold text-gray-900">
                  {assignedEmployees.find((employee) => employee.id === selectedStaffId)?.name || (locale === 'ar' ? 'تعيين تلقائي' : 'Auto assign')}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">{locale === 'ar' ? 'الموعد' : 'Appointment'}</p>
                <p className="font-semibold text-gray-900">
                  {appointmentDate} • {appointmentTime}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">{locale === 'ar' ? 'الدفع' : 'Payment'}</p>
                <p className="font-semibold text-gray-900">
                  {paymentMethod === 'at-center'
                    ? (locale === 'ar' ? 'الدفع عند المركز' : 'Pay at Center')
                    : paymentMethod === 'online-full'
                      ? (locale === 'ar' ? 'الدفع الكامل أونلاين' : 'Pay in Full Online')
                      : paymentMethod === 'booking-fee'
                        ? (locale === 'ar' ? 'عربون الحجز' : 'Booking Fee')
                        : (locale === 'ar' ? 'غير محدد' : 'Not selected')}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button type="button" onClick={() => router.back()} className="btn btn-secondary flex-1">
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="button" onClick={handleSubmit} disabled={saving} className="btn btn-primary flex-1">
                {saving ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </TenantLayout>
  );
}
