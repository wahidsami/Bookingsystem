'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { TenantLayout } from '@/components/TenantLayout';

const SECTION_OPTIONS = [
  { id: 'overview', labelAr: 'نظرة مالية', labelEn: 'Financial overview' },
  { id: 'employees', labelAr: 'إيراد الموظفين', labelEn: 'Employee revenue' },
  { id: 'services', labelAr: 'إيراد الخدمات', labelEn: 'Service revenue' },
  { id: 'products', labelAr: 'إيراد المنتجات', labelEn: 'Product revenue' },
  { id: 'daily', labelAr: 'الإيراد اليومي', labelEn: 'Daily revenue' },
  { id: 'bookingTrends', labelAr: 'اتجاهات الحجز', labelEn: 'Booking trends' },
  { id: 'servicePerformance', labelAr: 'أداء الخدمات', labelEn: 'Service performance' },
  { id: 'employeePerformance', labelAr: 'أداء الموظفين', labelEn: 'Employee performance' },
  { id: 'peakHours', labelAr: 'ساعات الذروة', labelEn: 'Peak hours' },
  { id: 'customerAnalytics', labelAr: 'تحليلات العملاء', labelEn: 'Customer analytics' },
  { id: 'rebookings', labelAr: 'تحليلات إعادة الحجز', labelEn: 'Rebooking analytics' },
  { id: 'discounts', labelAr: 'تقرير الخصومات', labelEn: 'Discounts report' },
  { id: 'refunds', labelAr: 'تقرير الاستردادات', labelEn: 'Refunds report' },
  { id: 'paymentMethods', labelAr: 'طرق الدفع', labelEn: 'Payment methods' },
  { id: 'customerSales', labelAr: 'مبيعات العملاء', labelEn: 'Customer sales' },
] as const;

export type ReportSectionId = (typeof SECTION_OPTIONS)[number]['id'];

export default function GenerateReportPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [startDate, setStartDate] = useState(() => {
    const prefill = searchParams.get('startDate');
    if (prefill) return prefillsDateToIso(prefill);
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const prefill = searchParams.get('endDate');
    if (prefill) return prefillsDateToIso(prefill);
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split('T')[0];
  });
  const [sections, setSections] = useState<ReportSectionId[]>(() => {
    const prefills = searchParams.get('sections');
    const parsed = prefills
      ? prefills.split(',').map((section) => section.trim()).filter(Boolean) as ReportSectionId[]
      : [];
    return parsed.length ? parsed : ['overview', 'employees', 'services', 'products'];
  });
  const [reportTitle, setReportTitle] = useState(() => searchParams.get('title') || '');
  const [notes, setNotes] = useState(() => searchParams.get('notes') || '');

  function prefillsDateToIso(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toISOString().split('T')[0];
  }

  const toggleSection = (id: ReportSectionId) => {
    setSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handlePreview = () => {
    const q = new URLSearchParams();
    q.set('startDate', startDate);
    q.set('endDate', endDate);
    q.set('sections', sections.join(','));
    if (reportTitle.trim()) q.set('title', reportTitle.trim());
    if (notes.trim()) q.set('notes', notes.trim());
    router.push(`/${locale}/dashboard/reports/preview?${q.toString()}`);
  };

  return (
    <TenantLayout>
      <div className="w-full max-w-7xl mx-auto p-6 space-y-6" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/dashboard/reports`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <span>{isRTL ? '→' : '←'}</span>
            <span>{locale === 'ar' ? 'العودة إلى التقارير' : 'Back to reports'}</span>
          </button>
          <div className="text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-full px-3 py-1">
            {sections.length} {locale === 'ar' ? 'أقسام محددة' : 'sections selected'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {locale === 'ar' ? 'إنشاء تقرير' : 'Generate report'}
          </h1>
          <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {locale === 'ar'
              ? 'اختر الأقسام والفترة الزمنية ثم انتقل إلى المعاينة أو التصدير.'
              : 'Pick sections and date range, then continue to preview or export.'}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'أقسام التقرير' : 'Report sections'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SECTION_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-3 cursor-pointer rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={sections.includes(opt.id)}
                      onChange={() => toggleSection(opt.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 font-medium">{locale === 'ar' ? opt.labelAr : opt.labelEn}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'الفترة الزمنية' : 'Date range'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'ar' ? 'من تاريخ' : 'Start date'}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'ar' ? 'إلى تاريخ' : 'End date'}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {locale === 'ar' ? 'بيانات التقرير' : 'Report metadata'}
              </h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {locale === 'ar' ? 'عنوان التقرير (اختياري)' : 'Report title (optional)'}
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder={locale === 'ar' ? 'مثال: التقرير الشهري' : 'e.g. Monthly report'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">{locale === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col gap-3 no-print">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={sections.length === 0}
                  className="w-full px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {locale === 'ar' ? 'معاينة التقرير' : 'Preview report'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/dashboard/reports`)}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
