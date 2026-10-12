import { ServiceRecord, ServiceVariantRecord } from './serviceContract';
import { MinimalStagedItem, MinimalPackageItem } from './bundleStagingHelpers';

export interface HistoricalRawServiceItem {
  id?: string;
  serviceId?: string;
  packageId?: string;
  packageItemId?: string;
  serviceNameEn?: string;
  serviceNameAr?: string;
  serviceVariantId?: string;
  serviceVariantName?: string;
  staffId?: string;
  staff?: { id: string; name: string };
  service?: {
    id: string;
    name_en?: string;
    name_ar?: string;
    duration?: number;
    category?: string;
  };
  price?: number;
  amount?: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  details?: {
    serviceVariantName?: string;
    serviceVariantId?: string;
    [key: string]: any;
  };
}

export interface HistoricalSessionRecord {
  id: string;
  bookingSessionId?: string | null;
  bookingReference?: string | null;
  date?: string;
  startTime?: string;
  status: string;
  amount?: number;
  price?: number;
  packageId?: string;
  serviceNameEn?: string;
  serviceNameAr?: string;
  assignedStaffName?: string;
  serviceLines?: HistoricalRawServiceItem[];
  appointments?: HistoricalRawServiceItem[];
  details?: {
    packageId?: string;
    services?: HistoricalRawServiceItem[];
    service?: any;
    staff?: any;
    staffName?: string;
    duration?: number;
    notes?: string;
    serviceVariantName?: string;
    serviceVariantId?: string;
  };
}

export interface RebookingUnavailableItem {
  name: string;
  variantName?: string;
  reason: string;
}

export interface RebookingAvailableItem {
  service: ServiceRecord;
  variant?: ServiceVariantRecord | null;
  prevStaffId?: string;
  duration: number;
  basePrice: number;
  sequenceOrder?: number;
}

export interface RebookingResolutionResult {
  isReliableBundle: boolean;
  matchedPackageId: string | null;
  unavailableItems: RebookingUnavailableItem[];
  availableItems: RebookingAvailableItem[];
  preparedDraftItems: MinimalStagedItem[];
}

/**
 * Extract individual service items from a historical session or appointment
 */
export function extractHistoricalItems(session: HistoricalSessionRecord): HistoricalRawServiceItem[] {
  if (!session) return [];
  if (Array.isArray(session.serviceLines)) {
    return session.serviceLines;
  }
  if (Array.isArray(session.details?.services)) {
    return session.details.services;
  }
  if (Array.isArray(session.appointments)) {
    return session.appointments;
  }
  if ((session as any).serviceId || (session as any).service || (session as any).title) {
    return [session as unknown as HistoricalRawServiceItem];
  }
  return [];
}

/**
 * Resolve rebooking feasibility against current active catalog and staff qualifications.
 * Adheres to:
 * - Requirement 1: Never silently drop unavailable/retired items.
 * - Requirement 2: Treat previous staff as preferences only; revalidate qualifications.
 * - Requirement 3: Preserve bundle composition ONLY when reliably identified by explicit packageId.
 * - Requirement 4: Calculate fresh draft with live catalog pricing; do not copy historical IDs/payment.
 */
export function resolveRebookingDraft(params: {
  session: HistoricalSessionRecord;
  canonicalServices: ServiceRecord[];
  availableStylists: Array<{ id: string; name: string }>;
  services2Bundles?: MinimalPackageItem[];
  servicePackages?: MinimalPackageItem[];
  currentStartTime?: number;
  shouldChainServiceTimes?: boolean;
  isRtl?: boolean;
}): RebookingResolutionResult {
  const {
    session,
    canonicalServices,
    availableStylists,
    services2Bundles = [],
    servicePackages = [],
    currentStartTime = 540,
    shouldChainServiceTimes = true,
    isRtl = false
  } = params;

  const rawItems = extractHistoricalItems(session);

  // Requirement 3: Explicit packageId check only. No guessing.
  const explicitPkgId = session.packageId
    || session.details?.packageId
    || (session.details?.service as any)?.packageId
    || rawItems.find(it => it.packageId)?.packageId
    || null;

  const matchedPkg = explicitPkgId
    ? (services2Bundles.find(p => p.id === explicitPkgId) || servicePackages.find(p => p.id === explicitPkgId))
    : null;

  if (matchedPkg && matchedPkg.id) {
    return {
      isReliableBundle: true,
      matchedPackageId: matchedPkg.id,
      unavailableItems: [],
      availableItems: [],
      preparedDraftItems: []
    };
  }

  const unavailableItems: RebookingUnavailableItem[] = [];
  const availableItems: RebookingAvailableItem[] = [];

  rawItems.forEach((item, idx) => {
    const sId = item.service?.id || item.serviceId || item.id;
    const sNameEn = item.serviceNameEn || item.service?.name_en || (item as any).title || '';
    const sNameAr = item.serviceNameAr || item.service?.name_ar || (item as any).title || '';

    // Match live service
    const liveService = canonicalServices.find(s => s.id === sId)
      || canonicalServices.find(s => (s.nameEn && s.nameEn === sNameEn) || (s.nameAr && s.nameAr === sNameAr));

    const finalNameEn = liveService?.nameEn || sNameEn;
    const finalNameAr = liveService?.nameAr || sNameAr;
    const displayName = isRtl
      ? (finalNameAr || finalNameEn || `خدمة #${idx + 1}`)
      : (finalNameEn || finalNameAr || `Service #${idx + 1}`);

    if (!liveService || liveService.isActive === false || (liveService as any).status === 'inactive') {
      unavailableItems.push({
        name: displayName,
        variantName: item.serviceVariantName,
        reason: isRtl ? 'الخدمة غير متوفرة أو معطلة في القائمة الحالية' : 'Service is inactive or no longer in catalog'
      });
      return;
    }

    // Match variant if historical record had one
    const histVariantName = item.serviceVariantName || item.details?.serviceVariantName || '';
    const histVariantId = item.serviceVariantId || item.details?.serviceVariantId || '';
    let liveVariant: ServiceVariantRecord | null = null;

    if (histVariantId || histVariantName) {
      liveVariant = (liveService.variants || []).find((v: any) =>
        (histVariantId && v.id === histVariantId) ||
        (histVariantName && (
          (v.name_en && v.name_en.toLowerCase() === histVariantName.toLowerCase()) ||
          (v.name_ar && v.name_ar === histVariantName) ||
          (v.nameEn && v.nameEn.toLowerCase() === histVariantName.toLowerCase()) ||
          (v.nameAr && v.nameAr === histVariantName)
        ))
      ) || null;

      if (!liveVariant || liveVariant.isActive === false) {
        unavailableItems.push({
          name: displayName,
          variantName: histVariantName,
          reason: isRtl ? 'الخيار أو الخصلة المحددة لم تعد متاحة' : 'Variant is no longer available'
        });
        return;
      }
    }

    // Live catalog pricing & duration
    const basePrice = Number(
      liveVariant?.finalPrice
      ?? liveVariant?.price
      ?? liveService.finalPrice
      ?? liveService.price
      ?? 0
    );

    const duration = Number(
      liveVariant?.duration
      ?? liveService.duration
      ?? 30
    );

    // Requirement 2: Staff preference revalidation
    const prevStaffId = item.staff?.id || item.staffId || session.details?.staff?.id || (session as any).staffId || '';
    const matchedStylist = availableStylists.find(st => st.id === prevStaffId);
    const assignments = liveService.employeeAssignments || [];
    const isQualified = matchedStylist && (assignments.length === 0 || assignments.map(String).includes(String(matchedStylist.id)));

    availableItems.push({
      service: liveService,
      variant: liveVariant,
      prevStaffId: isQualified ? matchedStylist.id : '',
      duration,
      basePrice,
      sequenceOrder: idx
    });
  });

  // Build fresh staged draft items from available items
  let runningStartTime = currentStartTime;
  const preparedDraftItems: MinimalStagedItem[] = availableItems.map((it, idx) => {
    const itemStartTime = runningStartTime;
    if (shouldChainServiceTimes) {
      runningStartTime += it.duration;
    }

    return {
      id: `stg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      itemType: 'service',
      serviceId: it.service.id,
      variantId: it.variant?.id || undefined,
      staffId: it.prevStaffId || '',
      startTime: itemStartTime,
      duration: it.duration,
      basePrice: it.basePrice,
      finalPrice: it.basePrice
    };
  });

  return {
    isReliableBundle: false,
    matchedPackageId: null,
    unavailableItems,
    availableItems,
    preparedDraftItems
  };
}

/**
 * Calculate dynamic subtotal and 15% VAT for rebooked items
 */
export function calculateRebookingPricing(items: MinimalStagedItem[]): {
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
} {
  const subtotal = items.reduce((sum, item) => sum + Number(item.finalPrice ?? item.basePrice ?? 0), 0);
  const vatAmount = Math.round(subtotal * 0.15 * 100) / 100;
  const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount,
    grandTotal
  };
}
