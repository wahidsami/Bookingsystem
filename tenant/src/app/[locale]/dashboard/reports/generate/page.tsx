'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TenantLayout } from '@/components/TenantLayout';

const SECTION_OPTIONS = [
  { id: 'overview', labelKey: 'overview', labelEn: 'Financial overview' },
  { id: 'employees', labelKey: 'employees', labelEn: 'Employee revenue' },
  { id: 'services', labelKey: 'services', labelEn: 'Service revenue' },
  { id: 'products', labelKey: 'products', labelEn: 'Product revenue' },
  { id: 'daily', labelKey: 'daily', labelEn: 'Daily revenue' },
  { id: 'bookingTrends', labelKey: 'bookingTrends', labelEn: 'Booking trends' },
  { id: 'servicePerformance', labelKey: 'servicePerformance', labelEn: 'Service performance' },
  { id: 'employeePerformance', labelKey: 'employeePerformance', labelEn: 'Employee performance' },
  { id: 'peakHours', labelKey: 'peakHours', labelEn: 'Peak hours' },
  { id: 'customerAnalytics', labelKey: 'customerAnalytics', labelEn: 'Customer analytics' },
] as const;

export type ReportSectionId = (typeof SECTION_OPTIONS)[number]['id'];

export default function GenerateReportPage() {
  const t = useTranslations('Reports');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split('T')[0];
  });
  const [sections, setSections] = useState<ReportSectionId[]>(['overview', 'employees', 'services', 'products']);
  const [reportTitle, setReportTitle] = useState('');
  const [notes, setNotes] = useState('');

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
      <div className="max-w-2xl mx-auto p-6" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {locale === 'ar' ? 'إنشاء تقرير' : 'Generate report'}
        </h1>
        <p className="text-gray-600 mb-6" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {locale === 'ar' ? 'اختر الأقسام والفترة ثم اعرض التقرير أو اطبعه.' : 'Choose sections and date range, then preview or print.'}
        </p>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {locale === 'ar' ? 'الفترة' : 'Date range'}
          </h2>
          <div className="flex flex-wrap gap-4">
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

        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {locale === 'ar' ? 'أقسام التقرير' : 'Report sections'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SECTION_OPTIONS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sections.includes(opt.id)}
                  onChange={() => toggleSection(opt.id)}
                  className="rounded border-gray-300"
                />
                <span className="text-gray-700">{locale === 'ar' ? t(opt.labelKey) : opt.labelEn}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {locale === 'ar' ? 'عنوان التقرير (اختياري)' : 'Report title (optional)'}
          </h2>
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
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="flex gap-4 no-print">
          <button
            type="button"
            onClick={handlePreview}
            disabled={sections.length === 0}
            className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {locale === 'ar' ? 'معاينة التقرير' : 'Preview report'}
          </button>
          <a
            href={`/${locale}/dashboard/reports`}
            className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300"
          >
            {locale === 'ar' ? 'إلغاء' : 'Cancel'}
          </a>
        </div>
      </div>
    </TenantLayout>
  );
}
