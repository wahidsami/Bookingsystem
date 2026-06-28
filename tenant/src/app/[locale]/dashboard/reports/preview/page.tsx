'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTenantAuth } from '@/contexts/TenantAuthContext';
import { ReportHeader } from '@/components/ReportHeader';
import { ReportExportToolbar } from '@/components/ReportExportToolbar';
import { AnalyticsDataTable } from '@/components/AnalyticsDataTable';
import { API_BASE_URL, tenantApi } from '@/lib/api';
import { Currency } from '@/components/Currency';
import { ReportPdfDebugPanel, type ReportPdfDebugState } from '@/components/ReportPdfDebugPanel';
import {
  exportEmployeesToCsv,
  exportServicesToCsv,
  exportProductsToCsv,
  exportDailyRevenueToCsv,
  exportBookingTrendsToCsv,
  exportServicePerformanceToCsv,
  exportEmployeePerformanceToCsv,
} from '@/utils/csvExport';
import {
  buildReportExportTables,
  exportCsv,
  exportExcel,
  exportPdf,
  printReport
} from '@/lib/reportExportService';
import type { ReportSectionId } from '../generate/page';

function EmptyReportSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="break-inside-avoid rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </section>
  );
}

function getGenerateHref({
  locale,
  startDate,
  endDate,
  sections,
  reportTitle,
  notes,
}: {
  locale: string;
  startDate: string;
  endDate: string;
  sections: ReportSectionId[];
  reportTitle?: string;
  notes?: string;
}) {
  const query = new URLSearchParams({
    startDate,
    endDate,
    sections: sections.join(','),
  });
  if (reportTitle?.trim()) query.set('title', reportTitle.trim());
  if (notes?.trim()) query.set('notes', notes.trim());
  return `/${locale}/dashboard/reports/generate?${query.toString()}`;
}

export default function ReportPreviewPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { user } = useTenantAuth();

  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const sectionsParam = searchParams.get('sections') || 'overview';
  const sections = useMemo(
    () => sectionsParam.split(',').filter(Boolean) as ReportSectionId[],
    [sectionsParam]
  );
  const reportTitle = searchParams.get('title') || '';
  const notes = searchParams.get('notes') || '';

  const [loading, setLoading] = useState(true);
  const [downloadError, setDownloadError] = useState<string>('');
  const [pdfDebug, setPdfDebug] = useState<ReportPdfDebugState | null>(null);
  const [data, setData] = useState<Record<string, any>>({});

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!startDate || !endDate) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const r = await tenantApi.getFullReport({ startDate, endDate, sections });
        if (isMounted && r?.success && r?.data) {
          setData(r.data);
        }
      } catch (err) {
        console.error('Report fetch error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [endDate, sections, startDate]);

  const tenantName = user?.businessName || (locale === 'ar' ? 'النشاط' : 'Business');
  const previewExportData = useMemo(() => ({
    overview: data.overview,
    summary: data.overview,
    financialOverview: data.overview,
    bookingTrends: data.bookingTrends,
    dailyRevenue: data.dailyRevenue,
    servicePerformance: data.servicePerformance,
    employeePerformance: data.employeePerformance || data.employees,
    employees: data.employees || data.employeePerformance,
    services: data.services,
    products: data.products,
    discounts: data.discounts,
    refunds: data.refunds,
    paymentMethods: data.paymentMethods,
    customerAnalytics: data.customerAnalytics,
    rebookings: data.rebookings,
    posClosingSummary: data.posClosingSummary
  }), [data]);
  const previewExportTables = useMemo(
    () =>
      buildReportExportTables({
        locale,
        sections,
        data: previewExportData
      }),
    [locale, previewExportData, sections]
  );
  const previewReportTitle = reportTitle || (locale === 'ar' ? 'تقرير مخصص' : 'Custom report');
  const previewEditHref = getGenerateHref({
    locale,
    startDate,
    endDate,
    sections,
    reportTitle,
    notes
  });
  const previewPdfUrl = `${API_BASE_URL}/tenant/reports/pdf?${new URLSearchParams({
    startDate,
    endDate,
    sections: sections.join(','),
    title: previewReportTitle
  }).toString()}`;

  const handleExportPdf = async () => {
    const startedAt = new Date();
    const requestUrl = previewPdfUrl;
    setPdfDebug({
      status: 'running',
      startedAt: startedAt.toISOString(),
      requestUrl,
      startDate,
      endDate,
      sections,
      title: previewReportTitle
    });
    try {
      setDownloadError('');
      const file = await exportPdf({
        startDate,
        endDate,
        sections,
        title: previewReportTitle
      });
      setPdfDebug({
        status: 'success',
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        requestUrl,
        startDate,
        endDate,
        sections,
        title: previewReportTitle,
        filename: file.filename
      });
    } catch (err: any) {
      console.error('Failed to download report PDF:', err);
      setPdfDebug({
        status: 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        requestUrl,
        startDate,
        endDate,
        sections,
        title: previewReportTitle,
        httpStatus: err?.status,
        statusText: err?.statusText,
        contentType: err?.contentType,
        errorMessage: err?.message,
        responseBody: err?.responsePreview || err?.responseBody
      });
      setDownloadError(
        err?.message
          || (locale === 'ar' ? 'تعذر تنزيل ملف PDF. حاول مرة أخرى.' : 'Failed to download PDF. Please try again.')
      );
    }
  };

  const handleExportCsv = () => {
    setDownloadError('');
    exportCsv({
      fileName: previewReportTitle,
      reportTitle: previewReportTitle,
      startDate,
      endDate,
      sections,
      tables: previewExportTables,
    });
  };

  const handleExportExcel = async () => {
    try {
      setDownloadError('');
      await exportExcel({
        fileName: previewReportTitle,
        reportTitle: previewReportTitle,
        startDate,
        endDate,
        sections,
        tables: previewExportTables,
      });
    } catch (err: any) {
      console.error('Failed to download report Excel:', err);
      setDownloadError(
        err?.message
          || (locale === 'ar' ? 'تعذر تنزيل ملف Excel. حاول مرة أخرى.' : 'Failed to download Excel. Please try again.')
      );
    }
  };

  if (!startDate || !endDate) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        <p className="text-gray-600 mb-4">{locale === 'ar' ? 'معلمات التقرير غير صالحة.' : 'Invalid report parameters.'}</p>
        <Link href={`/${locale}/dashboard/reports/generate`} className="text-primary-600 underline">
          {locale === 'ar' ? 'العودة إلى إنشاء التقرير' : 'Back to Generate report'}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${locale}/dashboard/reports`}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {locale === 'ar' ? 'العودة إلى التقارير' : 'Back to Reports'}
          </Link>
          <Link
            href={previewEditHref}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {locale === 'ar' ? 'تعديل التقرير' : 'Edit report'}
          </Link>
        </div>
        <ReportExportToolbar
          locale={locale}
          previewHref={previewEditHref}
          previewLabel={locale === 'ar' ? 'تعديل' : 'Edit'}
          onExportPdf={handleExportPdf}
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onPrint={printReport}
          disabled={loading}
        />
      </div>
      <ReportPdfDebugPanel
        locale={locale}
        debug={pdfDebug}
        onClear={() => setPdfDebug(null)}
      />
      {downloadError ? (
        <div className="no-print mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {downloadError}
        </div>
      ) : null}

      <div className="report-print-area max-w-4xl">
        <ReportHeader
          tenantName={tenantName}
          startDate={startDate}
          endDate={endDate}
          reportTitle={reportTitle || undefined}
          generatedAt={new Date()}
          notes={notes || undefined}
          isRTL={isRTL}
        />

        {loading ? (
          <p className="text-gray-500">{locale === 'ar' ? 'جاري تحميل التقرير...' : 'Loading report...'}</p>
        ) : (
          <div className="space-y-8">
            {sections.includes('overview') && data.overview && (
              <section className="break-inside-avoid">
                <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'نظرة مالية' : 'Financial overview'}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-600">{locale === 'ar' ? 'إجمالي الإيرادات:' : 'Total revenue:'}</span> <Currency amount={data.overview?.totalRevenue ?? 0} /></div>
                  <div><span className="text-gray-600">{locale === 'ar' ? 'إيرادك:' : 'Tenant revenue:'}</span> <Currency amount={data.overview?.totalTenantRevenue ?? 0} /></div>
                  <div><span className="text-gray-600">{locale === 'ar' ? 'صافي الإيرادات:' : 'Net revenue:'}</span> <Currency amount={data.overview?.netRevenue ?? 0} /></div>
                  <div><span className="text-gray-600">{locale === 'ar' ? 'الحجوزات:' : 'Bookings:'}</span> {data.overview?.totalBookings ?? 0}</div>
                </div>
              </section>
            )}

            {sections.includes('employees') && data.employees && (
              <section className="break-inside-avoid">
                <div className="flex items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locale === 'ar' ? 'إيراد الموظفين' : 'Employee revenue'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => exportEmployeesToCsv(data.employees, startDate, endDate)}
                    className="no-print text-sm text-primary-600 hover:underline"
                  >
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </button>
                </div>
                <AnalyticsDataTable
                  columns={[
                    { id: 'employee', header: locale === 'ar' ? 'الموظف' : 'Employee' },
                    { id: 'bookings', header: locale === 'ar' ? 'الحجوزات' : 'Bookings', align: 'right' },
                    { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                    { id: 'commission', header: locale === 'ar' ? 'العمولة' : 'Commission', align: 'right' },
                    { id: 'earnings', header: locale === 'ar' ? 'الإجمالي' : 'Total earnings', align: 'right' },
                  ]}
                  rows={(data.employees || []).map((emp: any) => [
                    emp.name,
                    emp.totalBookings ?? 0,
                    <Currency amount={emp.totalRevenueGenerated ?? 0} />,
                    <Currency amount={emp.totalCommission ?? 0} />,
                    <Currency amount={emp.totalEarnings ?? 0} />,
                  ])}
                  sourceLabel={locale === 'ar' ? 'الموظفين' : 'employees'}
                />
              </section>
            )}

            {sections.includes('services') && data.services && (
              <section className="break-inside-avoid">
                <div className="flex items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locale === 'ar' ? 'إيراد الخدمات' : 'Service revenue'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => exportServicesToCsv(data.services, startDate, endDate, locale)}
                    className="no-print text-sm text-primary-600 hover:underline"
                  >
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </button>
                </div>
                <AnalyticsDataTable
                  columns={[
                    { id: 'service', header: locale === 'ar' ? 'الخدمة' : 'Service' },
                    { id: 'bookings', header: locale === 'ar' ? 'الحجوزات' : 'Bookings', align: 'right' },
                    { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                    { id: 'tenant-revenue', header: locale === 'ar' ? 'إيرادك' : 'Tenant revenue', align: 'right' },
                  ]}
                  rows={(data.services || []).map((s: any) => [
                    locale === 'ar' ? s.name_ar : s.name_en,
                    s.totalBookings ?? 0,
                    <Currency amount={s.totalRevenue ?? 0} />,
                    <Currency amount={s.totalTenantRevenue ?? 0} />,
                  ])}
                  sourceLabel={locale === 'ar' ? 'الخدمات' : 'services'}
                />
              </section>
            )}

            {sections.includes('products') && data.products && (
              <section className="break-inside-avoid">
                <div className="flex items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locale === 'ar' ? 'إيراد المنتجات' : 'Product revenue'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => exportProductsToCsv(data.products, startDate, endDate, locale)}
                    className="no-print text-sm text-primary-600 hover:underline"
                  >
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </button>
                </div>
                <AnalyticsDataTable
                  columns={[
                    { id: 'product', header: locale === 'ar' ? 'المنتج' : 'Product' },
                    { id: 'orders', header: locale === 'ar' ? 'الطلبات' : 'Orders', align: 'right' },
                    { id: 'quantity', header: locale === 'ar' ? 'الكمية' : 'Quantity', align: 'right' },
                    { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                    { id: 'tenant-revenue', header: locale === 'ar' ? 'إيرادك' : 'Tenant revenue', align: 'right' },
                  ]}
                  rows={(data.products || []).map((p: any) => [
                    locale === 'ar' ? p.name_ar : p.name_en,
                    p.totalOrders ?? 0,
                    p.totalQuantity ?? 0,
                    <Currency amount={p.totalRevenue ?? 0} />,
                    <Currency amount={p.totalTenantRevenue ?? 0} />,
                  ])}
                  sourceLabel={locale === 'ar' ? 'المنتجات' : 'products'}
                />
              </section>
            )}

            {sections.includes('daily') && data.dailyRevenue && data.dailyRevenue.length > 0 && (
              <section className="break-inside-avoid">
                <div className="flex items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locale === 'ar' ? 'الإيراد اليومي' : 'Daily revenue'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => exportDailyRevenueToCsv(data.dailyRevenue, startDate, endDate)}
                    className="no-print text-sm text-primary-600 hover:underline"
                  >
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </button>
                </div>
                <AnalyticsDataTable
                  columns={[
                    { id: 'date', header: locale === 'ar' ? 'التاريخ' : 'Date' },
                    { id: 'bookings', header: locale === 'ar' ? 'الحجوزات' : 'Bookings', align: 'right' },
                    { id: 'orders', header: locale === 'ar' ? 'الطلبات' : 'Orders', align: 'right' },
                    { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                  ]}
                  rows={(data.dailyRevenue || []).map((d: any) => [
                    d.date,
                    d.bookings ?? 0,
                    d.orders ?? 0,
                    <Currency amount={d.revenue ?? 0} />,
                  ])}
                  sourceLabel={locale === 'ar' ? 'الأيام' : 'days'}
                />
              </section>
            )}

            {sections.includes('bookingTrends') && data.bookingTrends && data.bookingTrends.length > 0 && (
              <section className="break-inside-avoid">
                <div className="flex items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locale === 'ar' ? 'اتجاهات الحجز' : 'Booking trends'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => exportBookingTrendsToCsv(data.bookingTrends, startDate, endDate)}
                    className="no-print text-sm text-primary-600 hover:underline"
                  >
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </button>
                </div>
                <AnalyticsDataTable
                  columns={[
                    { id: 'date', header: locale === 'ar' ? 'التاريخ' : 'Date' },
                    { id: 'bookings', header: locale === 'ar' ? 'الحجوزات' : 'Bookings', align: 'right' },
                    { id: 'completed', header: locale === 'ar' ? 'المكتملة' : 'Completed', align: 'right' },
                    { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                  ]}
                  rows={(data.bookingTrends || []).map((t: any) => [
                    t.date,
                    t.bookings ?? 0,
                    t.completed ?? 0,
                    <Currency amount={t.revenue ?? 0} />,
                  ])}
                  sourceLabel={locale === 'ar' ? 'الأيام' : 'days'}
                />
              </section>
            )}

            {sections.includes('servicePerformance') && data.servicePerformance && data.servicePerformance.length > 0 && (
              <section className="break-inside-avoid">
                <div className="flex items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locale === 'ar' ? 'أداء الخدمات' : 'Service performance'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => exportServicePerformanceToCsv(data.servicePerformance, startDate, endDate, locale)}
                    className="no-print text-sm text-primary-600 hover:underline"
                  >
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </button>
                </div>
                <AnalyticsDataTable
                  columns={[
                    { id: 'service', header: locale === 'ar' ? 'الخدمة' : 'Service' },
                    { id: 'bookings', header: locale === 'ar' ? 'الحجوزات' : 'Bookings', align: 'right' },
                    { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                    { id: 'completion', header: locale === 'ar' ? 'معدل الإكمال' : 'Completion %', align: 'right' },
                  ]}
                  rows={(data.servicePerformance || []).map((s: any) => [
                    locale === 'ar' ? s.name_ar : s.name_en,
                    s.totalBookings ?? 0,
                    <Currency amount={s.revenue ?? 0} />,
                    `${s.completionRate ?? 0}%`,
                  ])}
                  sourceLabel={locale === 'ar' ? 'الخدمات' : 'services'}
                />
              </section>
            )}

            {sections.includes('employeePerformance') && data.employeePerformance && data.employeePerformance.length > 0 && (
              <section className="break-inside-avoid">
                <div className="flex items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {locale === 'ar' ? 'أداء الموظفين' : 'Employee performance'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => exportEmployeePerformanceToCsv(data.employeePerformance, startDate, endDate)}
                    className="no-print text-sm text-primary-600 hover:underline"
                  >
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </button>
                </div>
                <AnalyticsDataTable
                  columns={[
                    { id: 'employee', header: locale === 'ar' ? 'الموظف' : 'Employee' },
                    { id: 'bookings', header: locale === 'ar' ? 'الحجوزات' : 'Bookings', align: 'right' },
                    { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                    { id: 'commission', header: locale === 'ar' ? 'العمولة' : 'Commission', align: 'right' },
                    { id: 'completion', header: locale === 'ar' ? 'معدل الإكمال' : 'Completion %', align: 'right' },
                  ]}
                  rows={(data.employeePerformance || []).map((e: any) => [
                    e.name,
                    e.totalBookings ?? 0,
                    <Currency amount={e.revenue ?? 0} />,
                    <Currency amount={e.commission ?? 0} />,
                    `${e.completionRate ?? 0}%`,
                  ])}
                  sourceLabel={locale === 'ar' ? 'الموظفين' : 'employees'}
                />
              </section>
            )}

            {sections.includes('peakHours') && data.peakHours && (
              <section className="break-inside-avoid">
                <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'ساعات الذروة' : 'Peak hours'}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {locale === 'ar' ? 'أوقات الذروة: ' : 'Peak hours: '}
                  {(data.peakHours.peakHours || []).join(', ')}
                </p>
                <p className="text-sm text-gray-600">
                  {locale === 'ar' ? 'أكثر الأيام ازدحاماً: ' : 'Busiest days: '}
                  {(data.peakHours.busiestDays || []).join(', ')}
                </p>
              </section>
            )}

            {sections.includes('customerAnalytics') && data.customerAnalytics && (
              <section className="break-inside-avoid">
                <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'تحليلات العملاء' : 'Customer analytics'}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-600">{locale === 'ar' ? 'إجمالي العملاء:' : 'Total customers:'}</span> {data.customerAnalytics.totalCustomers ?? 0}</div>
                  <div><span className="text-gray-600">{locale === 'ar' ? 'عملاء جدد:' : 'New customers:'}</span> {data.customerAnalytics.newCustomers ?? 0}</div>
                  <div><span className="text-gray-600">{locale === 'ar' ? 'العائدون:' : 'Returning:'}</span> {data.customerAnalytics.returningCustomers ?? 0}</div>
                  <div><span className="text-gray-600">{locale === 'ar' ? 'معدل الاحتفاظ:' : 'Retention rate:'}</span> {data.customerAnalytics.retentionRate ?? 0}%</div>
                </div>
              </section>
            )}

            {sections.includes('discounts') && (
              data.discounts ? (
                <section className="break-inside-avoid">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'تقرير الخصومات' : 'Discounts report'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div><span className="text-gray-600">{locale === 'ar' ? 'إجمالي الخصومات:' : 'Total discounts:'}</span> <Currency amount={data.discounts.totalDiscountAmount ?? 0} /></div>
                    <div><span className="text-gray-600">{locale === 'ar' ? 'خصومات الحجوزات:' : 'Booking discounts:'}</span> <Currency amount={data.discounts.appointmentDiscountAmount ?? 0} /></div>
                    <div><span className="text-gray-600">{locale === 'ar' ? 'خصومات الطلبات:' : 'Order discounts:'}</span> <Currency amount={data.discounts.orderDiscountAmount ?? 0} /></div>
                    <div><span className="text-gray-600">{locale === 'ar' ? 'متوسط الخصم:' : 'Average discount:'}</span> <Currency amount={data.discounts.averageDiscountAmount ?? 0} /></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">{locale === 'ar' ? 'أكبر الخدمات المخفضة' : 'Top discounted services'}</p>
                      <AnalyticsDataTable
                        columns={[
                          { id: 'service', header: locale === 'ar' ? 'الخدمة' : 'Service' },
                          { id: 'bookings', header: locale === 'ar' ? 'الحجوزات' : 'Bookings', align: 'right' },
                          { id: 'discount', header: locale === 'ar' ? 'الخصم' : 'Discount', align: 'right' },
                        ]}
                        rows={(data.discounts.topDiscountedServices || []).map((item: any) => [
                          locale === 'ar' ? item.name_ar : item.name_en,
                          item.bookingCount ?? 0,
                          <Currency amount={item.discountAmount ?? 0} />,
                        ])}
                        countLabel={
                          (data.discounts.topDiscountedServices || []).length
                            ? (locale === 'ar'
                              ? `عرض أفضل ${(data.discounts.topDiscountedServices || []).length} سجلات`
                              : `Showing Top ${(data.discounts.topDiscountedServices || []).length} Records`)
                            : undefined
                        }
                        sourceLabel={locale === 'ar' ? 'الخدمات' : 'services'}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">{locale === 'ar' ? 'أكبر الطلبات المخفضة' : 'Top discounted orders'}</p>
                      <AnalyticsDataTable
                        columns={[
                          { id: 'order', header: locale === 'ar' ? 'الطلب' : 'Order' },
                          { id: 'base', header: locale === 'ar' ? 'القيمة الأساسية' : 'Base amount', align: 'right' },
                          { id: 'discount', header: locale === 'ar' ? 'الخصم' : 'Discount', align: 'right' },
                        ]}
                        rows={(data.discounts.topDiscountedOrders || []).map((item: any) => [
                          item.orderNumber,
                          <Currency amount={item.baseAmount ?? 0} />,
                          <Currency amount={item.discountAmount ?? 0} />,
                        ])}
                        countLabel={
                          (data.discounts.topDiscountedOrders || []).length
                            ? (locale === 'ar'
                              ? `عرض أفضل ${(data.discounts.topDiscountedOrders || []).length} سجلات`
                              : `Showing Top ${(data.discounts.topDiscountedOrders || []).length} Records`)
                            : undefined
                        }
                        sourceLabel={locale === 'ar' ? 'الطلبات' : 'orders'}
                      />
                    </div>
                  </div>
                </section>
              ) : (
                <EmptyReportSection
                  title={locale === 'ar' ? 'تقرير الخصومات' : 'Discounts report'}
                  description={locale === 'ar'
                    ? 'لا توجد خصومات مسجلة ضمن هذا النطاق.'
                    : 'No recorded discounts were found for this range.'}
                />
              )
            )}

            {sections.includes('refunds') && (
              data.refunds ? (
                <section className="break-inside-avoid">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'تقرير الاستردادات' : 'Refunds report'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div><span className="text-gray-600">{locale === 'ar' ? 'إجمالي الاسترداد:' : 'Refunds total:'}</span> <Currency amount={data.refunds?.totals?.totalRefunds ?? 0} /></div>
                    <div><span className="text-gray-600">{locale === 'ar' ? 'عدد الاستردادات:' : 'Refund count:'}</span> {data.refunds?.totals?.refundCount ?? 0}</div>
                  </div>
                  <AnalyticsDataTable
                    columns={[
                      { id: 'date', header: locale === 'ar' ? 'التاريخ' : 'Date' },
                      { id: 'customer', header: locale === 'ar' ? 'العميل' : 'Customer' },
                      { id: 'reference', header: locale === 'ar' ? 'المرجع' : 'Reference' },
                      { id: 'amount', header: locale === 'ar' ? 'المبلغ' : 'Amount', align: 'right' },
                      { id: 'method', header: locale === 'ar' ? 'طريقة الدفع' : 'Payment method' },
                      { id: 'reason', header: locale === 'ar' ? 'السبب' : 'Reason' },
                      { id: 'type', header: locale === 'ar' ? 'النوع' : 'Type' },
                    ]}
                    rows={(data.refunds?.rows || []).map((item: any) => [
                      item.date ? new Date(item.date).toLocaleDateString() : '-',
                      item.customer,
                      item.reference,
                      <Currency amount={item.amount ?? 0} />,
                      item.paymentMethodLabel,
                      item.refundReason || '-',
                      item.refundMode,
                    ])}
                    sourceLabel={locale === 'ar' ? 'الاستردادات' : 'refunds'}
                  />
                </section>
              ) : (
                <EmptyReportSection
                  title={locale === 'ar' ? 'تقرير الاستردادات' : 'Refunds report'}
                  description={locale === 'ar'
                    ? 'لم يتم العثور على استردادات ضمن هذا النطاق.'
                    : 'No refund transactions were found in this range.'}
                />
              )
            )}

            {sections.includes('rebookings') && (
              data.rebookings ? (
                <section className="break-inside-avoid">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'تحليلات إعادة الحجز' : 'Rebooking analytics'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div><span className="text-gray-600">{locale === 'ar' ? 'معدل إعادة الحجز:' : 'Rebooking rate:'}</span> {data.rebookings?.totals?.rebookingRate ?? 0}%</div>
                    <div><span className="text-gray-600">{locale === 'ar' ? 'العملاء المتكررون:' : 'Repeat customers:'}</span> {data.rebookings?.totals?.repeatCustomers ?? 0}</div>
                    <div><span className="text-gray-600">{locale === 'ar' ? 'إيراد معاد حجزه:' : 'Rebooked revenue:'}</span> <Currency amount={data.rebookings?.totals?.rebookedRevenue ?? 0} /></div>
                    <div><span className="text-gray-600">{locale === 'ar' ? 'الحجوزات المعادة:' : 'Rebooked appointments:'}</span> {data.rebookings?.totals?.rebookedAppointments ?? 0}</div>
                  </div>
                  <AnalyticsDataTable
                    columns={[
                      { id: 'employee', header: locale === 'ar' ? 'الموظف' : 'Employee' },
                      { id: 'rebooked', header: locale === 'ar' ? 'إعادة الحجز' : 'Rebooked', align: 'right' },
                      { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                    ]}
                    rows={(data.rebookings?.topRebookingEmployees || []).map((item: any) => [
                      item.name,
                      item.rebookedAppointments ?? item.rebookingCount ?? 0,
                      <Currency amount={item.rebookedRevenue ?? item.revenue ?? 0} />,
                    ])}
                    countLabel={
                      (data.rebookings?.topRebookingEmployees || []).length
                        ? (locale === 'ar'
                          ? `عرض أفضل ${(data.rebookings?.topRebookingEmployees || []).length} سجلات`
                          : `Showing Top ${(data.rebookings?.topRebookingEmployees || []).length} Records`)
                        : undefined
                    }
                    sourceLabel={locale === 'ar' ? 'الموظفين' : 'employees'}
                  />
                </section>
              ) : (
                <EmptyReportSection
                  title={locale === 'ar' ? 'تحليلات إعادة الحجز' : 'Rebooking analytics'}
                  description={locale === 'ar' ? 'لم يتم العثور على بيانات إعادة الحجز ضمن هذا النطاق.' : 'No rebooking analytics were found for this range.'}
                />
              )
            )}

            {sections.includes('paymentMethods') && (
              data.paymentMethods ? (
                <section className="break-inside-avoid">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'طرق الدفع' : 'Payment methods'}
                  </h3>
                  {Array.isArray(data.paymentMethods?.trend) && data.paymentMethods.trend.length > 0 && (
                    <div className="mb-4">
                      <AnalyticsDataTable
                        columns={[
                          { id: 'date', header: locale === 'ar' ? 'التاريخ' : 'Date' },
                          { id: 'method', header: locale === 'ar' ? 'طريقة الدفع' : 'Payment method' },
                          { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                          { id: 'transactions', header: locale === 'ar' ? 'العمليات' : 'Transactions', align: 'right' },
                        ]}
                        rows={(data.paymentMethods.trend || []).map((item: any, index: number) => [
                          item.date || item.label || '-',
                          item.paymentMethodLabel || item.paymentMethod || '-',
                          <Currency amount={item.revenue ?? item.totalRevenue ?? item.collected ?? 0} />,
                          item.transactionCount ?? 0,
                        ])}
                        sourceLabel={locale === 'ar' ? 'المدفوعات' : 'payments'}
                      />
                    </div>
                  )}
                  <AnalyticsDataTable
                    columns={[
                      { id: 'method', header: locale === 'ar' ? 'الطريقة' : 'Method' },
                      { id: 'revenue', header: locale === 'ar' ? 'الإيراد' : 'Revenue', align: 'right' },
                      { id: 'transactions', header: locale === 'ar' ? 'العمليات' : 'Transactions', align: 'right' },
                    ]}
                    rows={(data.paymentMethods?.rows || []).map((item: any) => [
                      item.paymentMethodLabel,
                      <Currency amount={item.revenue ?? 0} />,
                      item.transactionCount ?? 0,
                    ])}
                    sourceLabel={locale === 'ar' ? 'طرق الدفع' : 'payment methods'}
                  />
                </section>
              ) : (
                <EmptyReportSection
                  title={locale === 'ar' ? 'طرق الدفع' : 'Payment methods'}
                  description={locale === 'ar'
                    ? 'تفصيل طرق الدفع غير متوفر لهذا النطاق.'
                    : 'No payment method breakdown is available for this range.'}
                />
              )
            )}

            {sections.includes('customerSales') && (
              data.customerSales ? (
                <section className="break-inside-avoid">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'مبيعات العملاء' : 'Customer sales'}
                  </h3>
                  <AnalyticsDataTable
                    columns={[
                      { id: 'customer', header: locale === 'ar' ? 'العميل' : 'Customer' },
                      { id: 'visits', header: locale === 'ar' ? 'الزيارات' : 'Visits', align: 'right' },
                      { id: 'total', header: locale === 'ar' ? 'الإجمالي' : 'Total spent', align: 'right' },
                      { id: 'average', header: locale === 'ar' ? 'المتوسط' : 'Average spend', align: 'right' },
                      { id: 'last-visit', header: locale === 'ar' ? 'آخر زيارة' : 'Last visit' },
                    ]}
                    rows={(data.customerSales || []).map((item: any) => [
                      item.customerName || item.customer || item.name || item.id,
                      item.bookings ?? item.visits ?? 0,
                      <Currency amount={item.revenue ?? item.totalSpent ?? 0} />,
                      <Currency amount={item.averageSpend ?? 0} />,
                      item.lastVisit ? new Date(item.lastVisit).toLocaleDateString() : '-',
                    ])}
                    sourceLabel={locale === 'ar' ? 'العملاء' : 'customers'}
                  />
                </section>
              ) : (
                <EmptyReportSection
                  title={locale === 'ar' ? 'مبيعات العملاء' : 'Customer sales'}
                  description={locale === 'ar'
                    ? 'تقرير مبيعات العملاء غير متوفر لهذا النطاق.'
                    : 'No customer sales data is available for this range.'}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
