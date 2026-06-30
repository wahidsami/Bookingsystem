"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import { FinanceEmptyState, FinanceMetricCard, FinanceSectionCard } from "@/components/FinanceWorkspaceShell";
import { FinancialReportWorkspaceShell } from "@/components/FinancialReportWorkspaceShell";
import { ReportOptionsMenu } from "@/components/ReportOptionsMenu";
import { useReportFavorite } from "@/components/useReportFavorites";
import { useReportingDateRange } from "@/components/useReportingDateRange";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { tenantApi } from "@/lib/api";
import { exportCsv, exportExcel, printReport } from "@/lib/reportExportService";
import { getFinancialReportNavItems } from "@/lib/financialReportConfig";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function FinancialReportsHubPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const userKey = user?.id || user?.email || "guest";
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [landingSummary, setLandingSummary] = useState<any>(null);
  const { isFavorite, toggleFavorite } = useReportFavorite(userKey, "financial-hub");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [overviewRes, landingRes] = await Promise.allSettled([
          tenantApi.getFinancialOverview({ startDate, endDate }),
          tenantApi.getFinancialLandingSummary({ startDate, endDate })
        ]);

        if (!mounted) return;

        setOverview(overviewRes.status === "fulfilled" && overviewRes.value?.success ? overviewRes.value.overview || null : null);
        setLandingSummary(landingRes.status === "fulfilled" && landingRes.value?.success ? landingRes.value.summary || landingRes.value.data || null : null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل مركز المالية." : "Failed to load the financial hub."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [endDate, locale, startDate]);

  const exportPayload = useMemo(() => ({
    fileName: "financial-hub",
    reportTitle: locale === "ar" ? "مركز المالية" : "Financial hub",
    startDate,
    endDate,
    sections: ["overview"],
    tables: [
      {
        title: locale === "ar" ? "مؤشرات مالية" : "Financial indicators",
        columns: [locale === "ar" ? "المؤشر" : "Metric", locale === "ar" ? "القيمة" : "Value"],
        rows: [
          [locale === "ar" ? "الإيراد الخام" : "Gross revenue", safeNumber(overview?.totalRevenue)],
          [locale === "ar" ? "الإيراد الصافي" : "Net revenue", safeNumber(overview?.netRevenue)],
          [locale === "ar" ? "إيراد المركز" : "Tenant revenue", safeNumber(overview?.totalTenantRevenue)],
          [locale === "ar" ? "المدفوعات المعلقة" : "Pending payments", safeNumber(overview?.pendingPayments)]
        ]
      }
    ]
  }), [endDate, locale, overview, startDate]);

  return (
    <TenantLayout>
      <FinancialReportWorkspaceShell
        locale={locale}
        title={locale === "ar" ? "مركز المالية" : "Financial hub"}
        subtitle={locale === "ar"
          ? "نقطة دخول للتقارير المالية الجديدة: الملخص، معاملات الدفع، والتدفق النقدي."
          : "Entry point for the new financial reports: summary, payment transactions, and cash flow."
        }
        navItems={getFinancialReportNavItems(locale)}
        activeReportId="hub"
        selectedPreset={selectedPreset}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={setSelectedPreset}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        actions={
          <>
            <Link href={`/${locale}/dashboard/reports/financial/summary`} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
              {locale === "ar" ? "ملخص المالية" : "Finance summary"}
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
              window.location.href = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
                startDate,
                endDate,
                title: locale === "ar" ? "نسخة من مركز المالية" : "Financial hub copy",
                sections: "overview,financial,discounts,refunds,paymentMethods"
              }).toString()}`;
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard label={locale === "ar" ? "الإيراد الخام" : "Gross revenue"} value={safeNumber(overview?.totalRevenue)} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "إيراد المركز" : "Tenant revenue"} value={safeNumber(overview?.totalTenantRevenue)} tone="blue" />
              <FinanceMetricCard label={locale === "ar" ? "المستحق" : "Net revenue"} value={safeNumber(overview?.netRevenue)} tone="purple" />
              <FinanceMetricCard label={locale === "ar" ? "المقبوضات المعلقة" : "Pending payments"} value={safeNumber(overview?.pendingPayments)} tone="amber" />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <FinanceSectionCard title={locale === "ar" ? "ملخص المالية" : "Finance summary"} subtitle={locale === "ar" ? "افتح الملخص التفصيلي وتابع مقاييس التحصيل." : "Open the detailed summary and monitor collections."}>
                <div className="space-y-3">
                  <Link href={`/${locale}/dashboard/reports/financial/summary`} className="block rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-primary hover:bg-primary/5">
                    {locale === "ar" ? "فتح ملخص المالية" : "Open finance summary"}
                  </Link>
                </div>
              </FinanceSectionCard>
              <FinanceSectionCard title={locale === "ar" ? "معاملات الدفع" : "Payment transactions"} subtitle={locale === "ar" ? "راجع سجل المدفوعات والبطاقات والتحصيلات." : "Review payment, gift card, and redemption transactions."}>
                <Link href={`/${locale}/dashboard/reports/financial/payment-transactions`} className="block rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-primary hover:bg-primary/5">
                  {locale === "ar" ? "فتح معاملات الدفع" : "Open payment transactions"}
                </Link>
              </FinanceSectionCard>
              <FinanceSectionCard title={locale === "ar" ? "التدفق النقدي" : "Cash flow summary"} subtitle={locale === "ar" ? "راجع أرصدة الافتتاح والإغلاق مع التدفقات." : "Review opening balance and inflow/outflow movement."}>
                <Link href={`/${locale}/dashboard/reports/financial/cash-flow`} className="block rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-primary hover:bg-primary/5">
                  {locale === "ar" ? "فتح التدفق النقدي" : "Open cash flow"}
                </Link>
              </FinanceSectionCard>
            </div>

            {landingSummary ? (
              <FinanceSectionCard title={locale === "ar" ? "ملخص التحصيل" : "Collections summary"} subtitle={locale === "ar" ? "ملخص موجز من المالية وPOS." : "A quick summary from finance and POS."}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FinanceMetricCard label={locale === "ar" ? "إجمالي التحصيل" : "Net collected"} value={safeNumber(landingSummary?.netCollected ?? landingSummary?.collectionSummary?.netCollected)} tone="green" />
                  <FinanceMetricCard label={locale === "ar" ? "المدفوعات" : "Payments"} value={safeNumber(landingSummary?.paymentsCollected ?? landingSummary?.paymentSummary?.grossCollected)} tone="blue" />
                  <FinanceMetricCard label={locale === "ar" ? "المرتجعات" : "Refunds"} value={safeNumber(landingSummary?.refundsTotal ?? landingSummary?.paymentSummary?.refundsTotal)} tone="rose" />
                  <FinanceMetricCard label={locale === "ar" ? "الفواتير غير المسددة" : "Unpaid bills"} value={safeNumber(landingSummary?.unpaidBillsCount)} tone="amber" />
                </div>
              </FinanceSectionCard>
            ) : null}
          </div>
        )}

        {!loading && !overview ? (
          <FinanceEmptyState
            title={locale === "ar" ? "لا توجد بيانات مالية" : "No financial data"}
            description={locale === "ar" ? "جرّب نطاق تاريخ مختلف." : "Try a different date range."}
          />
        ) : null}
      </FinancialReportWorkspaceShell>
    </TenantLayout>
  );
}
