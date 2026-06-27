"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import {
  FinanceEmptyState,
  FinanceMetricCard,
  FinanceSectionCard,
  FinanceWorkspaceShell,
  type FinanceSidebarGroup
} from "@/components/FinanceWorkspaceShell";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";

interface Overview {
  totalRevenue: number;
  totalRawPrice: number;
  totalTax: number;
  totalPlatformFees: number;
  totalTenantRevenue: number;
  totalEmployeeCommissions: number;
  netRevenue: number;
  totalBookings: number;
  totalOrders?: number;
  paidBookings: number;
  paidOrders?: number;
  pendingPayments: number;
  completedBookings: number;
  completedOrders?: number;
  cancelledBookings?: number;
  noShowBookings?: number;
  uniqueCustomers?: number;
  completionRate?: number;
  avgBookingValue?: number;
  appointmentRevenue?: number;
  orderRevenue?: number;
  giftCardRevenue?: number;
  appointmentTenantRevenue?: number;
  orderTenantRevenue?: number;
  discountTotals?: {
    totalDiscountAmount: number;
    appointmentDiscountAmount: number;
    orderDiscountAmount: number;
    discountedBookings: number;
    discountedOrders: number;
    averageDiscountAmount: number;
    topDiscountedServices?: Array<{
      id: string;
      name_en?: string;
      name_ar?: string;
      category?: string | null;
      discountAmount: number;
      bookingCount: number;
    }>;
    topDiscountedOrders?: Array<{
      id: string;
      orderNumber?: string;
      discountAmount: number;
      totalAmount: number;
      baseAmount: number;
    }>;
  };
}

interface EmployeeRevenue {
  id: string;
  name: string;
  baseSalary?: number;
  commissionRate?: number;
  totalBookings: number;
  paidBookings?: number;
  totalRevenueGenerated: number;
  totalCommission?: number;
  totalEarnings: number;
}

interface ServiceRevenue {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  totalBookings: number;
  totalRevenue: number;
  totalTax?: number;
  totalPlatformFees?: number;
  totalTenantRevenue: number;
}

interface ProductRevenue {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
  totalPlatformFees?: number;
  totalTenantRevenue: number;
}

interface DailyRevenue {
  date: string;
  bookings: number;
  orders: number;
  revenue: number;
  tenantRevenue: number;
}

interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number | string;
  segments?: {
    oneTime?: number;
    occasional?: number;
    regular?: number;
    loyal?: number;
  };
  segmentRevenue?: {
    oneTime?: number;
    occasional?: number;
    regular?: number;
    loyal?: number;
  };
  topCustomers?: Array<{
    id: string;
    bookings: number;
    completed: number;
    revenue: number;
    firstVisit: string;
    lastVisit: string;
  }>;
}

interface PosClosingSummary {
  date?: string;
  grossCollected?: number;
  refundsTotal?: number;
  netCollected?: number;
  transactionCount?: number;
  totalsByMethod?: Array<{
    paymentMethod: string;
    paymentMethodLabel: string;
    collected: number;
    refunded: number;
    transactionCount: number;
  }>;
  totalsBySource?: {
    appointments?: number;
    orders?: number;
    refunds?: number;
  };
}

type FinancialSectionId =
  | "executive"
  | "billing"
  | "subscription"
  | "collections"
  | "sales"
  | "financial"
  | "appointments"
  | "employees"
  | "services"
  | "products"
  | "discounts"
  | "refunds"
  | "paymentMethods"
  | "customerSales";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value: unknown) {
  return `${safeNumber(value).toFixed(1)}%`;
}

function formatDateInput(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
}

function TrendSparkline({
  values,
  color = "#7c3aed",
  height = 120
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const points = useMemo(() => {
    if (!values.length) return "";
    const max = Math.max(...values, 1);
    return values
      .map((value, index) => {
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
        const y = height - (safeNumber(value) / max) * (height - 12) - 6;
        return `${x},${y}`;
      })
      .join(" ");
  }, [height, values]);

  const areaPath = useMemo(() => {
    if (!values.length) {
      return `M 0 ${height} L 100 ${height} Z`;
    }

    const max = Math.max(...values, 1);
    const coords = values.map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = height - (safeNumber(value) / max) * (height - 12) - 6;
      return `${x},${y}`;
    });

    const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point}`).join(" ");
    return `${linePath} L 100 ${height} L 0 ${height} Z`;
  }, [height, values]);

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
      <svg viewBox={`0 0 100 ${height}`} className="block h-56 w-full">
        <defs>
          <linearGradient id="finance-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={areaPath}
          fill="url(#finance-spark-fill)"
          opacity="0.9"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {values.map((value, index) => {
          const max = Math.max(...values, 1);
          const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
          const y = height - (safeNumber(value) / max) * (height - 12) - 6;
          return <circle key={`${index}-${value}`} cx={x} cy={y} r="2.8" fill={color} />;
        })}
      </svg>
    </div>
  );
}

function SectionTable({
  headers,
  rows,
  rtl = false
}: {
  headers: string[];
  rows: ReactNode[][];
  rtl?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-gray-200">
      <table className="min-w-full bg-white text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className={`px-4 py-3 font-semibold text-gray-600 ${rtl ? "text-right" : "text-left"}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50/70">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 align-top text-gray-800 ${cellIndex === 0 && !rtl ? "font-medium" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-4 py-10 text-center text-gray-500" colSpan={headers.length}>
                No rows found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatMoney(value: unknown) {
  return <Currency amount={safeNumber(value)} />;
}

export default function FinancialPage() {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<FinancialSectionId>("executive");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [landingSummary, setLandingSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<EmployeeRevenue[]>([]);
  const [services, setServices] = useState<ServiceRevenue[]>([]);
  const [products, setProducts] = useState<ProductRevenue[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);
  const [posClosingSummary, setPosClosingSummary] = useState<PosClosingSummary | null>(null);

  const [startDate, setStartDate] = useState(() => formatDateInput(-29));
  const [endDate, setEndDate] = useState(() => formatDateInput(0));

  const sidebarGroups: FinanceSidebarGroup[] = [
    {
      title: locale === "ar" ? "نظرة عامة" : "Overview",
      items: [
        { id: "executive", label: locale === "ar" ? "لوحة القيادة" : "Executive dashboard", description: locale === "ar" ? "KPIs, trends, and booking health" : "KPIs, trends, and booking health" },
        { id: "billing", label: locale === "ar" ? "الفواتير" : "Billing / My Bills", description: locale === "ar" ? "Bills, invoices, and receipts" : "Bills, invoices, and receipts" },
        { id: "subscription", label: locale === "ar" ? "الاشتراك" : "My Subscription", description: locale === "ar" ? "Plans, quotas, and entitlements" : "Plans, quotas, and entitlements" }
      ]
    },
    {
      title: locale === "ar" ? "التحصيل" : "Collections",
      items: [
        { id: "collections", label: locale === "ar" ? "POS / التحصيل" : "POS / Collections", description: locale === "ar" ? "Daily closing and payment mix" : "Daily closing and payment mix" }
      ]
    },
    {
      title: locale === "ar" ? "التقارير" : "Reports",
      items: [
        { id: "sales", label: locale === "ar" ? "المبيعات" : "Sales reports" },
        { id: "financial", label: locale === "ar" ? "المالية" : "Financial reports" },
        { id: "appointments", label: locale === "ar" ? "المواعيد" : "Appointment reports" },
        { id: "employees", label: locale === "ar" ? "الموظفون" : "Employee reports" },
        { id: "services", label: locale === "ar" ? "الخدمات" : "Service reports" },
        { id: "products", label: locale === "ar" ? "المنتجات" : "Product reports" },
        { id: "discounts", label: locale === "ar" ? "الخصومات" : "Discounts report" },
        { id: "refunds", label: locale === "ar" ? "الاستردادات" : "Refunds report" },
        { id: "paymentMethods", label: locale === "ar" ? "طرق الدفع" : "Payment methods" },
        { id: "customerSales", label: locale === "ar" ? "مبيعات العملاء" : "Customer sales" }
      ]
    }
  ];

  const totalBookings = safeNumber(overview?.totalBookings ?? reportSummary?.totalBookings);
  const paidBookings = safeNumber(overview?.paidBookings);
  const completedBookings = safeNumber(overview?.completedBookings ?? reportSummary?.completedBookings);
  const unpaidBookings = Math.max(totalBookings - paidBookings, 0);
  const completionRate = safeNumber(reportSummary?.completionRate ?? overview?.completionRate);
  const retentionRate = safeNumber(customerAnalytics?.retentionRate);
  const cancellationRate = totalBookings > 0
    ? (safeNumber(overview?.cancelledBookings) / totalBookings) * 100
    : 0;
  const noShowRate = totalBookings > 0
    ? (safeNumber(overview?.noShowBookings) / totalBookings) * 100
    : 0;

  const revenueSeries = useMemo(() => dailyRevenue.map((day) => safeNumber(day.revenue)), [dailyRevenue]);
  const tenantRevenueSeries = useMemo(() => dailyRevenue.map((day) => safeNumber(day.tenantRevenue)), [dailyRevenue]);
  const bookingSeries = useMemo(() => dailyRevenue.map((day) => safeNumber(day.bookings)), [dailyRevenue]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { startDate, endDate };
      const [overviewRes, landingRes, employeesRes, servicesRes, productsRes, dailyRes, customerRes] = await Promise.allSettled([
        tenantApi.getFinancialOverview(params),
        tenantApi.getFinancialLandingSummary(params),
        tenantApi.getEmployeeRevenue(params),
        tenantApi.getServiceRevenue(params),
        tenantApi.getProductRevenue(params),
        tenantApi.getDailyRevenue(params),
        tenantApi.getCustomerAnalytics(params)
      ]);

      const failedSections: string[] = [];

      if (overviewRes.status === "fulfilled" && overviewRes.value.success) {
        setOverview(overviewRes.value.overview || null);
      } else {
        setOverview(null);
        failedSections.push(locale === "ar" ? "الملخص المالي" : "financial overview");
      }

      if (landingRes.status === "fulfilled" && landingRes.value.success) {
        setLandingSummary(landingRes.value.data || null);
        setReportSummary(landingRes.value.data?.overview || null);
        setPosClosingSummary(landingRes.value.data?.collections?.closingSummary || null);
      } else {
        setLandingSummary(null);
        setReportSummary(null);
        setPosClosingSummary(null);
        failedSections.push(locale === "ar" ? "ملخص التقارير" : "report summary");
      }

      if (employeesRes.status === "fulfilled" && employeesRes.value.success) {
        setEmployees(employeesRes.value.employees || []);
      } else {
        setEmployees([]);
        failedSections.push(locale === "ar" ? "إيراد الموظفين" : "employee revenue");
      }

      if (servicesRes.status === "fulfilled" && servicesRes.value.success) {
        setServices(servicesRes.value.services || []);
      } else {
        setServices([]);
        failedSections.push(locale === "ar" ? "إيراد الخدمات" : "service revenue");
      }

      if (productsRes.status === "fulfilled" && productsRes.value.success) {
        setProducts(productsRes.value.products || []);
      } else {
        setProducts([]);
        failedSections.push(locale === "ar" ? "إيراد المنتجات" : "product revenue");
      }

      if (dailyRes.status === "fulfilled" && dailyRes.value.success) {
        setDailyRevenue(dailyRes.value.dailyRevenue || []);
      } else {
        setDailyRevenue([]);
        failedSections.push(locale === "ar" ? "الإيراد اليومي" : "daily revenue");
      }

      if (customerRes.status === "fulfilled" && customerRes.value.success) {
        setCustomerAnalytics(customerRes.value.data || null);
      } else {
        setCustomerAnalytics(null);
        failedSections.push(locale === "ar" ? "مبيعات العملاء" : "customer sales");
      }

      if (failedSections.length > 0) {
        setError(
          locale === "ar"
            ? `تعذر تحميل بعض الأقسام: ${failedSections.join("، ")}`
            : `Some sections failed to load: ${failedSections.join(", ")}`
        );
      }
    } catch (err: any) {
      console.error("Failed to load financial data:", err);
      setError(err?.message || (locale === "ar" ? "تعذر تحميل البيانات المالية" : "Failed to load financial data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const setQuickRange = (mode: "7d" | "30d" | "month" | "year") => {
    const now = new Date();
    const start = new Date(now);

    if (mode === "7d") {
      start.setDate(now.getDate() - 6);
    } else if (mode === "30d") {
      start.setDate(now.getDate() - 29);
    } else if (mode === "month") {
      start.setDate(1);
    } else {
      start.setMonth(0, 1);
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  const appointmentRevenue = safeNumber(overview?.appointmentRevenue ?? overview?.totalRevenue);
  const orderRevenue = safeNumber(overview?.orderRevenue);
  const giftCardRevenue = safeNumber(overview?.giftCardRevenue);
  const mixTotal = Math.max(appointmentRevenue + orderRevenue + giftCardRevenue, 1);
  const appointmentShare = (appointmentRevenue / mixTotal) * 100;
  const orderShare = (orderRevenue / mixTotal) * 100;
  const giftCardShare = (giftCardRevenue / mixTotal) * 100;
  const discountTotals = overview?.discountTotals || null;

  return (
    <TenantLayout>
      <FinanceWorkspaceShell
        title={locale === "ar" ? "المالية والتقارير" : "Finance & reporting"}
        subtitle={locale === "ar"
          ? "لوحة مالية بأسلوب Fresha تعرض المؤشرات الرئيسية، التحصيل، والتقارير مع التصفية الثابتة والتنقل الجانبي."
          : "A Fresha-style financial workspace with sticky filters, grouped navigation, and dashboard-grade reporting."
        }
        locale={locale}
        sidebarGroups={sidebarGroups}
        activeSection={activeSection}
        onSectionChange={(sectionId) => setActiveSection(sectionId as FinancialSectionId)}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        quickRanges={[
          { id: "7d", label: locale === "ar" ? "7 أيام" : "7 days", onClick: () => setQuickRange("7d"), active: startDate === formatDateInput(-6) },
          { id: "30d", label: locale === "ar" ? "30 يوم" : "30 days", onClick: () => setQuickRange("30d"), active: startDate === formatDateInput(-29) },
          { id: "month", label: locale === "ar" ? "هذا الشهر" : "This month", onClick: () => setQuickRange("month") },
          { id: "year", label: locale === "ar" ? "هذا العام" : "This year", onClick: () => setQuickRange("year") }
        ]}
        actions={
          <>
            <Link
              href={`/${locale}/dashboard/bills`}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {locale === "ar" ? "فواتيري" : "My bills"}
            </Link>
            <Link
              href={`/${locale}/dashboard/subscription`}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {locale === "ar" ? "اشتراكي" : "My subscription"}
            </Link>
            <Link
              href={`/${locale}/dashboard/pos`}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {locale === "ar" ? "التحصيل" : "Collections"}
            </Link>
            <Link
              href={`/${locale}/dashboard/reports/generate`}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              {locale === "ar" ? "إنشاء تقرير" : "Generate report"}
            </Link>
          </>
        }
      >
        {error ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-white" />
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-72 animate-pulse rounded-3xl border border-gray-200 bg-white" />
              <div className="h-72 animate-pulse rounded-3xl border border-gray-200 bg-white" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard
                label={locale === "ar" ? "إجمالي الإيرادات" : "Total revenue"}
                value={formatMoney(overview?.totalRevenue)}
                note={`${totalBookings} ${locale === "ar" ? "حجز" : "bookings"}`}
                tone="green"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "إيراد المركز" : "Tenant revenue"}
                value={formatMoney(overview?.totalTenantRevenue)}
                note={locale === "ar" ? "بعد الرسوم" : "After platform fees"}
                tone="blue"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "صافي الإيرادات" : "Net revenue"}
                value={formatMoney(overview?.netRevenue)}
                note={locale === "ar" ? "بعد العمولات" : "After commissions"}
                tone="purple"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "المدفوعات المعلقة" : "Pending payments"}
                value={formatMoney(overview?.pendingPayments)}
                note={locale === "ar" ? "يحتاج متابعة" : "Requires follow-up"}
                tone="amber"
              />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard
                label={locale === "ar" ? "إجمالي الحجوزات" : "Total bookings"}
                value={totalBookings}
                note={`${completedBookings} ${locale === "ar" ? "مكتمل" : "completed"}`}
              />
              <FinanceMetricCard
                label={locale === "ar" ? "الحجوزات المدفوعة" : "Paid bookings"}
                value={paidBookings}
                note={`${unpaidBookings} ${locale === "ar" ? "غير مدفوعة" : "unpaid"}`}
              />
              <FinanceMetricCard
                label={locale === "ar" ? "الحجوزات المكتملة" : "Completed bookings"}
                value={completedBookings}
                note={`${formatPercent(completionRate)} ${locale === "ar" ? "معدل الإكمال" : "completion rate"}`}
                tone="green"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "العملاء الفريدون" : "Unique customers"}
                value={safeNumber(overview?.uniqueCustomers ?? customerAnalytics?.totalCustomers)}
                note={`${safeNumber(customerAnalytics?.returningCustomers)} ${locale === "ar" ? "عملاء عائدون" : "returning"}`}
                tone="blue"
              />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard
                label={locale === "ar" ? "متوسط قيمة الحجز" : "Average booking value"}
                value={formatMoney(overview?.avgBookingValue)}
                note={locale === "ar" ? "قيم الذروة والوسط" : "Average per completed booking"}
              />
              <FinanceMetricCard
                label={locale === "ar" ? "معدل الإلغاء" : "Cancellation rate"}
                value={formatPercent(cancellationRate)}
                note={`${safeNumber(overview?.cancelledBookings)} ${locale === "ar" ? "إلغاء" : "cancellations"}`}
                tone="rose"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "معدل عدم الحضور" : "No-show rate"}
                value={formatPercent(noShowRate)}
                note={`${safeNumber(overview?.noShowBookings)} ${locale === "ar" ? "حالة" : "cases"}`}
                tone="amber"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "معدل الاحتفاظ" : "Retention rate"}
                value={formatPercent(retentionRate)}
                note={locale === "ar" ? "من تقرير العملاء" : "From customer analytics"}
                tone="purple"
              />
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
              <FinanceSectionCard
                title={locale === "ar" ? "اتجاه الإيرادات" : "Revenue trend"}
                subtitle={locale === "ar" ? "خط زمني للإيرادات وإيراد المركز عبر النطاق المحدد." : "Revenue and tenant revenue over the selected range."}
              >
                {revenueSeries.length ? (
                  <div className="space-y-4">
                    <TrendSparkline values={revenueSeries} color="#7c3aed" />
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {locale === "ar" ? "إجمالي الإيرادات" : "Total revenue"}
                        </p>
                        <div className="mt-2 text-lg font-bold text-gray-900">{formatMoney(overview?.totalRevenue)}</div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {locale === "ar" ? "إيراد المركز" : "Tenant revenue"}
                        </p>
                        <div className="mt-2 text-lg font-bold text-gray-900">{formatMoney(overview?.totalTenantRevenue)}</div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {locale === "ar" ? "إيراد السلع" : "Product revenue"}
                        </p>
                        <div className="mt-2 text-lg font-bold text-gray-900">{formatMoney(overview?.orderRevenue)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد بيانات زمنية" : "No timeline data"}
                    description={locale === "ar" ? "لم يتم العثور على إيرادات ضمن النطاق المحدد." : "No revenue points were found for the selected range."}
                  />
                )}
              </FinanceSectionCard>

              <FinanceSectionCard
                title={locale === "ar" ? "توزيع الإيرادات" : "Revenue mix"}
                subtitle={locale === "ar" ? "توزيع حسب المواعيد والطلبات والبطاقات." : "Appointments, orders, and gift card revenue mix."}
              >
                <div className="space-y-4">
                  <div className="rounded-3xl border border-gray-200 p-4">
                    <div
                      className="mx-auto h-44 w-44 rounded-full"
                      style={{
                        background: `conic-gradient(#7c3aed 0 ${appointmentShare}%, #0ea5e9 ${appointmentShare}% ${appointmentShare + orderShare}%, #f59e0b ${appointmentShare + orderShare}% 100%)`
                      }}
                    />
                    <div className="mt-4 grid gap-2 text-sm text-gray-600">
                      <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span>{locale === "ar" ? "المواعيد" : "Appointments"}</span>
                        <span className="font-semibold text-gray-900">{formatMoney(appointmentRevenue)}</span>
                      </div>
                      <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span>{locale === "ar" ? "الطلبات" : "Orders"}</span>
                        <span className="font-semibold text-gray-900">{formatMoney(orderRevenue)}</span>
                      </div>
                      <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span>{locale === "ar" ? "البطاقات" : "Gift cards"}</span>
                        <span className="font-semibold text-gray-900">{formatMoney(giftCardRevenue)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {[
                      { label: locale === "ar" ? "المواعيد" : "Appointments", value: appointmentShare, tone: "bg-violet-500" },
                      { label: locale === "ar" ? "الطلبات" : "Orders", value: orderShare, tone: "bg-sky-500" },
                      { label: locale === "ar" ? "البطاقات" : "Gift cards", value: giftCardShare, tone: "bg-amber-500" }
                    ].map((item) => (
                      <div key={item.label} className="space-y-1 rounded-2xl border border-gray-200 p-3">
                        <div className={`flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          <span className="text-sm font-semibold text-gray-900">{item.value.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div className={`h-2 rounded-full ${item.tone}`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </FinanceSectionCard>
            </div>

            {activeSection === "executive" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "اللقطات السريعة" : "Quick snapshots"}
                subtitle={locale === "ar" ? "روابط عملية تفتح الأسطح المالية الحالية." : "Operational entry points for the current finance surfaces."}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Link href={`/${locale}/dashboard/bills`} className="rounded-3xl border border-gray-200 bg-gray-50 p-5 transition hover:bg-white">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "فواتيري" : "My bills"}</p>
                    <p className="mt-2 text-sm text-gray-500">{locale === "ar" ? "الفواتير، الإيصالات، والتنزيلات." : "Bills, receipts, and downloads."}</p>
                  </Link>
                  <Link href={`/${locale}/dashboard/subscription`} className="rounded-3xl border border-gray-200 bg-gray-50 p-5 transition hover:bg-white">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "الاشتراك" : "My subscription"}</p>
                    <p className="mt-2 text-sm text-gray-500">{locale === "ar" ? "الباقات والحصص والميزات." : "Plans, quotas, and entitlements."}</p>
                  </Link>
                  <Link href={`/${locale}/dashboard/pos`} className="rounded-3xl border border-gray-200 bg-gray-50 p-5 transition hover:bg-white">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "التحصيل POS" : "POS / collections"}</p>
                    <p className="mt-2 text-sm text-gray-500">{locale === "ar" ? "التحصيل اليومي، الاستردادات، وطرق الدفع." : "Daily closing, refunds, and payment methods."}</p>
                  </Link>
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "billing" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "الفواتير والاشتراك" : "Billing and subscription"}
                subtitle={locale === "ar" ? "نحافظ على الأسطح الحالية مع تجربة موحدة." : "Existing billing surfaces presented inside one cohesive suite."}
                action={<Link href={`/${locale}/dashboard/bills`} className="text-sm font-semibold text-primary hover:underline">{locale === "ar" ? "فتح الفواتير" : "Open bills"}</Link>}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <FinanceMetricCard
                    label={locale === "ar" ? "فواتير مفتوحة" : "Open bills"}
                    value={safeNumber(landingSummary?.billing?.unpaidBillCount)}
                    note={landingSummary?.billing?.currentUnpaidBill?.billNumber || (locale === "ar" ? "أحدث فاتورة مستحقة" : "Latest payable bill")}
                  />
                  <FinanceMetricCard
                    label={locale === "ar" ? "آخر اشتراك" : "Latest subscription"}
                    value={landingSummary?.subscription?.currentSubscription?.status || "--"}
                    note={landingSummary?.subscription?.currentSubscription?.package?.name || (locale === "ar" ? "المستوى والحصص" : "Plan and quotas")}
                  />
                    <FinanceMetricCard
                      label={locale === "ar" ? "عرض الحزم" : "Entitlements"}
                      value={safeNumber(landingSummary?.subscription?.consumption?.rows?.length)}
                      note={landingSummary?.subscription?.consumption?.alerts?.length ? `${safeNumber(landingSummary?.subscription?.consumption?.alerts?.length)} alerts` : (locale === "ar" ? "الميزات المسموح بها" : "Allowed features")}
                    />
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "subscription" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "الاشتراك" : "My subscription"}
                subtitle={locale === "ar" ? "واجهة الاشتراك الحالية تصبح جزءا من مساحة التمويل الموحدة." : "The current subscription surface now sits inside the unified finance workspace."}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <FinanceMetricCard
                    label={locale === "ar" ? "الخطة" : "Plan"}
                    value={landingSummary?.subscription?.currentSubscription?.package?.name || "--"}
                  />
                  <FinanceMetricCard
                    label={locale === "ar" ? "الحصص" : "Quotas"}
                    value={safeNumber(landingSummary?.subscription?.consumption?.rows?.length)}
                  />
                  <FinanceMetricCard
                    label={locale === "ar" ? "الترقية" : "Upgrade"}
                    value={landingSummary?.billing?.currentUnpaidBill?.status || (locale === "ar" ? "لا حاجة" : "None")}
                  />
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "collections" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "التحصيل POS" : "POS collections"}
                subtitle={locale === "ar" ? "ملخص التحصيل اليومي، طرق الدفع، والاستردادات." : "Daily closing snapshot, payment methods, and refunds."}
              >
                {posClosingSummary ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-4">
                      <FinanceMetricCard label={locale === "ar" ? "إجمالي التحصيل" : "Gross collected"} value={formatMoney(posClosingSummary.grossCollected)} tone="green" />
                      <FinanceMetricCard label={locale === "ar" ? "الاستردادات" : "Refunds"} value={formatMoney(posClosingSummary.refundsTotal)} tone="rose" />
                      <FinanceMetricCard label={locale === "ar" ? "الصافي" : "Net collected"} value={formatMoney(posClosingSummary.netCollected)} tone="blue" />
                      <FinanceMetricCard label={locale === "ar" ? "عدد العمليات" : "Transactions"} value={safeNumber(posClosingSummary.transactionCount)} tone="purple" />
                    </div>
                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "طريقة الدفع" : "Payment method",
                        locale === "ar" ? "المحصّل" : "Collected",
                        locale === "ar" ? "الاستردادات" : "Refunded",
                        locale === "ar" ? "العمليات" : "Transactions"
                      ]}
                      rows={(posClosingSummary.totalsByMethod || []).map((method) => [
                        method.paymentMethodLabel,
                        formatMoney(method.collected),
                        formatMoney(method.refunded),
                        method.transactionCount ?? 0
                      ])}
                    />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا يوجد ملخص POS" : "No POS snapshot"}
                    description={locale === "ar" ? "لا يمكن تحميل ملخص التحصيل في هذا النطاق." : "The closing snapshot could not be loaded for this range."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {(activeSection === "sales" || activeSection === "financial" || activeSection === "appointments") ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <FinanceSectionCard
                  title={locale === "ar" ? "إيرادات زمنية" : "Timeline revenue"}
                  subtitle={locale === "ar" ? "سلسلة الإيرادات اليومية وأحجام الحجوزات." : "Daily revenue and booking volume across the selected range."}
                >
                  {revenueSeries.length ? (
                    <div className="space-y-4">
                      <TrendSparkline values={revenueSeries} color="#0ea5e9" />
                      <SectionTable
                        rtl={isRTL}
                        headers={[locale === "ar" ? "التاريخ" : "Date", locale === "ar" ? "الحجوزات" : "Bookings", locale === "ar" ? "الإيراد" : "Revenue", locale === "ar" ? "إيراد المركز" : "Tenant revenue"]}
                        rows={dailyRevenue.slice(0, 8).map((day) => [
                          day.date,
                          day.bookings,
                          formatMoney(day.revenue),
                          formatMoney(day.tenantRevenue)
                        ])}
                      />
                    </div>
                  ) : (
                    <FinanceEmptyState
                      title={locale === "ar" ? "لا توجد بيانات زمنية" : "No timeline data"}
                      description={locale === "ar" ? "لا توجد بيانات حجز أو إيراد ضمن هذه الفترة." : "No booking or revenue data exists for this period."}
                    />
                  )}
                </FinanceSectionCard>

                <FinanceSectionCard
                  title={locale === "ar" ? "تفصيل الإيراد" : "Revenue breakdown"}
                  subtitle={locale === "ar" ? "التحويلات الرئيسية بين المواعيد والطلبات والبطاقات." : "Main revenue sources across appointments, orders, and gift cards."}
                >
                  <div className="space-y-4">
                    {[
                      { label: locale === "ar" ? "المواعيد" : "Appointments", value: appointmentRevenue, tone: "bg-violet-500" },
                      { label: locale === "ar" ? "الطلبات" : "Orders", value: orderRevenue, tone: "bg-sky-500" },
                      { label: locale === "ar" ? "البطاقات" : "Gift cards", value: giftCardRevenue, tone: "bg-amber-500" }
                    ].map((item) => (
                      <div key={item.label} className="space-y-2 rounded-2xl border border-gray-200 p-4">
                        <div className={`flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="font-medium text-gray-700">{item.label}</span>
                          <span className="font-semibold text-gray-900">{formatMoney(item.value)}</span>
                        </div>
                        <div className="h-3 rounded-full bg-gray-100">
                          <div className={`h-3 rounded-full ${item.tone}`} style={{ width: `${(safeNumber(item.value) / mixTotal) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="grid gap-3 md:grid-cols-2">
                      <FinanceMetricCard
                        label={locale === "ar" ? "رسوم المنصة" : "Platform fees"}
                        value={formatMoney(overview?.totalPlatformFees)}
                        tone="amber"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "عمولات الموظفين" : "Employee commissions"}
                        value={formatMoney(overview?.totalEmployeeCommissions)}
                        tone="rose"
                      />
                    </div>
                  </div>
                </FinanceSectionCard>
              </div>
            ) : null}

            {activeSection === "employees" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "أداء الموظفين" : "Employee performance"}
                subtitle={locale === "ar" ? "إيراد الموظفين والعمولات والحجوزات." : "Bookings, generated revenue, and earnings by employee."}
              >
                <SectionTable
                  rtl={isRTL}
                  headers={[
                    locale === "ar" ? "الموظف" : "Employee",
                    locale === "ar" ? "الحجوزات" : "Bookings",
                    locale === "ar" ? "الإيراد" : "Revenue generated",
                    locale === "ar" ? "العمولة" : "Commission",
                    locale === "ar" ? "الإجمالي" : "Total earnings"
                  ]}
                  rows={employees.map((emp) => [
                    emp.name,
                    emp.totalBookings,
                    formatMoney(emp.totalRevenueGenerated),
                    formatMoney(emp.totalCommission),
                    formatMoney(emp.totalEarnings)
                  ])}
                />
              </FinanceSectionCard>
            ) : null}

            {activeSection === "services" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "أداء الخدمات" : "Service performance"}
                subtitle={locale === "ar" ? "الخدمات الأكثر تأثيرا على الإيراد." : "Service-level impact on bookings and revenue."}
              >
                <SectionTable
                  rtl={isRTL}
                  headers={[
                    locale === "ar" ? "الخدمة" : "Service",
                    locale === "ar" ? "الحجوزات" : "Bookings",
                    locale === "ar" ? "الإيراد" : "Revenue",
                    locale === "ar" ? "إيراد المركز" : "Tenant revenue"
                  ]}
                  rows={services.map((service) => [
                    locale === "ar" ? service.name_ar : service.name_en,
                    service.totalBookings,
                    formatMoney(service.totalRevenue),
                    formatMoney(service.totalTenantRevenue)
                  ])}
                />
              </FinanceSectionCard>
            ) : null}

            {activeSection === "products" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "أداء المنتجات" : "Product performance"}
                subtitle={locale === "ar" ? "حركة المنتجات والطلب عليها." : "Product orders and revenue performance."}
              >
                <SectionTable
                  rtl={isRTL}
                  headers={[
                    locale === "ar" ? "المنتج" : "Product",
                    locale === "ar" ? "الطلبات" : "Orders",
                    locale === "ar" ? "الكمية" : "Quantity",
                    locale === "ar" ? "الإيراد" : "Revenue",
                    locale === "ar" ? "إيراد المركز" : "Tenant revenue"
                  ]}
                  rows={products.map((product) => [
                    locale === "ar" ? product.name_ar : product.name_en,
                    product.totalOrders,
                    product.totalQuantity,
                    formatMoney(product.totalRevenue),
                    formatMoney(product.totalTenantRevenue)
                  ])}
                />
              </FinanceSectionCard>
            ) : null}

            {activeSection === "discounts" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "تقرير الخصومات" : "Discounts report"}
                subtitle={locale === "ar" ? "مستخرج من حجوزات الخدمات والطلبات حيث يوجد خصم فعلي محفوظ." : "Derived from service bookings and orders where a real discount exists."}
              >
                {discountTotals ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FinanceMetricCard
                        label={locale === "ar" ? "إجمالي الخصومات" : "Total discounts"}
                        value={formatMoney(discountTotals.totalDiscountAmount)}
                        tone="rose"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "خصومات الحجوزات" : "Booking discounts"}
                        value={formatMoney(discountTotals.appointmentDiscountAmount)}
                        tone="purple"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "خصومات الطلبات" : "Order discounts"}
                        value={formatMoney(discountTotals.orderDiscountAmount)}
                        tone="blue"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "متوسط الخصم" : "Average discount"}
                        value={formatMoney(discountTotals.averageDiscountAmount)}
                        tone="amber"
                      />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <FinanceSectionCard
                        title={locale === "ar" ? "أكبر الخدمات المخفضة" : "Top discounted services"}
                        subtitle={locale === "ar" ? "الخدمات التي حققت أعلى إجمالي خصم." : "Services with the highest total discount amount."}
                      >
                        <SectionTable
                          rtl={isRTL}
                          headers={[
                            locale === "ar" ? "الخدمة" : "Service",
                            locale === "ar" ? "عدد الحجوزات" : "Bookings",
                            locale === "ar" ? "إجمالي الخصم" : "Total discount"
                          ]}
                          rows={(discountTotals.topDiscountedServices || []).map((service: any) => [
                            locale === "ar" ? service.name_ar : service.name_en,
                            service.bookingCount,
                            formatMoney(service.discountAmount)
                          ])}
                        />
                      </FinanceSectionCard>

                      <FinanceSectionCard
                        title={locale === "ar" ? "أكبر الطلبات المخفضة" : "Top discounted orders"}
                        subtitle={locale === "ar" ? "الطلبات التي تحمل خصما فعليا محفوظا." : "Orders with a stored discount delta."}
                      >
                        <SectionTable
                          rtl={isRTL}
                          headers={[
                            locale === "ar" ? "رقم الطلب" : "Order number",
                            locale === "ar" ? "القيمة الأساسية" : "Base amount",
                            locale === "ar" ? "الخصم" : "Discount"
                          ]}
                          rows={(discountTotals.topDiscountedOrders || []).map((order: any) => [
                            order.orderNumber,
                            formatMoney(order.baseAmount),
                            formatMoney(order.discountAmount)
                          ])}
                        />
                      </FinanceSectionCard>
                    </div>
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد خصومات مسجلة" : "No recorded discounts"}
                    description={locale === "ar" ? "لم يتم العثور على حجوزات أو طلبات تحتوي على خصم ضمن هذا النطاق." : "No appointments or orders with discounts were found in the selected range."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "refunds" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "الاستردادات" : "Refunds"}
                subtitle={locale === "ar" ? "ملخص الاستردادات من ملخص الإقفال اليومي." : "Refund summary from the daily closing snapshot."}
              >
                {posClosingSummary ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <FinanceMetricCard label={locale === "ar" ? "إجمالي الاستردادات" : "Total refunds"} value={formatMoney(posClosingSummary.refundsTotal)} tone="rose" />
                    <FinanceMetricCard label={locale === "ar" ? "طرق الدفع" : "Payment methods"} value={(posClosingSummary.totalsByMethod || []).length} tone="blue" />
                    <FinanceMetricCard label={locale === "ar" ? "صافي التحصيل" : "Net collected"} value={formatMoney(posClosingSummary.netCollected)} tone="green" />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد بيانات استرداد" : "No refunds data"}
                    description={locale === "ar" ? "لم يتم تحميل ملخص الإقفال اليومي بعد." : "The closing summary has not been loaded yet."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "paymentMethods" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "طرق الدفع" : "Payment methods"}
                subtitle={locale === "ar" ? "تفصيل التحصيل حسب طريقة الدفع." : "Collected and refunded totals by payment method."}
              >
                {posClosingSummary?.totalsByMethod?.length ? (
                  <SectionTable
                    rtl={isRTL}
                    headers={[
                      locale === "ar" ? "طريقة الدفع" : "Payment method",
                      locale === "ar" ? "المحصّل" : "Collected",
                      locale === "ar" ? "الاسترداد" : "Refunded",
                      locale === "ar" ? "العمليات" : "Transactions"
                    ]}
                    rows={posClosingSummary.totalsByMethod.map((method) => [
                      method.paymentMethodLabel,
                      formatMoney(method.collected),
                      formatMoney(method.refunded),
                      method.transactionCount
                    ])}
                  />
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد طرق دفع" : "No payment methods"}
                    description={locale === "ar" ? "تأكد من اختيار نطاق تاريخ يحتوي على عمليات POS." : "Pick a date range with POS transactions."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "customerSales" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "مبيعات العملاء" : "Customer sales"}
                subtitle={locale === "ar" ? "عملاء نشطون، عائدون، وتوزيع الشرائح." : "Active customers, retention, and segment revenue distribution."}
              >
                {customerAnalytics ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-4">
                      <FinanceMetricCard label={locale === "ar" ? "إجمالي العملاء" : "Total customers"} value={customerAnalytics.totalCustomers} tone="blue" />
                      <FinanceMetricCard label={locale === "ar" ? "عملاء جدد" : "New customers"} value={customerAnalytics.newCustomers} tone="green" />
                      <FinanceMetricCard label={locale === "ar" ? "عملاء عائدون" : "Returning customers"} value={customerAnalytics.returningCustomers} tone="purple" />
                      <FinanceMetricCard label={locale === "ar" ? "الاحتفاظ" : "Retention"} value={formatPercent(customerAnalytics.retentionRate)} tone="amber" />
                    </div>
                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "العميل" : "Customer",
                        locale === "ar" ? "الحجوزات" : "Bookings",
                        locale === "ar" ? "المكتملة" : "Completed",
                        locale === "ar" ? "الإيراد" : "Revenue"
                      ]}
                      rows={(customerAnalytics.topCustomers || []).map((customer, index) => [
                        `${index + 1}. ${customer.id}`,
                        customer.bookings,
                        customer.completed,
                        formatMoney(customer.revenue)
                      ])}
                    />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد تحليلات العملاء" : "No customer analytics"}
                    description={locale === "ar" ? "البيانات غير متاحة لنطاق التاريخ الحالي." : "No customer analytics are available for this date range."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "financial" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "التقرير المالي" : "Financial report"}
                subtitle={locale === "ar" ? "الملخص المالي الحالي هو مصدر الحقيقة للمحاسبة دون تغيير النموذج." : "The current financial summary remains the accounting source of truth."}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <FinanceMetricCard label={locale === "ar" ? "الإيراد الخام" : "Gross revenue"} value={formatMoney(overview?.totalRevenue)} />
                  <FinanceMetricCard label={locale === "ar" ? "الرسوم والعمولات" : "Fees and commissions"} value={formatMoney((overview?.totalPlatformFees || 0) + (overview?.totalEmployeeCommissions || 0))} />
                  <FinanceMetricCard label={locale === "ar" ? "إيراد الملتقى" : "Tenant revenue"} value={formatMoney(overview?.totalTenantRevenue)} />
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "appointments" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "تقرير المواعيد" : "Appointment report"}
                subtitle={locale === "ar" ? "نظرة على حجوزات المواعيد، الإكمال، وعدم الحضور." : "Bookings, completion, and no-show performance."}
              >
                <div className="grid gap-4 md:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "الحجوزات" : "Bookings"} value={totalBookings} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "المكتملة" : "Completed"} value={completedBookings} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "الإلغاء" : "Cancelled"} value={safeNumber(overview?.cancelledBookings)} tone="rose" />
                  <FinanceMetricCard label={locale === "ar" ? "عدم الحضور" : "No-shows"} value={safeNumber(overview?.noShowBookings)} tone="amber" />
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "executive" ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
                <FinanceSectionCard
                  title={locale === "ar" ? "خط الإيراد" : "Revenue line"}
                  subtitle={locale === "ar" ? "سلسلة يومية مبسطة تظهر اتجاه الإيراد وإيراد المركز." : "A simplified daily line that shows total and tenant revenue trend."}
                >
                  <TrendSparkline values={revenueSeries.length ? revenueSeries : [0]} color="#7c3aed" />
                </FinanceSectionCard>

                <FinanceSectionCard
                  title={locale === "ar" ? "إجمالي سريع" : "Quick totals"}
                  subtitle={locale === "ar" ? "أهم أرقام التشغيل اليومية." : "Top operational totals for the selected range."}
                >
                  <div className="space-y-3">
                    {[
                      { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(overview?.totalRevenue), tone: "bg-violet-500" },
                      { label: locale === "ar" ? "إيراد المركز" : "Tenant revenue", value: formatMoney(overview?.totalTenantRevenue), tone: "bg-sky-500" },
                      { label: locale === "ar" ? "التحصيل POS" : "POS net collected", value: formatMoney(posClosingSummary?.netCollected), tone: "bg-emerald-500" },
                      { label: locale === "ar" ? "الاستردادات" : "Refunds", value: formatMoney(posClosingSummary?.refundsTotal), tone: "bg-rose-500" }
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-gray-200 p-4">
                        <div className={`flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="text-sm font-medium text-gray-600">{item.label}</span>
                          <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-gray-100">
                          <div className={`h-2 rounded-full ${item.tone}`} style={{ width: "100%" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </FinanceSectionCard>
              </div>
            ) : null}

            {activeSection === "sales" || activeSection === "financial" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "توزيع إيراد التفاصيل" : "Detailed revenue split"}
                subtitle={locale === "ar" ? "الإيراد اليومي وإيراد المركز وتوزيع السلسلة." : "Daily revenue, tenant revenue, and booking volume split."}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <FinanceMetricCard label={locale === "ar" ? "إيراد المواعيد" : "Appointment revenue"} value={formatMoney(overview?.appointmentRevenue)} tone="purple" />
                  <FinanceMetricCard label={locale === "ar" ? "إيراد الطلبات" : "Order revenue"} value={formatMoney(overview?.orderRevenue)} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "إيراد البطاقات" : "Gift card revenue"} value={formatMoney(overview?.giftCardRevenue)} tone="amber" />
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "إيراد يومي" : "Daily revenue"}</p>
                    <TrendSparkline values={revenueSeries.length ? revenueSeries : [0]} color="#0ea5e9" height={110} />
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "إيراد المركز" : "Tenant revenue"}</p>
                    <TrendSparkline values={tenantRevenueSeries.length ? tenantRevenueSeries : [0]} color="#10b981" height={110} />
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "الحجوزات" : "Bookings"}</p>
                    <TrendSparkline values={bookingSeries.length ? bookingSeries : [0]} color="#f59e0b" height={110} />
                  </div>
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "discounts" || activeSection === "refunds" || activeSection === "paymentMethods" || activeSection === "customerSales" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "ملاحظات التوسعة" : "Extension notes"}
                subtitle={locale === "ar" ? "هذه الأقسام أضيفت الآن إلى التجربة بينما نحتفظ بمصادر الحقيقة الحالية." : "These sections are added to the UI while keeping the current source-of-truth APIs intact."}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "الخصومات" : "Discounts"} value={locale === "ar" ? "جاهز للتوسعة" : "Ready to expand"} tone="rose" />
                  <FinanceMetricCard label={locale === "ar" ? "الاستردادات" : "Refunds"} value={safeNumber(posClosingSummary?.refundsTotal)} tone="amber" />
                  <FinanceMetricCard label={locale === "ar" ? "طرق الدفع" : "Payment methods"} value={safeNumber(posClosingSummary?.totalsByMethod?.length)} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "مبيعات العملاء" : "Customer sales"} value={safeNumber(customerAnalytics?.totalCustomers)} tone="green" />
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "executive" ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <FinanceSectionCard
                  title={locale === "ar" ? "أكبر العملاء" : "Top customers"}
                  subtitle={locale === "ar" ? "مستخرج من تحليلات العملاء الحالية." : "Derived from the current customer analytics response."}
                >
                  <SectionTable
                    rtl={isRTL}
                    headers={[
                      locale === "ar" ? "العميل" : "Customer",
                      locale === "ar" ? "الحجوزات" : "Bookings",
                      locale === "ar" ? "الإيراد" : "Revenue"
                    ]}
                    rows={(customerAnalytics?.topCustomers || []).slice(0, 5).map((customer) => [
                      customer.id,
                      customer.bookings,
                      formatMoney(customer.revenue)
                    ])}
                  />
                </FinanceSectionCard>

                <FinanceSectionCard
                  title={locale === "ar" ? "التحصيل اليومي" : "Daily closing"}
                  subtitle={locale === "ar" ? "نقطة دخول سريعة إلى التحصيل وطرق الدفع والاستردادات." : "Quick entry point into collections, payment mix, and refunds."}
                >
                  {posClosingSummary ? (
                    <div className="space-y-3">
                      {(posClosingSummary.totalsByMethod || []).slice(0, 4).map((method) => (
                        <div key={method.paymentMethod} className="rounded-2xl border border-gray-200 p-4">
                          <div className={`flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className="font-medium text-gray-700">{method.paymentMethodLabel}</span>
                            <span className="font-semibold text-gray-900">{formatMoney(method.collected)}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {method.transactionCount} {locale === "ar" ? "عملية" : "transactions"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <FinanceEmptyState
                      title={locale === "ar" ? "لا يوجد تحصيل اليوم" : "No collection snapshot"}
                      description={locale === "ar" ? "اختر تاريخا يحتوي على إغلاق POS." : "Choose a date that has a POS closing summary."}
                    />
                  )}
                </FinanceSectionCard>
              </div>
            ) : null}
          </div>
        )}
      </FinanceWorkspaceShell>
    </TenantLayout>
  );
}
