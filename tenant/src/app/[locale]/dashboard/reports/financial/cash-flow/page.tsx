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
import {
  buildFinancialCashFlowRows,
  filterFinancialReportData,
  type FinancialReportFilters
} from "@/lib/financialReports";

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

export default function FinancialCashFlowSummaryPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentLedger, setCurrentLedger] = useState<any>(null);
  const [previousLedger, setPreviousLedger] = useState<any>(null);
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
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "financial-cash-flow");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const previousEndDate = startOfPreviousDay(startDate);
        const [currentLedgerRes, previousLedgerRes, giftTransactionsRes, giftRedemptionsRes] = await Promise.allSettled([
          tenantApi.getFinancialLedger({ startDate, endDate }),
          previousEndDate ? tenantApi.getFinancialLedger({ endDate: previousEndDate }) : Promise.resolve(null),
          tenantApi.getTenantGiftCardTransactions({ startDate, endDate, limit: 400 }),
          tenantApi.getTenantGiftCardRedemptions({ startDate, endDate, limit: 400 })
        ]);

        if (!mounted) return;

        setCurrentLedger(currentLedgerRes.status === "fulfilled" && currentLedgerRes.value?.success ? currentLedgerRes.value : null);
        setPreviousLedger(previousLedgerRes && previousLedgerRes.status === "fulfilled" && previousLedgerRes.value?.success ? previousLedgerRes.value : null);
        setGiftCardTransactions(giftTransactionsRes.status === "fulfilled" && giftTransactionsRes.value?.success ? giftTransactionsRes.value.transactions || giftTransactionsRes.value.data?.transactions || [] : []);
        setGiftCardRedemptions(giftRedemptionsRes.status === "fulfilled" && giftRedemptionsRes.value?.success ? giftRedemptionsRes.value.redemptions || giftRedemptionsRes.value.data?.redemptions || [] : []);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل التدفق النقدي." : "Failed to load cash flow summary."));
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
    ledgerResponse: currentLedger,
    giftCardTransactions,
    giftCardRedemptions,
    filters
  }), [currentLedger, filters, giftCardRedemptions, giftCardTransactions]);

  const filteredPreviousData = useMemo(() => filterFinancialReportData({
    ledgerResponse: previousLedger,
    giftCardTransactions: [],
    giftCardRedemptions: [],
    filters
  }), [filters, previousLedger]);

  const rows = useMemo(() => buildFinancialCashFlowRows({
    locale,
    startDate,
    endDate,
    currentLedger: filteredData.ledgerResponse,
    previousLedger: filteredPreviousData.ledgerResponse,
    giftCardTransactions: filteredData.giftCardTransactions,
    giftCardRedemptions: filteredData.giftCardRedemptions
  }), [endDate, filteredData, filteredPreviousData.ledgerResponse, locale, startDate]);

  const defaultColumns = useMemo(() => ([
    { id: "type", label: locale === "ar" ? "Type" : "Type", description: locale === "ar" ? "نوع السطر" : "Row type", visible: true, locked: true },
    { id: "location", label: locale === "ar" ? "Location" : "Location", description: locale === "ar" ? "الموقع" : "Location", visible: true, locked: true },
    { id: "openingBalance", label: locale === "ar" ? "Opening Balance" : "Opening Balance", description: locale === "ar" ? "الرصيد الافتتاحي" : "Opening balance", visible: true },
    { id: "totalInflows", label: locale === "ar" ? "Total Inflows" : "Total Inflows", description: locale === "ar" ? "إجمالي التدفقات الداخلة" : "Total inflows", visible: true },
    { id: "totalOutflows", label: locale === "ar" ? "Total Outflows" : "Total Outflows", description: locale === "ar" ? "إجمالي التدفقات الخارجة" : "Total outflows", visible: true },
    { id: "closingBalance", label: locale === "ar" ? "Closing Balance" : "Closing Balance", description: locale === "ar" ? "الرصيد الختامي" : "Closing balance", visible: true }
  ]), [locale]);

  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "financial-cash-flow",
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
    fileName: "financial-cash-flow",
    reportTitle: locale === "ar" ? "التدفق النقدي" : "Cash flow summary",
    startDate,
    endDate,
    sections: ["financial"],
    tables: [
      {
        title: locale === "ar" ? "التدفق النقدي" : "Cash flow summary",
        columns: visibleColumns.map((column) => column.label),
        rows: rows.map((row) => visibleColumns.map((column) => {
          switch (column.id) {
            case "type":
              return row.type;
            case "location":
              return row.location;
            case "openingBalance":
              return row.openingBalance;
            case "totalInflows":
              return row.totalInflows;
            case "totalOutflows":
              return row.totalOutflows;
            case "closingBalance":
              return row.closingBalance;
            default:
              return row[column.id as keyof typeof row] as any;
          }
        }))
      }
    ]
  }), [endDate, locale, rows, startDate, visibleColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من التدفق النقدي" : "Cash flow copy",
    sections: "financial,paymentMethods,refunds"
  }).toString()}`;

  const openingBalance = rows.find((row) => row.id === "net")?.openingBalance || 0;
  const totalInflows = rows.find((row) => row.id === "net")?.totalInflows || 0;
  const totalOutflows = rows.find((row) => row.id === "net")?.totalOutflows || 0;
  const closingBalance = rows.find((row) => row.id === "net")?.closingBalance || 0;

  return (
    <TenantLayout>
      <FinancialReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "التدفق النقدي" : "Cash flow summary"}
        subtitle={locale === "ar"
          ? "ألخص الافتتاح والتدفقات الداخلة والخارجة والرصيد الختامي باستخدام السجل الحالي والسابقة."
          : "Summarize opening balance, inflows, outflows, and closing balance using current and prior ledgers."
        }
        navItems={getFinancialReportNavItems(locale)}
        activeReportId="cash-flow"
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
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard label={locale === "ar" ? "الرصيد الافتتاحي" : "Opening balance"} value={<Currency amount={openingBalance} />} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "إجمالي الداخل" : "Total inflows"} value={<Currency amount={totalInflows} />} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "إجمالي الخارج" : "Total outflows"} value={<Currency amount={totalOutflows} />} tone="amber" />
              <FinanceMetricCard label={locale === "ar" ? "الرصيد الختامي" : "Closing balance"} value={<Currency amount={closingBalance} />} tone="purple" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "التدفق النقدي" : "Cash flow"}
              subtitle={locale === "ar" ? "الافتتاح، الداخلة، الخارجة، والإغلاق." : "Opening, inflows, outflows, and closing balances."}
              action={
                <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  {locale === "ar" ? "الأعمدة" : "Columns"}
                </button>
              }
            >
              <AnalyticsDataTable
                columns={visibleColumns.map((column) => ({
                  id: column.id,
                  header: column.label,
                  sortable: column.id !== "type"
                }))}
                rows={rows.map((row) => visibleColumns.map((column) => {
                  switch (column.id) {
                    case "type":
                      return row.type;
                    case "location":
                      return row.location;
                    case "openingBalance":
                      return <Currency amount={row.openingBalance} />;
                    case "totalInflows":
                      return <Currency amount={row.totalInflows} />;
                    case "totalOutflows":
                      return <Currency amount={row.totalOutflows} />;
                    case "closingBalance":
                      return <Currency amount={row.closingBalance} />;
                    default:
                      return row[column.id as keyof typeof row] as any;
                  }
                }))}
                totalRows={rows.length}
                sourceLabel={locale === "ar" ? "الصفوف" : "rows"}
                countLabel={locale === "ar" ? `عرض ${rows.length} صفوف` : `Showing ${rows.length} rows`}
                emptyTitle={locale === "ar" ? "لا توجد صفوف" : "No rows"}
                emptyDescription={locale === "ar" ? "لا توجد بيانات للتدفق النقدي في هذا النطاق." : "No cash flow data is available for this range."}
              />
            </FinanceSectionCard>
          </div>
        )}

        {!loading && !rows.length ? (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد بيانات تدفق نقدي" : "No cash flow data"}
            description={locale === "ar" ? "غيّر نطاق التاريخ أو المرشحات." : "Try a different date range or filter combination."}
          />
        ) : null}
      </FinancialReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات التدفق النقدي" : "Cash flow filters"}
        subtitle={locale === "ar" ? "نفس المرشحات تُطبق على السجل الحالي والسابقة." : "The same filters are applied to the current and prior ledgers."}
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
            ? "هذا الملخص يعتمد على الرصيد الافتتاحي المشتق من السجل السابق."
            : "This summary derives opening balance from the previous ledger window."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة التدفق النقدي" : "Cash flow columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
