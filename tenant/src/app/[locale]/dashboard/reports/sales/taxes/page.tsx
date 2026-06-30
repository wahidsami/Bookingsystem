"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { AnalyticsDataTable } from "@/components/AnalyticsDataTable";
import { FinanceEmptyState, FinanceMetricCard, FinanceSectionCard } from "@/components/FinanceWorkspaceShell";
import { ReportColumnCustomizationDrawer } from "@/components/ReportColumnCustomizationDrawer";
import { ReportFiltersDrawer } from "@/components/ReportFiltersDrawer";
import { ReportOptionsMenu } from "@/components/ReportOptionsMenu";
import { SalesReportFiltersPanel } from "@/components/SalesReportFiltersPanel";
import { SalesReportWorkspaceShell } from "@/components/SalesReportWorkspaceShell";
import { useReportColumnPreferences } from "@/components/useReportColumnPreferences";
import { useReportFavorite } from "@/components/useReportFavorites";
import { useReportingDateRange } from "@/components/useReportingDateRange";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { tenantApi } from "@/lib/api";
import { exportCsv, exportExcel, printReport } from "@/lib/reportExportService";
import { getSalesReportNavItems } from "@/lib/salesReportConfig";
import { normalizeFinancialLedgerEntries, type SalesEntry } from "@/lib/salesReports";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function effectiveRate(tax: number, gross: number) {
  if (!gross) return 0;
  return Number(((tax / gross) * 100).toFixed(1));
}

export default function TaxesSummaryReportPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<SalesEntry[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [filters, setFilters] = useState({
    location: "all",
    teamMember: "all",
    status: "all",
    type: "all",
    customerSegment: "all",
    customerGender: "all",
    customerRetention: "all",
    channel: "all"
  });
  const [draftFilters, setDraftFilters] = useState(filters);
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "tax-summary");

  const defaultColumns = useMemo(() => ([
    { id: "label", label: locale === "ar" ? "نوع الضريبة" : "Tax Type", description: locale === "ar" ? "الفئة" : "Tax bucket", visible: true, locked: true },
    { id: "location", label: locale === "ar" ? "الموقع" : "Location", description: locale === "ar" ? "الموقع" : "Location", visible: true },
    { id: "taxRate", label: locale === "ar" ? "معدل الضريبة" : "Tax Rate", description: locale === "ar" ? "النسبة المئوية" : "Effective rate", visible: true },
    { id: "itemsSold", label: locale === "ar" ? "العناصر المباعة" : "Items Sold", description: locale === "ar" ? "عدد العناصر" : "Sold items", visible: true },
    { id: "taxOnNetSales", label: locale === "ar" ? "الضرائب على صافي المبيعات" : "Taxes on Net Sales", description: locale === "ar" ? "الضريبة الأساسية" : "Base tax", visible: true },
    { id: "taxOnServiceCharges", label: locale === "ar" ? "الضريبة على رسوم الخدمة" : "Tax on Service Charges", description: locale === "ar" ? "الرسوم" : "Service charge tax", visible: true },
    { id: "totalTax", label: locale === "ar" ? "إجمالي الضريبة" : "Total Tax", description: locale === "ar" ? "الإجمالي" : "Total tax", visible: true }
  ]), [locale]);
  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "tax-summary",
    defaultColumns
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [ledgerRes, overviewRes] = await Promise.allSettled([
          tenantApi.getFinancialLedger({ startDate, endDate }),
          tenantApi.getFinancialOverview({ startDate, endDate })
        ]);

        if (!mounted) return;

        setLedgerEntries(
          ledgerRes.status === "fulfilled" && ledgerRes.value?.success
            ? normalizeFinancialLedgerEntries(ledgerRes.value)
            : []
        );

        if (overviewRes.status === "fulfilled" && overviewRes.value?.success) {
          setOverview(overviewRes.value.overview || overviewRes.value.data || null);
        } else {
          setOverview(null);
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل ملخص الضرائب." : "Failed to load the tax summary."));
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

  const rows = useMemo(() => {
    const orderRows = ledgerEntries.filter((entry) => entry.type?.toLowerCase() === "order" || entry.category === "Product");

    const buildRow = (label: string, gross: number, tax: number, itemsSold: number) => ({
      label,
      location: locale === "ar" ? "كل المواقع" : "All locations",
      taxRate: effectiveRate(tax, gross),
      itemsSold,
      taxOnNetSales: tax,
      taxOnServiceCharges: 0,
      totalTax: tax
    });

    return [
      buildRow(locale === "ar" ? "الحجوزات" : "Appointments", safeNumber(overview?.appointmentRevenue), safeNumber(overview?.totalTax), safeNumber(overview?.totalBookings)),
      buildRow(locale === "ar" ? "الطلبات" : "Orders", safeNumber(overview?.orderRevenue), orderRows.reduce((sum, row) => sum + safeNumber(row.tax), 0), safeNumber(overview?.totalOrders)),
      buildRow(locale === "ar" ? "بطاقات الهدايا" : "Gift cards", safeNumber(overview?.giftCardRevenue), 0, safeNumber(overview?.giftCardTransactions)),
      buildRow(locale === "ar" ? "الإجمالي" : "Total", safeNumber(overview?.totalRevenue), safeNumber(overview?.totalTax), safeNumber(overview?.totalBookings) + safeNumber(overview?.totalOrders) + safeNumber(overview?.giftCardTransactions))
    ];
  }, [ledgerEntries, locale, overview]);

  const filteredRows = useMemo(() => rows.filter(() => true), [rows]);
  const visibleTaxColumns = visibleColumns;
  const tableColumns = visibleTaxColumns.map((column) => ({
    id: column.id,
    header: column.label,
    sortable: column.id !== "label"
  }));

  const tableRows = filteredRows.map((row) => visibleTaxColumns.map((column) => {
    switch (column.id) {
      case "label":
        return row.label;
      case "location":
        return row.location;
      case "taxRate":
        return `${row.taxRate}%`;
      case "itemsSold":
        return row.itemsSold;
      case "taxOnNetSales":
        return <Currency amount={row.taxOnNetSales} />;
      case "taxOnServiceCharges":
        return <Currency amount={row.taxOnServiceCharges} />;
      case "totalTax":
        return <Currency amount={row.totalTax} />;
      default:
        return row[column.id as keyof typeof row] as any;
    }
  }));

  const exportPayload = useMemo(() => ({
    fileName: "tax-summary",
    reportTitle: locale === "ar" ? "ملخص الضرائب" : "Tax summary",
    startDate,
    endDate,
    sections: ["financial"],
    tables: [
      {
        title: locale === "ar" ? "ملخص الضرائب" : "Tax summary",
        columns: visibleTaxColumns.map((column) => column.label),
        rows: filteredRows.map((row) => visibleTaxColumns.map((column) => {
          switch (column.id) {
            case "label":
              return row.label;
            case "location":
              return row.location;
            case "taxRate":
              return row.taxRate;
            case "itemsSold":
              return row.itemsSold;
            case "taxOnNetSales":
              return row.taxOnNetSales;
            case "taxOnServiceCharges":
              return row.taxOnServiceCharges;
            case "totalTax":
              return row.totalTax;
            default:
              return row[column.id as keyof typeof row] as any;
          }
        }))
      }
    ]
  }), [endDate, filteredRows, locale, startDate, visibleTaxColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من ملخص الضرائب" : "Tax summary copy",
    sections: "financial"
  }).toString()}`;

  return (
    <TenantLayout>
      <SalesReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "ملخص الضرائب" : "Tax summary"}
        subtitle={locale === "ar"
          ? "تفصيل الضرائب على صافي المبيعات ورسوم الخدمة."
          : "Tax breakdown on net sales and service charges."
        }
        navItems={getSalesReportNavItems(locale)}
        activeReportId="taxes"
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
            <Link href={`/${locale}/dashboard/reports/sales`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              {locale === "ar" ? "مركز المبيعات" : "Sales hub"}
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
            <div className="h-80 animate-pulse rounded-3xl border border-gray-200 bg-white" />
          </div>
        ) : rows.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard label={locale === "ar" ? "إجمالي الضريبة" : "Total tax"} value={<Currency amount={safeNumber(overview?.totalTax)} />} tone="amber" />
              <FinanceMetricCard label={locale === "ar" ? "الضريبة على صافي المبيعات" : "Tax on net sales"} value={<Currency amount={safeNumber(overview?.totalTax)} />} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "الرسوم والعمولات" : "Service charge tax"} value={<Currency amount={0} />} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "معدل الضريبة الفعلي" : "Effective tax rate"} value={`${effectiveRate(safeNumber(overview?.totalTax), safeNumber(overview?.totalRevenue))}%`} tone="green" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "ملخص الضرائب" : "Tax summary"}
              subtitle={locale === "ar" ? "يمكنك إخفاء الأعمدة أو إعادة ترتيبها." : "Hide columns or reorder them."}
              action={
                <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  {locale === "ar" ? "الأعمدة" : "Columns"}
                </button>
              }
            >
              <AnalyticsDataTable
                columns={tableColumns}
                rows={tableRows}
                totalRows={filteredRows.length}
                sourceLabel={locale === "ar" ? "السجلات" : "records"}
                countLabel={locale === "ar" ? `عرض ${filteredRows.length} سجل` : `Showing ${filteredRows.length} records`}
                emptyTitle={locale === "ar" ? "لا توجد بيانات" : "No data"}
                emptyDescription={locale === "ar" ? "لا توجد ضرائب ضمن هذا النطاق." : "No tax rows were found for this range."}
              />
            </FinanceSectionCard>
          </>
        ) : (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد بيانات ضريبية" : "No tax data"}
            description={locale === "ar" ? "غيّر نطاق التاريخ أو المرشحات." : "Try a different date range or filter combination."}
          />
        )}
      </SalesReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات الضرائب" : "Tax filters"}
        subtitle={locale === "ar" ? "حافظ على المسودة قبل التطبيق." : "Keep the draft before applying it."}
        onClose={() => setFiltersOpen(false)}
        onApply={() => {
          setFilters(draftFilters);
          setFiltersOpen(false);
        }}
        onReset={() => {
          const reset = {
            location: "all",
            teamMember: "all",
            status: "all",
            type: "all",
            customerSegment: "all",
            customerGender: "all",
            customerRetention: "all",
            channel: "all"
          };
          setDraftFilters(reset);
          setFilters(reset);
        }}
      >
        <SalesReportFiltersPanel
          locale={locale}
          filters={draftFilters}
          onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))}
          locationOptions={["All locations"]}
          teamMemberOptions={[]}
          statusOptions={["all"]}
          typeOptions={["Appointments", "Orders", "Gift cards"]}
          customerSegmentOptions={[]}
          customerGenderOptions={[]}
          customerRetentionOptions={[]}
          channelOptions={["online", "cash", "card_pos", "wallet", "gift_card_code"]}
          note={locale === "ar"
            ? "الأرقام هنا تعكس الضريبة الفعالة المجمعة من سجل الإيراد."
            : "The numbers here reflect the effective tax aggregated from the revenue ledger."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة الضرائب" : "Tax columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
