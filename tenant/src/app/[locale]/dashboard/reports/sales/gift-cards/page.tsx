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
import { normalizeGiftCardEntries, type SalesEntry, buildSalesOverview, filterSalesEntries } from "@/lib/salesReports";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function GiftCardListReportPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "gift-card-list");

  const defaultColumns = useMemo(() => ([
    { id: "code", label: locale === "ar" ? "رمز البطاقة" : "Code", description: locale === "ar" ? "مرجع البطاقة" : "Gift card code", visible: true, locked: true },
    { id: "salesNo", label: locale === "ar" ? "رقم البيع" : "Sales No", description: locale === "ar" ? "مرجع البيع" : "Sales reference", visible: true, locked: true },
    { id: "customer", label: locale === "ar" ? "المشتري" : "Purchased By", description: locale === "ar" ? "الجهة المشتري" : "Purchaser", visible: true },
    { id: "status", label: locale === "ar" ? "الحالة" : "Status", description: locale === "ar" ? "حالة البطاقة" : "Card status", visible: true },
    { id: "date", label: locale === "ar" ? "تاريخ الإصدار" : "Issue Date", description: locale === "ar" ? "تاريخ الإصدار" : "Issue date", visible: true },
    { id: "expiryDate", label: locale === "ar" ? "تاريخ الانتهاء" : "Expiry Date", description: locale === "ar" ? "تاريخ الانتهاء" : "Expiry date", visible: true },
    { id: "channel", label: locale === "ar" ? "القناة" : "Channel", description: locale === "ar" ? "قناة التسليم" : "Delivery channel", visible: true },
    { id: "grossSales", label: locale === "ar" ? "الإيراد" : "Gross Sales", description: locale === "ar" ? "قيمة الشراء" : "Purchase amount", visible: true }
  ]), [locale]);
  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "gift-card-list",
    defaultColumns
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [transactionsRes, redemptionsRes, summaryRes] = await Promise.allSettled([
          tenantApi.getTenantGiftCardTransactions({ startDate, endDate, limit: 400 }),
          tenantApi.getTenantGiftCardRedemptions({ startDate, endDate, limit: 400 }),
          tenantApi.getTenantGiftCardSummary({ startDate, endDate })
        ]);

        if (!mounted) return;

        setGiftEntries(
          transactionsRes.status === "fulfilled" && transactionsRes.value?.success
            ? normalizeGiftCardEntries(transactionsRes.value.transactions || transactionsRes.value.data?.transactions || [])
            : []
        );
        if (summaryRes.status === "fulfilled" && summaryRes.value?.success) {
          // no-op, summary is only used in cards below
        }
        if (redemptionsRes.status === "fulfilled" && redemptionsRes.value?.success) {
          // no-op, the current list report stays transaction-focused
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل تقرير بطاقات الهدايا." : "Failed to load the gift card report."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [endDate, locale, startDate]);

  const filteredEntries = useMemo(() => filterSalesEntries(giftEntries, filters), [giftEntries, filters]);
  const overview = useMemo(() => buildSalesOverview(filteredEntries), [filteredEntries]);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const visibleGiftColumns = visibleColumns;
  const tableColumns = visibleGiftColumns.map((column) => ({
    id: column.id,
    header: column.label,
    sortable: column.id !== "salesNo"
  }));

  const tableRows = filteredEntries.map((entry) => visibleGiftColumns.map((column) => {
    switch (column.id) {
      case "salesNo":
        return entry.salesNo;
      case "code":
        return entry.raw?.giftCardCode?.code || entry.raw?.giftCode?.code || entry.salesNo;
      case "customer":
        return entry.customer;
      case "status":
        return entry.status;
      case "date":
        return entry.date;
      case "expiryDate":
        return entry.raw?.expiresAt ? new Date(entry.raw.expiresAt).toISOString().split("T")[0] : "—";
      case "channel":
        return entry.channel;
      case "grossSales":
        return <Currency amount={entry.grossSales} />;
      default:
        return entry[column.id as keyof SalesEntry] as any;
    }
  }));

  const exportPayload = useMemo(() => ({
    fileName: "gift-card-list",
    reportTitle: locale === "ar" ? "قائمة بطاقات الهدايا" : "Gift card list",
    startDate,
    endDate,
    sections: ["giftCards"],
    tables: [
      {
        title: locale === "ar" ? "قائمة بطاقات الهدايا" : "Gift card list",
        columns: visibleGiftColumns.map((column) => column.label),
        rows: filteredEntries.map((entry) => visibleGiftColumns.map((column) => {
          switch (column.id) {
            case "salesNo":
              return entry.salesNo;
            case "code":
              return entry.raw?.giftCardCode?.code || entry.raw?.giftCode?.code || entry.salesNo;
            case "customer":
              return entry.customer;
            case "status":
              return entry.status;
            case "date":
              return entry.date;
            case "expiryDate":
              return entry.raw?.expiresAt ? new Date(entry.raw.expiresAt).toISOString().split("T")[0] : "";
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
  }), [endDate, filteredEntries, locale, startDate, visibleGiftColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من قائمة بطاقات الهدايا" : "Gift card list copy",
    sections: "overview,refunds,paymentMethods,customerSales"
  }).toString()}`;

  const teamMemberOptions = useMemo(() => Array.from(new Set(filteredEntries.map((entry) => entry.teamMember).filter(Boolean))), [filteredEntries]);

  return (
    <TenantLayout>
      <SalesReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "قائمة بطاقات الهدايا" : "Gift card list"}
        subtitle={locale === "ar"
          ? "بطاقات الهدايا المباعة مع تاريخ الإصدار والانتهاء."
          : "Gift card sales with issue and expiry dates."
        }
        navItems={getSalesReportNavItems(locale)}
        activeReportId="gift-cards"
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
              <FinanceMetricCard label={locale === "ar" ? "الإيراد الخام" : "Gross sales"} value={<Currency amount={overview.grossSales} />} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "القيمة المهداه" : "Gifted value"} value={<Currency amount={overview.giftCards} />} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "الخصومات" : "Discounts"} value={<Currency amount={overview.discounts} />} tone="amber" />
              <FinanceMetricCard label={locale === "ar" ? "المستحق" : "Amount due"} value={<Currency amount={overview.amountDue} />} tone="rose" />
              <FinanceMetricCard label={locale === "ar" ? "القنوات" : "Channels"} value={new Set(filteredEntries.map((entry) => entry.channel)).size} tone="neutral" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "قائمة بطاقات الهدايا" : "Gift card list"}
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
                totalRows={filteredEntries.length}
                sourceLabel={locale === "ar" ? "السجلات" : "records"}
                countLabel={locale === "ar" ? `عرض ${filteredEntries.length} سجل` : `Showing ${filteredEntries.length} records`}
                emptyTitle={locale === "ar" ? "لا توجد بيانات" : "No data"}
                emptyDescription={locale === "ar" ? "لا توجد سجلات تطابق المرشحات الحالية." : "No rows match the current filters."}
              />
            </FinanceSectionCard>
          </>
        ) : (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد بطاقات هدايا" : "No gift cards"}
            description={locale === "ar" ? "غيّر نطاق التاريخ أو المرشحات." : "Try a different date range or filter combination."}
          />
        )}
      </SalesReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات بطاقات الهدايا" : "Gift card filters"}
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
          teamMemberOptions={teamMemberOptions}
          statusOptions={["purchased", "sent_pending_claim", "sent_completed", "redeemed", "expired", "cancelled"]}
          typeOptions={["Gift cards"]}
          customerSegmentOptions={[]}
          customerGenderOptions={[]}
          customerRetentionOptions={[]}
          channelOptions={["in_app", "email", "sms_whatsapp_future"]}
          note={locale === "ar"
            ? "رمز البطاقة في هذا التقرير يعتمد على رقم المعاملة عندما لا يكون رمز البطاقة متاحًا في حمولة الواجهة الحالية."
            : "The code column falls back to the transaction reference when the gift card code is not present in the current API payload."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة بطاقات الهدايا" : "Gift card columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
