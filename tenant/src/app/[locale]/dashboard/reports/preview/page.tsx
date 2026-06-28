'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTenantAuth } from '@/contexts/TenantAuthContext';
import { ReportHeader } from '@/components/ReportHeader';
import { ReportExportToolbar } from '@/components/ReportExportToolbar';
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
                <table className="w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الموظف' : 'Employee'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'العمولة' : 'Commission'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإجمالي' : 'Total earnings'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.employees || []).map((emp: any) => (
                      <tr key={emp.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{emp.name}</td>
                        <td className="px-3 py-2 text-right">{emp.totalBookings ?? 0}</td>
                        <td className="px-3 py-2 text-right"><Currency amount={emp.totalRevenueGenerated ?? 0} /></td>
                        <td className="px-3 py-2 text-right"><Currency amount={emp.totalCommission ?? 0} /></td>
                        <td className="px-3 py-2 text-right"><Currency amount={emp.totalEarnings ?? 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الخدمة' : 'Service'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'إيرادك' : 'Tenant revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.services || []).map((s: any) => (
                      <tr key={s.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{locale === 'ar' ? s.name_ar : s.name_en}</td>
                        <td className="px-3 py-2 text-right">{s.totalBookings ?? 0}</td>
                        <td className="px-3 py-2 text-right"><Currency amount={s.totalRevenue ?? 0} /></td>
                        <td className="px-3 py-2 text-right"><Currency amount={s.totalTenantRevenue ?? 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الطلبات' : 'Orders'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الكمية' : 'Quantity'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'إيرادك' : 'Tenant revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.products || []).map((p: any) => (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{locale === 'ar' ? p.name_ar : p.name_en}</td>
                        <td className="px-3 py-2 text-right">{p.totalOrders ?? 0}</td>
                        <td className="px-3 py-2 text-right">{p.totalQuantity ?? 0}</td>
                        <td className="px-3 py-2 text-right"><Currency amount={p.totalRevenue ?? 0} /></td>
                        <td className="px-3 py-2 text-right"><Currency amount={p.totalTenantRevenue ?? 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الطلبات' : 'Orders'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.dailyRevenue || []).map((d: any) => (
                      <tr key={d.date} className="border-b border-gray-100">
                        <td className="px-3 py-2">{d.date}</td>
                        <td className="px-3 py-2 text-right">{d.bookings ?? 0}</td>
                        <td className="px-3 py-2 text-right">{d.orders ?? 0}</td>
                        <td className="px-3 py-2 text-right"><Currency amount={d.revenue ?? 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'المكتملة' : 'Completed'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.bookingTrends || []).map((t: any) => (
                      <tr key={t.date} className="border-b border-gray-100">
                        <td className="px-3 py-2">{t.date}</td>
                        <td className="px-3 py-2 text-right">{t.bookings ?? 0}</td>
                        <td className="px-3 py-2 text-right">{t.completed ?? 0}</td>
                        <td className="px-3 py-2 text-right"><Currency amount={t.revenue ?? 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الخدمة' : 'Service'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'معدل الإكمال' : 'Completion %'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.servicePerformance || []).map((s: any) => (
                      <tr key={s.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{locale === 'ar' ? s.name_ar : s.name_en}</td>
                        <td className="px-3 py-2 text-right">{s.totalBookings ?? 0}</td>
                        <td className="px-3 py-2 text-right"><Currency amount={s.revenue ?? 0} /></td>
                        <td className="px-3 py-2 text-right">{s.completionRate ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="w-full border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الموظف' : 'Employee'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'العمولة' : 'Commission'}</th>
                      <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'معدل الإكمال' : 'Completion %'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.employeePerformance || []).map((e: any) => (
                      <tr key={e.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{e.name}</td>
                        <td className="px-3 py-2 text-right">{e.totalBookings ?? 0}</td>
                        <td className="px-3 py-2 text-right"><Currency amount={e.revenue ?? 0} /></td>
                        <td className="px-3 py-2 text-right"><Currency amount={e.commission ?? 0} /></td>
                        <td className="px-3 py-2 text-right">{e.completionRate ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                      <table className="w-full border border-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الخدمة' : 'Service'}</th>
                            <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
                            <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الخصم' : 'Discount'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.discounts.topDiscountedServices || []).map((item: any) => (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="px-3 py-2">{locale === 'ar' ? item.name_ar : item.name_en}</td>
                              <td className="px-3 py-2 text-right">{item.bookingCount ?? 0}</td>
                              <td className="px-3 py-2 text-right"><Currency amount={item.discountAmount ?? 0} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">{locale === 'ar' ? 'أكبر الطلبات المخفضة' : 'Top discounted orders'}</p>
                      <table className="w-full border border-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الطلب' : 'Order'}</th>
                            <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'القيمة الأساسية' : 'Base amount'}</th>
                            <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الخصم' : 'Discount'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.discounts.topDiscountedOrders || []).map((item: any) => (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="px-3 py-2">{item.orderNumber}</td>
                              <td className="px-3 py-2 text-right"><Currency amount={item.baseAmount ?? 0} /></td>
                              <td className="px-3 py-2 text-right"><Currency amount={item.discountAmount ?? 0} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  <table className="w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'العميل' : 'Customer'}</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'المرجع' : 'Reference'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'المبلغ' : 'Amount'}</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'طريقة الدفع' : 'Payment method'}</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'السبب' : 'Reason'}</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'النوع' : 'Type'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.refunds?.rows || []).map((item: any) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-3 py-2">{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                          <td className="px-3 py-2">{item.customer}</td>
                          <td className="px-3 py-2">{item.reference}</td>
                          <td className="px-3 py-2 text-right"><Currency amount={item.amount ?? 0} /></td>
                          <td className="px-3 py-2">{item.paymentMethodLabel}</td>
                          <td className="px-3 py-2">{item.refundReason || '-'}</td>
                          <td className="px-3 py-2">{item.refundMode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <table className="w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الموظف' : 'Employee'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'إعادة الحجز' : 'Rebooked'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.rebookings?.topRebookingEmployees || []).map((item: any) => (
                        <tr key={item.id || item.name} className="border-b border-gray-100">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right">{item.rebookedAppointments ?? item.rebookingCount ?? 0}</td>
                          <td className="px-3 py-2 text-right"><Currency amount={item.rebookedRevenue ?? item.revenue ?? 0} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                      <table className="w-full border border-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                            <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'طريقة الدفع' : 'Payment method'}</th>
                            <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                            <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'العمليات' : 'Transactions'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.paymentMethods.trend.slice(0, 10).map((item: any, index: number) => (
                            <tr key={`${item.date || item.label || index}`} className="border-b border-gray-100">
                              <td className="px-3 py-2">{item.date || item.label || '-'}</td>
                              <td className="px-3 py-2">{item.paymentMethodLabel || item.paymentMethod || '-'}</td>
                              <td className="px-3 py-2 text-right"><Currency amount={item.revenue ?? item.totalRevenue ?? item.collected ?? 0} /></td>
                              <td className="px-3 py-2 text-right">{item.transactionCount ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <table className="w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'الطريقة' : 'Method'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'العمليات' : 'Transactions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.paymentMethods?.rows || []).map((item: any) => (
                        <tr key={item.paymentMethod} className="border-b border-gray-100">
                          <td className="px-3 py-2">{item.paymentMethodLabel}</td>
                          <td className="px-3 py-2 text-right"><Currency amount={item.revenue ?? 0} /></td>
                          <td className="px-3 py-2 text-right">{item.transactionCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <table className="w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'العميل' : 'Customer'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الزيارات' : 'Visits'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'الإجمالي' : 'Total spent'}</th>
                        <th className="border-b px-3 py-2 text-right font-semibold">{locale === 'ar' ? 'المتوسط' : 'Average spend'}</th>
                        <th className="border-b px-3 py-2 text-left font-semibold">{locale === 'ar' ? 'آخر زيارة' : 'Last visit'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.customerSales || []).map((item: any) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-3 py-2">{item.customerName || item.customer || item.name || item.id}</td>
                          <td className="px-3 py-2 text-right">{item.bookings ?? item.visits ?? 0}</td>
                          <td className="px-3 py-2 text-right"><Currency amount={item.revenue ?? item.totalSpent ?? 0} /></td>
                          <td className="px-3 py-2 text-right"><Currency amount={item.averageSpend ?? 0} /></td>
                          <td className="px-3 py-2">{item.lastVisit ? new Date(item.lastVisit).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
