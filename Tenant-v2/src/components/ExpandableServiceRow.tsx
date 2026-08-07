import React from 'react';
import { Check, ChevronDown, ChevronUp, Image as ImageIcon, PlusCircle } from 'lucide-react';
import {
  getServiceDisplayName,
  getServiceDisplayPrice,
  resolveServiceImageUrl,
  type ServiceRecord,
  type ServiceVariantRecord
} from '../lib/serviceContract';

interface ExpandableServiceRowProps {
  service: ServiceRecord;
  isRtl: boolean;
  variant?: ServiceVariantRecord | null;
  depth?: number;
  canExpand?: boolean;
  isExpanded?: boolean;
  isAdded: boolean;
  onToggleAdd: () => void;
  onToggleExpand?: () => void;
  assignedStaffNames?: string[];
  description?: string;
  children?: React.ReactNode;
}

export default function ExpandableServiceRow({
  service,
  isRtl,
  variant = null,
  depth = 0,
  canExpand = false,
  isExpanded = false,
  isAdded,
  onToggleAdd,
  onToggleExpand,
  assignedStaffNames = [],
  description,
  children
}: ExpandableServiceRowProps) {
  const isVariantRow = Boolean(variant);
  const title = isVariantRow
    ? `${variant?.nameEn || variant?.nameAr || variant?.description || ''}`.trim() || getServiceDisplayName(service, isRtl ? 'ar' : 'en')
    : getServiceDisplayName(service, isRtl ? 'ar' : 'en');
  const price = isVariantRow
    ? Number(variant?.finalPrice ?? variant?.price ?? service.finalPrice ?? service.price ?? 0)
    : Number(getServiceDisplayPrice(service) || 0);
  const duration = isVariantRow
    ? Number(variant?.duration ?? service.duration ?? 0)
    : Number(service.duration || 0);
  const resolvedDescription = description
    || (isVariantRow
      ? `${variant?.descriptionEn || variant?.descriptionAr || variant?.description || ''}`.trim()
      : `${service.descriptionEn || service.descriptionAr || ''}`.trim());
  const staffSummary = assignedStaffNames.length > 0
    ? assignedStaffNames.join(isRtl ? '، ' : ', ')
    : '';

  return (
    <article
      className={`rounded-[22px] border bg-white shadow-sm transition ${
        isVariantRow
          ? 'border-slate-200 bg-slate-50/80'
          : 'border-slate-200 hover:border-primary/30 hover:shadow-md'
      }`}
      style={{
        marginInlineStart: depth > 0 ? `${depth * 1.25}rem` : 0
      }}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {service.image ? (
            <img
              src={resolveServiceImageUrl(service.image)}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`truncate font-semibold tracking-tight text-slate-900 ${isVariantRow ? 'text-sm' : 'text-base sm:text-lg'}`}>
                {title}
              </p>
              <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {price.toFixed(2)} SAR
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canExpand && onToggleExpand ? (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      <span>{isRtl ? 'إخفاء' : 'Collapse'}</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      <span>{isRtl ? 'تفاصيل' : 'Details'}</span>
                    </>
                  )}
                </button>
              ) : null}

              <button
                type="button"
                onClick={onToggleAdd}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold transition ${
                  isAdded
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                    : 'border border-primary bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {isAdded ? <Check className="h-3.5 w-3.5" /> : <PlusCircle className="h-3.5 w-3.5" />}
                <span>
                  {isAdded
                    ? (isRtl ? 'إزالة' : 'Remove')
                    : (isRtl ? 'إضافة' : '+ Add')}
                </span>
              </button>
            </div>
          </div>

          {isExpanded && !isVariantRow ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {isRtl ? 'المدة' : 'Duration'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{duration} {isRtl ? 'دقيقة' : 'min'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {isRtl ? 'الموظفون' : 'Staff'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {staffSummary || (isRtl ? 'حسب الإعدادات' : 'Based on settings')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {isRtl ? 'السعر' : 'Price'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{price.toFixed(2)} SAR</p>
                </div>
              </div>

              {resolvedDescription ? (
                <p className="text-[12px] leading-6 text-slate-600">{resolvedDescription}</p>
              ) : null}

              {children ? (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  {children}
                </div>
              ) : null}
            </div>
          ) : null}

        </div>
      </div>
    </article>
  );
}
