"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
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
import { normalizeFinancialLedgerEntries, normalizeGiftCardEntries, type SalesEntry, buildSalesOverview, filterSalesEntries } from "@/lib/salesReports";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SalesListReportPage() {
  const locale = useLocale();
  const router = useRouter();
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
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "sales-list");

  const defaultColumns = useMemo(() => ([
    { id: "salesNo", label: locale === "ar" ? "رقم البيع" : "Sales No", description: locale === "ar" ? "المرجع" : "Reference", visible: true, locked: true },
    { id: "date", label: locale === "ar" ? "تاريخ البيع" : "Sale Date", description: locale === "ar" ? "تاريخ العملية" : "Transaction date", visible: true },
    { id: "status", label: locale === "ar" ? "الحالة" : "Sale Status", description: locale === "ar" ? "حالة البيع" : "Sale status", visible: true },
    { id: "eInvoice", label: locale === "ar" ? "الفوترة الإلكترونية" : "E-Invoicing", description: locale === "ar" ? "حالة الإيصال" : "Invoice state", visible: true },
    { id: "location", label: locale === "ar" ? "الموقع" : "Location", description: locale === "ar" ? "الموقع" : "Location", visible: true },
    { id: "customer", label: locale === "ar" ? "العميل" : "Customer", description: locale === "ar" ? "العميل" : "Customer", visible: true },
    { id: "channel", label: locale === "ar" ? "القناة" : "Channel", description: locale === "ar" ? "قناة البيع" : "Sales channel", visible: true },
    { id: "itemsSold", label: locale === "ar" ? "العناصر المباعة" : "Items Sold", description: locale === "ar" ? "عدد العناصر" : "Sold items", visible: true },
    { id: "grossSales", label: locale === "ar" ? "إجمالي المبيعات" : "Total Sales", description: locale === "ar" ? "إجمالي البيع" : "Sales total", visible: true },
    { id: "giftCards", label: locale === "ar" ? "بطاقات الهدايا" : "Gift Cards", description: locale === "ar" ? "إجمالي بطاقات الهدايا" : "Gift card amount", visible: true },
    { id: "serviceCharges", label: locale === "ar" ? "رسوم الخدمة" : "Service Charges", description: locale === "ar" ? "الرسوم/الضرائب" : "Fees / taxes", visible: true },
    { id: "amountDue", label: locale === "ar" ? "المبلغ المستحق" : "Amount Due", description: locale === "ar" ? "المبلغ النهائي" : "Final amount due", visible: true }
  ]), [locale]);
  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "sales-list",
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
        setError(err?.message || (locale === "ar" ? "فشل تحميل قائمة المبيعات." : "Failed to load sales list."));
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

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const visibleListColumns = visibleColumns;
  const tableColumns = visibleListColumns.map((column) => ({
    id: column.id,
    header: column.label,
    sortable: column.id !== "salesNo"
  }));

  const tableRows = filteredEntries.map((entry) => visibleListColumns.map((column) => {
    switch (column.id) {
      case "salesNo":
        return entry.salesNo;
      case "date":
        return entry.date;
      case "status":
        return entry.status;
      case "eInvoice":
        return entry.eInvoice;
      case "location":
        return entry.location;
      case "customer":
        return entry.customer;
      case "channel":
        return entry.channel;
      case "itemsSold":
        return entry.itemsSold;
      case "grossSales":
        return <Currency amount={entry.grossSales} />;
      case "giftCards":
        return <Currency amount={entry.giftCards} />;
      case "serviceCharges":
        return <Currency amount={entry.serviceCharges} />;
      case "amountDue":
        return <Currency amount={entry.amountDue} />;
      default:
        return entry[column.id as keyof SalesEntry] as any;
    }
  }));

  const exportPayload = useMemo(() => ({
    fileName: "sales-list",
    reportTitle: locale === "ar" ? "قائمة المبيعات" : "Sales list",
    startDate,
    endDate,
    sections: ["sales"],
    tables: [
      {
        title: locale === "ar" ? "قائمة المبيعات" : "Sales list",
        columns: visibleListColumns.map((column) => column.label),
        rows: filteredEntries.map((entry) => visibleListColumns.map((column) => {
          switch (column.id) {
            case "salesNo":
              return entry.salesNo;
            case "date":
              return entry.date;
            case "status":
              return entry.status;
            case "eInvoice":
              return entry.eInvoice;
            case "location":
              return entry.location;
            case "customer":
              return entry.customer;
            case "channel":
              return entry.channel;
            case "itemsSold":
              return entry.itemsSold;
            case "grossSales":
              return entry.grossSales;
            case "giftCards":
              return entry.giftCards;
            case "serviceCharges":
              return entry.serviceCharges;
            case "amountDue":
              return entry.amountDue;
            default:
              return entry[column.id as keyof SalesEntry] as any;
          }
        }))
      }
    ]
  }), [endDate, filteredEntries, locale, startDate, visibleListColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من قائمة المبيعات" : "Sales list copy",
    sections: "overview,refunds,paymentMethods,customerSales"
  }).toString()}`;

  const teamMemberOptions = useMemo(() => Array.from(new Set(filteredEntries.map((entry) => entry.teamMember).filter(Boolean))), [filteredEntries]);

  return (
    <TenantLayout>
      <SalesReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "قائمة المبيعات" : "Sales list"}
        subtitle={locale === "ar"
          ? "سطور مبيعات جاهزة للتدقيق والتصفية والتصدير."
          : "Transaction-level sales rows ready for review, filters, and exports."
        }
        navItems={getSalesReportNavItems(locale)}
        activeReportId="list"
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
              <FinanceMetricCard label={locale === "ar" ? "كمية البيع" : "Sales qty"} value={overview.salesQty} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "العناصر المباعة" : "Items sold"} value={overview.itemsSold} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "إجمالي المبيعات" : "Gross sales"} value={<Currency amount={overview.grossSales} />} tone="amber" />
              <FinanceMetricCard label={locale === "ar" ? "بطاقات الهدايا" : "Gift cards"} value={<Currency amount={overview.giftCards} />} tone="rose" />
              <FinanceMetricCard label={locale === "ar" ? "المستحق" : "Amount due"} value={<Currency amount={overview.amountDue} />} tone="neutral" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "قائمة المبيعات" : "Sales list"}
              subtitle={locale === "ar" ? "يمكنك فتح تفاصيل الصف من الجدول." : "Open a row to drill into the detail view."}
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
                onRowClick={(index) => {
                  const row = filteredEntries[index];
                  if (row?.detailPath) {
                    router.push(`/${locale}${row.detailPath}`);
                  }
                }}
                emptyTitle={locale === "ar" ? "لا توجد بيانات" : "No data"}
                emptyDescription={locale === "ar" ? "لا توجد سجلات تطابق المرشحات الحالية." : "No rows match the current filters."}
              />
            </FinanceSectionCard>
          </>
        ) : (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد مبيعات" : "No sales yet"}
            description={locale === "ar" ? "غيّر نطاق التاريخ أو المرشحات." : "Try a different date range or filter combination."}
          />
        )}
      </SalesReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات قائمة المبيعات" : "Sales list filters"}
        subtitle={locale === "ar" ? "حافظ على مسودة المرشحات قبل التطبيق." : "Review the draft filters before applying them."}
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
            ? "هذه المرشحات مبنية على حقول العمليات المتاحة في السجل المالي."
            : "These filters are driven by the operational fields available in the financial ledger."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة قائمة المبيعات" : "Sales list columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
