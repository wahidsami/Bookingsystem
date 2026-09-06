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
  key?: React.Key;
  tenantId: string;
  tenantTimezone: string;
  selectedDate: string;
  service: ServiceRecord;
  isRtl: boolean;
  variant?: ServiceVariantRecord | null;
  depth?: number;
  boardStartHour?: number;
  slotMinutes?: number;
  forceExpanded?: boolean;
  availableStylists: any[];
  stagedItem: StagedService | null;
  onAddService: (service: ServiceRecord, variant?: ServiceVariantRecord | null) => void;
  onUpdateService: (id: string, updates: Partial<StagedService>) => void;
  onRemoveService: (id: string) => void;
  children?: React.ReactNode;
}

export default function AppointmentServiceRow({
  tenantId,
  tenantTimezone,
  selectedDate,
  service,
  isRtl,
  variant = null,
  depth = 0,
  boardStartHour = 9,
  slotMinutes = 5,
  forceExpanded = false,
  availableStylists,
  stagedItem,
  onAddService,
  onUpdateService,
  onRemoveService,
  children
}: AppointmentServiceRowProps) {
  const isVariantRow = Boolean(variant);
  const serviceName = getServiceDisplayName(service, isRtl ? 'ar' : 'en');
  const title = isVariantRow
    ? `${serviceName} - ${variant?.nameEn || variant?.nameAr || variant?.description || ''}`.trim() || serviceName
    : serviceName;
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
    staffId: '',
    startTime: 0,
    duration,
    discountType: 'none',
    discountValue: 0
  });

  useEffect(() => {
    if (stagedItem) {
      setDraftConfig({
        staffId: stagedItem.staffId || '',
        startTime: stagedItem.startTime,
        duration: stagedItem.duration,
        discountType: stagedItem.discountType,
        discountValue: stagedItem.discountValue
      });
    }
  }, [stagedItem, validStylists.length]);

  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded, stagedItem?.id]);

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
      className={`overflow-hidden rounded-[22px] border shadow-sm transition border-slate-200 bg-white hover:border-primary/30 hover:shadow-md`}
      style={{ marginInlineStart: depth > 0 ? `${depth * 1.25}rem` : 0 }}
    >
      <div className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 min-h-[68px] ${isExpanded ? 'bg-slate-50' : ''}`}>
        
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

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <p className={`truncate font-semibold tracking-tight text-slate-900 text-base sm:text-[15px]`}>
              {title}
            </p>
            {isVariantRow && (
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {isRtl ? 'بديل' : 'Variant'}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="whitespace-nowrap text-[13px] sm:text-sm font-semibold text-slate-900" dir="ltr">
            {price.toFixed(2)} <span className="text-[10px] sm:text-xs text-slate-500 font-medium">SAR</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {isAdded && (
              <button
                type="button"
                onClick={handleToggleExpand}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${isExpanded ? 'bg-slate-100 border-slate-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                aria-label="Configure service"
              >
                <Settings2 className="h-4 w-4 text-slate-700" />
              </button>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition whitespace-nowrap ${
                isAdded
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                  : 'border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{isRtl ? 'تمت الإضافة' : 'Added'}</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>{isRtl ? 'إضافة' : 'Add'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <AppointmentServiceConfiguration
          tenantId={tenantId}
          tenantTimezone={tenantTimezone}
          selectedDate={selectedDate}
          serviceId={service.id}
          variantId={variant?.id || stagedItem?.variantId}
          isRtl={isRtl}
          boardStartHour={boardStartHour}
          slotMinutes={slotMinutes}
          draftConfig={draftConfig}
          setDraftConfig={setDraftConfig}
          validStylists={validStylists}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {children ? (
        <div className="border-t border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-2">
          {children}
        </div>
      ) : null}
    </article>
  );
}
