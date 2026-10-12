/**
 * Helpers for managing staged services and bundles in appointment drawers,
 * ensuring strict isolation between standalone service selections and bundle components,
 * safe dismissal evaluation, and cascading time recalculations.
 */

export interface MinimalStagedItem {
  id?: string;
  serviceId: string;
  variantId?: string | null;
  itemType?: string;
  packageId?: string | null;
  packageInstanceId?: string | null;
  basePrice?: number;
  finalPrice?: number;
  duration?: number;
  startTime?: number;
  participantId?: string | null;
}

export interface MinimalPackageItem {
  id: string;
  totalPrice?: number;
  price?: number;
  totalDuration?: number;
  scheduleType?: string;
}

/**
 * Checks whether a standalone service (or variant) is currently selected.
 * Strictly ignores bundle component items so that services inside packages
 * do not falsely appear as standalone bookings.
 * Optionally scopes selection to a specific participant for group appointments.
 */
export const isQueuedStandaloneServiceSelected = (
  stagedServices: MinimalStagedItem[],
  serviceId: string,
  variantId?: string | null,
  participantId?: string | null
): boolean => {
  return stagedServices.some((item) => {
    if (participantId && item.participantId && item.participantId !== participantId) {
      return false;
    }
    if (item.itemType === 'package' || Boolean(item.packageId)) {
      return false;
    }
    if (item.serviceId !== serviceId) {
      return false;
    }
    if (variantId) {
      return item.variantId === variantId;
    }
    return !item.variantId;
  });
};

/**
 * Removes a standalone service from staged services.
 * Preserves all bundle component items intact even if they share the same serviceId.
 * Optionally scopes removal to a specific participant for group appointments.
 */
export const removeStandaloneQueuedService = <T extends MinimalStagedItem>(
  stagedServices: T[],
  serviceId: string,
  variantId?: string | null,
  participantId?: string | null
): T[] => {
  return stagedServices.filter((item) => {
    if (participantId && item.participantId && item.participantId !== participantId) {
      return true;
    }
    if (item.itemType === 'package' || Boolean(item.packageId)) {
      return true;
    }
    if (item.serviceId !== serviceId) {
      return true;
    }
    if (variantId) {
      return item.variantId !== variantId;
    }
    return Boolean(item.variantId);
  });
};

/**
 * Removes all child services belonging to a package instance or package ID.
 * Optionally scopes removal to a specific participant for group appointments.
 */
export const removeBundleFromStagedServices = <T extends MinimalStagedItem>(
  stagedServices: T[],
  packageOrInstanceId: string,
  participantId?: string | null
): T[] => {
  return stagedServices.filter((item) => {
    if (participantId && item.participantId && item.participantId !== participantId) {
      return true;
    }
    const isTarget = item.packageInstanceId === packageOrInstanceId || item.packageId === packageOrInstanceId;
    return !isTarget;
  });
};

/**
 * Calculates pricing for staged items, verifying that packages charge the package price
 * and component services are not charged individually.
 */
export const calculateStagedPricing = (
  stagedServices: MinimalStagedItem[],
  packages: MinimalPackageItem[]
): { subtotal: number; vat: number; total: number } => {
  const standaloneItems = stagedServices.filter((s) => s.itemType !== 'package' && !s.packageId);
  const pkgItems = stagedServices.filter((s) => s.itemType === 'package' || Boolean(s.packageId));

  const standaloneTotal = standaloneItems.reduce((sum, item) => sum + Number(item.finalPrice ?? item.basePrice ?? 0), 0);

  const pkgGroups = pkgItems.reduce((acc, curr) => {
    const groupKey = curr.packageInstanceId || curr.packageId!;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(curr);
    return acc;
  }, {} as Record<string, MinimalStagedItem[]>);

  const packagesTotal = Object.values(pkgGroups).reduce((sum, items) => {
    const pkgId = items[0]?.packageId;
    const pkg = packages.find((p) => p.id === pkgId);
    return sum + Number(pkg?.totalPrice ?? pkg?.price ?? 0);
  }, 0);

  const subtotal = Number((standaloneTotal + packagesTotal).toFixed(2));
  const vat = Number((subtotal * 0.15).toFixed(2));
  const total = Number((subtotal + vat).toFixed(2));

  return { subtotal, vat, total };
};

export interface GroupParticipantInfo {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  isOrganizer?: boolean;
}

export interface GroupParticipantFinancials {
  participantId: string;
  name: string;
  isOrganizer: boolean;
  serviceCount: number;
  subtotal: number;
  vat: number;
  total: number;
}

export interface GroupPricingSummary {
  participants: GroupParticipantFinancials[];
  consolidatedSubtotal: number;
  consolidatedVat: number;
  consolidatedTotal: number;
}

/**
 * Calculates per-participant and consolidated financial summaries for group bookings.
 */
export const calculateGroupStagedPricing = (
  participants: GroupParticipantInfo[],
  stagedServices: MinimalStagedItem[],
  packages: MinimalPackageItem[]
): GroupPricingSummary => {
  const defaultParticipantId = participants[0]?.id || 'part-1';
  const participantFinancials: GroupParticipantFinancials[] = participants.map((p, idx) => {
    const pItems = stagedServices.filter(s => (s.participantId || defaultParticipantId) === p.id);
    const pricing = calculateStagedPricing(pItems, packages);
    return {
      participantId: p.id,
      name: p.name || `Participant ${idx + 1}`,
      isOrganizer: idx === 0 || Boolean(p.isOrganizer),
      serviceCount: pItems.length,
      subtotal: pricing.subtotal,
      vat: pricing.vat,
      total: pricing.total
    };
  });

  const consolidatedSubtotal = Number(participantFinancials.reduce((sum, p) => sum + p.subtotal, 0).toFixed(2));
  const consolidatedVat = Number((consolidatedSubtotal * 0.15).toFixed(2));
  const consolidatedTotal = Number((consolidatedSubtotal + consolidatedVat).toFixed(2));

  return {
    participants: participantFinancials,
    consolidatedSubtotal,
    consolidatedVat,
    consolidatedTotal
  };
};

export interface DraftStateCheckInput {
  createMode?: string;
  selectedCustId?: string;
  customerSearch?: string;
  custMode?: string;
  walkinFullName?: string;
  walkinPhone?: string;
  walkinEmail?: string;
  walkinDob?: string;
  walkinIsVip?: boolean;
  includeGroupGuests?: boolean;
  guestCount?: number;
  guestNames?: string;
  stagedServicesCount?: number;
  currentServiceId?: string;
  currentDiscountType?: string;
  currentDiscountValue?: number;
  currentServiceNotes?: string;
  sessionNotes?: string;
  createSplitActive?: boolean;
  createSplitAmounts?: Record<string, number>;
  giftCardCodeInput?: string;
  blockTitleAr?: string;
  blockTitleEn?: string;
  blockStaffId?: string;
  blockIsRecurring?: boolean;
  blockEndDate?: string;
  bookingScope?: string;
  groupName?: string;
  groupParticipantsCount?: number;
}

/**
 * Checks whether an appointment creation draft is dirty (contains unsaved user changes).
 * Returns false when pristine.
 */
export const checkIsAppointmentDraftDirty = (input: DraftStateCheckInput): boolean => {
  if (input.createMode === 'blocked') {
    return Boolean(
      (input.blockTitleAr && input.blockTitleAr !== 'استراحة قهوة الموظفين') ||
      (input.blockTitleEn && input.blockTitleEn !== 'Staff Espresso Recess') ||
      input.blockStaffId ||
      input.blockIsRecurring ||
      input.blockEndDate?.trim()
    );
  }

  if (input.bookingScope === 'group') return true;
  if (input.groupName?.trim()) return true;
  if ((input.groupParticipantsCount ?? 1) > 1) return true;
  if (input.selectedCustId) return true;
  if (input.customerSearch?.trim()) return true;
  if (input.custMode === 'walkin' && (input.walkinFullName?.trim() || input.walkinPhone?.trim() || input.walkinEmail?.trim() || input.walkinDob?.trim() || input.walkinIsVip)) return true;
  if (input.includeGroupGuests || (input.guestCount && input.guestCount > 1) || input.guestNames?.trim()) return true;
  if ((input.stagedServicesCount ?? 0) > 0) return true;
  if (input.currentServiceId) return true;
  if ((input.currentDiscountType && input.currentDiscountType !== 'none') || (input.currentDiscountValue ?? 0) > 0) return true;
  if (input.currentServiceNotes?.trim()) return true;
  if (input.sessionNotes?.trim()) return true;
  if (input.createSplitActive || Object.values(input.createSplitAmounts || {}).some(a => Number(a) > 0)) return true;
  if (input.giftCardCodeInput?.trim()) return true;

  return false;
};

export type DismissalIntent = 'dismiss_request' | 'confirm_discard' | 'keep_editing';

export interface DismissalDecision {
  showConfirmDialog: boolean;
  shouldCloseDrawer: boolean;
  shouldResetDraft: boolean;
  invalidateDraftStorage: boolean;
  preserveState: boolean;
}

/**
 * Pure function determining the correct action for drawer dismissal requests.
 */
export const evaluateDismissalAction = (
  isDirty: boolean,
  intent: DismissalIntent
): DismissalDecision => {
  if (intent === 'confirm_discard') {
    return {
      showConfirmDialog: false,
      shouldCloseDrawer: true,
      shouldResetDraft: true,
      invalidateDraftStorage: true,
      preserveState: false
    };
  }

  if (intent === 'keep_editing') {
    return {
      showConfirmDialog: false,
      shouldCloseDrawer: false,
      shouldResetDraft: false,
      invalidateDraftStorage: false,
      preserveState: true
    };
  }

  // intent === 'dismiss_request' (from close button, backdrop click, or Escape)
  if (isDirty) {
    return {
      showConfirmDialog: true,
      shouldCloseDrawer: false,
      shouldResetDraft: false,
      invalidateDraftStorage: false,
      preserveState: true
    };
  }

  return {
    showConfirmDialog: false,
    shouldCloseDrawer: true,
    shouldResetDraft: true,
    invalidateDraftStorage: false,
    preserveState: false
  };
};

/**
 * Recalculates service times in a chain,
 * supporting parallel bundle synchronization and sequential cascading.
 */
export const cascadeTimingForStagedItems = <T extends MinimalStagedItem>(
  items: T[],
  targetItemId: string,
  newStartTime: number,
  bundleScheduleTypeLookup?: (packageId: string) => string | undefined
): T[] => {
  const targetItem = items.find(i => (i.id || '') === targetItemId);
  if (!targetItem) return items;

  const targetPkgType = targetItem.packageId && bundleScheduleTypeLookup
    ? bundleScheduleTypeLookup(targetItem.packageId)
    : undefined;
  const isParallelBundle = Boolean(targetItem.packageInstanceId && targetPkgType === 'parallel');

  // Step 1: Update target item (and parallel siblings if in a parallel bundle)
  const updatedList = items.map(item => {
    const isTarget = (item.id || '') === targetItemId;
    const isParallelSibling = isParallelBundle && item.packageInstanceId === targetItem.packageInstanceId;

    if (isTarget || isParallelSibling) {
      return {
        ...item,
        startTime: newStartTime
      };
    }
    return item;
  });

  // Step 2: Cascade subsequent sequential items
  for (let i = 1; i < updatedList.length; i++) {
    const current = updatedList[i];
    const prev = updatedList[i - 1];

    // Parallel siblings in the same bundle share start time and do not chain sequentially
    if (
      current.packageInstanceId &&
      prev.packageInstanceId &&
      current.packageInstanceId === prev.packageInstanceId
    ) {
      const pkgType = current.packageId && bundleScheduleTypeLookup
        ? bundleScheduleTypeLookup(current.packageId)
        : undefined;
      if (pkgType === 'parallel') {
        continue;
      }
    }

    let expectedStart = Number(prev.startTime || 0) + Number(prev.duration || 0);
    if (prev.packageInstanceId) {
      const prevPkgType = prev.packageId && bundleScheduleTypeLookup
        ? bundleScheduleTypeLookup(prev.packageId)
        : undefined;
      if (prevPkgType === 'parallel') {
        const siblings = updatedList.filter(it => it.packageInstanceId === prev.packageInstanceId);
        expectedStart = Math.max(...siblings.map(it => Number(it.startTime || 0) + Number(it.duration || 0)));
      }
    }

    current.startTime = expectedStart;
  }

  return updatedList;
};
