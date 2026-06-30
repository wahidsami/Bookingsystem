"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { AnalyticsDataTable } from "@/components/AnalyticsDataTable";
import { FinanceEmptyState, FinanceMetricCard, FinanceSectionCard } from "@/components/FinanceWorkspaceShell";
import { FinancialReportWorkspaceShell } from "@/components/FinancialReportWorkspaceShell";
import { FinancialReportFiltersPanel } from "@/components/FinancialReportFiltersPanel";
import { ReportColumnCustomizationDrawer } from "@/components/ReportColumnCustomizationDrawer";
import { ReportFiltersDrawer } from "@/components/ReportFiltersDrawer";
import { ReportOptionsMenu } from "@/components/ReportOptionsMenu";
import { useReportColumnPreferences } from "@/components/useReportColumnPreferences";
import { useReportFavorite } from "@/components/useReportFavorites";
import { useReportingDateRange } from "@/components/useReportingDateRange";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { tenantApi } from "@/lib/api";
import { exportCsv, exportExcel, printReport } from "@/lib/reportExportService";
import { getFinancialReportNavItems } from "@/lib/financialReportConfig";
import { buildFinancialSummaryRows, filterFinancialReportData, type FinancialReportFilters } from "@/lib/financialReports";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfPreviousDay(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() - 1);
  return parsed.toISOString().split("T")[0];
}

export default function FinanceSummaryReportPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [ledgerResponse, setLedgerResponse] = useState<any>(null);
  const [giftCardSummary, setGiftCardSummary] = useState<any>(null);
  const [giftCardTransactions, setGiftCardTransactions] = useState<any[]>([]);
  const [giftCardRedemptions, setGiftCardRedemptions] = useState<any[]>([]);
  const [filters, setFilters] = useState<FinancialReportFilters>({
    location: "all",
    teamMember: "all",
    paymentMethod: "all",
    amountMin: "",
    amountMax: "",
    excludeGiftCards: false,
    excludeDeposits: false
  });
  const [draftFilters, setDraftFilters] = useState(filters);
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "finance-summary");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const previousEndDate = startOfPreviousDay(startDate);
        const [overviewRes, ledgerRes, giftSummaryRes, giftTransactionsRes, giftRedemptionsRes] = await Promise.allSettled([
          tenantApi.getFinancialOverview({ startDate, endDate }),
          tenantApi.getFinancialLedger({ startDate, endDate }),
          tenantApi.getTenantGiftCardSummary({ startDate, endDate }),
          tenantApi.getTenantGiftCardTransactions({ startDate, endDate, limit: 400 }),
          tenantApi.getTenantGiftCardRedemptions({ startDate, endDate, limit: 400 })
        ]);

        if (!mounted) return;

        setOverview(overviewRes.status === "fulfilled" && overviewRes.value?.success ? overviewRes.value.overview || null : null);
        setLedgerResponse(ledgerRes.status === "fulfilled" && ledgerRes.value?.success ? ledgerRes.value : null);
        setGiftCardSummary(giftSummaryRes.status === "fulfilled" && giftSummaryRes.value?.success ? giftSummaryRes.value.summary || giftSummaryRes.value.data || null : null);
        setGiftCardTransactions(giftTransactionsRes.status === "fulfilled" && giftTransactionsRes.value?.success ? giftTransactionsRes.value.transactions || giftTransactionsRes.value.data?.transactions || [] : []);
        setGiftCardRedemptions(giftRedemptionsRes.status === "fulfilled" && giftRedemptionsRes.value?.success ? giftRedemptionsRes.value.redemptions || giftRedemptionsRes.value.data?.redemptions || [] : []);

        if (previousEndDate) {
          void tenantApi.getFinancialLedger({ endDate: previousEndDate }).catch(() => null);
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل ملخص المالية." : "Failed to load finance summary."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [endDate, locale, startDate]);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const filteredData = useMemo(() => filterFinancialReportData({
    ledgerResponse,
    giftCardTransactions,
    giftCardRedemptions,
    filters
  }), [filters, giftCardRedemptions, giftCardTransactions, ledgerResponse]);

  const summaryData = useMemo(() => buildFinancialSummaryRows({
    locale,
    startDate,
    endDate,
    overview,
    ledgerResponse: filteredData.ledgerResponse,
    giftCardSummary,
    giftCardTransactions: filteredData.giftCardTransactions,
    giftCardRedemptions: filteredData.giftCardRedemptions
  }), [endDate, filteredData, giftCardSummary, locale, overview, startDate]);

  const monthColumns = summaryData.monthLabels;
  const defaultColumns = useMemo(() => ([
    { id: "label", label: locale === "ar" ? "Sales" : "Sales", description: locale === "ar" ? "اسم الصف" : "Row label", visible: true, locked: true },
    { id: "total", label: locale === "ar" ? "Total" : "Total", description: locale === "ar" ? "إجمالي الصف" : "Row total", visible: true, locked: true },
    ...monthColumns.map((month) => ({ id: month.id, label: month.label, description: locale === "ar" ? "القيمة الشهرية" : "Monthly value", visible: true }))
  ]), [locale, monthColumns]);

  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "finance-summary",
    defaultColumns
  });

  const teamMemberOptions = useMemo(() => {
    const names = new Set<string>();
    const revenueRows = Array.isArray(filteredData.ledgerResponse?.revenueLedger?.rows) ? filteredData.ledgerResponse.revenueLedger.rows : [];
    const paymentRows = Array.isArray(filteredData.ledgerResponse?.paymentLedger?.rows) ? filteredData.ledgerResponse.paymentLedger.rows : [];
    [...revenueRows, ...paymentRows].forEach((row: any) => {
      const name = `${row.employee || ""}`.trim();
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [filteredData.ledgerResponse]);

  const paymentMethodOptions = ["Cash", "Card POS", "Online", "Bank transfer", "Deposit", "Gift card"];

  const exportPayload = useMemo(() => ({
    fileName: "finance-summary",
    reportTitle: locale === "ar" ? "ملخص المالية" : "Finance summary",
    startDate,
    endDate,
    sections: ["financial"],
    tables: summaryData.sections.map((section) => ({
      title: section.label,
      columns: visibleColumns.map((column) => column.label),
      rows: section.rows.map((row) => visibleColumns.map((column) => {
        if (column.id === "label") return row.label;
        if (column.id === "total") return row.total;
        return row.monthly[column.id] || 0;
      }))
    }))
  }), [endDate, locale, startDate, summaryData.sections, visibleColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من ملخص المالية" : "Finance summary copy",
    sections: "financial,discounts,refunds,paymentMethods"
  }).toString()}`;

  return (
    <TenantLayout>
      <FinancialReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "ملخص المالية" : "Finance summary"}
        subtitle={locale === "ar"
          ? "ملخص تشغيلي للمبيعات والمدفوعات والتحصيل عبر الأعمدة الشهرية."
          : "Operational summary for sales, payments, and collections across monthly columns."
        }
        navItems={getFinancialReportNavItems(locale)}
        activeReportId="summary"
        selectedPreset={selectedPreset}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={setSelectedPreset}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFiltersClick={() => setFiltersOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
        actions={
          <>
            <Link href={`/${locale}/dashboard/reports/financial`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              {locale === "ar" ? "مركز المالية" : "Financial hub"}
            </Link>
            <Link href={`/${locale}/dashboard/reports`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              {locale === "ar" ? "التقارير" : "Reports"}
            </Link>
          </>
        }
        optionsMenu={
          <ReportOptionsMenu
            locale={locale}
            isFavorite={isFavorite}
            onDuplicate={() => {
              window.location.href = duplicateHref;
            }}
            onToggleFavorite={toggleFavorite}
            onExportCsv={() => void exportCsv(exportPayload)}
            onExportXlsx={() => void exportExcel(exportPayload)}
            onExportPdf={printReport}
            onPrint={printReport}
          />
        }
      >
        {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}

        {loading ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-white" />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-3xl border border-gray-200 bg-white" />
          </div>
        ) : summaryData.sections.length ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard label={locale === "ar" ? "Gross Sales" : "Gross Sales"} value={<Currency amount={safeNumber(overview?.appointmentRevenue) + safeNumber(overview?.orderRevenue)} />} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "Net Sales" : "Net Sales"} value={<Currency amount={(safeNumber(overview?.appointmentRevenue) + safeNumber(overview?.orderRevenue)) - safeNumber(overview?.totalDiscountAmount) - safeNumber(overview?.totalRefunds)} />} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "Total Payments" : "Total Payments"} value={<Currency amount={summaryData.sections.find((section) => section.id === "payments")?.rows.reduce((sum, row) => sum + safeNumber(row.total), 0) || 0} />} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "Total Redemptions" : "Total Redemptions"} value={<Currency amount={summaryData.sections.find((section) => section.id === "redemptions")?.rows.reduce((sum, row) => sum + safeNumber(row.total), 0) || 0} />} tone="amber" />
            </div>

            {summaryData.sections.map((section) => (
              <FinanceSectionCard
                key={section.id}
                title={section.label}
                subtitle={locale === "ar"
                  ? "اعرض الصفوف المالية مع الأعمدة الشهرية القابلة للتخصيص."
                  : "View the financial rows with customizable monthly columns."
                }
                action={
                  <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                    {locale === "ar" ? "الأعمدة" : "Columns"}
                  </button>
                }
              >
                <AnalyticsDataTable
                  columns={visibleColumns.map((column, index) => ({
                    id: column.id,
                    header: column.label,
                    sortable: index !== 0
                  }))}
                  rows={section.rows.map((row) => visibleColumns.map((column) => {
                    if (column.id === "label") return row.label;
                    if (column.id === "total") return <Currency amount={row.total} />;
                    return <Currency amount={row.monthly[column.id] || 0} />;
                  }))}
                  totalRows={section.rows.length}
                  sourceLabel={locale === "ar" ? "الصفوف" : "rows"}
                  countLabel={locale === "ar" ? `عرض ${section.rows.length} صفوف` : `Showing ${section.rows.length} rows`}
                  emptyTitle={locale === "ar" ? "لا توجد صفوف" : "No rows"}
                  emptyDescription={locale === "ar" ? "لا توجد بيانات لهذه المجموعة." : "No data exists for this group."}
                />
              </FinanceSectionCard>
            ))}
          </div>
        ) : (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد بيانات مالية" : "No financial data"}
            description={locale === "ar" ? "جرّب نطاق تاريخ مختلف." : "Try a different date range."}
          />
        )}
      </FinancialReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات ملخص المالية" : "Finance summary filters"}
        subtitle={locale === "ar" ? "هذه المرشحات تؤثر على المبالغ المجمعة." : "These filters affect the aggregated amounts."}
        onClose={() => setFiltersOpen(false)}
        onApply={() => {
          setFilters(draftFilters);
          setFiltersOpen(false);
        }}
        onReset={() => {
          const reset = {
            location: "all",
            teamMember: "all",
            paymentMethod: "all",
            amountMin: "",
            amountMax: "",
            excludeGiftCards: false,
            excludeDeposits: false
          };
          setDraftFilters(reset);
          setFilters(reset);
        }}
      >
        <FinancialReportFiltersPanel
          locale={locale}
          filters={draftFilters}
          onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))}
          locationOptions={["All locations"]}
          teamMemberOptions={teamMemberOptions}
          paymentMethodOptions={paymentMethodOptions}
          note={locale === "ar"
            ? "هذه المرشحات تُطبق على مصادر المالية الحالية فقط."
            : "These filters are applied to the current finance datasets only."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة ملخص المالية" : "Finance summary columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
