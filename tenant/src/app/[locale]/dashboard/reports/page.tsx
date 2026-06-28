"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { TenantLayout } from "@/components/TenantLayout";
import { ReportExportToolbar } from "@/components/ReportExportToolbar";
import { ReportPdfDebugPanel, type ReportPdfDebugState } from "@/components/ReportPdfDebugPanel";
import { AnalyticsDetailsDrawer } from "@/components/AnalyticsDetailsDrawer";
import {
  FinanceEmptyState,
  FinanceMetricCard,
  FinanceSectionCard,
  FinanceWorkspaceShell,
  type FinanceSidebarGroup
} from "@/components/FinanceWorkspaceShell";
import { AnalyticsDataTable } from "@/components/AnalyticsDataTable";
import { CustomerIdentityCell } from "@/components/CustomerIdentityCell";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";
import {
  buildReportExportTables,
  exportCsv,
  exportExcel,
  exportPdf,
  printReport
} from "@/lib/reportExportService";

type ReportSectionId =
  | "overview"
  | "savedReports"
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

function getReportSectionLabel(sectionId: ReportSectionId, locale: string) {
  switch (sectionId) {
    case "savedReports":
      return locale === "ar" ? "التقارير المحفوظة" : "Saved reports";
    case "sales":
      return locale === "ar" ? "تقرير المبيعات" : "Sales reports";
    case "financial":
      return locale === "ar" ? "التقارير المالية" : "Financial reports";
    case "appointments":
      return locale === "ar" ? "تقارير المواعيد" : "Appointment reports";
    case "rebookings":
      return locale === "ar" ? "تحليلات إعادة الحجز" : "Rebooking analytics";
    case "employees":
      return locale === "ar" ? "تقارير الموظفين" : "Employee reports";
    case "services":
      return locale === "ar" ? "تقارير الخدمات" : "Service reports";
    case "products":
      return locale === "ar" ? "تقارير المنتجات" : "Product reports";
    case "discounts":
      return locale === "ar" ? "تقرير الخصومات" : "Discounts report";
    case "refunds":
      return locale === "ar" ? "تقرير الاستردادات" : "Refunds report";
    case "paymentMethods":
      return locale === "ar" ? "طرق الدفع" : "Payment methods";
    case "customerSales":
      return locale === "ar" ? "مبيعات العملاء" : "Customer sales";
    case "overview":
    default:
      return locale === "ar" ? "نظرة عامة" : "Overview";
  }
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
  rtl = false,
  onRowClick,
  sourceLabel,
  totalRows,
  truncatedLabel,
  countLabel
}: {
  headers: string[];
  rows: ReactNode[][];
  rtl?: boolean;
  onRowClick?: (rowIndex: number) => void;
  sourceLabel?: string;
  totalRows?: number;
  truncatedLabel?: string;
  countLabel?: string;
}) {
  return (
    <AnalyticsDataTable
      columns={headers.map((header, index) => ({
        id: `${header}-${index}`,
        header,
        align: index === 0 ? (rtl ? "right" : "left") : "right",
      }))}
      rows={rows}
      onRowClick={onRowClick}
      sourceLabel={sourceLabel || "rows"}
      totalRows={totalRows}
      truncatedLabel={truncatedLabel}
      countLabel={countLabel}
      emptyTitle={rtl ? "لا توجد صفوف" : "No rows found"}
      emptyDescription={rtl ? "لا توجد بيانات مطابقة للمرشحات الحالية." : "No rows match the current filters."}
      searchPlaceholder={rtl ? "ابحث داخل الجدول" : "Search this table"}
    />
  );
}

function getPreviewSectionsForReportSection(sectionId: ReportSectionId) {
  switch (sectionId) {
    case "savedReports":
      return [];
    case "sales":
      return ["daily", "bookingTrends"];
    case "financial":
      return ["financial", "discounts", "refunds", "paymentMethods"];
    case "appointments":
      return ["appointments", "bookingTrends"];
    case "rebookings":
      return ["rebookings"];
    case "employees":
      return ["employees", "employeePerformance"];
    case "services":
      return ["services", "servicePerformance"];
    case "products":
      return ["products"];
    case "discounts":
      return ["discounts"];
    case "refunds":
      return ["refunds"];
    case "paymentMethods":
      return ["paymentMethods"];
    case "customerSales":
      return ["customerSales"];
    case "overview":
    default:
      return ["overview"];
  }
}

type DrilldownTabId = "overview" | "source";

type DrilldownState = {
  title: ReactNode;
  subtitle?: ReactNode;
  summaryItems: Array<{ label: ReactNode; value: ReactNode; note?: ReactNode }>;
  tabs: Array<{ id: DrilldownTabId; label: ReactNode; description?: ReactNode }>;
  activeTab: DrilldownTabId;
  tabPanels: Record<DrilldownTabId, ReactNode>;
  actions?: ReactNode;
  sideNote?: ReactNode;
};

export default function ReportsPage() {
  const locale = useLocale();
  const router = useRouter();
  const isRTL = locale === "ar";

  const [activeSection, setActiveSection] = useState<ReportSectionId>("overview");
  const [savedReportTemplateSection, setSavedReportTemplateSection] = useState<ReportSectionId>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfDebug, setPdfDebug] = useState<ReportPdfDebugState | null>(null);
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
  const [customerSalesReport, setCustomerSalesReport] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [detailDrawer, setDetailDrawer] = useState<DrilldownState | null>(null);
  const [savedReportsLoading, setSavedReportsLoading] = useState(false);
  const [savedReportsError, setSavedReportsError] = useState("");
  const [exportError, setExportError] = useState("");
  const [savedReportTitle, setSavedReportTitle] = useState("");
  const [savedReportDescription, setSavedReportDescription] = useState("");
  const [savedReportFavorite, setSavedReportFavorite] = useState(false);
  const [savingSavedReport, setSavingSavedReport] = useState(false);

  const sidebarGroups: FinanceSidebarGroup[] = [
    {
      title: locale === "ar" ? "الأقسام" : "Sections",
      items: [
        { id: "overview", label: locale === "ar" ? "نظرة عامة" : "Overview" },
        { id: "savedReports", label: locale === "ar" ? "التقارير المحفوظة" : "Saved reports" },
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
      const [summaryRes, financialRes, trendsRes, servicesRes, employeesRes, productsRes, peakRes, customerRes, rebookingRes, refundsRes, paymentMethodsRes, posRes, customerSalesRes] = await Promise.allSettled([
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
        tenantApi.getPosClosingSummary({ date: endDate }),
        tenantApi.getFullReport({ startDate, endDate, sections: ["customerSales"] })
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

      if (customerSalesRes.status === "fulfilled" && customerSalesRes.value.success) {
        const reportData = customerSalesRes.value.data || {};
        setCustomerSalesReport(Array.isArray(reportData.customerSales) ? reportData.customerSales : []);
      } else {
        setCustomerSalesReport([]);
        failedSections.push(locale === "ar" ? "مبيعات العملاء" : "customer sales");
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

  const loadSavedReports = async () => {
    setSavedReportsLoading(true);
    setSavedReportsError("");
    try {
      const response = await tenantApi.getSavedReports();
      if (response?.success) {
        setSavedReports(Array.isArray(response.data) ? response.data : []);
      } else {
        setSavedReports([]);
        setSavedReportsError(locale === "ar" ? "تعذر تحميل التقارير المحفوظة" : "Failed to load saved reports");
      }
    } catch (err: any) {
      console.error("Failed to load saved reports:", err);
      setSavedReports([]);
      setSavedReportsError(err?.message || (locale === "ar" ? "تعذر تحميل التقارير المحفوظة" : "Failed to load saved reports"));
    } finally {
      setSavedReportsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, dateRange]);

  useEffect(() => {
    loadSavedReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSectionChange = (sectionId: string) => {
    const nextSection = sectionId as ReportSectionId;
    setActiveSection(nextSection);
    if (nextSection !== "savedReports") {
      setSavedReportTemplateSection(nextSection);
    }
  };

  const bookingTrendValues = useMemo(() => bookingTrends.map((item) => safeNumber(item.bookings)), [bookingTrends]);
  const revenueTrendValues = useMemo(() => bookingTrends.map((item) => safeNumber(item.revenue)), [bookingTrends]);
  const paymentMethodTrendValues = useMemo(
    () => (paymentMethodsReport?.trend || []).map((item: any) =>
      safeNumber(item.revenue ?? item.totalRevenue ?? item.collected ?? item.value)
    ),
    [paymentMethodsReport]
  );
  const customerSalesRows = useMemo(
    () => (customerSalesReport.length ? customerSalesReport : (customerAnalytics?.topCustomers || [])),
    [customerAnalytics, customerSalesReport]
  );
  const rebookingTrendValues = useMemo(
    () => (rebookingAnalytics?.trend || []).map((item: any) =>
      safeNumber(item.rebookedRevenue ?? item.revenue ?? item.totalRevenue ?? item.value)
    ),
    [rebookingAnalytics]
  );

  const exportSections = useMemo(() => getPreviewSectionsForReportSection(activeSection), [activeSection]);
  const savedReportTemplateSections = useMemo(
    () => getPreviewSectionsForReportSection(savedReportTemplateSection),
    [savedReportTemplateSection]
  );
  const savedReportDefaultTitle = useMemo(
    () => `${getReportSectionLabel(savedReportTemplateSection, locale)} - ${startDate} → ${endDate}`,
    [endDate, locale, savedReportTemplateSection, startDate]
  );
  const reportTitle = useMemo(() => {
    switch (activeSection) {
      case "savedReports":
        return locale === "ar" ? "التقارير المحفوظة" : "Saved reports";
      case "sales":
        return locale === "ar" ? "تقرير المبيعات" : "Sales report";
      case "financial":
        return locale === "ar" ? "التقرير المالي" : "Financial report";
      case "appointments":
        return locale === "ar" ? "تقرير المواعيد" : "Appointment report";
      case "rebookings":
        return locale === "ar" ? "تحليلات إعادة الحجز" : "Rebooking analytics";
      case "employees":
        return locale === "ar" ? "تقرير الموظفين" : "Employee report";
      case "services":
        return locale === "ar" ? "تقرير الخدمات" : "Service report";
      case "products":
        return locale === "ar" ? "تقرير المنتجات" : "Product report";
      case "discounts":
        return locale === "ar" ? "تقرير الخصومات" : "Discounts report";
      case "refunds":
        return locale === "ar" ? "تقرير الاستردادات" : "Refunds report";
      case "paymentMethods":
        return locale === "ar" ? "طرق الدفع" : "Payment methods";
      case "customerSales":
        return locale === "ar" ? "مبيعات العملاء" : "Customer sales";
      case "overview":
      default:
        return locale === "ar" ? "النظرة العامة" : "Overview";
    }
  }, [activeSection, locale]);

  const exportData = useMemo(() => ({
    overview: summary || financialOverview,
    summary,
    financialOverview,
    bookingTrends,
    dailyRevenue: bookingTrends,
    servicePerformance,
    employeePerformance,
    employees: employeePerformance,
    products: productRevenue?.rows || [],
    discounts: financialOverview?.discountTotals,
    refunds: refundsReport,
    paymentMethods: paymentMethodsReport,
    customerAnalytics,
    customerSales: customerSalesRows,
    rebookings: rebookingAnalytics,
    posClosingSummary
  }), [
    bookingTrends,
    customerAnalytics,
    customerSalesRows,
    employeePerformance,
    financialOverview,
    paymentMethodsReport,
    productRevenue?.rows,
    rebookingAnalytics,
    refundsReport,
    servicePerformance,
    summary
  ]);

  const exportTables = useMemo(
    () =>
      buildReportExportTables({
        locale,
        sections: exportSections,
        data: exportData
      }),
    [exportData, exportSections, locale]
  );

  const handleExportPdf = async () => {
    const startedAt = new Date();
    const requestUrl = `${process.env.NEXT_PUBLIC_API_URL || ""}/tenant/reports/pdf?${new URLSearchParams({
      startDate,
      endDate,
      sections: exportSections.join(","),
      title: reportTitle
    }).toString()}`;
    setPdfDebug({
      status: "running",
      startedAt: startedAt.toISOString(),
      requestUrl,
      startDate,
      endDate,
      sections: exportSections,
      title: reportTitle
    });
    try {
      setExportError("");
      const file = await exportPdf({
        startDate,
        endDate,
        sections: exportSections,
        title: reportTitle
      });
      setPdfDebug({
        status: "success",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        requestUrl,
        startDate,
        endDate,
        sections: exportSections,
        title: reportTitle,
        filename: file.filename
      });
    } catch (err: any) {
      console.error("Failed to download report PDF:", err);
      setPdfDebug({
        status: "failed",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        requestUrl,
        startDate,
        endDate,
        sections: exportSections,
        title: reportTitle,
        httpStatus: err?.status,
        statusText: err?.statusText,
        contentType: err?.contentType,
        errorMessage: err?.message,
        responseBody: err?.responsePreview || err?.responseBody
      });
      setExportError(err?.message || "Failed to download PDF.");
    }
  };

  const handleExportCsv = () => {
    exportCsv({
      fileName: reportTitle,
      reportTitle,
      startDate,
      endDate,
      sections: exportSections,
      tables: exportTables
    });
  };

  const handleExportExcel = async () => {
    try {
      setExportError("");
      await exportExcel({
        fileName: reportTitle,
        reportTitle,
        startDate,
        endDate,
        sections: exportSections,
        tables: exportTables
      });
    } catch (err: any) {
      console.error("Failed to download report Excel:", err);
      setExportError(err?.message || "Failed to download Excel.");
    }
  };

  const saveCurrentReportConfiguration = async () => {
    const title = savedReportTitle.trim() || savedReportDefaultTitle;
    const description = savedReportDescription.trim() || undefined;
    setSavingSavedReport(true);
    try {
      await tenantApi.createSavedReport({
        reportType: savedReportTemplateSection,
        title,
        description,
        sections: savedReportTemplateSections,
        filters: {
          startDate,
          endDate,
          dateRange
        },
        selectedMetrics: savedReportTemplateSections,
        grouping: dateRange === "year" ? "month" : "day",
        sorting: {
          field: "date",
          direction: "desc"
        },
        reportConfig: {
          title,
          description,
          startDate,
          endDate,
          dateRange,
          sections: savedReportTemplateSections
        },
        isFavorite: savedReportFavorite
      });
      setSavedReportTitle("");
      setSavedReportDescription("");
      setSavedReportFavorite(false);
      await loadSavedReports();
      setActiveSection("savedReports");
    } catch (err) {
      console.error("Failed to save report configuration:", err);
    } finally {
      setSavingSavedReport(false);
    }
  };

  const openSavedReport = async (savedReport: any) => {
    const sections = Array.isArray(savedReport.sections) && savedReport.sections.length
      ? savedReport.sections
      : getPreviewSectionsForReportSection(savedReport.reportType as ReportSectionId);
    const config = savedReport.reportConfig || {};
    const nextStartDate = config.startDate || savedReport.filters?.startDate || startDate;
    const nextEndDate = config.endDate || savedReport.filters?.endDate || endDate;

    try {
      await tenantApi.updateSavedReport(savedReport.id, {
        lastOpenedAt: new Date().toISOString()
      });
      await loadSavedReports();
    } catch (err) {
      console.error("Failed to mark saved report as opened:", err);
    }

    const query = new URLSearchParams({
      startDate: nextStartDate,
      endDate: nextEndDate,
      sections: sections.join(","),
      title: savedReport.title
    });

    if (config.notes || savedReport.description) {
      query.set("notes", config.notes || savedReport.description);
    }

    router.push(`/${locale}/dashboard/reports/preview?${query.toString()}`);
  };

  const duplicateSavedReport = async (savedReport: any) => {
    const copyTitle = `${savedReport.title} Copy`;
    try {
      await tenantApi.createSavedReport({
        reportType: savedReport.reportType,
        title: copyTitle,
        description: savedReport.description,
        sections: savedReport.sections,
        filters: savedReport.filters,
        selectedMetrics: savedReport.selectedMetrics,
        grouping: savedReport.grouping,
        sorting: savedReport.sorting,
        reportConfig: savedReport.reportConfig,
        isFavorite: Boolean(savedReport.isFavorite),
        duplicatedFromId: savedReport.id
      });
      await loadSavedReports();
    } catch (err) {
      console.error("Failed to duplicate saved report:", err);
    }
  };

  const toggleSavedReportFavorite = async (savedReport: any) => {
    try {
      await tenantApi.updateSavedReport(savedReport.id, {
        isFavorite: !savedReport.isFavorite
      });
      await loadSavedReports();
    } catch (err) {
      console.error("Failed to toggle saved report favorite:", err);
    }
  };

  const renameSavedReport = async (savedReport: any) => {
    const nextTitle = window.prompt(
      locale === "ar" ? "أدخل عنوانًا جديدًا" : "Enter a new title",
      savedReport.title
    );
    if (!nextTitle?.trim()) return;

    try {
      await tenantApi.updateSavedReport(savedReport.id, {
        title: nextTitle.trim()
      });
      await loadSavedReports();
    } catch (err) {
      console.error("Failed to rename saved report:", err);
    }
  };

  const deleteSavedReport = async (savedReport: any) => {
    const confirmed = window.confirm(
      locale === "ar"
        ? `حذف التقرير المحفوظ "${savedReport.title}"؟`
        : `Delete saved report "${savedReport.title}"?`
    );
    if (!confirmed) return;

    try {
      await tenantApi.deleteSavedReport(savedReport.id);
      await loadSavedReports();
    } catch (err) {
      console.error("Failed to delete saved report:", err);
    }
  };

  const openSummaryDetail = (config: {
    title: ReactNode;
    subtitle?: ReactNode;
    summaryItems: Array<{ label: ReactNode; value: ReactNode; note?: ReactNode }>;
    sourceHref?: string;
    sourceLabel?: ReactNode;
    sideNote?: ReactNode;
  }) => {
    setDetailDrawer({
      title: config.title,
      subtitle: config.subtitle,
      summaryItems: config.summaryItems,
      tabs: [
        { id: "overview", label: locale === "ar" ? "نظرة عامة" : "Overview" },
        { id: "source", label: locale === "ar" ? "المصدر" : "Source" }
      ],
      activeTab: "overview",
      tabPanels: {
        overview: (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
            {locale === "ar"
              ? "تفاصيل تفصيلية للعنصر المحدد."
              : "Detailed context for the selected analytics record."}
          </div>
        ),
        source: (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
            {config.sourceHref ? (
              <Link className="text-primary underline" href={config.sourceHref}>
                {config.sourceLabel || (locale === "ar" ? "فتح المصدر" : "Open source")}
              </Link>
            ) : (
              <span>{locale === "ar" ? "لا يوجد مصدر مباشر لهذا السطر." : "No direct source link exists for this row."}</span>
            )}
          </div>
        )
      },
      actions: config.sourceHref ? (
        <Link href={config.sourceHref} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
          {config.sourceLabel || (locale === "ar" ? "فتح المصدر" : "Open source")}
        </Link>
      ) : undefined,
      sideNote: config.sideNote
    });
  };

  const totalBookings = safeNumber(summary?.totalBookings ?? financialOverview?.totalBookings);
  const totalRevenue = safeNumber(summary?.totalRevenue ?? financialOverview?.totalRevenue);
  const tenantRevenue = safeNumber(financialOverview?.totalTenantRevenue);
  const avgBookingValue = safeNumber(summary?.avgBookingValue ?? financialOverview?.avgBookingValue);
  const completionRate = safeNumber(summary?.completionRate ?? financialOverview?.completionRate);
  const retentionRate = safeNumber(customerAnalytics?.retentionRate);
  const discountTotals = financialOverview?.discountTotals || null;

  const renderSectionWorkspace = () => {
    switch (activeSection) {
      case "overview":
        return (
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
                    rows={bookingTrends.map((trend) => [
                      trend.date,
                      safeNumber(trend.bookings),
                      safeNumber(trend.completed),
                      formatMoney(trend.revenue)
                    ])}
                    onRowClick={(index) => {
                      const row = bookingTrends[index];
                      if (!row) return;
                      openSummaryDetail({
                        title: row.date ? new Date(row.date).toLocaleDateString() : (locale === "ar" ? "اتجاه الحجز" : "Booking trend"),
                        subtitle: locale === "ar" ? "تفاصيل صف الاتجاه" : "Trend row detail",
                        summaryItems: [
                          { label: locale === "ar" ? "الحجوزات" : "Bookings", value: safeNumber(row.bookings) },
                          { label: locale === "ar" ? "المكتملة" : "Completed", value: safeNumber(row.completed) },
                          { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue) }
                        ],
                        sideNote: locale === "ar"
                          ? "هذا الصف يمثل بيانات مجمعة للنطاق الحالي."
                          : "This row reflects aggregated data for the current range."
                      });
                    }}
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
                  rows={servicePerformance.map((service) => [
                    locale === "ar" ? service.name_ar : service.name_en,
                    safeNumber(service.totalBookings),
                    formatMoney(service.revenue ?? service.totalRevenue)
                  ])}
                  onRowClick={(index) => {
                    const row = servicePerformance[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: locale === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar,
                      subtitle: locale === "ar" ? "تفاصيل الخدمة" : "Service drill-down",
                      summaryItems: [
                        { label: locale === "ar" ? "الحجوزات" : "Bookings", value: safeNumber(row.totalBookings) },
                        { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue ?? row.totalRevenue) }
                      ],
                      sourceHref: `/${locale}/dashboard/services/${row.id}`,
                      sourceLabel: locale === "ar" ? "فتح الخدمة" : "Open service"
                    });
                  }}
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
                  rows={(customerAnalytics?.topCustomers || []).map((customer: any) => [
                    customer.name || customer.id,
                    safeNumber(customer.bookings),
                    formatMoney(customer.revenue)
                  ])}
                  onRowClick={(index) => {
                    const row = customerAnalytics?.topCustomers?.[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: row.name || row.id,
                      subtitle: locale === "ar" ? "أعلى العملاء" : "Top customer",
                      summaryItems: [
                        { label: locale === "ar" ? "الحجوزات" : "Bookings", value: safeNumber(row.bookings) },
                        { label: locale === "ar" ? "المكتملة" : "Completed", value: safeNumber(row.completed) },
                        { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue) }
                      ],
                      sourceHref: row.id ? `/${locale}/dashboard/customers/${row.id}` : undefined,
                      sourceLabel: locale === "ar" ? "فتح العميل" : "Open customer"
                    });
                  }}
                  countLabel={
                    customerAnalytics?.topCustomers?.length
                      ? (locale === "ar"
                        ? `عرض أفضل ${customerAnalytics.topCustomers.length} سجلات`
                        : `Showing Top ${customerAnalytics.topCustomers.length} Records`)
                      : undefined
                  }
                  sourceLabel={locale === "ar" ? "العملاء" : "customers"}
                  totalRows={customerAnalytics?.topCustomers?.length}
                />
              </FinanceSectionCard>
            </div>
          </>
        );

      case "savedReports":
        return (
          <div className="space-y-5">
            <FinanceSectionCard
              title={locale === "ar" ? "التقارير المحفوظة" : "Saved reports"}
              subtitle={locale === "ar"
                ? "احفظ إعدادات التقرير الحالية وأعد فتحها أو نسخها أو تمييزها كمفضلة."
                : "Save the current report configuration and reopen, duplicate, or favorite it later."
              }
              action={
                <Link
                  href={`/${locale}/dashboard/reports/generate`}
                  className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {locale === "ar" ? "إنشاء تقرير جديد" : "Generate report"}
                </Link>
              }
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "نوع التقرير" : "Report type"}
                      </span>
                      <select
                        value={savedReportTemplateSection}
                        onChange={(event) => setSavedReportTemplateSection(event.target.value as ReportSectionId)}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {[
                          "overview",
                          "sales",
                          "financial",
                          "appointments",
                          "rebookings",
                          "employees",
                          "services",
                          "products",
                          "discounts",
                          "refunds",
                          "paymentMethods",
                          "customerSales"
                        ].map((section) => (
                          <option key={section} value={section}>
                            {getReportSectionLabel(section as ReportSectionId, locale)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {locale === "ar" ? "العنوان" : "Title"}
                      </span>
                      <input
                        type="text"
                        value={savedReportTitle}
                        onChange={(event) => setSavedReportTitle(event.target.value)}
                        placeholder={savedReportDefaultTitle}
                        className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {locale === "ar" ? "وصف مختصر" : "Description"}
                    </span>
                    <textarea
                      value={savedReportDescription}
                      onChange={(event) => setSavedReportDescription(event.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder={locale === "ar" ? "مثال: تقرير شهري للمبيعات" : "e.g. Monthly revenue summary"}
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={savedReportFavorite}
                      onChange={(event) => setSavedReportFavorite(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>{locale === "ar" ? "إضافة إلى المفضلة" : "Mark as favorite"}</span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={saveCurrentReportConfiguration}
                      disabled={savingSavedReport}
                      className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingSavedReport
                        ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...")
                        : (locale === "ar" ? "حفظ التقرير" : "Save report")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSavedReportTitle("");
                        setSavedReportDescription("");
                        setSavedReportFavorite(false);
                        setSavedReportTemplateSection(activeSection === "savedReports" ? "overview" : activeSection);
                      }}
                      className="rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {locale === "ar" ? "إعادة الضبط" : "Reset"}
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {locale === "ar" ? "الإعداد الحالي" : "Current configuration"}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "النوع" : "Type"}</div>
                      <div className="mt-1 font-semibold text-gray-900">{getReportSectionLabel(savedReportTemplateSection, locale)}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "الفترة" : "Date range"}</div>
                      <div className="mt-1 font-semibold text-gray-900">{startDate} → {endDate}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:col-span-2">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "الأقسام" : "Sections"}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {savedReportTemplateSections.map((section) => (
                          <span key={section} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-700">
                            {getReportSectionLabel(section as ReportSectionId, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:col-span-2">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "المفضلة" : "Favorite"}</div>
                      <div className="mt-1 font-semibold text-gray-900">{savedReportFavorite ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </FinanceSectionCard>

            <FinanceSectionCard
              title={locale === "ar" ? "المحفوظات" : "Saved presets"}
              subtitle={locale === "ar"
                ? "أعد فتح أو نسخ أو تعديل أي إعداد محفوظ دون إعادة بناء التقرير من الصفر."
                : "Reopen, duplicate, or edit saved presets without rebuilding the report from scratch."
              }
            >
              {savedReportsError ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {savedReportsError}
                </div>
              ) : null}

              {savedReportsLoading ? (
                <div className="space-y-3">
                  <div className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-gray-50" />
                  <div className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-gray-50" />
                </div>
              ) : savedReports.length ? (
                <div className="space-y-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    {savedReports.map((savedReport) => (
                      <article key={savedReport.id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className={`flex flex-col gap-3 ${isRTL ? "xl:flex-row-reverse" : "xl:flex-row"} xl:items-start xl:justify-between`}>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900">{savedReport.title}</h3>
                              {savedReport.isFavorite ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                  {locale === "ar" ? "مفضلة" : "Favorite"}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-gray-600">{getReportSectionLabel(savedReport.reportType as ReportSectionId, locale)}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                              <span className="rounded-full bg-gray-100 px-2.5 py-1">{savedReport.filters?.startDate || startDate} → {savedReport.filters?.endDate || endDate}</span>
                              <span className="rounded-full bg-gray-100 px-2.5 py-1">{savedReport.sections?.length || 0} {locale === "ar" ? "أقسام" : "sections"}</span>
                              {savedReport.lastOpenedAt ? (
                                <span className="rounded-full bg-gray-100 px-2.5 py-1">
                                  {locale === "ar" ? "آخر فتح" : "Last opened"} {new Date(savedReport.lastOpenedAt).toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                            {savedReport.description ? (
                              <p className="text-sm text-gray-500">{savedReport.description}</p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openSavedReport(savedReport)}
                              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                            >
                              {locale === "ar" ? "فتح" : "Open"}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSavedReportFavorite(savedReport)}
                              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              {savedReport.isFavorite ? (locale === "ar" ? "إلغاء المفضلة" : "Unfavorite") : (locale === "ar" ? "تفضيل" : "Favorite")}
                            </button>
                            <button
                              type="button"
                              onClick={() => renameSavedReport(savedReport)}
                              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              {locale === "ar" ? "إعادة تسمية" : "Rename"}
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateSavedReport(savedReport)}
                              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              {locale === "ar" ? "نسخ" : "Duplicate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedReport(savedReport)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              {locale === "ar" ? "حذف" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <FinanceEmptyState
                  title={locale === "ar" ? "لا توجد تقارير محفوظة" : "No saved reports"}
                  description={locale === "ar"
                    ? "احفظ إعدادًا من أي تقرير لتتمكن من إعادة فتحه لاحقًا."
                    : "Save a report configuration to reopen it later."
                  }
                />
              )}
            </FinanceSectionCard>
          </div>
        );

      case "sales":
        return (
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
        );

      case "financial":
        return (
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
        );

      case "appointments":
        return (
          <FinanceSectionCard title={locale === "ar" ? "تقرير المواعيد" : "Appointment report"}>
            <div className="grid gap-4 md:grid-cols-4">
              <FinanceMetricCard label={locale === "ar" ? "الإجمالي" : "Total"} value={totalBookings} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "المكتمل" : "Completed"} value={safeNumber(summary?.completedBookings)} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "الملغى" : "Cancelled"} value={safeNumber(summary?.cancelledBookings)} tone="rose" />
              <FinanceMetricCard label={locale === "ar" ? "عدم الحضور" : "No-shows"} value={safeNumber(summary?.noShowBookings)} tone="amber" />
            </div>
          </FinanceSectionCard>
        );

      case "rebookings":
        return (
          <FinanceSectionCard
            title={locale === "ar" ? "تحليلات إعادة الحجز" : "Rebooking analytics"}
            subtitle={locale === "ar" ? "معدل إعادة الحجز، العملاء المتكررين، والإيراد المعاد حجزه." : "Rebooking rate, repeat customers, rebooked revenue, and trend."}
          >
            {rebookingAnalytics ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "معدل إعادة الحجز" : "Rebooking rate"} value={formatPercent(rebookingAnalytics.totals?.rebookingRate)} tone="purple" />
                  <FinanceMetricCard label={locale === "ar" ? "عملاء متكررون" : "Repeat customers"} value={safeNumber(rebookingAnalytics.totals?.repeatCustomers)} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "إيراد معاد حجزه" : "Rebooked revenue"} value={formatMoney(rebookingAnalytics.totals?.rebookedRevenue)} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "الحجوزات المعادة" : "Rebooked appointments"} value={safeNumber(rebookingAnalytics.totals?.rebookedAppointments)} tone="amber" />
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
                      onRowClick={(index) => {
                        const row = rebookingAnalytics.topRebookingEmployees?.[index];
                        if (!row) return;
                        openSummaryDetail({
                          title: row.name,
                          subtitle: locale === "ar" ? "أعلى موظف لإعادة الحجز" : "Top rebooking employee",
                          summaryItems: [
                            { label: locale === "ar" ? "إعادة الحجز" : "Rebooked", value: safeNumber(row.rebookedAppointments ?? row.rebookingCount) },
                            { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.rebookedRevenue ?? row.revenue) }
                          ],
                          sourceHref: `/${locale}/dashboard/employees/${row.id}`,
                          sourceLabel: locale === "ar" ? "فتح الموظف" : "Open employee"
                        });
                      }}
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
                  onRowClick={(index) => {
                    const row = rebookingAnalytics.rows?.[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: row.customerName || row.customer || (locale === "ar" ? "إعادة حجز" : "Rebooking"),
                      subtitle: locale === "ar" ? "صف إعادة الحجز" : "Rebooking row detail",
                      summaryItems: [
                        { label: locale === "ar" ? "المرجع" : "Reference", value: row.reference || row.bookingNumber || "-" },
                        { label: locale === "ar" ? "إعادة الحجز" : "Rebooked", value: row.rebooked ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No") },
                        { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.rebookedRevenue ?? row.revenue ?? row.amount) }
                      ],
                      sideNote: locale === "ar"
                        ? "لا يوجد رابط مباشر لهذا الصف، لكنه يبقى قابلاً للمراجعة داخل التقرير."
                        : "This row has no direct source link but remains reviewable within the report."
                    });
                  }}
                />
              </div>
            ) : (
              <FinanceEmptyState
                title={locale === "ar" ? "لا توجد تحليلات إعادة الحجز" : "No rebooking analytics"}
                description={locale === "ar" ? "لم يتم العثور على بيانات إعادة حجز في هذا النطاق." : "No rebooking analytics are available for the selected range."}
              />
            )}
          </FinanceSectionCard>
        );

      case "employees":
        return (
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
              onRowClick={(index) => {
                const row = employeePerformance[index];
                if (!row) return;
                openSummaryDetail({
                  title: row.name,
                  subtitle: locale === "ar" ? "أداء الموظف" : "Employee performance",
                  summaryItems: [
                    { label: locale === "ar" ? "الحجوزات" : "Bookings", value: row.totalBookings ?? 0 },
                    { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue ?? row.totalRevenueGenerated) },
                    { label: locale === "ar" ? "العمولة" : "Commission", value: formatMoney(row.commission ?? row.totalCommission) }
                  ],
                  sourceHref: `/${locale}/dashboard/employees/${row.id}`,
                  sourceLabel: locale === "ar" ? "فتح الموظف" : "Open employee"
                });
              }}
            />
          </FinanceSectionCard>
        );

      case "services":
        return (
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
              onRowClick={(index) => {
                const row = servicePerformance[index];
                if (!row) return;
                openSummaryDetail({
                  title: locale === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar,
                  subtitle: locale === "ar" ? "تفاصيل الخدمة" : "Service drill-down",
                  summaryItems: [
                    { label: locale === "ar" ? "الحجوزات" : "Bookings", value: row.totalBookings ?? 0 },
                    { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue ?? row.totalRevenue) },
                    { label: locale === "ar" ? "معدل الإكمال" : "Completion %", value: `${safeNumber(row.completionRate).toFixed(1)}%` }
                  ],
                  sourceHref: `/${locale}/dashboard/services/${row.id}`,
                  sourceLabel: locale === "ar" ? "فتح الخدمة" : "Open service"
                });
              }}
            />
          </FinanceSectionCard>
        );

      case "products":
        return (
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
                  onRowClick={(index) => {
                    const row = productRevenue.rows?.[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: locale === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar,
                      subtitle: locale === "ar" ? "تفاصيل المنتج" : "Product detail",
                      summaryItems: [
                        { label: locale === "ar" ? "الطلبات" : "Orders", value: safeNumber(row.totalOrders) },
                        { label: locale === "ar" ? "الكمية" : "Quantity", value: safeNumber(row.totalQuantity) },
                        { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.totalRevenue) },
                        { label: locale === "ar" ? "إيراد المركز" : "Tenant revenue", value: formatMoney(row.totalTenantRevenue) }
                      ],
                      sourceHref: `/${locale}/dashboard/products/${row.id}`,
                      sourceLabel: locale === "ar" ? "فتح المنتج" : "Open product"
                    });
                  }}
                />
              </div>
            ) : (
              <FinanceEmptyState
                title={locale === "ar" ? "لا يوجد تقرير منتجات" : "No product report"}
                description={locale === "ar" ? "التقرير لا يحتوي على بيانات منتجات ضمن هذا النطاق." : "No product revenue data is available for this range."}
              />
            )}
          </FinanceSectionCard>
        );

      case "discounts":
        return (
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
                  onRowClick={(index) => {
                    const row = discountTotals.topDiscountedServices?.[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: locale === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar,
                      subtitle: locale === "ar" ? "أعلى الخصومات" : "Top discounted service",
                      summaryItems: [
                        { label: locale === "ar" ? "الحجوزات" : "Bookings", value: safeNumber(row.bookingCount) },
                        { label: locale === "ar" ? "الخصم" : "Discount", value: formatMoney(row.discountAmount) }
                      ],
                      sourceHref: `/${locale}/dashboard/services/${row.id}`,
                      sourceLabel: locale === "ar" ? "فتح الخدمة" : "Open service"
                    });
                  }}
                />
              </div>
            ) : (
              <FinanceEmptyState
                title={locale === "ar" ? "لا توجد خصومات مسجلة" : "No recorded discounts"}
                description={locale === "ar" ? "لم يتم العثور على حجوزات أو طلبات تحتوي على خصم ضمن هذا النطاق." : "No appointments or orders with discounts were found in the selected range."}
              />
            )}
          </FinanceSectionCard>
        );

      case "refunds":
        return (
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
                  onRowClick={(index) => {
                    const row = refundsReport.rows?.[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: row.reference || row.customer || (locale === "ar" ? "استرداد" : "Refund"),
                      subtitle: locale === "ar" ? "صف الاسترداد" : "Refund row detail",
                      summaryItems: [
                        { label: locale === "ar" ? "العميل" : "Customer", value: row.customer || "-" },
                        { label: locale === "ar" ? "المبلغ" : "Amount", value: formatMoney(row.amount) },
                        { label: locale === "ar" ? "طريقة الدفع" : "Payment method", value: row.paymentMethodLabel || "-" },
                        { label: locale === "ar" ? "النوع" : "Type", value: row.refundMode || "-" }
                      ],
                      sideNote: row.refundReason || undefined
                    });
                  }}
                />
              </div>
            ) : (
              <FinanceEmptyState
                title={locale === "ar" ? "لا توجد بيانات استرداد" : "No refund data"}
                description={locale === "ar" ? "لم نعثر على استردادات ضمن النطاق المحدد." : "No refund transactions were found in the selected range."}
              />
            )}
          </FinanceSectionCard>
        );

      case "paymentMethods":
        return (
          <FinanceSectionCard
            title={locale === "ar" ? "طرق الدفع" : "Payment methods"}
            subtitle={locale === "ar" ? "توزيع الإيراد والمعاملات حسب طريقة الدفع." : "Revenue and transaction distribution by payment method."}
          >
            {paymentMethodsReport?.rows?.length ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "إجمالي الإيراد" : "Total revenue"} value={formatMoney(paymentMethodsReport.totals?.revenue)} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "عدد العمليات" : "Transactions"} value={safeNumber(paymentMethodsReport.totals?.transactionCount)} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "أكبر حصة" : "Largest share"} value={paymentMethodsReport.rows?.length ? `${Math.max(...paymentMethodsReport.rows.map((row: any) => safeNumber(row.revenue))).toFixed(0)}` : "0"} tone="purple" />
                  <FinanceMetricCard label={locale === "ar" ? "اتجاه زمني" : "Trend points"} value={safeNumber(paymentMethodsReport.trend?.length)} tone="amber" />
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">{locale === "ar" ? "الاتجاه الزمني لطرق الدفع" : "Payment method trend"}</p>
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
                  onRowClick={(index) => {
                    const row = paymentMethodsReport.rows?.[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: row.paymentMethodLabel,
                      subtitle: locale === "ar" ? "طريقة الدفع" : "Payment method detail",
                      summaryItems: [
                        { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue) },
                        { label: locale === "ar" ? "العمليات" : "Transactions", value: safeNumber(row.transactionCount) },
                        { label: locale === "ar" ? "النسبة" : "Share", value: `${paymentMethodsReport.totals?.revenue ? ((safeNumber(row.revenue) / safeNumber(paymentMethodsReport.totals.revenue)) * 100).toFixed(1) : "0.0"}%` }
                      ],
                      sideNote: locale === "ar"
                        ? "هذه قراءة تجميعية وليست قائمة معاملات فردية."
                        : "This is an aggregate view rather than an individual transaction list."
                    });
                  }}
                />
              </div>
            ) : (
              <FinanceEmptyState
                title={locale === "ar" ? "لا توجد طرق دفع" : "No payment methods"}
                description={locale === "ar" ? "اختر نطاق تاريخ فيه معاملات مسجلة." : "Pick a range with recorded transactions."}
              />
            )}
          </FinanceSectionCard>
        );

      case "customerSales":
        return (
          <FinanceSectionCard
            title={locale === "ar" ? "مبيعات العملاء" : "Customer sales"}
            subtitle={locale === "ar"
              ? "عرض تفصيلي للعملاء، الهوية، والزيارات من التقرير الكامل."
              : "Detailed customer identity and visit data from the full report."}
          >
            {customerSalesRows.length || customerAnalytics ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "إجمالي العملاء" : "Total customers"} value={safeNumber(customerAnalytics?.totalCustomers)} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "عملاء جدد" : "New customers"} value={safeNumber(customerAnalytics?.newCustomers)} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "عملاء عائدون" : "Returning customers"} value={safeNumber(customerAnalytics?.returningCustomers)} tone="purple" />
                  <FinanceMetricCard label={locale === "ar" ? "الاحتفاظ" : "Retention"} value={formatPercent(customerAnalytics?.retentionRate)} tone="amber" />
                </div>
                <SectionTable
                  rtl={isRTL}
                  headers={[
                    locale === "ar" ? "العميل" : "Customer",
                    locale === "ar" ? "النوع" : "Type",
                    locale === "ar" ? "الهوية" : "Identity",
                    locale === "ar" ? "الحجوزات" : "Bookings",
                    locale === "ar" ? "المكتملة" : "Completed",
                    locale === "ar" ? "الإيراد" : "Revenue",
                    locale === "ar" ? "آخر زيارة" : "Last visit"
                  ]}
                  rows={customerSalesRows.map((customer: any) => [
                    <CustomerIdentityCell
                      name={customer.customerDisplayName || customer.customerName || customer.customer || customer.name || customer.id || "-"}
                      badge={customer.customerBadge || (customer.customerType === "registered_customer"
                        ? (locale === "ar" ? "عميل مسجل" : "Registered Customer")
                        : customer.customerType === "walk_in_customer"
                          ? (locale === "ar" ? "عميل زيارة" : "Walk-In Customer")
                          : (locale === "ar" ? "ضيف" : "Guest Customer"))}
                      identityLine={customer.customerIdentityLine || customer.email || customer.phone || customer.id || ""}
                      rtl={isRTL}
                    />,
                    customer.customerType || customer.type || "-",
                    customer.customerIdentityLine || customer.email || customer.phone || customer.id || "-",
                    safeNumber(customer.bookings ?? customer.visits),
                    safeNumber(customer.completed ?? customer.visits),
                    formatMoney(customer.revenue ?? customer.totalSpent),
                    customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : "-"
                  ])}
                  onRowClick={(index) => {
                    const row = customerSalesRows[index];
                    if (!row) return;
                    openSummaryDetail({
                      title: row.customerDisplayName || row.customerName || row.name || row.id || (locale === "ar" ? "عميل" : "Customer"),
                      subtitle: locale === "ar" ? "تفاصيل العميل" : "Customer detail",
                      summaryItems: [
                        { label: locale === "ar" ? "النوع" : "Type", value: row.customerType || row.type || "-" },
                        { label: locale === "ar" ? "الهوية" : "Identity", value: row.customerIdentityLine || row.email || row.phone || row.id || "-" },
                        { label: locale === "ar" ? "الحجوزات" : "Bookings", value: safeNumber(row.bookings ?? row.visits) },
                        { label: locale === "ar" ? "المكتملة" : "Completed", value: safeNumber(row.completed ?? row.visits) },
                        { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue ?? row.totalSpent) }
                      ],
                      sourceHref: row.id ? `/${locale}/dashboard/customers/${row.id}` : undefined,
                      sourceLabel: locale === "ar" ? "فتح العميل" : "Open customer"
                    });
                  }}
                  countLabel={
                    (customerSalesRows.length || customerAnalytics?.topCustomers?.length)
                      ? (locale === "ar"
                        ? `عرض ${customerSalesRows.length} سجلات`
                        : `Showing ${customerSalesRows.length} records`)
                      : undefined
                  }
                  sourceLabel={locale === "ar" ? "العملاء" : "customers"}
                  totalRows={customerSalesRows.length}
                />
              </div>
            ) : (
              <FinanceEmptyState
                title={locale === "ar" ? "لا توجد تحليلات العملاء" : "No customer analytics"}
                description={locale === "ar" ? "البيانات غير متاحة لهذا النطاق." : "No analytics are available for this date range."}
              />
            )}
          </FinanceSectionCard>
        );

      default:
        return null;
    }
  };

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
        onSectionChange={handleSectionChange}
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
        toolbarExtras={
          activeSection === "savedReports"
            ? null
            : (
          <ReportExportToolbar
            locale={locale}
            previewHref={`/${locale}/dashboard/reports/preview?${new URLSearchParams({
              startDate,
              endDate,
              sections: exportSections.join(","),
              title: reportTitle
            }).toString()}`}
            onExportPdf={handleExportPdf}
            onExportCsv={handleExportCsv}
            onExportExcel={handleExportExcel}
            onPrint={printReport}
            disabled={loading}
          />
            )
        }
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
        <ReportPdfDebugPanel
          locale={locale}
          debug={pdfDebug}
          onClear={() => setPdfDebug(null)}
        />

        {exportError ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {exportError}
          </div>
        ) : null}

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
            {renderSectionWorkspace()}
          </div>
        )}

        {detailDrawer ? (
          <AnalyticsDetailsDrawer
            open
            title={detailDrawer.title}
            subtitle={detailDrawer.subtitle}
            onClose={() => setDetailDrawer(null)}
            summaryItems={detailDrawer.summaryItems}
            tabs={detailDrawer.tabs}
            activeTab={detailDrawer.activeTab}
            onTabChange={(tabId) => setDetailDrawer((current) => current ? { ...current, activeTab: tabId as DrilldownTabId } : current)}
            tabPanels={detailDrawer.tabPanels}
            actions={detailDrawer.actions}
            sideNote={detailDrawer.sideNote}
          />
        ) : null}
      </FinanceWorkspaceShell>
    </TenantLayout>
  );
}
