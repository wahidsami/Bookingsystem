'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTenantAuth } from '@/contexts/TenantAuthContext';
import { ReportHeader } from '@/components/ReportHeader';
import { tenantApi } from '@/lib/api';
import { Currency } from '@/components/Currency';
import {
  exportEmployeesToCsv,
  exportServicesToCsv,
  exportProductsToCsv,
  exportDailyRevenueToCsv,
  exportBookingTrendsToCsv,
  exportServicePerformanceToCsv,
  exportEmployeePerformanceToCsv,
} from '@/utils/csvExport';
import type { ReportSectionId } from '../generate/page';

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
  const sections = sectionsParam.split(',').filter(Boolean) as ReportSectionId[];
  const reportTitle = searchParams.get('title') || '';
  const notes = searchParams.get('notes') || '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any>>({});

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await tenantApi.getFullReport({ startDate, endDate, sections });
      if (r?.success && r?.data) {
        setData(r.data);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, sections]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const tenantName = user?.businessName || (locale === 'ar' ? 'النشاط' : 'Business');

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
      <div className="no-print flex gap-4 mb-6">
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:opacity-90"
        >
          {locale === 'ar' ? 'طباعة / حفظ كـ PDF' : 'Print / Save as PDF'}
        </button>
        <Link
          href={`/${locale}/dashboard/reports/generate`}
          className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300"
        >
          {locale === 'ar' ? 'تعديل التقرير' : 'Edit report'}
        </Link>
        <Link
          href={`/${locale}/dashboard/reports`}
          className="px-4 py-2 text-gray-600 hover:underline"
        >
          {locale === 'ar' ? 'العودة إلى التقارير' : 'Back to Reports'}
        </Link>
      </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
