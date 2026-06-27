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

type ReportSectionId =
  | "overview"
  | "sales"
  | "financial"
  | "appointments"
  | "rebookings"
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

function formatDateInput(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
}

function formatPercent(value: unknown) {
  return `${safeNumber(value).toFixed(1)}%`;
}

function formatMoney(value: unknown) {
  return <Currency amount={safeNumber(value)} />;
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

  if (!values.length) {
    return <FinanceEmptyState title="No data" description="No time-series data is available." />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
      <svg viewBox={`0 0 100 ${height}`} className="block h-56 w-full">
        <defs>
          <linearGradient id="report-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#report-spark-fill)" />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
                  <td key={cellIndex} className="px-4 py-3 align-top text-gray-800">
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

export default function ReportsPage() {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeSection, setActiveSection] = useState<ReportSectionId>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState("month");
  const [startDate, setStartDate] = useState(formatDateInput(-29));
  const [endDate, setEndDate] = useState(formatDateInput(0));

  const [summary, setSummary] = useState<any>(null);
  const [financialOverview, setFinancialOverview] = useState<any>(null);
  const [bookingTrends, setBookingTrends] = useState<any[]>([]);
  const [servicePerformance, setServicePerformance] = useState<any[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<any[]>([]);
  const [productRevenue, setProductRevenue] = useState<any>(null);
  const [peakHours, setPeakHours] = useState<any>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<any>(null);
  const [rebookingAnalytics, setRebookingAnalytics] = useState<any>(null);
  const [posClosingSummary, setPosClosingSummary] = useState<any>(null);
  const [refundsReport, setRefundsReport] = useState<any>(null);
  const [paymentMethodsReport, setPaymentMethodsReport] = useState<any>(null);

  const sidebarGroups: FinanceSidebarGroup[] = [
    {
      title: locale === "ar" ? "الأقسام" : "Sections",
      items: [
        { id: "overview", label: locale === "ar" ? "نظرة عامة" : "Overview" },
        { id: "sales", label: locale === "ar" ? "المبيعات" : "Sales reports" },
        { id: "financial", label: locale === "ar" ? "المالية" : "Financial reports" },
        { id: "appointments", label: locale === "ar" ? "المواعيد" : "Appointment reports" },
        { id: "rebookings", label: locale === "ar" ? "إعادة الحجز" : "Rebooking analytics" },
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

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { startDate, endDate };
      const [summaryRes, financialRes, trendsRes, servicesRes, employeesRes, productsRes, peakRes, customerRes, rebookingRes, refundsRes, paymentMethodsRes, posRes] = await Promise.allSettled([
        tenantApi.getReportsSummary(params),
        tenantApi.getFinancialOverview(params),
        tenantApi.getBookingTrends({ ...params, groupBy: dateRange === "year" ? "month" : "day" }),
        tenantApi.getServicePerformance(params),
        tenantApi.getEmployeePerformance(params),
        tenantApi.getProductRevenue(params),
        tenantApi.getPeakHoursAnalysis(params),
        tenantApi.getCustomerAnalytics(params),
        tenantApi.getRebookingAnalytics({ ...params, groupBy: dateRange === "year" ? "month" : "day" }),
        tenantApi.getRefundsReport(params),
        tenantApi.getPaymentMethodsReport({ ...params, groupBy: dateRange === "year" ? "month" : "day" }),
        tenantApi.getPosClosingSummary({ date: endDate })
      ]);

      const failedSections: string[] = [];

      if (summaryRes.status === "fulfilled" && summaryRes.value.success) {
        setSummary(summaryRes.value.data || null);
      } else {
        setSummary(null);
        failedSections.push(locale === "ar" ? "ملخص التقارير" : "report summary");
      }

      if (financialRes.status === "fulfilled" && financialRes.value.success) {
        setFinancialOverview(financialRes.value.overview || null);
      } else {
        setFinancialOverview(null);
        failedSections.push(locale === "ar" ? "الملخص المالي" : "financial overview");
      }

      if (trendsRes.status === "fulfilled" && trendsRes.value.success) {
        setBookingTrends(trendsRes.value.data || []);
      } else {
        setBookingTrends([]);
        failedSections.push(locale === "ar" ? "اتجاهات الحجز" : "booking trends");
      }

      if (servicesRes.status === "fulfilled" && servicesRes.value.success) {
        setServicePerformance(servicesRes.value.data || []);
      } else {
        setServicePerformance([]);
        failedSections.push(locale === "ar" ? "أداء الخدمات" : "service performance");
      }

      if (employeesRes.status === "fulfilled" && employeesRes.value.success) {
        setEmployeePerformance(employeesRes.value.data || []);
      } else {
        setEmployeePerformance([]);
        failedSections.push(locale === "ar" ? "أداء الموظفين" : "employee performance");
      }

      if (productsRes.status === "fulfilled" && productsRes.value.success) {
        setProductRevenue({
          rows: productsRes.value.products || [],
          totals: productsRes.value.totals || null
        });
      } else {
        setProductRevenue(null);
        failedSections.push(locale === "ar" ? "تقرير المنتجات" : "product report");
      }

      if (peakRes.status === "fulfilled" && peakRes.value.success) {
        setPeakHours(peakRes.value.data || null);
      } else {
        setPeakHours(null);
        failedSections.push(locale === "ar" ? "ساعات الذروة" : "peak hours");
      }

      if (customerRes.status === "fulfilled" && customerRes.value.success) {
        setCustomerAnalytics(customerRes.value.data || null);
      } else {
        setCustomerAnalytics(null);
        failedSections.push(locale === "ar" ? "تحليلات العملاء" : "customer analytics");
      }

      if (rebookingRes.status === "fulfilled" && rebookingRes.value.success) {
        setRebookingAnalytics({
          rows: rebookingRes.value.rows || [],
          totals: rebookingRes.value.totals || null,
          trend: rebookingRes.value.trend || [],
          topRebookingEmployees: rebookingRes.value.topRebookingEmployees || []
        });
      } else {
        setRebookingAnalytics(null);
        failedSections.push(locale === "ar" ? "تحليلات إعادة الحجز" : "rebooking analytics");
      }

      if (refundsRes.status === "fulfilled" && refundsRes.value.success) {
        setRefundsReport({
          rows: refundsRes.value.data || [],
          totals: refundsRes.value.totals || null
        });
      } else {
        setRefundsReport(null);
        failedSections.push(locale === "ar" ? "تقرير الاستردادات" : "refunds report");
      }

      if (paymentMethodsRes.status === "fulfilled" && paymentMethodsRes.value.success) {
        setPaymentMethodsReport({
          rows: paymentMethodsRes.value.data || [],
          totals: paymentMethodsRes.value.totals || null,
          trend: paymentMethodsRes.value.trend || []
        });
      } else {
        setPaymentMethodsReport(null);
        failedSections.push(locale === "ar" ? "تقرير طرق الدفع" : "payment methods report");
      }

      if (posRes.status === "fulfilled" && posRes.value.success) {
        setPosClosingSummary(posRes.value.summary || null);
      } else {
        setPosClosingSummary(null);
        failedSections.push(locale === "ar" ? "ملخص الإقفال POS" : "POS closing summary");
      }

      if (failedSections.length > 0) {
        setError(
          locale === "ar"
            ? `تعذر تحميل بعض التقارير: ${failedSections.join("، ")}`
            : `Some report sections failed to load: ${failedSections.join(", ")}`
        );
      }
    } catch (err: any) {
      console.error("Failed to load reports:", err);
      setError(err?.message || (locale === "ar" ? "تعذر تحميل التقارير" : "Failed to load reports"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, dateRange]);

  const setQuickRange = (mode: "week" | "month" | "quarter" | "year") => {
    const now = new Date();
    let start: Date;

    switch (mode) {
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case "quarter":
        start = new Date(now);
        start.setDate(now.getDate() - 90);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "month":
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    setDateRange(mode);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  const bookingTrendValues = useMemo(() => bookingTrends.map((item) => safeNumber(item.bookings)), [bookingTrends]);
  const revenueTrendValues = useMemo(() => bookingTrends.map((item) => safeNumber(item.revenue)), [bookingTrends]);
  const paymentMethodTrendValues = useMemo(
    () => (paymentMethodsReport?.trend || []).map((item: any) =>
      safeNumber(item.revenue ?? item.totalRevenue ?? item.collected ?? item.value)
    ),
    [paymentMethodsReport]
  );
  const rebookingTrendValues = useMemo(
    () => (rebookingAnalytics?.trend || []).map((item: any) =>
      safeNumber(item.rebookedRevenue ?? item.revenue ?? item.totalRevenue ?? item.value)
    ),
    [rebookingAnalytics]
  );

  const totalBookings = safeNumber(summary?.totalBookings ?? financialOverview?.totalBookings);
  const totalRevenue = safeNumber(summary?.totalRevenue ?? financialOverview?.totalRevenue);
  const tenantRevenue = safeNumber(financialOverview?.totalTenantRevenue);
  const avgBookingValue = safeNumber(summary?.avgBookingValue ?? financialOverview?.avgBookingValue);
  const completionRate = safeNumber(summary?.completionRate ?? financialOverview?.completionRate);
  const retentionRate = safeNumber(customerAnalytics?.retentionRate);
  const discountTotals = financialOverview?.discountTotals || null;
  const overviewVisible = activeSection === "overview";

  return (
    <TenantLayout>
      <FinanceWorkspaceShell
        title={locale === "ar" ? "التقارير" : "Reports"}
        subtitle={locale === "ar"
          ? "منطقة تقارير بأسلوب Fresha تعرض مؤشرات التنفيذ، التقارير التفصيلية، والتحصيل في لوحة واحدة."
          : "A Fresha-style reporting workspace for execution metrics, detailed reports, and collections in one place."
        }
        locale={locale}
        sidebarGroups={sidebarGroups}
        activeSection={activeSection}
        onSectionChange={(sectionId) => setActiveSection(sectionId as ReportSectionId)}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        quickRanges={[
          { id: "week", label: locale === "ar" ? "7 أيام" : "7 days", onClick: () => setQuickRange("week") },
          { id: "month", label: locale === "ar" ? "هذا الشهر" : "This month", onClick: () => setQuickRange("month") },
          { id: "quarter", label: locale === "ar" ? "ربع سنة" : "Quarter", onClick: () => setQuickRange("quarter") },
          { id: "year", label: locale === "ar" ? "هذا العام" : "This year", onClick: () => setQuickRange("year") }
        ]}
        actions={
          <>
            <Link href={`/${locale}/dashboard/reports/generate`} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
              {locale === "ar" ? "إنشاء تقرير" : "Generate report"}
            </Link>
            <Link href={`/${locale}/dashboard/financial`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              {locale === "ar" ? "المالية" : "Financial"}
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
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="h-72 animate-pulse rounded-3xl border border-gray-200 bg-white" />
              <div className="h-72 animate-pulse rounded-3xl border border-gray-200 bg-white" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {overviewVisible ? (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "إجمالي الحجوزات" : "Total bookings"} value={totalBookings} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "الإيراد" : "Total revenue"} value={formatMoney(totalRevenue)} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "إيراد المركز" : "Tenant revenue"} value={formatMoney(tenantRevenue)} tone="purple" />
                  <FinanceMetricCard label={locale === "ar" ? "العملاء الفريدون" : "Unique customers"} value={safeNumber(summary?.uniqueCustomers)} tone="amber" />
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "متوسط قيمة الحجز" : "Average booking value"} value={formatMoney(avgBookingValue)} />
                  <FinanceMetricCard label={locale === "ar" ? "معدل الإكمال" : "Completion rate"} value={formatPercent(completionRate)} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "معدل الاحتفاظ" : "Retention rate"} value={formatPercent(retentionRate)} tone="purple" />
                  <FinanceMetricCard label={locale === "ar" ? "المدفوعات المعلقة" : "Pending revenue"} value={formatMoney(summary?.pendingRevenue ?? financialOverview?.pendingPayments)} tone="rose" />
                </section>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
                  <FinanceSectionCard
                    title={locale === "ar" ? "اتجاهات الحجز" : "Booking trends"}
                    subtitle={locale === "ar" ? "الاتجاه اليومي أو الشهري بحسب النطاق المحدد." : "Daily or monthly booking trend based on the selected range."}
                  >
                    <div className="space-y-4">
                      <TrendSparkline values={bookingTrendValues.length ? bookingTrendValues : [0]} color="#0ea5e9" />
                      <SectionTable
                        rtl={isRTL}
                        headers={[
                          locale === "ar" ? "التاريخ" : "Date",
                          locale === "ar" ? "الحجوزات" : "Bookings",
                          locale === "ar" ? "المكتملة" : "Completed",
                          locale === "ar" ? "الإيراد" : "Revenue"
                        ]}
                        rows={bookingTrends.slice(0, 8).map((trend) => [
                          trend.date,
                          safeNumber(trend.bookings),
                          safeNumber(trend.completed),
                          formatMoney(trend.revenue)
                        ])}
                      />
                    </div>
                  </FinanceSectionCard>

                  <FinanceSectionCard
                    title={locale === "ar" ? "ملخص التشغيل" : "Operational summary"}
                    subtitle={locale === "ar" ? "مؤشرات سريعة من الملخص المالي والتقارير." : "Quick KPIs from the financial and report summaries."}
                  >
                    <div className="space-y-3">
                      {[
                        { label: locale === "ar" ? "الحجوزات المكتملة" : "Completed bookings", value: safeNumber(summary?.completedBookings ?? financialOverview?.completedBookings), tone: "bg-emerald-500" },
                        { label: locale === "ar" ? "الحجوزات الملغاة" : "Cancelled bookings", value: safeNumber(summary?.cancelledBookings ?? financialOverview?.cancelledBookings), tone: "bg-rose-500" },
                        { label: locale === "ar" ? "حالات عدم الحضور" : "No-show cases", value: safeNumber(summary?.noShowBookings ?? financialOverview?.noShowBookings), tone: "bg-amber-500" },
                        { label: locale === "ar" ? "العملاء العائدون" : "Returning customers", value: safeNumber(customerAnalytics?.returningCustomers), tone: "bg-violet-500" }
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

                <div className="grid gap-5 xl:grid-cols-2">
                  <FinanceSectionCard
                    title={locale === "ar" ? "الخدمات الأعلى أداء" : "Top services"}
                    subtitle={locale === "ar" ? "الخدمات الأكثر توليدا للإيراد." : "Highest revenue-generating services."}
                  >
                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "الخدمة" : "Service",
                        locale === "ar" ? "الحجوزات" : "Bookings",
                        locale === "ar" ? "الإيراد" : "Revenue"
                      ]}
                      rows={servicePerformance.slice(0, 6).map((service) => [
                        locale === "ar" ? service.name_ar : service.name_en,
                        safeNumber(service.totalBookings),
                        formatMoney(service.revenue ?? service.totalRevenue)
                      ])}
                    />
                  </FinanceSectionCard>

                  <FinanceSectionCard
                    title={locale === "ar" ? "أكبر العملاء" : "Top customers"}
                    subtitle={locale === "ar" ? "العملاء الأكثر إنفاقا." : "Customers with the highest revenue contribution."}
                  >
                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "العميل" : "Customer",
                        locale === "ar" ? "الحجوزات" : "Bookings",
                        locale === "ar" ? "الإيراد" : "Revenue"
                      ]}
                      rows={(customerAnalytics?.topCustomers || []).slice(0, 6).map((customer: any) => [
                        customer.id,
                        safeNumber(customer.bookings),
                        formatMoney(customer.revenue)
                      ])}
                    />
                  </FinanceSectionCard>
                </div>
              </>
            ) : null}

            {activeSection === "sales" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "تقرير المبيعات" : "Sales report"}
                subtitle={locale === "ar" ? "السلسلة الزمنية، الخدمات، والعملاء." : "Time series, services, and customer contribution."}
              >
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "الإيراد" : "Revenue"}</p>
                    <TrendSparkline values={revenueTrendValues.length ? revenueTrendValues : [0]} color="#7c3aed" height={110} />
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "إيراد المركز" : "Tenant revenue"}</p>
                    <TrendSparkline values={bookingTrendValues.length ? bookingTrendValues : [0]} color="#10b981" height={110} />
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "الحجوزات" : "Bookings"}</p>
                    <TrendSparkline values={bookingTrendValues.length ? bookingTrendValues : [0]} color="#0ea5e9" height={110} />
                  </div>
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "financial" ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <FinanceSectionCard title={locale === "ar" ? "ملخص مالي" : "Financial summary"}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FinanceMetricCard label={locale === "ar" ? "الإيراد الخام" : "Gross revenue"} value={formatMoney(financialOverview?.totalRevenue ?? summary?.totalRevenue)} tone="green" />
                    <FinanceMetricCard label={locale === "ar" ? "إيراد المركز" : "Tenant revenue"} value={formatMoney(financialOverview?.totalTenantRevenue)} tone="blue" />
                    <FinanceMetricCard label={locale === "ar" ? "الرسوم والعمولات" : "Fees and commissions"} value={formatMoney((financialOverview?.totalPlatformFees || 0) + (financialOverview?.totalEmployeeCommissions || 0))} tone="amber" />
                    <FinanceMetricCard label={locale === "ar" ? "صافي الإيراد" : "Net revenue"} value={formatMoney(financialOverview?.netRevenue)} tone="purple" />
                  </div>
                </FinanceSectionCard>

                <FinanceSectionCard title={locale === "ar" ? "طرق الدفع" : "Payment methods"}>
                  {posClosingSummary?.totalsByMethod?.length ? (
                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "الطريقة" : "Method",
                        locale === "ar" ? "المحصّل" : "Collected",
                        locale === "ar" ? "الاسترداد" : "Refunded"
                      ]}
                      rows={posClosingSummary.totalsByMethod.map((method: any) => [
                        method.paymentMethodLabel,
                        formatMoney(method.collected),
                        formatMoney(method.refunded)
                      ])}
                    />
                  ) : (
                    <FinanceEmptyState
                      title={locale === "ar" ? "لا توجد طرق دفع" : "No payment methods"}
                      description={locale === "ar" ? "اختر نطاق تاريخ يحتوي على تحصيل POS." : "Pick a date range with POS closing activity."}
                    />
                  )}
                </FinanceSectionCard>
              </div>
            ) : null}

            {activeSection === "appointments" ? (
              <FinanceSectionCard title={locale === "ar" ? "تقرير المواعيد" : "Appointment report"}>
                <div className="grid gap-4 md:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "الإجمالي" : "Total"} value={totalBookings} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "المكتمل" : "Completed"} value={safeNumber(summary?.completedBookings)} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "الملغى" : "Cancelled"} value={safeNumber(summary?.cancelledBookings)} tone="rose" />
                  <FinanceMetricCard label={locale === "ar" ? "عدم الحضور" : "No-shows"} value={safeNumber(summary?.noShowBookings)} tone="amber" />
                </div>
              </FinanceSectionCard>
            ) : null}

            {activeSection === "rebookings" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "تحليلات إعادة الحجز" : "Rebooking analytics"}
                subtitle={locale === "ar" ? "معدل إعادة الحجز، العملاء المتكررين، والإيراد المعاد حجزه." : "Rebooking rate, repeat customers, rebooked revenue, and trend."}
              >
                {rebookingAnalytics ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FinanceMetricCard
                        label={locale === "ar" ? "معدل إعادة الحجز" : "Rebooking rate"}
                        value={formatPercent(rebookingAnalytics.totals?.rebookingRate)}
                        tone="purple"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "عملاء متكررون" : "Repeat customers"}
                        value={safeNumber(rebookingAnalytics.totals?.repeatCustomers)}
                        tone="blue"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "إيراد معاد حجزه" : "Rebooked revenue"}
                        value={formatMoney(rebookingAnalytics.totals?.rebookedRevenue)}
                        tone="green"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "الحجوزات المعادة" : "Rebooked appointments"}
                        value={safeNumber(rebookingAnalytics.totals?.rebookedAppointments)}
                        tone="amber"
                      />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,1fr)]">
                      <div className="rounded-3xl border border-gray-200 bg-white p-4">
                        <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "اتجاه إعادة الحجز" : "Rebooking trend"}</p>
                        <div className="mt-3">
                          <TrendSparkline values={rebookingTrendValues.length ? rebookingTrendValues : [0]} color="#8b5cf6" height={110} />
                        </div>
                      </div>

                      <FinanceSectionCard title={locale === "ar" ? "أعلى الموظفين" : "Top rebooking employees"}>
                        <SectionTable
                          rtl={isRTL}
                          headers={[
                            locale === "ar" ? "الموظف" : "Employee",
                            locale === "ar" ? "إعادة الحجز" : "Rebooked",
                            locale === "ar" ? "الإيراد" : "Revenue"
                          ]}
                          rows={(rebookingAnalytics.topRebookingEmployees || []).map((employee: any) => [
                            employee.name,
                            safeNumber(employee.rebookedAppointments ?? employee.rebookingCount),
                            formatMoney(employee.rebookedRevenue ?? employee.revenue)
                          ])}
                        />
                      </FinanceSectionCard>
                    </div>

                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "التاريخ" : "Date",
                        locale === "ar" ? "العميل" : "Customer",
                        locale === "ar" ? "الحجز المرجعي" : "Reference booking",
                        locale === "ar" ? "إعادة الحجز" : "Rebooked",
                        locale === "ar" ? "الإيراد" : "Revenue"
                      ]}
                      rows={(rebookingAnalytics.rows || []).map((row: any) => [
                        row.date ? new Date(row.date).toLocaleDateString() : "-",
                        row.customerName || row.customer || "-",
                        row.reference || row.bookingNumber || "-",
                        row.rebooked ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No"),
                        formatMoney(row.rebookedRevenue ?? row.revenue ?? row.amount)
                      ])}
                    />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد تحليلات إعادة الحجز" : "No rebooking analytics"}
                    description={locale === "ar" ? "لم يتم العثور على بيانات إعادة حجز في هذا النطاق." : "No rebooking analytics are available for the selected range."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "employees" ? (
              <FinanceSectionCard title={locale === "ar" ? "أداء الموظفين" : "Employee performance"}>
                <SectionTable
                  rtl={isRTL}
                  headers={[
                    locale === "ar" ? "الموظف" : "Employee",
                    locale === "ar" ? "الحجوزات" : "Bookings",
                    locale === "ar" ? "الإيراد" : "Revenue",
                    locale === "ar" ? "العمولة" : "Commission"
                  ]}
                  rows={employeePerformance.map((employee: any) => [
                    employee.name,
                    safeNumber(employee.totalBookings),
                    formatMoney(employee.revenue ?? employee.totalRevenueGenerated),
                    formatMoney(employee.commission ?? employee.totalCommission)
                  ])}
                />
              </FinanceSectionCard>
            ) : null}

            {activeSection === "services" ? (
              <FinanceSectionCard title={locale === "ar" ? "أداء الخدمات" : "Service performance"}>
                <SectionTable
                  rtl={isRTL}
                  headers={[
                    locale === "ar" ? "الخدمة" : "Service",
                    locale === "ar" ? "الحجوزات" : "Bookings",
                    locale === "ar" ? "الإيراد" : "Revenue",
                    locale === "ar" ? "معدل الإكمال" : "Completion rate"
                  ]}
                  rows={servicePerformance.map((service: any) => [
                    locale === "ar" ? service.name_ar : service.name_en,
                    safeNumber(service.totalBookings),
                    formatMoney(service.revenue ?? service.totalRevenue),
                    `${safeNumber(service.completionRate).toFixed(1)}%`
                  ])}
                />
              </FinanceSectionCard>
            ) : null}

            {activeSection === "products" ? (
              <FinanceSectionCard title={locale === "ar" ? "تقرير المنتجات" : "Product report"}>
                {productRevenue?.rows?.length ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-4">
                      <FinanceMetricCard label={locale === "ar" ? "المنتجات النشطة" : "Active products"} value={safeNumber(productRevenue.totals?.totalProducts)} tone="blue" />
                      <FinanceMetricCard label={locale === "ar" ? "الطلبات" : "Orders"} value={safeNumber(productRevenue.totals?.totalOrders)} tone="green" />
                      <FinanceMetricCard label={locale === "ar" ? "الكمية" : "Quantity"} value={safeNumber(productRevenue.totals?.totalQuantity)} tone="purple" />
                      <FinanceMetricCard label={locale === "ar" ? "الإيراد" : "Revenue"} value={formatMoney(productRevenue.totals?.totalRevenue)} tone="amber" />
                    </div>
                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "المنتج" : "Product",
                        locale === "ar" ? "الطلبات" : "Orders",
                        locale === "ar" ? "الكمية" : "Quantity",
                        locale === "ar" ? "الإيراد" : "Revenue",
                        locale === "ar" ? "إيراد المركز" : "Tenant revenue"
                      ]}
                      rows={productRevenue.rows.map((product: any) => [
                        locale === "ar" ? product.name_ar : product.name_en,
                        safeNumber(product.totalOrders),
                        safeNumber(product.totalQuantity),
                        formatMoney(product.totalRevenue),
                        formatMoney(product.totalTenantRevenue)
                      ])}
                    />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا يوجد تقرير منتجات" : "No product report"}
                    description={locale === "ar" ? "التقرير لا يحتوي على بيانات منتجات ضمن هذا النطاق." : "No product revenue data is available for this range."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "discounts" ? (
              <FinanceSectionCard title={locale === "ar" ? "الخصومات" : "Discounts"}>
                {discountTotals ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FinanceMetricCard label={locale === "ar" ? "إجمالي الخصومات" : "Total discounts"} value={formatMoney(discountTotals.totalDiscountAmount)} tone="rose" />
                      <FinanceMetricCard label={locale === "ar" ? "خصومات الحجوزات" : "Booking discounts"} value={formatMoney(discountTotals.appointmentDiscountAmount)} tone="purple" />
                      <FinanceMetricCard label={locale === "ar" ? "خصومات الطلبات" : "Order discounts"} value={formatMoney(discountTotals.orderDiscountAmount)} tone="blue" />
                      <FinanceMetricCard label={locale === "ar" ? "متوسط الخصم" : "Average discount"} value={formatMoney(discountTotals.averageDiscountAmount)} tone="amber" />
                    </div>
                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "الخدمة" : "Service",
                        locale === "ar" ? "الحجوزات" : "Bookings",
                        locale === "ar" ? "الخصم" : "Discount"
                      ]}
                      rows={(discountTotals.topDiscountedServices || []).map((service: any) => [
                        locale === "ar" ? service.name_ar : service.name_en,
                        safeNumber(service.bookingCount),
                        formatMoney(service.discountAmount)
                      ])}
                    />
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
                subtitle={locale === "ar" ? "سجل الاستردادات الموحّد مع تفاصيل العملية والسبب." : "Unified refunds ledger with transaction and reason details."}
              >
                {refundsReport?.rows?.length ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-4">
                      <FinanceMetricCard label={locale === "ar" ? "إجمالي الاسترداد" : "Refunds total"} value={formatMoney(refundsReport.totals?.totalRefunds)} tone="rose" />
                      <FinanceMetricCard label={locale === "ar" ? "عدد الاستردادات" : "Refund count"} value={safeNumber(refundsReport.totals?.refundCount)} tone="blue" />
                      <FinanceMetricCard label={locale === "ar" ? "كامل" : "Full"} value={safeNumber(refundsReport.totals?.fullRefundCount)} tone="green" />
                      <FinanceMetricCard label={locale === "ar" ? "جزئي" : "Partial"} value={safeNumber(refundsReport.totals?.partialRefundCount)} tone="amber" />
                    </div>

                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "التاريخ" : "Date",
                        locale === "ar" ? "العميل" : "Customer",
                        locale === "ar" ? "المرجع" : "Reference",
                        locale === "ar" ? "المبلغ" : "Amount",
                        locale === "ar" ? "طريقة الدفع" : "Payment method",
                        locale === "ar" ? "السبب" : "Reason",
                        locale === "ar" ? "الموظف" : "Employee",
                        locale === "ar" ? "النوع" : "Type"
                      ]}
                      rows={(refundsReport.rows || []).map((row: any) => [
                        row.date ? new Date(row.date).toLocaleDateString() : "-",
                        row.customer,
                        row.reference,
                        formatMoney(row.amount),
                        row.paymentMethodLabel,
                        row.refundReason || "-",
                        row.employee || "-",
                        row.refundMode
                      ])}
                    />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد بيانات استرداد" : "No refund data"}
                    description={locale === "ar" ? "لم نعثر على استردادات ضمن النطاق المحدد." : "No refund transactions were found in the selected range."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "paymentMethods" ? (
              <FinanceSectionCard
                title={locale === "ar" ? "طرق الدفع" : "Payment methods"}
                subtitle={locale === "ar" ? "توزيع الإيراد والمعاملات حسب طريقة الدفع." : "Revenue and transaction distribution by payment method."}
              >
                {paymentMethodsReport?.rows?.length ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FinanceMetricCard
                        label={locale === "ar" ? "إجمالي الإيراد" : "Total revenue"}
                        value={formatMoney(paymentMethodsReport.totals?.revenue)}
                        tone="green"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "عدد العمليات" : "Transactions"}
                        value={safeNumber(paymentMethodsReport.totals?.transactionCount)}
                        tone="blue"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "أكبر حصة" : "Largest share"}
                        value={paymentMethodsReport.rows?.length ? `${Math.max(...paymentMethodsReport.rows.map((row: any) => safeNumber(row.revenue))).toFixed(0)}` : "0"}
                        tone="purple"
                      />
                      <FinanceMetricCard
                        label={locale === "ar" ? "اتجاه زمني" : "Trend points"}
                        value={safeNumber(paymentMethodsReport.trend?.length)}
                        tone="amber"
                      />
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {locale === "ar" ? "الاتجاه الزمني لطرق الدفع" : "Payment method trend"}
                      </p>
                      <div className="mt-3">
                        <TrendSparkline values={paymentMethodTrendValues.length ? paymentMethodTrendValues : [0]} color="#0ea5e9" height={110} />
                      </div>
                    </div>

                    <SectionTable
                      rtl={isRTL}
                      headers={[
                        locale === "ar" ? "الطريقة" : "Method",
                        locale === "ar" ? "الإيراد" : "Revenue",
                        locale === "ar" ? "العمليات" : "Transactions",
                        locale === "ar" ? "النسبة" : "Share"
                      ]}
                      rows={paymentMethodsReport.rows.map((method: any) => [
                        method.paymentMethodLabel,
                        formatMoney(method.revenue),
                        method.transactionCount,
                        `${paymentMethodsReport.totals?.revenue ? ((safeNumber(method.revenue) / safeNumber(paymentMethodsReport.totals.revenue)) * 100).toFixed(1) : "0.0"}%`
                      ])}
                    />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد طرق دفع" : "No payment methods"}
                    description={locale === "ar" ? "اختر نطاق تاريخ فيه معاملات مسجلة." : "Pick a range with recorded transactions."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}

            {activeSection === "customerSales" ? (
              <FinanceSectionCard title={locale === "ar" ? "مبيعات العملاء" : "Customer sales"}>
                {customerAnalytics ? (
                  <div className="grid gap-4 md:grid-cols-4">
                    <FinanceMetricCard label={locale === "ar" ? "إجمالي العملاء" : "Total customers"} value={safeNumber(customerAnalytics.totalCustomers)} tone="blue" />
                    <FinanceMetricCard label={locale === "ar" ? "عملاء جدد" : "New customers"} value={safeNumber(customerAnalytics.newCustomers)} tone="green" />
                    <FinanceMetricCard label={locale === "ar" ? "عملاء عائدون" : "Returning customers"} value={safeNumber(customerAnalytics.returningCustomers)} tone="purple" />
                    <FinanceMetricCard label={locale === "ar" ? "الاحتفاظ" : "Retention"} value={formatPercent(customerAnalytics.retentionRate)} tone="amber" />
                  </div>
                ) : (
                  <FinanceEmptyState
                    title={locale === "ar" ? "لا توجد تحليلات العملاء" : "No customer analytics"}
                    description={locale === "ar" ? "البيانات غير متاحة لهذا النطاق." : "No analytics are available for this date range."}
                  />
                )}
              </FinanceSectionCard>
            ) : null}
          </div>
        )}
      </FinanceWorkspaceShell>
    </TenantLayout>
  );
}
