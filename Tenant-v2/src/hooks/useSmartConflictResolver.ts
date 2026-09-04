import { useState, useCallback } from 'react';
import { fetchAvailabilityLayers } from '../services/availabilityService';
import { calculateAllValidChains } from '../utils/bookingChains';
import { pickBestConflictDiagnostic, buildConflictCard, ConflictCard } from '../lib/bookingConflictDiagnostics';

export type BookingRecoveryMode = 'chain' | 'modify_professionals' | 'separate_services';
export type ChainConflictView = 'explanation' | 'time-selection' | 'confirmation';

export interface ChainConflictDialogState {
  originalStaged: any[];
  payloadItems: any[];
  conflictCards: ConflictCard[];
  selectedDateKey: string;
  validChains: any[];
  selectedChain: any | null;
  isRevalidating: boolean;
}

export interface UseSmartConflictResolverOptions {
  tenantId: string;
  isRtl?: boolean;
  stylists: any[];
  onSubmitValidatedItems: (items: any[]) => Promise<void>;
  onRevalidationFailed: () => void;
}

/**
 * Shared hook to manage the state and logic of the Smart Conflict Resolver.
 * Extracted from InteractiveDrawers.tsx / AppointmentWorkspace.tsx.
 */
export const useSmartConflictResolver = ({
  tenantId,
  isRtl = false,
  stylists,
  onSubmitValidatedItems,
  onRevalidationFailed
}: UseSmartConflictResolverOptions) => {
  const [conflictDialog, setConflictDialog] = useState<ChainConflictDialogState | null>(null);
  const [conflictView, setConflictView] = useState<ChainConflictView>('explanation');
  const [bookingRecoveryMode, setBookingRecoveryMode] = useState<BookingRecoveryMode>('chain');

  const closeDialog = useCallback(() => {
    setConflictDialog(null);
    setConflictView('explanation');
  }, []);

  const preflightMultiServiceChain = async (
    currentItems: any[],
    originalStaged: any[],
    dateKey: string,
    isRetry = false
  ) => {
    const { layers, diagnosticsByLayer, anyFailed } = await fetchAvailabilityLayers({
      tenantId,
      items: currentItems,
      dateKey,
      isRtl
    });

    let isRequestedChainValid = true;
    const discoveredStaffIds: string[] = [];
    const discoveredStartTimes: string[] = [];
    const conflictCards: ConflictCard[] = [];

    const getDurationsFromLayers = (items: any[], fetchedLayers: any[][]) => {
      return items.map((item, idx) => {
        const layerSlots = fetchedLayers[idx];
        const sampleSlot = layerSlots?.find((s: any) => s.available) || layerSlots?.[0];
        return sampleSlot
            ? (new Date(sampleSlot.endTime).getTime() - new Date(sampleSlot.startTime).getTime()) / 60000
            : Number(item.duration || 60);
      });
    };
    
    const durations = getDurationsFromLayers(currentItems, layers);

    if (anyFailed) {
      isRequestedChainValid = false;
      conflictCards.push({
        staffId: '',
        staffName: isRtl ? 'مهني' : 'Professional',
        reasonType: 'unknown',
        reasonTitle: isRtl ? 'تعذر جلب التوافر' : 'Could not fetch availability',
        reasonDescription: isRtl ? 'تعذر التحقق من التوافر' : 'Could not verify availability for this service right now.'
      });
    } else {
      let currentCalculatedStart = new Date(currentItems[0].startTime).getTime();

      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i];
        const layerSlots = layers[i] || [];
        const diagnostics = diagnosticsByLayer[i] || [];
        const durationForSlot = durations[i] || 60;

        const requestStartIso = new Date(currentCalculatedStart).toISOString();
        const requestEndIso = new Date(currentCalculatedStart + durationForSlot * 60000).toISOString();
        const reqTimeMs = currentCalculatedStart;
        discoveredStartTimes.push(requestStartIso);

        const exactSlot = layerSlots.find((s: any) => new Date(s.startTime).getTime() === reqTimeMs);

        const staff = stylists.find(s => s.id === item.requestedStaffId) || stylists.find(s => s.id === exactSlot?.staffId);
        const staffName = staff ? (isRtl ? staff.nameAr : staff.nameEn) : (isRtl ? 'مهني' : 'Professional');
        const avatar = staff?.avatar || staff?.photo || staff?.profileImage;

        if (exactSlot && !exactSlot.available) {
          isRequestedChainValid = false;
          const diagnostic = pickBestConflictDiagnostic({
            diagnostics,
            serviceId: item.serviceId,
            staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || null,
            requestedStartTime: requestStartIso,
            requestedEndTime: requestEndIso,
            exactSlotStartTime: exactSlot.startTime,
            exactSlotEndTime: exactSlot.endTime
          });
          conflictCards.push(buildConflictCard({ diagnostic, staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || '', staffName, avatar, isRtl }));
          currentCalculatedStart += durationForSlot * 60000;
        } else if (!exactSlot) {
          isRequestedChainValid = false;
          const diagnostic = pickBestConflictDiagnostic({
            diagnostics,
            serviceId: item.serviceId,
            staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || null,
            requestedStartTime: requestStartIso,
            requestedEndTime: requestEndIso
          });
          conflictCards.push(buildConflictCard({ diagnostic, staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || '', staffName, avatar, isRtl }));
          currentCalculatedStart += durationForSlot * 60000;
        } else {
          discoveredStaffIds.push(exactSlot.staffId);
          currentCalculatedStart = new Date(exactSlot.endTime).getTime();
        }
      }
    }

    if (isRequestedChainValid && !isRetry) {
      const validatedItems = currentItems.map((item, idx) => ({
         ...item,
         startTime: discoveredStartTimes[idx] || item.startTime,
         staffId: discoveredStaffIds[idx] || item.staffId,
         assignmentMode: item.requestedStaffId ? 'tenant_reassigned' : 'auto_assigned'
      }));
      await onSubmitValidatedItems(validatedItems);
    } else {
      setConflictView('explanation');
      setConflictDialog({
        originalStaged,
        payloadItems: currentItems,
        conflictCards: isRetry ? [{
          staffId: '',
          staffName: isRtl ? 'مهني' : 'Professional',
          reasonType: 'unknown',
          reasonTitle: isRtl ? 'تغير التوافر' : 'Availability changed',
          reasonDescription: isRtl ? 'تغير التوافر، يرجى المحاولة في وقت آخر.' : 'Availability changed, please try another time.'
        }] : conflictCards,
        selectedDateKey: dateKey,
        validChains: calculateAllValidChains(layers, durations),
        selectedChain: null,
        isRevalidating: false
      });
    }
  };

  const preflightSeparateServices = async (
    currentItems: any[],
    originalStaged: any[],
    dateKey: string
  ) => {
    const validatedItems: any[] = [];
    const conflictCards: ConflictCard[] = [];
    let allItemsValid = true;

    for (const item of currentItems) {
      const requestStartIso = item.startTime;
      const requestEndIso = new Date(new Date(requestStartIso).getTime() + Number(item.duration || 0) * 60000).toISOString();
      const requestDate = requestStartIso.includes('T') ? requestStartIso.split('T')[0] : dateKey;

      const { layers, diagnosticsByLayer, anyFailed } = await fetchAvailabilityLayers({
        tenantId,
        items: [item],
        dateKey: requestDate,
        isRtl
      });

      const layerSlots = layers[0] || [];
      const diagnostics = diagnosticsByLayer[0] || [];
      const reqTimeMs = new Date(requestStartIso).getTime();
      const normalizedStaffId = `${item.requestedStaffId || item.staffId || ''}`.trim();

      const exactSlot = layerSlots.find((slot: any) => {
        const slotTimeMs = new Date(slot.startTime).getTime();
        const slotStaffId = `${slot.staffId || ''}`.trim();
        return slotTimeMs === reqTimeMs && (!normalizedStaffId || slotStaffId === normalizedStaffId);
      });

      const staff = stylists.find((candidate) => `${candidate.id || ''}`.trim() === normalizedStaffId)
        || stylists.find((candidate) => `${candidate.id || ''}`.trim() === `${exactSlot?.staffId || ''}`.trim());
      const staffName = staff ? (isRtl ? staff.nameAr : staff.nameEn) : (isRtl ? 'مهني' : 'Professional');
      const avatar = staff?.avatar || staff?.photo || staff?.profileImage;

      if (anyFailed || !exactSlot || !exactSlot.available) {
        allItemsValid = false;
        const diagnostic = pickBestConflictDiagnostic({
          diagnostics,
          serviceId: item.serviceId,
          staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || null,
          requestedStartTime: requestStartIso,
          requestedEndTime: requestEndIso,
          exactSlotStartTime: exactSlot?.startTime,
          exactSlotEndTime: exactSlot?.endTime
        });

        conflictCards.push(buildConflictCard({
          diagnostic,
          staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || '',
          staffName,
          avatar,
          isRtl
        }));
      } else {
        validatedItems.push({
          ...item,
          staffId: exactSlot.staffId || item.staffId,
          assignmentMode: item.requestedStaffId ? 'tenant_reassigned' : 'auto_assigned'
        });
      }
    }

    if (allItemsValid) {
      await onSubmitValidatedItems(validatedItems);
      return;
    }

    setBookingRecoveryMode('separate_services');
    setConflictView('explanation');
    setConflictDialog({
      originalStaged,
      payloadItems: currentItems,
      conflictCards,
      selectedDateKey: dateKey,
      validChains: [],
      selectedChain: null,
      isRevalidating: false
    });
  };

  const acceptSuggestedChain = async (chain: any) => {
    if (!conflictDialog) return;

    setConflictDialog(prev => prev ? { ...prev, isRevalidating: true } : null);

    const dateToValidate = chain.startTime.split('T')[0];
    const { layers: freshLayers } = await fetchAvailabilityLayers({
      tenantId,
      items: conflictDialog.payloadItems,
      dateKey: dateToValidate,
      isRtl
    });

    let isStillValid = true;
    for (let i = 0; i < conflictDialog.payloadItems.length; i++) {
       const reqTimeMs = new Date(chain.slots[i].startTime).getTime();
       const exactSlot = freshLayers[i]?.find((s: any) => new Date(s.startTime).getTime() === reqTimeMs && s.staffId === chain.slots[i].staffId);
       if (!exactSlot || !exactSlot.available) {
          isStillValid = false;
          break;
       }
    }

    if (isStillValid) {
      const confirmedItems = conflictDialog.payloadItems.map((item, idx) => {
         const slot = chain.slots[idx];
         return {
           ...item,
           startTime: slot.startTime,
           staffId: slot.staffId,
           assignmentMode: item.requestedStaffId ? 'tenant_reassigned' : 'auto_assigned',
           timingMode: idx === 0 ? item.timingMode : 'auto'
         };
      });
      closeDialog();
      await onSubmitValidatedItems(confirmedItems);
    } else {
      setConflictDialog(prev => prev ? { ...prev, isRevalidating: false } : null);
      onRevalidationFailed();
      setConflictView('time-selection');
    }
  };

  const selectAlternativeDate = async (dateStr: string) => {
    if (!conflictDialog) return;
    const { layers } = await fetchAvailabilityLayers({
      tenantId,
      items: conflictDialog.payloadItems,
      dateKey: dateStr,
      isRtl
    });
    const durations = conflictDialog.payloadItems.map((item, idx) => {
      const layerSlots = layers[idx];
      const sampleSlot = layerSlots?.find((s: any) => s.available) || layerSlots?.[0];
      return sampleSlot
          ? (new Date(sampleSlot.endTime).getTime() - new Date(sampleSlot.startTime).getTime()) / 60000
          : Number(item.duration || 60);
    });
    const validChains = calculateAllValidChains(layers, durations);
    setConflictDialog(prev => prev ? { ...prev, selectedDateKey: dateStr, validChains } : null);
    setConflictView('time-selection');
  };

  return {
    conflictDialog,
    setConflictDialog,
    conflictView,
    setConflictView,
    bookingRecoveryMode,
    setBookingRecoveryMode,
    preflightMultiServiceChain,
    preflightSeparateServices,
    acceptSuggestedChain,
    selectAlternativeDate,
    closeDialog
  };
};
