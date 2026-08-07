import React from 'react';
import { Check, ChevronDown, ChevronUp, Image as ImageIcon, PlusCircle, Settings2 } from 'lucide-react';
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

  return (
    <article
      className={`overflow-hidden rounded-[22px] border shadow-sm transition ${
        isVariantRow
          ? 'border-slate-200 bg-slate-50/80'
          : 'border-slate-200 bg-white hover:border-primary/30 hover:shadow-md'
      }`}
      style={{ marginInlineStart: depth > 0 ? `${depth * 1.25}rem` : 0 }}
    >
      <div
        className={`grid items-center gap-3 px-3 py-2.5 sm:px-4 ${
          isVariantRow
            ? 'min-h-[52px] grid-cols-[minmax(0,1fr)_auto_auto] border-l-4 border-l-primary/20 bg-slate-50/80'
            : 'min-h-[68px] grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]'
        }`}
      >
        {!isVariantRow ? (
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
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
        ) : (
          <div className="h-full w-3 rounded-full bg-primary/10" />
        )}

        <div className="min-w-0">
          <p className={`truncate font-semibold tracking-tight text-slate-900 ${isVariantRow ? 'text-sm' : 'text-base sm:text-[15px]'}`}>
            {title}
          </p>
        </div>

        <div className={`whitespace-nowrap text-sm font-semibold text-slate-900 ${isRtl ? 'justify-self-start text-left' : 'justify-self-end text-right'}`}>
          {price.toFixed(2)} SAR
        </div>

        {!isVariantRow && canExpand && onToggleExpand ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>{isRtl ? 'Collapse' : 'Collapse'}</span>
              </>
            ) : (
              <>
                <Settings2 className="h-3.5 w-3.5" />
                <span>{isRtl ? 'Expand' : 'Expand'}</span>
              </>
            )}
          </button>
        ) : (
          <span />
        )}

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
              ? (isRtl ? 'Added ✓' : '✓ Added')
              : (isRtl ? 'Add' : 'Add')}
          </span>
        </button>
      </div>

      {isExpanded && !isVariantRow ? (
        <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {isRtl ? 'المدة' : 'Duration'}
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {duration} {isRtl ? 'دقيقة' : 'Minutes'}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {isRtl ? 'الموظفون' : 'Performed By'}
              </p>
              <ul className="space-y-1 text-sm font-semibold text-slate-900">
                {assignedStaffNames.length > 0 ? assignedStaffNames.map((name) => (
                  <li key={name} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span>{name}</span>
                  </li>
                )) : (
                  <li className="text-slate-500">{isRtl ? 'حسب الإعدادات' : 'Based on settings'}</li>
                )}
              </ul>
            </div>
          </div>

          {resolvedDescription ? (
            <div className="mt-4 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {isRtl ? 'الوصف' : 'Description'}
              </p>
              <p className="text-[12px] leading-6 text-slate-600">{resolvedDescription}</p>
            </div>
          ) : null}

          {children ? (
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {isRtl ? 'البدائل' : 'Variants'}
              </p>
              <div className="space-y-2">
                {children}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
