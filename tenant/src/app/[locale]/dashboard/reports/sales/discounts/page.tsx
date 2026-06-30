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

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: number, base: number) {
  if (!base) return 0;
  return Number(((value / base) * 100).toFixed(1));
}

export default function DiscountSummaryReportPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "discount-summary");

  const defaultColumns = useMemo(() => ([
    { id: "label", label: locale === "ar" ? "فئة الخصم" : "Discount category", description: locale === "ar" ? "نوع الخصم" : "Discount type", visible: true, locked: true },
    { id: "itemsDiscounted", label: locale === "ar" ? "العناصر المخفضة" : "Items Discounted", description: locale === "ar" ? "عدد العناصر" : "Number of discounted items", visible: true },
    { id: "grossSales", label: locale === "ar" ? "إجمالي المبيعات" : "Gross Sales", description: locale === "ar" ? "الإيراد الخام" : "Gross revenue", visible: true },
    { id: "itemDiscounts", label: locale === "ar" ? "خصومات العناصر" : "Item Discounts", description: locale === "ar" ? "خصومات الحجوزات" : "Item-level discounts", visible: true },
    { id: "cartDiscounts", label: locale === "ar" ? "خصومات السلة" : "Cart Discounts", description: locale === "ar" ? "خصومات الطلبات" : "Order/cart discounts", visible: true },
    { id: "totalDiscounts", label: locale === "ar" ? "إجمالي الخصومات" : "Total Discounts", description: locale === "ar" ? "إجمالي الخصومات" : "Total discounts", visible: true },
    { id: "totalDiscountPercent", label: locale === "ar" ? "إجمالي نسبة الخصم" : "Total Discount %", description: locale === "ar" ? "النسبة المئوية" : "Percentage", visible: true }
  ]), [locale]);
  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "discount-summary",
    defaultColumns
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await tenantApi.getFinancialOverview({ startDate, endDate });
        if (!mounted) return;
        setOverview(response?.overview || response?.data || null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل ملخص الخصومات." : "Failed to load the discount summary."));
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
    const appointmentDiscount = safeNumber(overview?.discountTotals?.appointmentDiscountAmount);
    const orderDiscount = safeNumber(overview?.discountTotals?.orderDiscountAmount);
    const totalDiscount = safeNumber(overview?.discountTotals?.totalDiscountAmount);
    const appointmentRevenue = safeNumber(overview?.appointmentRevenue);
    const orderRevenue = safeNumber(overview?.orderRevenue);
    const totalRevenue = safeNumber(overview?.totalRevenue);

    return [
      {
        id: "appointments",
        label: locale === "ar" ? "الحجوزات" : "Appointments",
        itemsDiscounted: safeNumber(overview?.discountedBookings),
        grossSales: appointmentRevenue,
        itemDiscounts: appointmentDiscount,
        cartDiscounts: 0,
        totalDiscounts: appointmentDiscount,
        totalDiscountPercent: percent(appointmentDiscount, appointmentRevenue)
      },
      {
        id: "orders",
        label: locale === "ar" ? "الطلبات" : "Orders",
        itemsDiscounted: safeNumber(overview?.discountedOrders),
        grossSales: orderRevenue,
        itemDiscounts: 0,
        cartDiscounts: orderDiscount,
        totalDiscounts: orderDiscount,
        totalDiscountPercent: percent(orderDiscount, orderRevenue)
      },
      {
        id: "total",
        label: locale === "ar" ? "الإجمالي" : "Total",
        itemsDiscounted: safeNumber(overview?.discountedBookings) + safeNumber(overview?.discountedOrders),
        grossSales: totalRevenue,
        itemDiscounts: appointmentDiscount,
        cartDiscounts: orderDiscount,
        totalDiscounts: totalDiscount,
        totalDiscountPercent: percent(totalDiscount, totalRevenue)
      }
    ];
  }, [locale, overview]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (filters.type !== "all" && `${row.label}`.toLowerCase() !== `${filters.type}`.toLowerCase()) return false;
    return true;
  }), [filters.type, rows]);

  const visibleDiscountColumns = visibleColumns;
  const tableColumns = visibleDiscountColumns.map((column) => ({
    id: column.id,
    header: column.label,
    sortable: column.id !== "label"
  }));

  const tableRows = filteredRows.map((row) => visibleDiscountColumns.map((column) => {
    switch (column.id) {
      case "label":
        return row.label;
      case "itemsDiscounted":
        return row.itemsDiscounted;
      case "grossSales":
        return <Currency amount={row.grossSales} />;
      case "itemDiscounts":
        return <Currency amount={row.itemDiscounts} />;
      case "cartDiscounts":
        return <Currency amount={row.cartDiscounts} />;
      case "totalDiscounts":
        return <Currency amount={row.totalDiscounts} />;
      case "totalDiscountPercent":
        return `${row.totalDiscountPercent}%`;
      default:
        return row[column.id as keyof typeof row] as any;
    }
  }));

  const exportPayload = useMemo(() => ({
    fileName: "discount-summary",
    reportTitle: locale === "ar" ? "ملخص الخصومات" : "Discount summary",
    startDate,
    endDate,
    sections: ["discounts"],
    tables: [
      {
        title: locale === "ar" ? "ملخص الخصومات" : "Discount summary",
        columns: visibleDiscountColumns.map((column) => column.label),
        rows: filteredRows.map((row) => visibleDiscountColumns.map((column) => {
          switch (column.id) {
            case "label":
              return row.label;
            case "itemsDiscounted":
              return row.itemsDiscounted;
            case "grossSales":
              return row.grossSales;
            case "itemDiscounts":
              return row.itemDiscounts;
            case "cartDiscounts":
              return row.cartDiscounts;
            case "totalDiscounts":
              return row.totalDiscounts;
            case "totalDiscountPercent":
              return row.totalDiscountPercent;
            default:
              return row[column.id as keyof typeof row] as any;
          }
        }))
      }
    ]
  }), [endDate, filteredRows, locale, startDate, visibleDiscountColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من ملخص الخصومات" : "Discount summary copy",
    sections: "discounts"
  }).toString()}`;

  return (
    <TenantLayout>
      <SalesReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "ملخص الخصومات" : "Discount summary"}
        subtitle={locale === "ar"
          ? "مقارنة الخصومات بين الحجوزات والطلبات."
          : "Compare discount activity across appointments and orders."
        }
        navItems={getSalesReportNavItems(locale)}
        activeReportId="discounts"
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
              <FinanceMetricCard label={locale === "ar" ? "إجمالي الخصومات" : "Total discounts"} value={<Currency amount={safeNumber(overview?.discountTotals?.totalDiscountAmount)} />} tone="rose" />
              <FinanceMetricCard label={locale === "ar" ? "خصومات الحجوزات" : "Appointment discounts"} value={<Currency amount={safeNumber(overview?.discountTotals?.appointmentDiscountAmount)} />} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "خصومات الطلبات" : "Order discounts"} value={<Currency amount={safeNumber(overview?.discountTotals?.orderDiscountAmount)} />} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "متوسط الخصم" : "Average discount"} value={<Currency amount={safeNumber(overview?.discountTotals?.averageDiscountAmount)} />} tone="amber" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "ملخص الخصومات" : "Discount summary"}
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
                emptyDescription={locale === "ar" ? "لا توجد خصومات لهذا النطاق." : "No discounts were found for this range."}
              />
            </FinanceSectionCard>
          </>
        ) : (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد خصومات" : "No discounts"}
            description={locale === "ar" ? "غيّر نطاق التاريخ أو المرشحات." : "Try a different date range or filter combination."}
          />
        )}
      </SalesReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات الخصومات" : "Discount filters"}
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
          typeOptions={["Appointments", "Orders"]}
          customerSegmentOptions={[]}
          customerGenderOptions={[]}
          customerRetentionOptions={[]}
          channelOptions={["online", "cash", "card_pos", "wallet", "gift_card_code"]}
          note={locale === "ar"
            ? "يتم تجميع هذه الصفحة من الخصومات الخاصة بالحجوزات والطلبات."
            : "This page is assembled from booking and order discount totals."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة الخصومات" : "Discount columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
