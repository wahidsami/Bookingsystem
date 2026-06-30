"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { AnalyticsDataTable } from "@/components/AnalyticsDataTable";
import { AnalyticsDetailsDrawer } from "@/components/AnalyticsDetailsDrawer";
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
import { normalizeFinancialLedgerEntries, normalizeGiftCardEntries, type SalesEntry, buildSalesOverview, filterSalesEntries } from "@/lib/salesReports";

function detailValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return `${value}`;
}

export default function SalesLogDetailsReportPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<SalesEntry[]>([]);
  const [giftEntries, setGiftEntries] = useState<SalesEntry[]>([]);
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
  const [selectedRow, setSelectedRow] = useState<SalesEntry | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "payment" | "reference">("overview");
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "sales-log-details");

  const defaultColumns = useMemo(() => ([
    { id: "date", label: locale === "ar" ? "التاريخ" : "Date", description: locale === "ar" ? "تاريخ العملية" : "Transaction date", visible: true, locked: true },
    { id: "salesNo", label: locale === "ar" ? "رقم البيع" : "Sales No", description: locale === "ar" ? "المرجع" : "Reference", visible: true, locked: true },
    { id: "type", label: locale === "ar" ? "النوع" : "Type", description: locale === "ar" ? "نوع العملية" : "Transaction type", visible: true },
    { id: "item", label: locale === "ar" ? "العنصر" : "Item", description: locale === "ar" ? "العنصر" : "Item", visible: true },
    { id: "category", label: locale === "ar" ? "الفئة" : "Category", description: locale === "ar" ? "الفئة" : "Category", visible: true },
    { id: "customer", label: locale === "ar" ? "العميل" : "Customer", description: locale === "ar" ? "العميل" : "Customer", visible: true },
    { id: "teamMember", label: locale === "ar" ? "عضو الفريق" : "Team member", description: locale === "ar" ? "الموظف" : "Employee", visible: true },
    { id: "channel", label: locale === "ar" ? "القناة" : "Channel", description: locale === "ar" ? "قناة الدفع" : "Payment channel", visible: true },
    { id: "grossSales", label: locale === "ar" ? "إجمالي المبيعات" : "Gross Sales", description: locale === "ar" ? "الإيراد الخام" : "Gross revenue", visible: true }
  ]), [locale]);
  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "sales-log-details",
    defaultColumns
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [ledgerRes, giftRes] = await Promise.allSettled([
          tenantApi.getFinancialLedger({ startDate, endDate }),
          tenantApi.getTenantGiftCardTransactions({ startDate, endDate, limit: 400 })
        ]);

        if (!mounted) return;

        setLedgerEntries(
          ledgerRes.status === "fulfilled" && ledgerRes.value?.success
            ? normalizeFinancialLedgerEntries(ledgerRes.value)
            : []
        );

        setGiftEntries(
          giftRes.status === "fulfilled" && giftRes.value?.success
            ? normalizeGiftCardEntries(giftRes.value.transactions || giftRes.value.data?.transactions || [])
            : []
        );
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل تفاصيل السجل." : "Failed to load sales log details."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [endDate, locale, startDate]);

  const allEntries = useMemo(() => [...ledgerEntries, ...giftEntries].sort((left, right) => `${right.date}`.localeCompare(`${left.date}`)), [giftEntries, ledgerEntries]);
  const filteredEntries = useMemo(() => filterSalesEntries(allEntries, filters), [allEntries, filters]);
  const overview = useMemo(() => buildSalesOverview(filteredEntries), [filteredEntries]);
  const visibleLogColumns = visibleColumns;
  const tableColumns = visibleLogColumns.map((column) => ({
    id: column.id,
    header: column.label,
    sortable: column.id !== "salesNo"
  }));

  const tableRows = filteredEntries.map((entry) => visibleLogColumns.map((column) => {
    switch (column.id) {
      case "date":
        return entry.date;
      case "salesNo":
        return entry.salesNo;
      case "type":
        return entry.type;
      case "item":
        return entry.item;
      case "category":
        return entry.category;
      case "customer":
        return entry.customer;
      case "teamMember":
        return entry.teamMember;
      case "channel":
        return entry.channel;
      case "grossSales":
        return <Currency amount={entry.grossSales} />;
      default:
        return entry[column.id as keyof SalesEntry] as any;
    }
  }));

  const exportPayload = useMemo(() => ({
    fileName: "sales-log-details",
    reportTitle: locale === "ar" ? "تفاصيل سجل المبيعات" : "Sales log details",
    startDate,
    endDate,
    sections: ["sales"],
    tables: [
      {
        title: locale === "ar" ? "تفاصيل سجل المبيعات" : "Sales log details",
        columns: visibleLogColumns.map((column) => column.label),
        rows: filteredEntries.map((entry) => visibleLogColumns.map((column) => {
          switch (column.id) {
            case "date":
              return entry.date;
            case "salesNo":
              return entry.salesNo;
            case "type":
              return entry.type;
            case "item":
              return entry.item;
            case "category":
              return entry.category;
            case "customer":
              return entry.customer;
            case "teamMember":
              return entry.teamMember;
            case "channel":
              return entry.channel;
            case "grossSales":
              return entry.grossSales;
            default:
              return entry[column.id as keyof SalesEntry] as any;
          }
        }))
      }
    ]
  }), [endDate, filteredEntries, locale, startDate, visibleLogColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من تفاصيل السجل" : "Sales log copy",
    sections: "overview,refunds,paymentMethods,customerSales"
  }).toString()}`;

  const teamMemberOptions = useMemo(() => Array.from(new Set(filteredEntries.map((entry) => entry.teamMember).filter(Boolean))), [filteredEntries]);

  const selectedSummary = useMemo(() => selectedRow ? [
    { label: locale === "ar" ? "التاريخ" : "Date", value: detailValue(selectedRow.date) },
    { label: locale === "ar" ? "رقم البيع" : "Sales No", value: detailValue(selectedRow.salesNo) },
    { label: locale === "ar" ? "النوع" : "Type", value: detailValue(selectedRow.type) },
    { label: locale === "ar" ? "العنصر" : "Item", value: detailValue(selectedRow.item) },
    { label: locale === "ar" ? "إجمالي المبيعات" : "Gross sales", value: <Currency amount={selectedRow.grossSales} /> },
    { label: locale === "ar" ? "الخصومات" : "Discounts", value: <Currency amount={selectedRow.discounts} /> },
    { label: locale === "ar" ? "الضرائب" : "Taxes", value: <Currency amount={selectedRow.tax} /> },
    { label: locale === "ar" ? "المستحق" : "Amount due", value: <Currency amount={selectedRow.amountDue} /> }
  ] : [], [locale, selectedRow]);

  return (
    <TenantLayout>
      <SalesReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "تفاصيل سجل المبيعات" : "Sales log details"}
        subtitle={locale === "ar"
          ? "عرض مفصل لصفوف الإيراد والخصومات والضرائب."
          : "Detailed revenue rows with discounts, taxes, and payment information."
        }
        navItems={getSalesReportNavItems(locale)}
        activeReportId="log-details"
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
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-white" />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-3xl border border-gray-200 bg-white" />
          </div>
        ) : filteredEntries.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <FinanceMetricCard label={locale === "ar" ? "الإجمالي" : "Total"} value={overview.total} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "إجمالي المبيعات" : "Gross sales"} value={<Currency amount={overview.grossSales} />} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "الخصومات" : "Discounts"} value={<Currency amount={overview.discounts} />} tone="amber" />
              <FinanceMetricCard label={locale === "ar" ? "الاستردادات" : "Refunds"} value={<Currency amount={overview.refunds} />} tone="rose" />
              <FinanceMetricCard label={locale === "ar" ? "رسوم الخدمة" : "Service charges"} value={<Currency amount={overview.serviceCharges} />} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "المستحق" : "Amount due"} value={<Currency amount={overview.amountDue} />} tone="neutral" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "سجل المبيعات" : "Sales log"}
              subtitle={locale === "ar" ? "انقر على أي صف لعرض بطاقة تفاصيل جانبية." : "Click a row to open the detail drawer."}
              action={
                <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  {locale === "ar" ? "الأعمدة" : "Columns"}
                </button>
              }
            >
              <AnalyticsDataTable
                columns={tableColumns}
                rows={tableRows}
                totalRows={filteredEntries.length}
                sourceLabel={locale === "ar" ? "السجلات" : "records"}
                countLabel={locale === "ar" ? `عرض ${filteredEntries.length} سجل` : `Showing ${filteredEntries.length} records`}
                onRowClick={(index) => setSelectedRow(filteredEntries[index] || null)}
                emptyTitle={locale === "ar" ? "لا توجد بيانات" : "No data"}
                emptyDescription={locale === "ar" ? "لا توجد سجلات تطابق المرشحات الحالية." : "No rows match the current filters."}
              />
            </FinanceSectionCard>
          </>
        ) : (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد بيانات تفصيلية" : "No detailed data"}
            description={locale === "ar" ? "غيّر نطاق التاريخ أو المرشحات." : "Try a different date range or filter combination."}
          />
        )}
      </SalesReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات تفاصيل السجل" : "Sales log filters"}
        subtitle={locale === "ar" ? "احتفظ بالمسودة قبل التطبيق." : "Keep the draft before applying it."}
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
          teamMemberOptions={teamMemberOptions}
          statusOptions={["completed", "pending", "refunded", "cancelled"]}
          typeOptions={["Appointments", "Orders", "Gift cards", "Refunds"]}
          customerSegmentOptions={[]}
          customerGenderOptions={[]}
          customerRetentionOptions={[]}
          channelOptions={["online", "cash", "card_pos", "wallet", "gift_card_code"]}
          note={locale === "ar"
            ? "هذه المرشحات مبنية على الحقول المتاحة في السجل."
            : "These filters are driven by the fields available in the operational log."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة السجل" : "Sales log columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />

      <AnalyticsDetailsDrawer
        open={!!selectedRow}
        title={selectedRow ? selectedRow.item : ""}
        subtitle={selectedRow ? selectedRow.customer : undefined}
        onClose={() => setSelectedRow(null)}
        summaryItems={selectedSummary}
        tabs={[
          { id: "overview", label: locale === "ar" ? "نظرة عامة" : "Overview" },
          { id: "payment", label: locale === "ar" ? "الدفع" : "Payment" },
          { id: "reference", label: locale === "ar" ? "المرجع" : "Reference" }
        ]}
        activeTab={detailTab}
        onTabChange={(tabId) => setDetailTab(tabId as "overview" | "payment" | "reference")}
        tabPanels={{
          overview: selectedRow ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "الصف المختار" : "Selected row"}</div>
                <div className="mt-2 text-sm text-gray-700">{selectedRow.item}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "العميل" : "Customer"}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">{selectedRow.customer}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "القناة" : "Channel"}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">{selectedRow.channel}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null,
          payment: selectedRow ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className="text-gray-500">{locale === "ar" ? "الإجمالي" : "Gross"}</span> <Currency amount={selectedRow.grossSales} /></div>
                  <div><span className="text-gray-500">{locale === "ar" ? "الخصم" : "Discount"}</span> <Currency amount={selectedRow.discounts} /></div>
                  <div><span className="text-gray-500">{locale === "ar" ? "الضرائب" : "Taxes"}</span> <Currency amount={selectedRow.tax} /></div>
                  <div><span className="text-gray-500">{locale === "ar" ? "المستحق" : "Amount due"}</span> <Currency amount={selectedRow.amountDue} /></div>
                </div>
              </div>
            </div>
          ) : null,
          reference: selectedRow ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "رقم البيع" : "Sales No"}</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{selectedRow.salesNo}</div>
                <div className="mt-3 text-xs text-gray-500">{selectedRow.detailPath || (locale === "ar" ? "لا يوجد رابط تفصيلي مرتبط." : "No linked detail path is available.")}</div>
              </div>
            </div>
          ) : null
        }}
      />
    </TenantLayout>
  );
}
