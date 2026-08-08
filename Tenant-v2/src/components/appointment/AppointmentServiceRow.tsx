import React, { useState, useEffect } from 'react';
import { Settings2, PlusCircle, Check, Image as ImageIcon, Trash } from 'lucide-react';
import {
  getServiceDisplayName,
  getServiceDisplayPrice,
  resolveServiceImageUrl,
  type ServiceRecord,
  type ServiceVariantRecord
} from '../../lib/serviceContract';
import AppointmentServiceConfiguration from './AppointmentServiceConfiguration';
import { type StagedService } from './AppointmentServicesStep';

interface AppointmentServiceRowProps {
  service: ServiceRecord;
  isRtl: boolean;
  variant?: ServiceVariantRecord | null;
  depth?: number;
  availableStylists: any[];
  stagedItem: StagedService | null;
  onAddService: (service: ServiceRecord, variant?: ServiceVariantRecord | null) => void;
  onUpdateService: (id: string, updates: Partial<StagedService>) => void;
  onRemoveService: (id: string) => void;
  children?: React.ReactNode;
}

export default function AppointmentServiceRow({
  service,
  isRtl,
  variant = null,
  depth = 0,
  availableStylists,
  stagedItem,
  onAddService,
  onUpdateService,
  onRemoveService,
  children
}: AppointmentServiceRowProps) {
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

  const isAdded = Boolean(stagedItem);
  const [isExpanded, setIsExpanded] = useState(false);

  const validStylists = availableStylists.filter(s => {
    const assignments = service.employeeAssignments || [];
    return assignments.includes(s.id) || assignments.includes(Number(s.id) as any);
  });

  const [draftConfig, setDraftConfig] = useState<Partial<StagedService>>({
    staffId: validStylists[0]?.id || '',
    startTime: 0,
    duration,
    discountType: 'none',
    discountValue: 0
  });

  useEffect(() => {
    if (stagedItem) {
      setDraftConfig({
        staffId: stagedItem.staffId || (validStylists[0]?.id || ''),
        startTime: stagedItem.startTime,
        duration: stagedItem.duration,
        discountType: stagedItem.discountType,
        discountValue: stagedItem.discountValue
      });
    }
  }, [stagedItem, validStylists.length]);

  const handleAddClick = () => {
    if (isAdded && stagedItem) {
      // If already added, clicking the Add button could either mean remove or just show configured.
      // The requirement says: "If already selected, the action becomes the existing Remove/Added state."
      onRemoveService(stagedItem.id);
      setIsExpanded(false);
    } else {
      onAddService(service, variant);
      setIsExpanded(true); // Automatically open configuration
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSave = () => {
    if (!stagedItem) return;
    onUpdateService(stagedItem.id, draftConfig);
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setIsExpanded(false);
    if (stagedItem) {
      setDraftConfig({
        staffId: stagedItem.staffId,
        startTime: stagedItem.startTime,
        duration: stagedItem.duration,
        discountType: stagedItem.discountType,
        discountValue: stagedItem.discountValue
      });
    }
  };

  return (
    <article
      className={`overflow-hidden rounded-[22px] border shadow-sm transition ${
        isVariantRow
          ? 'border-slate-200 bg-slate-50/80'
          : 'border-slate-200 bg-white hover:border-primary/30 hover:shadow-md'
      }`}
      style={{ marginInlineStart: depth > 0 ? `${depth * 1.25}rem` : 0 }}
    >
      <div className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
        isVariantRow ? 'min-h-[52px] border-l-4 border-l-primary/20 bg-slate-50/80' : 'min-h-[68px]'
      } ${isExpanded && !isVariantRow ? 'bg-slate-50' : ''}`}>
        
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
          <div className="h-full w-3 shrink-0 rounded-full bg-primary/10" />
        )}

        <div className="flex-1 min-w-0 pr-2">
          <p className={`truncate font-semibold tracking-tight text-slate-900 ${isVariantRow ? 'text-sm' : 'text-base sm:text-[15px]'}`}>
            {title}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 md:gap-4">
          <div className="whitespace-nowrap text-[13px] sm:text-sm font-semibold text-slate-900">
            {price.toFixed(2)} <span className="text-[10px] sm:text-xs text-slate-500 font-medium">SAR</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAdded && (
              <button
                type="button"
                onClick={handleToggleExpand}
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border transition ${isExpanded ? 'bg-slate-100 border-slate-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                aria-label="Configure service"
              >
                <Settings2 className="h-4 w-4 text-slate-700" />
              </button>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className={`flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-full px-3 sm:px-4 text-[11px] sm:text-xs font-semibold transition ${
                isAdded
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                  : 'border border-primary bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isRtl ? 'تمت الإضافة' : 'Added'}</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isRtl ? 'إضافة' : 'Add'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && isAdded && stagedItem && (
        <AppointmentServiceConfiguration
          isRtl={isRtl}
          draftConfig={draftConfig}
          setDraftConfig={setDraftConfig}
          validStylists={validStylists}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {children && !isVariantRow ? (
        <div className="border-t border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-2">
          {children}
        </div>
      ) : null}
    </article>
  );
}
