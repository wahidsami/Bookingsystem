"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";

type DashboardLandingPage = "home" | "appointments" | "pos";

interface DashboardStats {
  todaysBookings: number;
  todaysRevenue: number;
  yesterdayBookings: number;
  yesterdayRevenue: number;
  totalRevenue: number;
  activeEmployees: number;
  totalCustomers: number;
}

interface Appointment {
  id: string;
  customerName: string;
  serviceName: string;
  employeeName?: string;
  startTime: string;
  endTime: string;
  status: string;
  price: number;
  paymentStatus?: string;
  paymentMethod?: string | null;
  depositAmount?: number;
  remainderAmount?: number;
  totalPaid?: number;
  outstandingAmount?: number;
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

const LANDING_PAGES: DashboardLandingPage[] = ["home", "appointments", "pos"];

const normalizeLandingPage = (value: unknown): DashboardLandingPage => {
  return LANDING_PAGES.includes(value as DashboardLandingPage) ? (value as DashboardLandingPage) : "home";
};

const getLandingPageRoute = (locale: string, landingPage: DashboardLandingPage) => {
  if (landingPage === "appointments") return `/${locale}/dashboard/appointments`;
  if (landingPage === "pos") return `/${locale}/dashboard/pos`;
  return `/${locale}/dashboard`;
};

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || "ar";
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [dashboardSettings, setDashboardSettings] = useState<{ defaultLandingPage: DashboardLandingPage }>({
    defaultLandingPage: "home"
  });
  const [savingLandingPage, setSavingLandingPage] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    todaysBookings: 0,
    todaysRevenue: 0,
    yesterdayBookings: 0,
    yesterdayRevenue: 0,
    totalRevenue: 0,
    activeEmployees: 0,
    totalCustomers: 0
  });
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [paymentDueSummary, setPaymentDueSummary] = useState({
    totalDueCount: 0,
    checkedInDueCount: 0,
    totalDueAmount: 0
  });
  const [paymentAlerts, setPaymentAlerts] = useState<PosAlert[]>([]);

  const getAppointmentStatusMeta = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: locale === "ar" ? "مؤكد" : "Confirmed", badgeClass: "badge-success" };
      case "checked_in":
        return { label: locale === "ar" ? "تم تسجيل الوصول" : "Checked In", badgeClass: "badge-success" };
      case "in_service":
        return { label: locale === "ar" ? "جاري التنفيذ" : "In Service", badgeClass: "badge-info" };
      case "completed":
        return { label: locale === "ar" ? "مكتمل" : "Completed", badgeClass: "badge-info" };
      case "cancelled":
        return { label: locale === "ar" ? "ملغي" : "Cancelled", badgeClass: "badge-error" };
      case "no_show":
        return { label: locale === "ar" ? "لم يحضر" : "No Show", badgeClass: "badge-warning" };
      case "pending":
      default:
        return { label: locale === "ar" ? "قيد الانتظار" : "Pending", badgeClass: "badge-warning" };
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setNotice("");

      const settingsResponse = await tenantApi.getSettings().catch(() => null);
      const defaultLandingPage = normalizeLandingPage(settingsResponse?.data?.settings?.dashboardSettings?.defaultLandingPage);
      setDashboardSettings({ defaultLandingPage });

      const forceHome = searchParams?.get("view") === "home";
      if (!forceHome && defaultLandingPage !== "home") {
        router.replace(getLandingPageRoute(locale, defaultLandingPage));
        return;
      }

      const [statsResponse, appointmentsResponse, posAlertsResponse] = await Promise.allSettled([
        tenantApi.getDashboardStats(),
        tenantApi.getTodaysAppointments(),
        tenantApi.getPosAlerts({ limit: 3 }).catch(() => null)
      ]);

      const failedSections: string[] = [];

      if (statsResponse.status === "fulfilled" && statsResponse.value.success && statsResponse.value.stats) {
        setStats({
          todaysBookings: statsResponse.value.stats.todaysBookings || 0,
          todaysRevenue: statsResponse.value.stats.todaysRevenue || 0,
          yesterdayBookings: statsResponse.value.stats.yesterdayBookings || 0,
          yesterdayRevenue: statsResponse.value.stats.yesterdayRevenue || 0,
          totalRevenue: statsResponse.value.stats.totalRevenue || 0,
          activeEmployees: statsResponse.value.stats.activeEmployees || 0,
          totalCustomers: statsResponse.value.stats.totalCustomers || 0
        });
      } else {
        failedSections.push(locale === "ar" ? "الإحصاءات" : "stats");
      }

      if (appointmentsResponse.status === "fulfilled" && appointmentsResponse.value.success && appointmentsResponse.value.appointments) {
        const formattedAppointments = appointmentsResponse.value.appointments.map((apt: any) => ({
          id: apt.id,
          customerName: apt.customerName || "Unknown Customer",
          serviceName: locale === "ar" ? (apt.serviceName_ar || apt.serviceName) : apt.serviceName,
          employeeName: apt.employeeName || "",
          startTime: apt.startTime,
          endTime: apt.endTime,
          status: apt.status,
          price: apt.price || 0,
          paymentStatus: apt.paymentStatus || "pending",
          paymentMethod: apt.paymentMethod || null,
          depositAmount: apt.depositAmount || 0,
          remainderAmount: apt.remainderAmount || 0,
          totalPaid: apt.totalPaid || 0,
          outstandingAmount: apt.outstandingAmount ?? Math.max((apt.price || 0) - (apt.totalPaid || 0), 0)
        }));
        setTodaysAppointments(formattedAppointments);
      } else {
        setTodaysAppointments([]);
        failedSections.push(locale === "ar" ? "مواعيد اليوم" : "today's appointments");
      }

      if (posAlertsResponse.status === "fulfilled" && posAlertsResponse.value?.success) {
        setPaymentDueSummary({
          totalDueCount: posAlertsResponse.value.summary?.totalDueCount || 0,
          checkedInDueCount: posAlertsResponse.value.summary?.checkedInDueCount || 0,
          totalDueAmount: posAlertsResponse.value.summary?.totalDueAmount || 0
        });
        setPaymentAlerts(Array.isArray(posAlertsResponse.value.alerts) ? posAlertsResponse.value.alerts : []);
      } else {
        setPaymentDueSummary({ totalDueCount: 0, checkedInDueCount: 0, totalDueAmount: 0 });
        setPaymentAlerts([]);
        failedSections.push(locale === "ar" ? "تنبيهات التحصيل" : "collections alerts");
      }

      if (failedSections.length > 0) {
        setNotice(
          locale === "ar"
            ? `تعذر تحميل بعض أقسام اللوحة: ${failedSections.join("، ")}`
            : `Some dashboard sections failed to load: ${failedSections.join(", ")}`
        );
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setStats({
        todaysBookings: 0,
        todaysRevenue: 0,
        yesterdayBookings: 0,
        yesterdayRevenue: 0,
        totalRevenue: 0,
        activeEmployees: 0,
        totalCustomers: 0
      });
      setTodaysAppointments([]);
      setPaymentDueSummary({ totalDueCount: 0, checkedInDueCount: 0, totalDueAmount: 0 });
      setPaymentAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!params?.locale) return;
    if (!searchParams) return;
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, params?.locale, searchParams?.toString()]);

  const handleLandingPageChange = async (nextLandingPage: DashboardLandingPage) => {
    if (savingLandingPage || nextLandingPage === dashboardSettings.defaultLandingPage) return;

    const previousLandingPage = dashboardSettings.defaultLandingPage;
    setSavingLandingPage(true);
    setDashboardSettings({ defaultLandingPage: nextLandingPage });

    try {
      await tenantApi.updateDashboardSettings({ dashboardSettings: { defaultLandingPage: nextLandingPage } });
      if (nextLandingPage !== "home") {
        router.push(getLandingPageRoute(locale, nextLandingPage));
      }
    } catch (error) {
      console.error("Failed to update dashboard landing page:", error);
      setDashboardSettings({ defaultLandingPage: previousLandingPage });
      setNotice(
        locale === "ar"
          ? "تعذر حفظ الصفحة الافتراضية للوحة."
          : "Failed to save the default dashboard page."
      );
    } finally {
      setSavingLandingPage(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="spinner" />
        </div>
      </TenantLayout>
    );
  }

  const dashboardLandingCopy: Record<DashboardLandingPage, string> = {
    home: locale === "ar" ? "الرئيسية" : "Home",
    appointments: locale === "ar" ? "الحجوزات" : "Appointments",
    pos: locale === "ar" ? "نقطة البيع" : "POS"
  };

  const landingPageDescription: Record<DashboardLandingPage, string> = {
    home: locale === "ar" ? "تبقى الصفحة الرئيسية هي نقطة البداية" : "Keep the home launchpad as the starting point",
    appointments:
      locale === "ar" ? "يفتح اللوحة مباشرة على المواعيد" : "Open directly into the appointment board",
    pos: locale === "ar" ? "يفتح مباشرة على التحصيل والمبيعات" : "Open directly into collections and sales"
  };

  const attentionAppointments = todaysAppointments.filter((appointment) => {
    const paymentStatus = (appointment.paymentStatus || "pending").toLowerCase();
    return paymentStatus === "pending" || paymentStatus === "deposit_paid" || Number(appointment.outstandingAmount || 0) > 0;
  });

  const attentionAmountDue = attentionAppointments.reduce((sum, appointment) => sum + Number(appointment.outstandingAmount || 0), 0);
  const urgentAlerts = paymentAlerts.filter((alert) => alert.severity === "high");
  const otherAlerts = paymentAlerts.filter((alert) => alert.severity !== "high");
  const staffSnapshot = Object.values(
    todaysAppointments.reduce<Record<string, { name: string; count: number; due: number }>>((acc, appointment) => {
      const name = appointment.employeeName || (locale === "ar" ? "موظف غير معروف" : "Unknown employee");
      if (!acc[name]) {
        acc[name] = { name, count: 0, due: 0 };
      }

      acc[name].count += 1;
      acc[name].due += Number(appointment.outstandingAmount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const busiestStaff = staffSnapshot[0];
  const maxStaffBookings = Math.max(1, ...staffSnapshot.map((item) => item.count));
  const bookingsDelta = stats.todaysBookings - stats.yesterdayBookings;
  const revenueDelta = stats.todaysRevenue - stats.yesterdayRevenue;
  const formatDeltaText = (value: number, isCurrency: boolean) => {
    const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
    const absoluteValue = Math.abs(value);

    if (isCurrency) {
      const formatter = new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
        maximumFractionDigits: 0
      });
      return `${prefix}${formatter.format(absoluteValue)} ${locale === "ar" ? "عن أمس" : "vs yesterday"}`;
    }

    return `${prefix}${absoluteValue} ${locale === "ar" ? "عن أمس" : "vs yesterday"}`;
  };

  return (
    <TenantLayout>
      <div className="space-y-6">
        {notice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            {notice}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-6 p-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
                    {locale === "ar" ? "مركز القيادة" : "Command center"}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
                    {t("welcome")} 👋
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
                    {locale === "ar"
                      ? "نظرة مركزة وسريعة على الحجوزات والتحصيل وما يحتاج انتباهك اليوم."
                      : "A compact launchpad for bookings, collections, and what needs attention today."}
                  </p>
                </div>

                <div className={`grid gap-3 sm:grid-cols-2 ${isRTL ? "sm:[direction:rtl]" : ""}`}>
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/dashboard/pos`)}
                    className="group rounded-3xl bg-gradient-to-br from-primary to-secondary p-5 text-start text-white shadow-lg transition-transform hover:-translate-y-0.5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                      {locale === "ar" ? "الاختصار الأسرع" : "Fast lane"}
                    </p>
                    <h3 className="mt-2 text-2xl font-bold">
                      {locale === "ar" ? "فتح نقطة البيع" : "Open POS"}
                    </h3>
                    <p className="mt-2 text-sm text-white/85">
                      {locale === "ar"
                        ? "ابدأ التحصيل أو أضف طلباً جديداً فوراً."
                        : "Start collections or create a sale instantly."}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/dashboard/appointments`)}
                    className="group rounded-3xl border border-primary/20 bg-primary/5 p-5 text-start text-gray-900 transition-colors hover:border-primary/40 hover:bg-primary/10"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                      {locale === "ar" ? "وصول مباشر" : "Direct access"}
                    </p>
                    <h3 className="mt-2 text-2xl font-bold">
                      {locale === "ar" ? "المواعيد" : "Appointments"}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">
                      {locale === "ar"
                        ? "افتح لوحة اليوم والجدول والتوزيع بسرعة."
                        : "Open today’s board, schedule, and staff flow quickly."}
                    </p>
                  </button>
                </div>
              </div>

              <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-gray-50/90 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                      {locale === "ar" ? "الصفحة الافتراضية" : "Default landing page"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {locale === "ar"
                        ? "اختر ما يفتح أولاً بعد تسجيل الدخول."
                        : "Choose what opens first after login."}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {savingLandingPage ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : dashboardLandingCopy[dashboardSettings.defaultLandingPage]}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {LANDING_PAGES.map((page) => {
                    const selected = dashboardSettings.defaultLandingPage === page;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => handleLandingPageChange(page)}
                        disabled={savingLandingPage}
                        className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          selected
                            ? "border-primary bg-primary text-white shadow-sm"
                            : "border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <span className="block">{dashboardLandingCopy[page]}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-gray-600">
                  {landingPageDescription[dashboardSettings.defaultLandingPage]}
                </p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">
                {locale === "ar" ? "تحصيلات مستحقة" : "Payments due"}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-gray-900">
                {locale === "ar" ? "متابعة سريعة قبل وأثناء الوصول" : "Quick collections before and during check-in"}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {locale === "ar"
                  ? `${paymentDueSummary.totalDueCount} حالة مستحقة، منها ${paymentDueSummary.checkedInDueCount} عميل وصل للمركز ويحتاج تحصيل.`
                  : `${paymentDueSummary.totalDueCount} due item(s), including ${paymentDueSummary.checkedInDueCount} checked-in customer(s) awaiting collection.`}
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-3xl bg-gradient-to-br from-rose-50 to-primary/10 p-4">
                <p className="text-sm font-semibold text-gray-700">
                  {locale === "ar" ? "إجمالي المبالغ المستحقة" : "Total due amount"}
                </p>
                <p className="mt-2 text-4xl font-bold text-gray-900">
                  <Currency amount={paymentDueSummary.totalDueAmount} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {locale === "ar" ? "حالات مستحقة" : "Due items"}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{paymentDueSummary.totalDueCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {locale === "ar" ? "وصلوا للمركز" : "Checked in"}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{paymentDueSummary.checkedInDueCount}</p>
                </div>
              </div>

              {paymentAlerts.length > 0 ? (
                <div className="space-y-2">
                  {paymentAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => router.push(`/${locale}${alert.detailPath || "/dashboard/pos"}`)}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm transition-colors ${
                        alert.severity === "high"
                          ? "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                          : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                      }`}
                      style={{ textAlign: isRTL ? "right" : "left" }}
                    >
                      <p className="font-bold">{locale === "ar" ? (alert.title_ar || alert.title) : alert.title}</p>
                      <p className="mt-1 text-xs opacity-90">
                        {locale === "ar" ? (alert.message_ar || alert.message) : alert.message}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
                  {locale === "ar" ? "لا توجد تحصيلات عاجلة حالياً." : "No urgent collections right now."}
                </p>
              )}

              <button type="button" onClick={() => router.push(`/${locale}/dashboard/pos`)} className="btn-primary w-full">
                {locale === "ar" ? "فتح نقطة البيع" : "Open POS"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="card overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">
                  {locale === "ar" ? "ما يحتاج انتباهك الآن" : "Needs attention now"}
                </p>
                <h3 className="mt-2 text-2xl font-bold text-gray-900">
                  {locale === "ar" ? "المدفوعات والمواعيد غير المكتملة" : "Unpaid appointments and urgent collections"}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {locale === "ar"
                    ? "أهم ما يحتاج تدخل اليوم بدون فتح صفحات كثيرة."
                    : "The highest-priority items to act on today without jumping across pages."}
                </p>
              </div>
              <div className="rounded-3xl bg-rose-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                  {locale === "ar" ? "مبلغ يحتاج تحصيل" : "Amount due"}
                </p>
                <p className="mt-1 text-2xl font-bold text-rose-900">
                  <Currency amount={attentionAmountDue} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                </p>
              </div>
            </div>

            <div className="grid gap-3 px-6 py-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                  {locale === "ar" ? "مواعيد تحتاج دفع" : "Appointments needing payment"}
                </p>
                <p className="mt-2 text-3xl font-bold text-amber-950">{attentionAppointments.length}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                  {locale === "ar" ? "تنبيهات عاجلة" : "Urgent alerts"}
                </p>
                <p className="mt-2 text-3xl font-bold text-sky-950">{urgentAlerts.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  {locale === "ar" ? "تنبيهات إضافية" : "Other alerts"}
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-950">{otherAlerts.length}</p>
              </div>
            </div>

            <div className="space-y-3 px-6 pb-6">
              {attentionAppointments.length > 0 ? (
                attentionAppointments.slice(0, 3).map((appointment) => {
                  const dueAmount = Number(appointment.outstandingAmount || 0);
                  return (
                    <button
                      key={`attention-${appointment.id}`}
                      type="button"
                      onClick={() => router.push(`/${locale}/dashboard/appointments`)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition hover:border-primary hover:bg-primary/5"
                    >
                      <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={isRTL ? 'text-end' : ''}>
                          <p className="text-sm font-semibold text-gray-900">{appointment.customerName}</p>
                          <p className="mt-1 text-sm text-gray-600">{appointment.serviceName}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {appointment.startTime} - {appointment.endTime}
                            {appointment.paymentMethod ? ` • ${appointment.paymentMethod}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {locale === "ar" ? "المتبقي" : "Due"}
                          </p>
                          <p className="mt-1 text-lg font-bold text-rose-700">
                            <Currency amount={dueAmount} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-green-50 px-4 py-4 text-sm text-green-700">
                  {locale === "ar"
                    ? "لا توجد مواعيد بانتظار الدفع حالياً."
                    : "No appointments are waiting for payment right now."}
                </p>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                {locale === "ar" ? "ملخص سريع" : "Quick snapshot"}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-gray-900">
                {locale === "ar" ? "أرقام اليوم في لقطة واحدة" : "Today’s numbers at a glance"}
              </h3>
            </div>

            <div className="space-y-3 p-6">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {locale === "ar" ? "مستحقات اليوم" : "Today’s due amount"}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  <Currency amount={paymentDueSummary.totalDueAmount} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">
                  {locale === "ar" ? "التنبيهات الحرجة" : "Critical alerts"}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {locale === "ar"
                    ? `${urgentAlerts.length} تنبيه/تنبيهات تحتاج مراجعة سريعة.`
                    : `${urgentAlerts.length} alert(s) need a quick review.`}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">
                  {locale === "ar" ? "الوصول السريع" : "Fast access"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => router.push(`/${locale}/dashboard/appointments`)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
                    {locale === "ar" ? "الحجوزات" : "Appointments"}
                  </button>
                  <button type="button" onClick={() => router.push(`/${locale}/dashboard/pos`)} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
                    {locale === "ar" ? "نقطة البيع" : "POS"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="card border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("todaysBookings")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.todaysBookings}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">📅</div>
            </div>
          </div>

          <div className="card border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("totalRevenue")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  <Currency amount={stats.totalRevenue} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-2xl">💰</div>
            </div>
          </div>

          <div className="card border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("activeEmployees")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.activeEmployees}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-2xl">👥</div>
            </div>
          </div>

          <div className="card border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-600">{t("totalCustomers")}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalCustomers}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">🤝</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="card overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                  {locale === "ar" ? "ملخص الفريق" : "Staff snapshot"}
                </p>
                <h3 className="mt-2 text-2xl font-bold text-gray-900">
                  {locale === "ar" ? "من هو الأكثر انشغالاً اليوم" : "Who is busiest today"}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {locale === "ar"
                    ? `${stats.activeEmployees} موظف نشط، والبطاقات التالية تشرح الحمل الحالي بسرعة.`
                    : `${stats.activeEmployees} active employee(s), with the current workload summarized below.`}
                </p>
              </div>
              <div className="rounded-3xl bg-primary/10 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
                  {locale === "ar" ? "الأكثر انشغالاً" : "Busiest"}
                </p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {busiestStaff?.name || (locale === "ar" ? "لا يوجد بعد" : "Not yet")}
                </p>
              </div>
            </div>

            <div className="space-y-3 p-6">
              {staffSnapshot.length > 0 ? (
                staffSnapshot.slice(0, 3).map((item) => (
                  <div key={item.name} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {locale === "ar" ? `${item.count} حجز اليوم` : `${item.count} appointment(s) today`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{item.count}</p>
                        <p className="text-xs font-medium text-gray-500">
                          {locale === "ar" ? "حجوزات" : "bookings"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${Math.max(8, (item.count / maxStaffBookings) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {locale === "ar"
                        ? `المتبقي: ${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA").format(item.due)}`
                        : `Outstanding: ${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA").format(item.due)}`}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-gray-50 px-4 py-4 text-sm text-gray-600">
                  {locale === "ar"
                    ? "لم تبدأ الحجوزات بعد، لذلك لا يوجد توزيع فريق اليوم."
                    : "No appointments yet, so there is no staff workload to show today."}
                </p>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">
                {locale === "ar" ? "مؤشر الحركة" : "Trend strip"}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-gray-900">
                {locale === "ar" ? "اليوم مقارنة بالأمس" : "Today compared with yesterday"}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {locale === "ar"
                  ? "نظرة سريعة على هل المواعيد والإيراد يتحركان للأعلى أم للأسفل."
                  : "A quick read on whether bookings and revenue are moving up or down."}
              </p>
            </div>

            <div className="grid gap-3 p-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "الحجوزات" : "Bookings"}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.todaysBookings}</p>
                <p className={`mt-2 text-sm font-semibold ${bookingsDelta > 0 ? "text-emerald-600" : bookingsDelta < 0 ? "text-rose-600" : "text-gray-500"}`}>
                  {bookingsDelta > 0 ? "▲" : bookingsDelta < 0 ? "▼" : "•"} {formatDeltaText(bookingsDelta, false)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  {locale === "ar" ? `أمس: ${stats.yesterdayBookings}` : `Yesterday: ${stats.yesterdayBookings}`}
                </p>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "الإيراد" : "Revenue"}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  <Currency amount={stats.todaysRevenue} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                </p>
                <p className={`mt-2 text-sm font-semibold ${revenueDelta > 0 ? "text-emerald-600" : revenueDelta < 0 ? "text-rose-600" : "text-gray-500"}`}>
                  {revenueDelta > 0 ? "▲" : revenueDelta < 0 ? "▼" : "•"} {formatDeltaText(revenueDelta, true)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  {locale === "ar" ? "اليوم مقارنة بالأمس" : "Compared with yesterday"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-5">
            <div>
              <h3 className="text-xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
                {t("recentAppointments")}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {locale === "ar" ? "حجوزات اليوم في عرض سريع ومختصر" : "Today’s bookings in a compact list"}
              </p>
            </div>
            <button className="btn-secondary" onClick={() => router.push(`/${locale}/dashboard/appointments`)}>
              {t("viewAll")} →
            </button>
          </div>

          {todaysAppointments.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <span className="mb-4 block text-6xl">📅</span>
              <p className="text-gray-600">{locale === "ar" ? "لا توجد حجوزات لهذا اليوم" : "No appointments for today"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todaysAppointments.map((appointment) => {
                const statusMeta = getAppointmentStatusMeta(appointment.status);

                return (
                  <div
                    key={appointment.id}
                    className={`flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between ${
                      isRTL ? "lg:flex-row-reverse" : ""
                    }`}
                  >
                    <div className={isRTL ? "text-end" : ""}>
                      <h4 className="font-semibold text-gray-900">{appointment.customerName}</h4>
                      <p className="text-sm text-gray-600">{appointment.serviceName}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {appointment.startTime} - {appointment.endTime}
                      </p>
                    </div>

                    <div className={`flex items-center gap-3 ${isRTL ? "lg:flex-row-reverse" : ""}`}>
                      <span className={`badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                      <span className="text-lg font-bold text-primary">
                        <Currency amount={appointment.price} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </TenantLayout>
  );
}

