'use client';

import { useMemo, useState } from 'react';

export type ReportPdfDebugState = {
  status: 'idle' | 'running' | 'success' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  elapsedMs?: number;
  requestUrl?: string;
  startDate?: string;
  endDate?: string;
  sections?: string[];
  title?: string;
  filename?: string;
  httpStatus?: number;
  statusText?: string;
  contentType?: string;
  errorMessage?: string;
  responseBody?: string;
};

type Props = {
  locale: string;
  debug: ReportPdfDebugState | null;
  onClear?: () => void;
};

function formatIso(iso?: string) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function badgeClasses(status: ReportPdfDebugState['status']) {
  switch (status) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'failed':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'running':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function ReportPdfDebugPanel({ locale, debug, onClear }: Props) {
  const [copied, setCopied] = useState(false);

  const payloadText = useMemo(() => {
    if (!debug) return '';
    return JSON.stringify(debug, null, 2);
  }, [debug]);

  if (!debug) return null;

  const copy = async () => {
    if (!payloadText || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(payloadText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="no-print mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {locale === 'ar' ? 'منطقة فحص PDF' : 'PDF debug area'}
            </h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses(debug.status)}`}>
              {debug.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {locale === 'ar'
              ? 'هذه المنطقة تعرض تفاصيل طلب PDF وأي رد من الخادم لمساعدتنا في تحديد سبب الفشل.'
              : 'This area shows the PDF request details and any server response so we can trace the failure.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {copied ? (locale === 'ar' ? 'تم النسخ' : 'Copied') : (locale === 'ar' ? 'نسخ التفاصيل' : 'Copy details')}
          </button>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {locale === 'ar' ? 'مسح' : 'Clear'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DebugField label={locale === 'ar' ? 'وقت البدء' : 'Started at'} value={formatIso(debug.startedAt)} />
        <DebugField label={locale === 'ar' ? 'وقت الانتهاء' : 'Finished at'} value={formatIso(debug.finishedAt)} />
        <DebugField label={locale === 'ar' ? 'المدة' : 'Elapsed'} value={debug.elapsedMs != null ? `${debug.elapsedMs} ms` : '-'} />
        <DebugField label={locale === 'ar' ? 'الحالة' : 'HTTP status'} value={debug.httpStatus != null ? `${debug.httpStatus}${debug.statusText ? ` ${debug.statusText}` : ''}` : '-'} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DebugField
          label={locale === 'ar' ? 'رابط الطلب' : 'Request URL'}
          value={debug.requestUrl || '-'}
          mono
        />
        <DebugField
          label={locale === 'ar' ? 'اسم الملف' : 'Filename'}
          value={debug.filename || '-'}
          mono
        />
        <DebugField
          label={locale === 'ar' ? 'الفترة' : 'Period'}
          value={debug.startDate && debug.endDate ? `${debug.startDate} → ${debug.endDate}` : '-'}
          mono
        />
        <DebugField
          label={locale === 'ar' ? 'الأقسام' : 'Sections'}
          value={debug.sections?.length ? debug.sections.join(', ') : '-'}
          mono
        />
      </div>

      {debug.errorMessage ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            {locale === 'ar' ? 'رسالة الخطأ' : 'Error message'}
          </p>
          <p className="mt-1 text-sm text-red-800">{debug.errorMessage}</p>
        </div>
      ) : null}

      {debug.responseBody ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            {locale === 'ar' ? 'رد الخادم' : 'Server response'}
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-800">
            {debug.responseBody}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function DebugField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm text-slate-900 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
    </div>
  );
}
