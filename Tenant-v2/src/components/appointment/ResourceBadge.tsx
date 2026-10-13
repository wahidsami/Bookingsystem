import React from 'react';
import { AlertCircle, Check, Loader2, Clock } from 'lucide-react';
import type { ServiceRecord, ServiceVariantRecord, ServiceResourceRequirementRecord } from '../../lib/serviceContract';

export interface ResourceRequirementStatus {
  resourceTypeId: string;
  resourceTypeName: string;
  resourceTypeNameAr: string;
  quantity: number;
  available: boolean;
  totalActive?: number;
  availableQuantity?: number;
  reason?: string;
  availableAgainAt?: string | null;
  messageEn?: string;
  messageAr?: string;
  actionableGuidanceEn?: string;
  actionableGuidanceAr?: string;
}

export interface ItemResourceAvailability {
  id: string;
  hasRequirements: boolean;
  isAvailable: boolean;
  requirements: ResourceRequirementStatus[];
  primaryConflict?: any;
}

/**
 * Resolves effective resource requirements for a service and optional variant,
 * mirroring resourceRequirementResolver.js (parent requirements + variant overrides).
 */
export function resolveEffectiveServiceRequirements(
  service?: ServiceRecord | null,
  variantId?: string | null
): ServiceResourceRequirementRecord[] {
  if (!service || !Array.isArray(service.resourceRequirements) || service.resourceRequirements.length === 0) {
    return [];
  }

  const parentMap = new Map<string, ServiceResourceRequirementRecord>();
  const variantMap = new Map<string, ServiceResourceRequirementRecord>();

  for (const req of service.resourceRequirements) {
    const typeId = req.resourceTypeId;
    if (!typeId) continue;

    const item: ServiceResourceRequirementRecord = {
      resourceTypeId: typeId,
      quantity: Math.max(1, req.quantity || 1),
      resourceType: req.resourceType,
      variantId: req.variantId || null
    };

    if (!req.variantId) {
      parentMap.set(typeId, item);
    } else if (variantId && String(req.variantId) === String(variantId)) {
      variantMap.set(typeId, item);
    }
  }

  if (!variantId) {
    return Array.from(parentMap.values());
  }

  const merged = new Map(parentMap);
  for (const [typeId, varItem] of variantMap.entries()) {
    merged.set(typeId, varItem);
  }

  return Array.from(merged.values());
}

interface ResourceBadgeProps {
  key?: React.Key;
  nameEn: string;
  nameAr: string;
  quantity?: number;
  availableQuantity?: number | null;
  totalActive?: number | null;
  status: 'loading' | 'available' | 'conflict';
  isRtl: boolean;
  conflictDetails?: {
    reason?: string;
    availableAgainAt?: string | null;
    messageEn?: string;
    messageAr?: string;
    actionableGuidanceEn?: string;
    actionableGuidanceAr?: string;
  };
  compact?: boolean;
  evaluatedTime?: string | null;
}

export function ResourceBadge({
  nameEn,
  nameAr,
  quantity = 1,
  availableQuantity = null,
  totalActive = null,
  status,
  isRtl,
  conflictDetails,
  compact = false,
  evaluatedTime = null
}: ResourceBadgeProps) {
  const displayName = isRtl ? (nameAr || nameEn) : (nameEn || nameAr);
  const qtyLabel = quantity > 1 ? ` x${quantity}` : '';

  // Authoritative capacity count label (e.g. "1/2 available" / "1/2 متاح")
  const hasCapacityCount = status !== 'loading'
    && typeof availableQuantity === 'number'
    && typeof totalActive === 'number';

  const capacityLabel = hasCapacityCount
    ? (isRtl ? `${availableQuantity}/${totalActive} متاح` : `${availableQuantity}/${totalActive} available`)
    : '';

  const evaluatedTimeLabel = evaluatedTime ? ` · ${evaluatedTime}` : '';

  // Format availableAgainAt for conflict tooltip/badge
  let availAgainLabel = '';
  if (conflictDetails?.availableAgainAt) {
    try {
      const dt = new Date(conflictDetails.availableAgainAt);
      availAgainLabel = new Intl.DateTimeFormat(isRtl ? 'ar-SA' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Riyadh'
      }).format(dt);
    } catch {
      availAgainLabel = '';
    }
  }

  const tooltip = status === 'conflict'
    ? (isRtl
        ? (conflictDetails?.messageAr || `${displayName}: غير متاح ${evaluatedTime ? `في ${evaluatedTime}` : 'حالياً'} (${capacityLabel})`)
        : (conflictDetails?.messageEn || `${displayName}: currently unavailable ${evaluatedTime ? `at ${evaluatedTime}` : ''} (${capacityLabel})`))
    : status === 'available'
    ? (isRtl
        ? `${displayName}: متاح ${evaluatedTime ? `في ${evaluatedTime}` : 'في هذا الوقت'} (${capacityLabel})`
        : `${displayName}: available ${evaluatedTime ? `at ${evaluatedTime}` : 'for this time'} (${capacityLabel})`)
    : (isRtl ? 'جاري التحقق من الموارد...' : 'Verifying resource availability...');

  if (status === 'loading') {
    return (
      <span
        title={tooltip}
        className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100/80 text-slate-500 font-medium select-none ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
        }`}
      >
        <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-400" />
        <span className="truncate max-w-[100px] sm:max-w-[130px]">{displayName}{qtyLabel}</span>
      </span>
    );
  }

  if (status === 'conflict') {
    return (
      <span
        title={tooltip}
        className={`inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 text-rose-700 font-bold select-none ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
        }`}
      >
        <AlertCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
        <span className="truncate max-w-[90px] sm:max-w-[130px]">{displayName}{qtyLabel}</span>
        {capacityLabel && (
          <span className="shrink-0 font-medium text-[8.5px] sm:text-[9.5px] opacity-90">
            · {capacityLabel}{evaluatedTimeLabel}
          </span>
        )}
        {availAgainLabel && (
          <span className="font-mono text-[8px] bg-rose-200/60 text-rose-800 px-1 rounded flex items-center gap-0.5 shrink-0">
            <Clock className="w-2 h-2" />
            <span>{availAgainLabel}</span>
          </span>
        )}
      </span>
    );
  }

  // Available
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/80 text-emerald-700 font-medium select-none ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      }`}
    >
      <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
      <span className="truncate max-w-[90px] sm:max-w-[130px]">{displayName}{qtyLabel}</span>
      {capacityLabel && (
        <span className="shrink-0 font-semibold text-[8.5px] sm:text-[9.5px] opacity-90">
          · {capacityLabel}{evaluatedTimeLabel}
        </span>
      )}
    </span>
  );
}

interface ResourceBadgeListProps {
  requirements: ServiceResourceRequirementRecord[];
  availability?: ItemResourceAvailability | null;
  isLoading?: boolean;
  isRtl: boolean;
  compact?: boolean;
  evaluatedTime?: string | null;
}

export function ResourceBadgeList({
  requirements,
  availability,
  isLoading = false,
  isRtl,
  compact = false,
  evaluatedTime = null
}: ResourceBadgeListProps) {
  if (!requirements || requirements.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {requirements.map((req) => {
        const typeId = req.resourceTypeId;
        const liveStatus = availability?.requirements?.find(r => r.resourceTypeId === typeId);

        let status: 'loading' | 'available' | 'conflict' = 'loading';
        if (isLoading || !availability) {
          status = 'loading';
        } else if (liveStatus) {
          // Guard: unverified drafts, network failures, or invalid draft inputs must never present as false conflicts
          if (!liveStatus.available && (liveStatus.reason === 'UNVERIFIED' || liveStatus.reason === 'API_ERROR' || liveStatus.reason === 'INVALID_TIME')) {
            status = 'loading';
          } else {
            status = liveStatus.available ? 'available' : 'conflict';
          }
        } else {
          // If availability check completed but this requirement wasn't evaluated, keep neutral/loading
          status = 'loading';
        }

        const nameEn = liveStatus?.resourceTypeName || req.resourceType?.name_en || 'Resource';
        const nameAr = liveStatus?.resourceTypeNameAr || req.resourceType?.name_ar || nameEn;
        const qty = liveStatus?.quantity || req.quantity || 1;
        const availableQty = typeof liveStatus?.availableQuantity === 'number' ? liveStatus.availableQuantity : null;
        const totalCapacity = typeof liveStatus?.totalActive === 'number' ? liveStatus.totalActive : null;

        return (
          <ResourceBadge
            key={`rb-${typeId}`}
            nameEn={nameEn}
            nameAr={nameAr}
            quantity={qty}
            availableQuantity={availableQty}
            totalActive={totalCapacity}
            status={status}
            isRtl={isRtl}
            conflictDetails={liveStatus?.available === false ? {
              reason: liveStatus.reason,
              availableAgainAt: liveStatus.availableAgainAt,
              messageEn: liveStatus.messageEn,
              messageAr: liveStatus.messageAr,
              actionableGuidanceEn: liveStatus.actionableGuidanceEn,
              actionableGuidanceAr: liveStatus.actionableGuidanceAr
            } : undefined}
            compact={compact}
            evaluatedTime={evaluatedTime}
          />
        );
      })}
    </div>
  );
}
