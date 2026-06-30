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
import { buildCustomerAnalyticsLookup, buildCustomerLookup, resolveRetentionBucket, resolveRetentionLabel } from "@/lib/salesReports";

type SummaryGroupBy = "type" | "category" | "item" | "teamMember" | "customer";

type SummaryRow = {
  id: string;
  label: string;
  salesCount: number;
  salesQty: number;
  itemsSold: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  amountDue: number;
  salesTag?: string;
  gender?: string;
  retention?: string;
  segment?: string;
  status?: string;
};

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsForSummary(params: {
  groupBy: SummaryGroupBy;
  locale: string;
  overview: any;
  employeeRevenue: any;
  serviceRevenue: any;
  productRevenue: any;
  customerSales: any[];
  customerLookup: Map<string, { name: string; gender: string; bookings: number; type: string }>;
  customerAnalyticsLookup: Map<string, { bookings: number; completed: number; revenue: number; retention: string; segment: string }>;
}): SummaryRow[] {
  const { groupBy, locale, overview, employeeRevenue, serviceRevenue, productRevenue, customerSales, customerLookup, customerAnalyticsLookup } = params;

  if (groupBy === "type") {
    return [
      {
        id: "appointments",
        label: locale === "ar" ? "الحجوزات" : "Appointments",
        salesCount: safeNumber(overview?.totalBookings),
        salesQty: safeNumber(overview?.totalBookings),
        itemsSold: safeNumber(overview?.totalBookings),
        grossSales: safeNumber(overview?.appointmentRevenue || overview?.totalRevenue),
        discounts: safeNumber(overview?.appointmentDiscountAmount),
        refunds: 0,
        amountDue: safeNumber(overview?.appointmentRevenue || overview?.totalRevenue),
        salesTag: locale === "ar" ? "خدمة" : "Service"
      },
      {
        id: "orders",
        label: locale === "ar" ? "الطلبات" : "Orders",
        salesCount: safeNumber(overview?.totalOrders),
        salesQty: safeNumber(overview?.totalOrders),
        itemsSold: safeNumber(overview?.totalOrders),
        grossSales: safeNumber(overview?.orderRevenue),
        discounts: safeNumber(overview?.orderDiscountAmount),
        refunds: 0,
        amountDue: safeNumber(overview?.orderRevenue),
        salesTag: locale === "ar" ? "منتج" : "Product"
      },
      {
        id: "gift-cards",
        label: locale === "ar" ? "بطاقات الهدايا" : "Gift cards",
        salesCount: safeNumber(overview?.giftCardTransactions),
        salesQty: safeNumber(overview?.giftCardTransactions),
        itemsSold: safeNumber(overview?.giftCardTransactions),
        grossSales: safeNumber(overview?.giftCardRevenue),
        discounts: 0,
        refunds: 0,
        amountDue: safeNumber(overview?.giftCardRevenue),
        salesTag: locale === "ar" ? "بطاقة هدية" : "Gift card"
      },
      {
        id: "refunds",
        label: locale === "ar" ? "الاستردادات" : "Refunds",
        salesCount: safeNumber(overview?.totalRefunds ? 1 : 0),
        salesQty: 0,
        itemsSold: 0,
        grossSales: 0,
        discounts: 0,
        refunds: safeNumber(overview?.totalRefunds),
        amountDue: -safeNumber(overview?.totalRefunds),
        salesTag: locale === "ar" ? "استرداد" : "Refund"
      }
    ].filter((row) => row.salesCount || row.grossSales || row.refunds);
  }

  if (groupBy === "teamMember") {
    return (Array.isArray(employeeRevenue?.employees) ? employeeRevenue.employees : []).map((row: any) => ({
      id: row.id,
      label: row.name || row.id,
      salesCount: safeNumber(row.totalBookings),
      salesQty: safeNumber(row.totalBookings),
      itemsSold: safeNumber(row.totalBookings),
      grossSales: safeNumber(row.totalRevenueGenerated ?? row.revenue),
      discounts: 0,
      refunds: 0,
      amountDue: safeNumber(row.totalEarnings ?? row.totalRevenueGenerated),
      salesTag: row.name || row.id
    }));
  }

  if (groupBy === "category" || groupBy === "item") {
    const serviceRows = (Array.isArray(serviceRevenue?.services) ? serviceRevenue.services : []).map((row: any) => ({
      id: `service-${row.id}`,
      label: groupBy === "category" ? (row.category || row.name_en || row.id) : (row.name_en || row.name_ar || row.id),
      salesCount: safeNumber(row.totalBookings),
      salesQty: safeNumber(row.totalBookings),
      itemsSold: safeNumber(row.totalBookings),
      grossSales: safeNumber(row.totalRevenue),
      discounts: 0,
      refunds: 0,
      amountDue: safeNumber(row.totalTenantRevenue),
      salesTag: locale === "ar" ? "خدمة" : "Service"
    }));
    const productRows = (Array.isArray(productRevenue?.products) ? productRevenue.products : []).map((row: any) => ({
      id: `product-${row.id}`,
      label: groupBy === "category" ? (row.category || row.name_en || row.id) : (row.name_en || row.name_ar || row.id),
      salesCount: safeNumber(row.totalOrders),
      salesQty: safeNumber(row.totalQuantity),
      itemsSold: safeNumber(row.totalQuantity),
      grossSales: safeNumber(row.totalRevenue),
      discounts: 0,
      refunds: 0,
      amountDue: safeNumber(row.totalTenantRevenue),
      salesTag: locale === "ar" ? "منتج" : "Product"
    }));
    return [...serviceRows, ...productRows];
  }

  return customerSales.map((row: any) => {
    const lookup = customerLookup.get(`${row.id || ""}`.trim());
    const analytics = customerAnalyticsLookup.get(`${row.id || ""}`.trim());
    const bookings = safeNumber(row.bookings ?? analytics?.bookings);
    const retention = analytics?.retention || resolveRetentionBucket(bookings);
    return {
      id: row.id || row.customerId || row.name,
      label: row.customerDisplayName || row.customerName || row.name || row.id || "Customer",
      salesCount: bookings,
      salesQty: bookings,
      itemsSold: bookings,
      grossSales: safeNumber(row.revenue ?? row.totalSpent ?? analytics?.revenue),
      discounts: 0,
      refunds: 0,
      amountDue: safeNumber(row.revenue ?? row.totalSpent ?? analytics?.revenue),
      salesTag: row.customerType || lookup?.type || resolveRetentionLabel(retention, locale),
      gender: lookup?.gender || "unknown",
      retention,
      segment: analytics?.segment || resolveRetentionBucket(bookings)
    };
  });
}

export default function SalesSummaryReportPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupBy, setGroupBy] = useState<SummaryGroupBy>("type");
  const [overview, setOverview] = useState<any>(null);
  const [employeeRevenue, setEmployeeRevenue] = useState<any>(null);
  const [serviceRevenue, setServiceRevenue] = useState<any>(null);
  const [productRevenue, setProductRevenue] = useState<any>(null);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [customerLookup, setCustomerLookup] = useState<Map<string, { name: string; gender: string; bookings: number; type: string }>>(new Map());
  const [customerAnalyticsLookup, setCustomerAnalyticsLookup] = useState<Map<string, { bookings: number; completed: number; revenue: number; retention: string; segment: string }>>(new Map());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "sales-summary");

  const defaultColumns = useMemo(() => ([
    { id: "label", label: locale === "ar" ? "التجميع" : "Group", description: locale === "ar" ? "مفتاح التجميع" : "Grouping key", visible: true, locked: true },
    { id: "salesCount", label: locale === "ar" ? "الإجمالي" : "Total", description: locale === "ar" ? "عدد السجلات" : "Number of source rows", visible: true },
    { id: "salesQty", label: locale === "ar" ? "كمية البيع" : "Sales Qty", description: locale === "ar" ? "وحدات البيع" : "Sales units", visible: true },
    { id: "itemsSold", label: locale === "ar" ? "العناصر المباعة" : "Items Sold", description: locale === "ar" ? "العناصر المباشرة" : "Sold items", visible: true },
    { id: "grossSales", label: locale === "ar" ? "إجمالي المبيعات" : "Gross Sales", description: locale === "ar" ? "إجمالي الإيراد" : "Gross revenue", visible: true },
    { id: "discounts", label: locale === "ar" ? "الخصومات" : "Total Discounts", description: locale === "ar" ? "إجمالي الخصم" : "Discount totals", visible: true },
    { id: "refunds", label: locale === "ar" ? "الاستردادات" : "Refunds", description: locale === "ar" ? "المبالغ المرتجعة" : "Refund totals", visible: true },
    { id: "amountDue", label: locale === "ar" ? "المستحق" : "Amount Due", description: locale === "ar" ? "المبلغ النهائي" : "Final due", visible: true }
  ]), [locale]);
  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "sales-summary",
    defaultColumns
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [overviewRes, employeeRes, serviceRes, productRes, customerSalesRes, customersRes, analyticsRes] = await Promise.allSettled([
          tenantApi.getFinancialOverview({ startDate, endDate }),
          tenantApi.getEmployeeRevenue({ startDate, endDate }),
          tenantApi.getServiceRevenue({ startDate, endDate }),
          tenantApi.getProductRevenue({ startDate, endDate }),
          tenantApi.getFullReport({ startDate, endDate, sections: ["customerSales"] }),
          tenantApi.getCustomers({ page: 1, limit: 500, sortBy: "lastVisit", sortOrder: "DESC" }),
          tenantApi.getCustomerAnalytics({ startDate, endDate })
        ]);

        if (!mounted) return;

        if (overviewRes.status === "fulfilled" && overviewRes.value?.success) {
          setOverview(overviewRes.value.overview || overviewRes.value.data || null);
        } else {
          setOverview(null);
        }

        if (employeeRes.status === "fulfilled" && employeeRes.value?.success) {
          setEmployeeRevenue(employeeRes.value || null);
        } else {
          setEmployeeRevenue(null);
        }

        if (serviceRes.status === "fulfilled" && serviceRes.value?.success) {
          setServiceRevenue(serviceRes.value || null);
        } else {
          setServiceRevenue(null);
        }

        if (productRes.status === "fulfilled" && productRes.value?.success) {
          setProductRevenue(productRes.value || null);
        } else {
          setProductRevenue(null);
        }

        if (customerSalesRes.status === "fulfilled" && customerSalesRes.value?.success) {
          const data = customerSalesRes.value?.data || {};
          setCustomerSales(Array.isArray(data.customerSales) ? data.customerSales : []);
        } else {
          setCustomerSales([]);
        }

        if (customersRes.status === "fulfilled" && customersRes.value?.success) {
          const data = customersRes.value?.data || {};
          setCustomerLookup(buildCustomerLookup(Array.isArray(data.customers) ? data.customers : []));
        } else {
          setCustomerLookup(new Map());
        }

        if (analyticsRes.status === "fulfilled" && analyticsRes.value?.success) {
          setCustomerAnalyticsLookup(buildCustomerAnalyticsLookup(analyticsRes.value.data || analyticsRes.value));
        } else {
          setCustomerAnalyticsLookup(new Map());
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل تقرير المبيعات." : "Failed to load the sales summary."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [endDate, locale, startDate]);

  const summaryRows = useMemo(
    () => rowsForSummary({
      groupBy,
      locale,
      overview,
      employeeRevenue,
      serviceRevenue,
      productRevenue,
      customerSales,
      customerLookup,
      customerAnalyticsLookup
    }),
    [customerAnalyticsLookup, customerLookup, customerSales, employeeRevenue, groupBy, locale, overview, productRevenue, serviceRevenue]
  );

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const filteredRows = useMemo(() => {
    const match = (left: string | undefined, right: string) => `${left || ""}`.trim().toLowerCase() === right.trim().toLowerCase();
    return summaryRows.filter((row: any) => {
      if (filters.teamMember !== "all" && !match(row.label, filters.teamMember)) return false;
      if (filters.status !== "all" && !match(row.status, filters.status)) return false;
      if (filters.customerRetention !== "all" && !match(row.retention, filters.customerRetention)) return false;
      if (filters.customerGender !== "all" && !match(row.gender, filters.customerGender)) return false;
      if (filters.customerSegment !== "all" && !match(row.segment, filters.customerSegment)) return false;
      return true;
    });
  }, [filters, summaryRows]);

  const visibleSummaryColumns = visibleColumns;
  const tableColumns = visibleSummaryColumns.map((column) => ({
    id: column.id,
    header: column.label,
    sortable: column.id !== "label"
  }));

  const tableRows = filteredRows.map((row: SummaryRow) => visibleSummaryColumns.map((column) => {
    switch (column.id) {
      case "label":
        return row.label;
      case "salesCount":
        return row.salesCount;
      case "salesQty":
        return row.salesQty;
      case "itemsSold":
        return row.itemsSold;
      case "grossSales":
        return <Currency amount={row.grossSales} />;
      case "discounts":
        return <Currency amount={row.discounts} />;
      case "refunds":
        return <Currency amount={row.refunds} />;
      case "amountDue":
        return <Currency amount={row.amountDue} />;
      default:
        return row[column.id as keyof typeof row] as any;
    }
  }));

  const exportPayload = useMemo(() => ({
    fileName: "sales-summary",
    reportTitle: locale === "ar" ? "ملخص المبيعات" : "Sales summary",
    startDate,
    endDate,
    sections: ["summary"],
    tables: [
      {
        title: locale === "ar" ? "ملخص المبيعات" : "Sales summary",
        columns: visibleSummaryColumns.map((column) => column.label),
        rows: filteredRows.map((row) => visibleSummaryColumns.map((column) => {
          switch (column.id) {
            case "label":
              return row.label;
            case "salesCount":
              return row.salesCount;
            case "salesQty":
              return row.salesQty;
            case "itemsSold":
              return row.itemsSold;
            case "grossSales":
              return row.grossSales;
            case "discounts":
              return row.discounts;
            case "refunds":
              return row.refunds;
            case "amountDue":
              return row.amountDue;
            default:
              return row[column.id as keyof typeof row] as any;
          }
        }))
      }
    ]
  }), [endDate, filteredRows, locale, startDate, visibleSummaryColumns]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من ملخص المبيعات" : "Sales summary copy",
    sections: "overview,employees,services,products,discounts,refunds,paymentMethods,customerSales"
  }).toString()}`;

  const teamMembers = useMemo(() => (Array.isArray(employeeRevenue?.employees) ? employeeRevenue.employees.map((employee: any) => employee.name).filter(Boolean) : []), [employeeRevenue]);

  return (
    <TenantLayout>
      <SalesReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "ملخص المبيعات" : "Sales summary"}
        subtitle={locale === "ar"
          ? "تجميعات المبيعات حسب النوع أو الفئة أو العنصر أو الموظف أو العميل."
          : "Sales totals grouped by type, category, item, team member, or customer."
        }
        navItems={getSalesReportNavItems(locale)}
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
        ) : summaryRows.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <FinanceMetricCard label={locale === "ar" ? "الإجمالي" : "Total"} value={filteredRows.length} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "كمية البيع" : "Sales qty"} value={summaryRows.reduce((sum, row) => sum + Number(row.salesQty || 0), 0)} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "العناصر المباعة" : "Items sold"} value={summaryRows.reduce((sum, row) => sum + Number(row.itemsSold || 0), 0)} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "إجمالي المبيعات" : "Gross sales"} value={<Currency amount={summaryRows.reduce((sum, row) => sum + Number(row.grossSales || 0), 0)} />} tone="amber" />
              <FinanceMetricCard label={locale === "ar" ? "إجمالي الخصومات" : "Total discounts"} value={<Currency amount={summaryRows.reduce((sum, row) => sum + Number(row.discounts || 0), 0)} />} tone="rose" />
              <FinanceMetricCard label={locale === "ar" ? "الاستردادات" : "Refunds"} value={<Currency amount={summaryRows.reduce((sum, row) => sum + Number(row.refunds || 0), 0)} />} tone="neutral" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "التجميع" : "Grouping"}
              subtitle={locale === "ar" ? "غيّر بُعد التجميع لإعادة تشكيل الجدول." : "Change the grouping dimension to reshape the table."}
            >
              <div className="flex flex-wrap gap-2">
                {(["type", "category", "item", "teamMember", "customer"] as SummaryGroupBy[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGroupBy(option)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      groupBy === option ? "bg-primary text-white shadow-sm" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option === "type" ? (locale === "ar" ? "النوع" : "Type") : null}
                    {option === "category" ? (locale === "ar" ? "الفئة" : "Category") : null}
                    {option === "item" ? (locale === "ar" ? "العنصر" : "Item") : null}
                    {option === "teamMember" ? (locale === "ar" ? "عضو الفريق" : "Team member") : null}
                    {option === "customer" ? (locale === "ar" ? "العميل" : "Customer") : null}
                  </button>
                ))}
              </div>
            </FinanceSectionCard>

            <FinanceSectionCard
              title={locale === "ar" ? "جدول ملخص المبيعات" : "Sales summary table"}
              subtitle={locale === "ar" ? "يمكنك إخفاء الأعمدة أو إعادة ترتيبها." : "You can hide columns or reorder them."}
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
                emptyDescription={locale === "ar" ? "لا توجد سجلات تطابق المرشحات الحالية." : "No rows match the current filters."}
              />
            </FinanceSectionCard>
          </>
        ) : (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد بيانات مبيعات" : "No sales data"}
            description={locale === "ar" ? "حاول تغيير نطاق التاريخ أو المرشحات." : "Try changing the date range or filters."}
          />
        )}
      </SalesReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات ملخص المبيعات" : "Sales summary filters"}
        subtitle={locale === "ar" ? "تتبع المرشحات الحالية قبل تطبيقها." : "Review the draft filters before applying them."}
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
          teamMemberOptions={teamMembers}
          statusOptions={["completed", "pending", "refunded", "cancelled"]}
          typeOptions={["Appointments", "Orders", "Gift cards", "Refunds"]}
          customerSegmentOptions={["one_time", "occasional", "regular", "loyal"]}
          customerGenderOptions={["male", "female", "other", "unknown"]}
          customerRetentionOptions={["one_time", "occasional", "regular", "loyal"]}
          channelOptions={["online", "cash", "card_pos", "wallet", "gift_card_code"]}
          note={locale === "ar"
            ? "بعض أبعاد العميل تعتمد على البيانات المتاحة في النطاق الحالي."
            : "Some customer-dimension filters depend on the available data in the current range."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة ملخص المبيعات" : "Sales summary columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
