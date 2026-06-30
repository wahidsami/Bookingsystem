"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { FinanceMetricCard, FinanceSectionCard } from "@/components/FinanceWorkspaceShell";
import { ReportingStickyToolbar } from "@/components/ReportingStickyToolbar";
import { ReportOptionsMenu } from "@/components/ReportOptionsMenu";
import { useReportingDateRange } from "@/components/useReportingDateRange";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { tenantApi } from "@/lib/api";
import { exportCsv, exportExcel, printReport } from "@/lib/reportExportService";
import { SALES_REPORT_NAV_ITEMS } from "@/lib/salesReportConfig";

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SalesReportsHubPage() {
  const locale = useLocale();
  const { user } = useTenantAuth();
  const { selectedPreset, setSelectedPreset, startDate, setStartDate, endDate, setEndDate } = useReportingDateRange("last_30_days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [giftSummary, setGiftSummary] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const [overviewRes, giftSummaryRes] = await Promise.allSettled([
          tenantApi.getFinancialOverview({ startDate, endDate }),
          tenantApi.getTenantGiftCardSummary({ startDate, endDate })
        ]);

        if (!mounted) return;

        if (overviewRes.status === "fulfilled" && overviewRes.value?.success) {
          setOverview(overviewRes.value.overview || overviewRes.value.data || null);
        } else {
          setOverview(null);
        }

        if (giftSummaryRes.status === "fulfilled" && giftSummaryRes.value?.success) {
          setGiftSummary(giftSummaryRes.value.summary || giftSummaryRes.value.data || null);
        } else {
          setGiftSummary(null);
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || (locale === "ar" ? "فشل تحميل بيانات المبيعات." : "Failed to load sales data."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [endDate, locale, startDate]);

  const metrics = useMemo(() => ({
    grossSales: safeNumber(overview?.totalRevenue),
    discounts: safeNumber(overview?.totalDiscountAmount),
    refunds: safeNumber(overview?.totalRefunds),
    taxes: safeNumber(overview?.totalTax),
    giftCards: safeNumber(giftSummary?.grossSales || giftSummary?.totalRevenue)
  }), [giftSummary, overview]);

  const duplicateHref = `/${locale}/dashboard/reports/generate?${new URLSearchParams({
    startDate,
    endDate,
    title: locale === "ar" ? "نسخة من مركز المبيعات" : "Sales hub copy",
    sections: "overview,employees,services,products,discounts,refunds,paymentMethods,customerSales"
  }).toString()}`;

  const handleExportCsv = () => {
    exportCsv({
      fileName: "sales-hub",
      reportTitle: locale === "ar" ? "مركز المبيعات" : "Sales hub",
      startDate,
      endDate,
      sections: ["overview"],
      tables: [
        {
          title: locale === "ar" ? "لقطة سريعة" : "Quick snapshot",
          columns: [locale === "ar" ? "المؤشر" : "Metric", locale === "ar" ? "القيمة" : "Value"],
          rows: [
            [locale === "ar" ? "إجمالي الإيراد" : "Gross sales", metrics.grossSales],
            [locale === "ar" ? "الخصومات" : "Discounts", metrics.discounts],
            [locale === "ar" ? "الاستردادات" : "Refunds", metrics.refunds],
            [locale === "ar" ? "الضرائب" : "Taxes", metrics.taxes],
            [locale === "ar" ? "بطاقات الهدايا" : "Gift cards", metrics.giftCards]
          ]
        }
      ]
    });
  };

  const handleExportExcel = () => {
    void exportExcel({
      fileName: "sales-hub",
      reportTitle: locale === "ar" ? "مركز المبيعات" : "Sales hub",
      startDate,
      endDate,
      sections: ["overview"],
      tables: [
        {
          title: locale === "ar" ? "لقطة سريعة" : "Quick snapshot",
          columns: [locale === "ar" ? "المؤشر" : "Metric", locale === "ar" ? "القيمة" : "Value"],
          rows: [
            [locale === "ar" ? "إجمالي الإيراد" : "Gross sales", metrics.grossSales],
            [locale === "ar" ? "الخصومات" : "Discounts", metrics.discounts],
            [locale === "ar" ? "الاستردادات" : "Refunds", metrics.refunds],
            [locale === "ar" ? "الضرائب" : "Taxes", metrics.taxes],
            [locale === "ar" ? "بطاقات الهدايا" : "Gift cards", metrics.giftCards]
          ]
        }
      ]
    });
  };

  return (
    <TenantLayout>
      <div className="space-y-5">
        <ReportingStickyToolbar
          locale={locale}
          title={locale === "ar" ? "مركز المبيعات" : "Sales hub"}
          subtitle={locale === "ar"
            ? "بوابة سريعة لوحدات المبيعات الجديدة مع نفس نطاق التاريخ والخيارات."
            : "A quick launchpad for the new sales reporting workspaces with shared dates and options."
          }
          selectedPreset={selectedPreset}
          startDate={startDate}
          endDate={endDate}
          onPresetChange={setSelectedPreset}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          actions={
            <>
              <Link href={`/${locale}/dashboard/reports`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                {locale === "ar" ? "التقارير" : "Reports"}
              </Link>
              <Link href={`/${locale}/dashboard/reports/generate`} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
                {locale === "ar" ? "إنشاء تقرير" : "Generate report"}
              </Link>
            </>
          }
          optionsMenu={
            <ReportOptionsMenu
              locale={locale}
              isFavorite={false}
              onDuplicate={() => {
                window.location.href = duplicateHref;
              }}
              onToggleFavorite={() => undefined}
              onExportCsv={handleExportCsv}
              onExportXlsx={handleExportExcel}
              onExportPdf={printReport}
              onPrint={printReport}
            />
          }
        />

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-3xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard label={locale === "ar" ? "إجمالي الإيراد" : "Gross sales"} value={<Currency amount={metrics.grossSales} />} tone="green" />
              <FinanceMetricCard label={locale === "ar" ? "الخصومات" : "Discounts"} value={<Currency amount={metrics.discounts} />} tone="amber" />
              <FinanceMetricCard label={locale === "ar" ? "الاستردادات" : "Refunds"} value={<Currency amount={metrics.refunds} />} tone="rose" />
              <FinanceMetricCard label={locale === "ar" ? "إيراد بطاقات الهدايا" : "Gift card revenue"} value={<Currency amount={metrics.giftCards} />} tone="blue" />
            </div>

            <FinanceSectionCard
              title={locale === "ar" ? "أدلة التقارير" : "Report launchers"}
              subtitle={locale === "ar" ? "انتقل مباشرة إلى وحدات المبيعات المتخصصة." : "Jump directly into the specialized sales workspaces."}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {SALES_REPORT_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${locale}${item.href}`}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      {locale === "ar" ? "Workspace" : "Workspace"}
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-gray-900">{locale === "ar" ? item.labelAr : item.labelEn}</h3>
                    <p className="mt-2 text-sm text-gray-600">{locale === "ar" ? item.descriptionAr : item.descriptionEn}</p>
                  </Link>
                ))}
              </div>
            </FinanceSectionCard>
          </>
        )}
      </div>
    </TenantLayout>
  );
}
