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
  applyFinancialPaymentFilters,
  buildFinancialPaymentTransactionRows,
  type FinancialPaymentTransactionRow,
  type FinancialReportFilters
} from "@/lib/financialReports";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function FinancialPaymentTransactionsPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ledgerResponse, setLedgerResponse] = useState<any>(null);
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
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "financial-payment-transactions");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [ledgerRes, giftTransactionsRes, giftRedemptionsRes] = await Promise.allSettled([
          tenantApi.getFinancialLedger({ startDate, endDate }),
          tenantApi.getTenantGiftCardTransactions({ startDate, endDate, limit: 400 }),
          tenantApi.getTenantGiftCardRedemptions({ startDate, endDate, limit: 400 })
        ]);

        if (!mounted) return;

        setLedgerResponse(ledgerRes.status === "fulfilled" && ledgerRes.value?.success ? ledgerRes.value : null);
        setGiftCardTransactions(giftTransactionsRes.status === "fulfilled" && giftTransactionsRes.value?.success ? giftTransactionsRes.value.transactions || giftTransactionsRes.value.data?.transactions || [] : []);
        setGiftCardRedemptions(giftRedemptionsRes.status === "fulfilled" && giftRedemptionsRes.value?.success ? giftRedemptionsRes.value.redemptions || giftRedemptionsRes.value.data?.redemptions || [] : []);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل معاملات الدفع." : "Failed to load payment transactions."));
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

  const allRows = useMemo(() => buildFinancialPaymentTransactionRows({
    ledgerResponse,
    giftCardTransactions,
    giftCardRedemptions
  }), [giftCardRedemptions, giftCardTransactions, ledgerResponse]);

  const filteredRows = useMemo(() => applyFinancialPaymentFilters(allRows, filters), [allRows, filters]);

  const defaultColumns = useMemo(() => ([
    { id: "date", label: locale === "ar" ? "Payment Date" : "Payment Date", description: locale === "ar" ? "تاريخ الدفع" : "Payment date", visible: true, locked: true },
    { id: "paymentNo", label: locale === "ar" ? "Payment No" : "Payment No", description: locale === "ar" ? "رقم الدفع" : "Payment number", visible: true, locked: true },
    { id: "saleDate", label: locale === "ar" ? "Sale Date" : "Sale Date", description: locale === "ar" ? "تاريخ البيع" : "Sale date", visible: true },
    { id: "saleNo", label: locale === "ar" ? "Sale No" : "Sale No", description: locale === "ar" ? "رقم البيع" : "Sale number", visible: true },
    { id: "appointmentRef", label: locale === "ar" ? "Appointment Ref" : "Appointment Ref", description: locale === "ar" ? "مرجع الحجز" : "Appointment reference", visible: true },
    { id: "customer", label: locale === "ar" ? "Customer" : "Customer", description: locale === "ar" ? "العميل" : "Customer", visible: true },
    { id: "location", label: locale === "ar" ? "Location" : "Location", description: locale === "ar" ? "الموقع" : "Location", visible: true },
    { id: "teamMember", label: locale === "ar" ? "Team Member" : "Team Member", description: locale === "ar" ? "عضو الفريق" : "Team member", visible: true },
    { id: "transactionType", label: locale === "ar" ? "Transaction Type" : "Transaction Type", description: locale === "ar" ? "نوع العملية" : "Transaction type", visible: true },
    { id: "paymentMethod", label: locale === "ar" ? "Payment Method" : "Payment Method", description: locale === "ar" ? "طريقة الدفع" : "Payment method", visible: true },
    { id: "paymentAmount", label: locale === "ar" ? "Payment Amount" : "Payment Amount", description: locale === "ar" ? "قيمة الدفع" : "Payment amount", visible: true }
  ]), [locale]);

  const { columns, visibleColumns, setColumns, resetColumns } = useReportColumnPreferences({
    userKey,
    reportKey: "financial-payment-transactions",
    defaultColumns
  });

  const teamMemberOptions = useMemo(() => {
    const names = new Set<string>();
    allRows.forEach((row) => {
      const name = `${row.teamMember || ""}`.trim();
      if (name && name !== "—") names.add(name);
    });
    return Array.from(names);
  }, [allRows]);

  const paymentMethodOptions = useMemo(() => {
    const methods = new Set<string>();
    allRows.forEach((row) => {
      const method = `${row.paymentMethod || ""}`.trim();
      if (method) methods.add(method);
    });
    return Array.from(methods);
  }, [allRows]);

  const visibleRows = filteredRows.slice();

  const visibleRowCount = visibleRows.length;
  const totalAmount = visibleRows.reduce((sum, row) => sum + safeNumber(row.paymentAmount), 0);
  const giftCardAmount = visibleRows.filter((row) => row.source === "gift_card").reduce((sum, row) => sum + safeNumber(row.paymentAmount), 0);
  const redemptionAmount = visibleRows.filter((row) => row.source === "redemption").reduce((sum, row) => sum + safeNumber(row.paymentAmount), 0);

  const exportPayload = useMemo(() => ({
    fileName: "financial-payment-transactions",
    reportTitle: locale === "ar" ? "معاملات الدفع" : "Payment transactions",
    startDate,
    endDate,
    sections: ["financial"],
    tables: [
      {
        title: locale === "ar" ? "معاملات الدفع" : "Payment transactions",
        columns: visibleColumns.map((column) => column.label),
        rows: visibleRows.map((row) => visibleColumns.map((column) => {
          switch (column.id) {
            case "date":
              return row.date;
            case "paymentNo":
              return row.paymentNo;
            case "saleDate":
              return row.saleDate;
            case "saleNo":
              return row.saleNo;
            case "appointmentRef":
              return row.appointmentRef;
            case "customer":
              return row.customer;
            case "location":
              return row.location;
            case "teamMember":
              return row.teamMember;
            case "transactionType":
              return row.transactionType;
            case "paymentMethod":
              return row.paymentMethod;
            case "paymentAmount":
              return row.paymentAmount;
            default:
              return row[column.id as keyof FinancialPaymentTransactionRow] as any;
          }
        }))
      }
    ]
  }), [endDate, locale, startDate, visibleColumns, visibleRows]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من معاملات الدفع" : "Payment transactions copy",
    sections: "financial,refunds,paymentMethods"
  }).toString()}`;

  return (
    <TenantLayout>
      <FinancialReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "معاملات الدفع" : "Payment transactions"}
        subtitle={locale === "ar"
          ? "سجل موحد للمدفوعات وبطاقات الهدايا والاستردادات مع مرشحات الاستبعاد."
          : "Unified ledger for payments, gift cards, and redemptions with exclusion filters."
        }
        navItems={getFinancialReportNavItems(locale)}
        activeReportId="payment-transactions"
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
              <FinanceMetricCard label={locale === "ar" ? "إجمالي السجلات" : "Total rows"} value={visibleRowCount} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "إجمالي المبلغ" : "Total amount"} value={<Currency amount={totalAmount} />} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "بطاقات الهدايا" : "Gift cards"} value={<Currency amount={giftCardAmount} />} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "الاستردادات" : "Redemptions"} value={<Currency amount={redemptionAmount} />} tone="amber" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "سجل المدفوعات" : "Payment ledger"}
              subtitle={locale === "ar" ? "انقر للتصفية، فرز الأعمدة، وتبديل الأعمدة." : "Filter, sort, and customize the ledger columns."}
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
                  sortable: column.id !== "paymentNo"
                }))}
                rows={visibleRows.map((row) => visibleColumns.map((column) => {
                  switch (column.id) {
                    case "date":
                      return row.date;
                    case "paymentNo":
                      return row.paymentNo;
                    case "saleDate":
                      return row.saleDate;
                    case "saleNo":
                      return row.saleNo;
                    case "appointmentRef":
                      return row.appointmentRef || "—";
                    case "customer":
                      return row.customer;
                    case "location":
                      return row.location;
                    case "teamMember":
                      return row.teamMember;
                    case "transactionType":
                      return row.transactionType;
                    case "paymentMethod":
                      return row.paymentMethod;
                    case "paymentAmount":
                      return <Currency amount={row.paymentAmount} />;
                    default:
                      return row[column.id as keyof FinancialPaymentTransactionRow] as any;
                  }
                }))}
                totalRows={visibleRows.length}
                sourceLabel={locale === "ar" ? "المعاملات" : "transactions"}
                countLabel={locale === "ar" ? `عرض ${visibleRows.length} معاملة` : `Showing ${visibleRows.length} transactions`}
                emptyTitle={locale === "ar" ? "لا توجد معاملات" : "No transactions"}
                emptyDescription={locale === "ar" ? "لا توجد معاملات تطابق المرشحات الحالية." : "No transactions match the current filters."}
              />
            </FinanceSectionCard>
          </div>
        )}

        {!loading && !visibleRows.length ? (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد معاملات" : "No transactions"}
            description={locale === "ar" ? "غيّر نطاق التاريخ أو المرشحات." : "Try a different date range or filter combination."}
          />
        ) : null}
      </FinancialReportWorkspaceShell>

      <ReportFiltersDrawer
        open={filtersOpen}
        locale={locale}
        title={locale === "ar" ? "مرشحات معاملات الدفع" : "Payment transaction filters"}
        subtitle={locale === "ar" ? "حدد مرشحات الجدول قبل التطبيق." : "Review the draft filters before applying them."}
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
            ? "يمكنك إخفاء بطاقات الهدايا أو الدفعات المقدمة من هذا السجل."
            : "You can hide gift cards or deposit-based rows from this ledger."
          }
        />
      </ReportFiltersDrawer>

      <ReportColumnCustomizationDrawer
        open={settingsOpen}
        locale={locale}
        title={locale === "ar" ? "إعدادات أعمدة المعاملات" : "Transaction columns"}
        subtitle={locale === "ar" ? "أخفِ الأعمدة أو أعد ترتيبها." : "Hide columns or reorder them."}
        columns={columns}
        onClose={() => setSettingsOpen(false)}
        onSave={setColumns}
        onReset={resetColumns}
      />
    </TenantLayout>
  );
}
