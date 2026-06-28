"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import {
  AnalyticsDataTable
} from "@/components/AnalyticsDataTable";
import {
  AnalyticsDetailsDrawer
} from "@/components/AnalyticsDetailsDrawer";
import {
  FinanceEmptyState,
  FinanceMetricCard,
  FinanceSectionCard,
  FinanceWorkspaceShell,
  type FinanceSidebarGroup
} from "@/components/FinanceWorkspaceShell";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";
import { exportCsv, exportExcel } from "@/lib/reportExportService";

type LedgerSectionId =
  | "revenueLedger"
  | "paymentLedger"
  | "refundLedger"
  | "commissionLedger"
  | "settlementLedger";

type LedgerRow = Record<string, any>;

type LedgerTableConfig = {
  id: LedgerSectionId;
  label: string;
  description: string;
  sourceLabel: string;
  rows: LedgerRow[];
  columns: Array<{
    id: string;
    header: string;
    align?: "left" | "center" | "right";
  }>;
  renderRow: (row: LedgerRow) => ReactNode[];
  exportColumns: string[];
  exportRow: (row: LedgerRow) => Array<string | number | boolean | null>;
  detailsTitle: (row: LedgerRow) => string;
  detailsSubtitle: (row: LedgerRow) => string;
  summaryItems: (row: LedgerRow) => Array<{ label: string; value: ReactNode; note?: ReactNode }>;
  sourceTabTitle: string;
  sourceTabDescription: string;
};

type LedgerDetailState = {
  title: string;
  subtitle: string;
  summaryItems: Array<{ label: string; value: ReactNode; note?: ReactNode }>;
  sourceJson: string;
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateInput(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
}

function formatMoney(value: unknown) {
  return <Currency amount={safeNumber(value)} />;
}

function formatDateTime(value: unknown, locale: string) {
  if (!value) return "—";
  const date = new Date(`${value}`);
  if (Number.isNaN(date.getTime())) return `${value}`;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatDateOnly(value: unknown, locale: string) {
  if (!value) return "—";
  const date = new Date(`${value}`);
  if (Number.isNaN(date.getTime())) return `${value}`;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium"
  }).format(date);
}

function buildExportTable(config: LedgerTableConfig, locale: string, startDate: string, endDate: string) {
  return {
    title: config.label,
    columns: config.exportColumns,
    rows: config.rows.map((row) => config.exportRow(row)),
    metadataRows: [
      [locale === "ar" ? "من" : "From", startDate],
      [locale === "ar" ? "إلى" : "To", endDate],
      [locale === "ar" ? "إجمالي السجلات" : "Total rows", config.rows.length]
    ] as Array<[string, string | number]>
  };
}

export default function FinancialLedgerPage() {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState(() => formatDateInput(-29));
  const [endDate, setEndDate] = useState(() => formatDateInput(0));
  const [activeSection, setActiveSection] = useState<LedgerSectionId>("revenueLedger");
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [downloadBusy, setDownloadBusy] = useState<"csv" | "xlsx" | null>(null);
  const [detail, setDetail] = useState<LedgerDetailState | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "source">("overview");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await tenantApi.getFinancialLedger({ startDate, endDate });
        if (!isMounted) return;
        if (response?.success) {
          setLedgerData(response);
        } else {
          setError(response?.message || (locale === "ar" ? "فشل تحميل السجل المالي" : "Failed to load ledger"));
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل السجل المالي" : "Failed to load ledger"));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [endDate, locale, startDate]);

  const sidebarGroups: FinanceSidebarGroup[] = [
    {
      title: locale === "ar" ? "السجل المالي" : "Financial ledger",
      items: [
        { id: "revenueLedger", label: locale === "ar" ? "إيراد المبيعات" : "Revenue ledger", description: locale === "ar" ? "المبيعات والحجوزات" : "Bookings and sales revenue", badge: ledgerData?.revenueLedger?.totals?.totalRows || 0 },
        { id: "paymentLedger", label: locale === "ar" ? "سجل المدفوعات" : "Payment ledger", description: locale === "ar" ? "المدفوعات حسب العملية" : "Payments by transaction", badge: ledgerData?.paymentLedger?.totals?.totalRows || 0 },
        { id: "refundLedger", label: locale === "ar" ? "سجل الاستردادات" : "Refund ledger", description: locale === "ar" ? "الاستردادات وأسبابها" : "Refund rows and reasons", badge: ledgerData?.refundLedger?.totals?.totalRows || 0 },
        { id: "commissionLedger", label: locale === "ar" ? "سجل العمولات" : "Commission ledger", description: locale === "ar" ? "العوائد والعمولات" : "Revenue, paid, and outstanding commission", badge: ledgerData?.commissionLedger?.totals?.totalRows || 0 },
        { id: "settlementLedger", label: locale === "ar" ? "سجل التسوية" : "Settlement ledger", description: locale === "ar" ? "الإغلاق والتحصيل" : "Closing and net collected", badge: ledgerData?.settlementLedger?.totals?.totalRows || 0 }
      ]
    }
  ];

  const currentSection = useMemo(() => {
    const sections: Record<LedgerSectionId, LedgerTableConfig> = {
      revenueLedger: {
        id: "revenueLedger",
        label: locale === "ar" ? "سجل الإيراد" : "Revenue ledger",
        description: locale === "ar" ? "تفاصيل الإيرادات لكل عملية مع الضرائب والخصومات" : "Revenue rows per transaction with tax and discount context",
        sourceLabel: locale === "ar" ? "الإيرادات" : "revenue rows",
        rows: ledgerData?.revenueLedger?.rows || [],
        columns: [
          { id: "date", header: locale === "ar" ? "التاريخ" : "Date" },
          { id: "reference", header: locale === "ar" ? "المرجع" : "Reference" },
          { id: "customer", header: locale === "ar" ? "العميل" : "Customer" },
          { id: "employee", header: locale === "ar" ? "الموظف" : "Employee" },
          { id: "service", header: locale === "ar" ? "الخدمة" : "Service" },
          { id: "revenue", header: locale === "ar" ? "الإيراد" : "Revenue", align: "right" },
          { id: "tax", header: locale === "ar" ? "الضريبة" : "Tax", align: "right" },
          { id: "discount", header: locale === "ar" ? "الخصم" : "Discount", align: "right" },
          { id: "paymentMethod", header: locale === "ar" ? "طريقة الدفع" : "Payment method" },
          { id: "status", header: locale === "ar" ? "الحالة" : "Status" }
        ],
        renderRow: (row) => [
          formatDateTime(row.date, locale),
          row.reference || "—",
          row.customer || "—",
          row.employee || "—",
          row.service || "—",
          formatMoney(row.revenue),
          formatMoney(row.tax),
          formatMoney(row.discount),
          row.paymentMethodLabel || row.paymentMethod || "—",
          row.status || "—"
        ],
        exportColumns: [
          locale === "ar" ? "التاريخ" : "Date",
          locale === "ar" ? "المرجع" : "Reference",
          locale === "ar" ? "العميل" : "Customer",
          locale === "ar" ? "الموظف" : "Employee",
          locale === "ar" ? "الخدمة" : "Service",
          locale === "ar" ? "الإيراد" : "Revenue",
          locale === "ar" ? "الضريبة" : "Tax",
          locale === "ar" ? "الخصم" : "Discount",
          locale === "ar" ? "طريقة الدفع" : "Payment method",
          locale === "ar" ? "الحالة" : "Status"
        ],
        exportRow: (row) => [
          formatDateTime(row.date, locale),
          row.reference || "",
          row.customer || "",
          row.employee || "",
          row.service || "",
          safeNumber(row.revenue),
          safeNumber(row.tax),
          safeNumber(row.discount),
          row.paymentMethodLabel || row.paymentMethod || "",
          row.status || ""
        ],
        detailsTitle: (row) => `${locale === "ar" ? "إيراد" : "Revenue"} · ${row.reference || "—"}`,
        detailsSubtitle: (row) => row.customer || row.service || "",
        summaryItems: (row) => [
          { label: locale === "ar" ? "الإيراد" : "Revenue", value: formatMoney(row.revenue) },
          { label: locale === "ar" ? "الضريبة" : "Tax", value: formatMoney(row.tax) },
          { label: locale === "ar" ? "الخصم" : "Discount", value: formatMoney(row.discount) },
          { label: locale === "ar" ? "طريقة الدفع" : "Payment method", value: row.paymentMethodLabel || row.paymentMethod || "—" }
        ],
        sourceTabTitle: locale === "ar" ? "السجل الخام" : "Raw record",
        sourceTabDescription: locale === "ar" ? "البيانات المستخدمة لتكوين هذا الصف." : "The source data behind this row."
      },
      paymentLedger: {
        id: "paymentLedger",
        label: locale === "ar" ? "سجل المدفوعات" : "Payment ledger",
        description: locale === "ar" ? "كل حركة دفع مرتبطة بالحجوزات أو الطلبات" : "Each payment movement tied to appointments or orders",
        sourceLabel: locale === "ar" ? "المدفوعات" : "payment rows",
        rows: ledgerData?.paymentLedger?.rows || [],
        columns: [
          { id: "date", header: locale === "ar" ? "التاريخ" : "Date" },
          { id: "reference", header: locale === "ar" ? "المرجع" : "Reference" },
          { id: "customer", header: locale === "ar" ? "العميل" : "Customer" },
          { id: "method", header: locale === "ar" ? "الطريقة" : "Method" },
          { id: "amount", header: locale === "ar" ? "المبلغ" : "Amount", align: "right" },
          { id: "type", header: locale === "ar" ? "النوع" : "Type" },
          { id: "status", header: locale === "ar" ? "الحالة" : "Status" }
        ],
        renderRow: (row) => [
          formatDateTime(row.date, locale),
          row.reference || "—",
          row.customer || "—",
          row.method || "—",
          formatMoney(row.amount),
          row.type || "—",
          row.status || "—"
        ],
        exportColumns: [
          locale === "ar" ? "التاريخ" : "Date",
          locale === "ar" ? "المرجع" : "Reference",
          locale === "ar" ? "العميل" : "Customer",
          locale === "ar" ? "الطريقة" : "Method",
          locale === "ar" ? "المبلغ" : "Amount",
          locale === "ar" ? "النوع" : "Type",
          locale === "ar" ? "الحالة" : "Status"
        ],
        exportRow: (row) => [
          formatDateTime(row.date, locale),
          row.reference || "",
          row.customer || "",
          row.method || "",
          safeNumber(row.amount),
          row.type || "",
          row.status || ""
        ],
        detailsTitle: (row) => `${locale === "ar" ? "دفعة" : "Payment"} · ${row.reference || "—"}`,
        detailsSubtitle: (row) => row.customer || row.method || "",
        summaryItems: (row) => [
          { label: locale === "ar" ? "المبلغ" : "Amount", value: formatMoney(row.amount) },
          { label: locale === "ar" ? "الطريقة" : "Method", value: row.method || "—" },
          { label: locale === "ar" ? "النوع" : "Type", value: row.type || "—" },
          { label: locale === "ar" ? "الحالة" : "Status", value: row.status || "—" }
        ],
        sourceTabTitle: locale === "ar" ? "تفاصيل العملية" : "Transaction details",
        sourceTabDescription: locale === "ar" ? "البيانات الخام المرتبطة بحركة الدفع." : "The raw fields associated with the payment movement."
      },
      refundLedger: {
        id: "refundLedger",
        label: locale === "ar" ? "سجل الاستردادات" : "Refund ledger",
        description: locale === "ar" ? "الاستردادات مع السبب وطريقة المعالجة" : "Refund rows with reason and method context",
        sourceLabel: locale === "ar" ? "الاستردادات" : "refund rows",
        rows: ledgerData?.refundLedger?.rows || [],
        columns: [
          { id: "date", header: locale === "ar" ? "التاريخ" : "Date" },
          { id: "customer", header: locale === "ar" ? "العميل" : "Customer" },
          { id: "amount", header: locale === "ar" ? "قيمة الاسترداد" : "Refund amount", align: "right" },
          { id: "reason", header: locale === "ar" ? "السبب" : "Reason" },
          { id: "employee", header: locale === "ar" ? "الموظف" : "Employee" },
          { id: "method", header: locale === "ar" ? "الطريقة" : "Method" }
        ],
        renderRow: (row) => [
          formatDateTime(row.date, locale),
          row.customer || "—",
          formatMoney(row.amount),
          row.reason || "—",
          row.employee || "—",
          row.methodLabel || row.method || "—"
        ],
        exportColumns: [
          locale === "ar" ? "التاريخ" : "Date",
          locale === "ar" ? "العميل" : "Customer",
          locale === "ar" ? "قيمة الاسترداد" : "Refund amount",
          locale === "ar" ? "السبب" : "Reason",
          locale === "ar" ? "الموظف" : "Employee",
          locale === "ar" ? "الطريقة" : "Method"
        ],
        exportRow: (row) => [
          formatDateTime(row.date, locale),
          row.customer || "",
          safeNumber(row.amount),
          row.reason || "",
          row.employee || "",
          row.methodLabel || row.method || ""
        ],
        detailsTitle: (row) => `${locale === "ar" ? "استرداد" : "Refund"} · ${row.customer || "—"}`,
        detailsSubtitle: (row) => row.reference || row.reason || "",
        summaryItems: (row) => [
          { label: locale === "ar" ? "قيمة الاسترداد" : "Refund amount", value: formatMoney(row.amount) },
          { label: locale === "ar" ? "السبب" : "Reason", value: row.reason || "—" },
          { label: locale === "ar" ? "الطريقة" : "Method", value: row.methodLabel || row.method || "—" }
        ],
        sourceTabTitle: locale === "ar" ? "الصف الخام" : "Raw row",
        sourceTabDescription: locale === "ar" ? "تفاصيل الاسترداد الخام." : "The source fields used for this refund row."
      },
      commissionLedger: {
        id: "commissionLedger",
        label: locale === "ar" ? "سجل العمولات" : "Commission ledger",
        description: locale === "ar" ? "الإيراد والعمولات المستحقة والمدفوعة" : "Revenue generated versus paid and outstanding commissions",
        sourceLabel: locale === "ar" ? "العمولات" : "commission rows",
        rows: ledgerData?.commissionLedger?.rows || [],
        columns: [
          { id: "employee", header: locale === "ar" ? "الموظف" : "Employee" },
          { id: "revenueGenerated", header: locale === "ar" ? "الإيراد الناتج" : "Revenue generated", align: "right" },
          { id: "commissionEarned", header: locale === "ar" ? "العمولة المستحقة" : "Commission earned", align: "right" },
          { id: "commissionPaid", header: locale === "ar" ? "العمولة المدفوعة" : "Commission paid", align: "right" },
          { id: "commissionOutstanding", header: locale === "ar" ? "العمولة المتبقية" : "Commission outstanding", align: "right" },
          { id: "latestStatus", header: locale === "ar" ? "حالة التسوية" : "Settlement status" }
        ],
        renderRow: (row) => [
          row.employee || "—",
          formatMoney(row.revenueGenerated),
          formatMoney(row.commissionEarned),
          formatMoney(row.commissionPaid),
          formatMoney(row.commissionOutstanding),
          row.latestStatus || "—"
        ],
        exportColumns: [
          locale === "ar" ? "الموظف" : "Employee",
          locale === "ar" ? "الإيراد الناتج" : "Revenue generated",
          locale === "ar" ? "العمولة المستحقة" : "Commission earned",
          locale === "ar" ? "العمولة المدفوعة" : "Commission paid",
          locale === "ar" ? "العمولة المتبقية" : "Commission outstanding",
          locale === "ar" ? "حالة التسوية" : "Settlement status"
        ],
        exportRow: (row) => [
          row.employee || "",
          safeNumber(row.revenueGenerated),
          safeNumber(row.commissionEarned),
          safeNumber(row.commissionPaid),
          safeNumber(row.commissionOutstanding),
          row.latestStatus || ""
        ],
        detailsTitle: (row) => `${locale === "ar" ? "عمولة" : "Commission"} · ${row.employee || "—"}`,
        detailsSubtitle: (row) => locale === "ar" ? "نظرة على الإيراد والعمولة والتسوية." : "Revenue, earned commission, and settlement status.",
        summaryItems: (row) => [
          { label: locale === "ar" ? "الإيراد الناتج" : "Revenue generated", value: formatMoney(row.revenueGenerated) },
          { label: locale === "ar" ? "العمولة المستحقة" : "Commission earned", value: formatMoney(row.commissionEarned) },
          { label: locale === "ar" ? "العمولة المدفوعة" : "Commission paid", value: formatMoney(row.commissionPaid) },
          { label: locale === "ar" ? "العمولة المتبقية" : "Commission outstanding", value: formatMoney(row.commissionOutstanding) }
        ],
        sourceTabTitle: locale === "ar" ? "الصف الخام" : "Raw row",
        sourceTabDescription: locale === "ar" ? "بيانات العمولات المجمعة من المبيعات والرواتب." : "The commission row assembled from sales and payroll data."
      },
      settlementLedger: {
        id: "settlementLedger",
        label: locale === "ar" ? "سجل التسوية" : "Settlement ledger",
        description: locale === "ar" ? "الإجمالي الخام وصافي التحصيل حسب اليوم" : "Gross revenue, refunds, and net collected by day",
        sourceLabel: locale === "ar" ? "التسويات" : "settlement rows",
        rows: ledgerData?.settlementLedger?.rows || [],
        columns: [
          { id: "date", header: locale === "ar" ? "التاريخ" : "Date" },
          { id: "grossRevenue", header: locale === "ar" ? "الإيراد الخام" : "Gross revenue", align: "right" },
          { id: "refunds", header: locale === "ar" ? "الاستردادات" : "Refunds", align: "right" },
          { id: "netCollected", header: locale === "ar" ? "صافي التحصيل" : "Net collected", align: "right" },
          { id: "cash", header: locale === "ar" ? "نقدي" : "Cash", align: "right" },
          { id: "card", header: locale === "ar" ? "بطاقات" : "Card", align: "right" },
          { id: "wallet", header: locale === "ar" ? "المحفظة" : "Wallet", align: "right" }
        ],
        renderRow: (row) => [
          formatDateOnly(row.date, locale),
          formatMoney(row.grossRevenue),
          formatMoney(row.refunds),
          formatMoney(row.netCollected),
          formatMoney(row.cash),
          formatMoney(row.card),
          formatMoney(row.wallet)
        ],
        exportColumns: [
          locale === "ar" ? "التاريخ" : "Date",
          locale === "ar" ? "الإيراد الخام" : "Gross revenue",
          locale === "ar" ? "الاستردادات" : "Refunds",
          locale === "ar" ? "صافي التحصيل" : "Net collected",
          locale === "ar" ? "نقدي" : "Cash",
          locale === "ar" ? "بطاقات" : "Card",
          locale === "ar" ? "المحفظة" : "Wallet"
        ],
        exportRow: (row) => [
          formatDateOnly(row.date, locale),
          safeNumber(row.grossRevenue),
          safeNumber(row.refunds),
          safeNumber(row.netCollected),
          safeNumber(row.cash),
          safeNumber(row.card),
          safeNumber(row.wallet)
        ],
        detailsTitle: (row) => `${locale === "ar" ? "تسوية" : "Settlement"} · ${row.date || "—"}`,
        detailsSubtitle: (row) => locale === "ar" ? "يوم التسوية والطرق المستخدمة في التحصيل." : "Settlement day and the payment mix used to collect it.",
        summaryItems: (row) => [
          { label: locale === "ar" ? "الإيراد الخام" : "Gross revenue", value: formatMoney(row.grossRevenue) },
          { label: locale === "ar" ? "الاستردادات" : "Refunds", value: formatMoney(row.refunds) },
          { label: locale === "ar" ? "صافي التحصيل" : "Net collected", value: formatMoney(row.netCollected) },
          { label: locale === "ar" ? "نقدي" : "Cash", value: formatMoney(row.cash) }
        ],
        sourceTabTitle: locale === "ar" ? "الصف الخام" : "Raw row",
        sourceTabDescription: locale === "ar" ? "تفاصيل التسوية اليومية الخام." : "The raw daily settlement values."
      }
    };

    return sections[activeSection];
  }, [activeSection, ledgerData, locale]);

  const overview = ledgerData?.overview || {};
  const currentExportTable = useMemo(
    () => buildExportTable(currentSection, locale, startDate, endDate),
    [currentSection, endDate, locale, startDate]
  );

  const handleExportCsv = async () => {
    setDownloadBusy("csv");
    try {
      await exportCsv({
        reportTitle: currentSection.label,
        startDate,
        endDate,
        sections: [currentSection.id],
        tables: [currentExportTable],
        notes: locale === "ar"
          ? "تم تصدير بيانات السجل المالي الحالية بدون تغيير الحسابات."
          : "Current financial ledger rows exported without changing calculations."
      });
    } finally {
      setDownloadBusy(null);
    }
  };

  const handleExportExcel = async () => {
    setDownloadBusy("xlsx");
    try {
      await exportExcel({
        reportTitle: currentSection.label,
        startDate,
        endDate,
        sections: [currentSection.id],
        tables: [currentExportTable],
        notes: locale === "ar"
          ? "تم تصدير بيانات السجل المالي الحالية بدون تغيير الحسابات."
          : "Current financial ledger rows exported without changing calculations."
      });
    } finally {
      setDownloadBusy(null);
    }
  };

  const openDetails = (row: LedgerRow) => {
    setDetailTab("overview");
    setDetail({
      title: currentSection.detailsTitle(row),
      subtitle: currentSection.detailsSubtitle(row),
      summaryItems: currentSection.summaryItems(row),
      sourceJson: JSON.stringify(row, null, 2)
    });
  };

  const drawerTabs = {
    overview: locale === "ar" ? "نظرة عامة" : "Overview",
    source: locale === "ar" ? "المصدر" : "Source"
  };

  return (
    <TenantLayout>
      <FinanceWorkspaceShell
        title={locale === "ar" ? "السجل المالي" : "Financial ledger"}
        subtitle={locale === "ar"
          ? "مساحة استكشاف مالية تجمع الإيرادات والمدفوعات والاستردادات والعمولات والتسويات في جدول enterprise-grade."
          : "An enterprise-grade ledger workspace for revenue, payments, refunds, commissions, and settlements."
        }
        locale={locale}
        sidebarGroups={sidebarGroups}
        activeSection={activeSection}
        onSectionChange={(sectionId) => setActiveSection(sectionId as LedgerSectionId)}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        actions={
          <>
            <Link
              href={`/${locale}/dashboard/financial`}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {locale === "ar" ? "العودة للمالية" : "Back to finance"}
            </Link>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || !!error || downloadBusy !== null}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadBusy === "csv" ? (locale === "ar" ? "تصدير CSV..." : "Exporting CSV...") : (locale === "ar" ? "CSV" : "CSV")}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || !!error || downloadBusy !== null}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadBusy === "xlsx" ? (locale === "ar" ? "تصدير Excel..." : "Exporting Excel...") : (locale === "ar" ? "Excel" : "Excel")}
            </button>
          </>
        }
      >
        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-white" />
              ))}
            </div>
            <div className="h-[34rem] animate-pulse rounded-3xl border border-gray-200 bg-white" />
          </div>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard
                label={locale === "ar" ? "إجمالي الإيراد" : "Total revenue"}
                value={formatMoney(overview.totalRevenue)}
                tone="green"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "إجمالي الاستردادات" : "Total refunds"}
                value={formatMoney(overview.totalRefunds)}
                tone="rose"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "صافي التحصيل" : "Net collected"}
                value={formatMoney(overview.netCollected)}
                tone="blue"
              />
              <FinanceMetricCard
                label={locale === "ar" ? "العمولات المتبقية" : "Commission outstanding"}
                value={formatMoney(overview.totalCommissionOutstanding)}
                tone="amber"
              />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard
                label={locale === "ar" ? "عدد العمليات" : "Transactions"}
                value={safeNumber(overview.totalTransactions)}
              />
              <FinanceMetricCard
                label={locale === "ar" ? "الضريبة" : "Tax"}
                value={formatMoney(overview.totalTax)}
              />
              <FinanceMetricCard
                label={locale === "ar" ? "الخصومات" : "Discounts"}
                value={formatMoney(overview.totalDiscount)}
              />
              <FinanceMetricCard
                label={locale === "ar" ? "العمولات المدفوعة" : "Commission paid"}
                value={formatMoney(overview.totalCommissionPaid)}
              />
            </section>

            <FinanceSectionCard
              title={currentSection.label}
              subtitle={currentSection.description}
              action={
                currentSection.rows.length ? (
                  <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {currentSection.rows.length} {locale === "ar" ? "سجل" : "rows"}
                  </div>
                ) : null
              }
            >
              {currentSection.rows.length ? (
                <AnalyticsDataTable
                  title={currentSection.label}
                  subtitle={locale === "ar"
                    ? "يمكن البحث والترتيب والتنقل بين الصفحات، مع فتح تفاصيل المصدر من خلال النقر على الصف."
                    : "Search, sort, paginate, and open source details by clicking a row."
                  }
                  columns={currentSection.columns}
                  rows={currentSection.rows.map((row) => currentSection.renderRow(row))}
                  onRowClick={(index) => {
                    const row = currentSection.rows[index];
                    if (row) openDetails(row);
                  }}
                  sourceLabel={currentSection.sourceLabel}
                  totalRows={currentSection.rows.length}
                  emptyTitle={locale === "ar" ? "لا توجد بيانات" : "No data"}
                  emptyDescription={locale === "ar" ? "لا توجد سجلات ضمن النطاق الحالي." : "No records exist for the selected range."}
                  searchPlaceholder={locale === "ar" ? "ابحث داخل هذا السجل" : "Search this ledger"}
                />
              ) : (
                <FinanceEmptyState
                  title={locale === "ar" ? "لا توجد بيانات" : "No data"}
                  description={locale === "ar" ? "لا توجد سجلات ضمن النطاق الحالي." : "No records exist for the selected range."}
                />
              )}
            </FinanceSectionCard>
          </div>
        )}
      </FinanceWorkspaceShell>

      {detail ? (
        <AnalyticsDetailsDrawer
          open={true}
          title={detail.title}
          subtitle={detail.subtitle}
          onClose={() => setDetail(null)}
          summaryItems={detail.summaryItems}
          tabs={[
            { id: "overview", label: drawerTabs.overview, description: locale === "ar" ? "ملخص سريع للصف المحدد." : "Quick summary of the selected row." },
            { id: "source", label: drawerTabs.source, description: locale === "ar" ? "المعطيات الخام." : "Raw source fields." }
          ]}
          activeTab={detailTab}
          onTabChange={(tabId) => setDetailTab(tabId as "overview" | "source")}
          tabPanels={{
            overview: (
              <div className="grid gap-4 md:grid-cols-2">
                {detail.summaryItems.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                    <div className="mt-2 text-lg font-bold text-gray-900">{item.value}</div>
                    {item.note ? <p className="mt-1 text-xs text-gray-500">{item.note}</p> : null}
                  </div>
                ))}
              </div>
            ),
            source: (
              <pre className="max-h-[60vh] overflow-auto rounded-2xl border border-gray-200 bg-gray-950 p-4 text-xs leading-6 text-gray-100">
                {detail.sourceJson}
              </pre>
            )
          }}
          sideNote={locale === "ar"
            ? "يستخدم هذا السجل البيانات الحالية نفسها الموجودة في المالية والتقارير دون تغيير أي معادلة."
            : "This workspace reuses the same finance datasets without changing any calculations."
          }
        />
      ) : null}
    </TenantLayout>
  );
}
