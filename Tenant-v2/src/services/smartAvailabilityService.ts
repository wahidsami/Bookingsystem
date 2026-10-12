import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { calculateAllValidChains, BookingSlot, ChainResult } from '../utils/bookingChains';
import { getDatePartsInTimeZone, DEFAULT_TENANT_TIMEZONE } from '../lib/tenantTime';

export interface SmartSlot {
  startTime: string; // ISO
  endTime: string;   // ISO
  clockLabel: string; // e.g. "5:30 PM" or "5:30 م" (in tenant timezone)
  boardMinutes: number; // Board minutes offset from boardStartHour (e.g. 510 for 5:30 PM with boardStartHour=9)
  timeMinutes: number; // Board minutes (synced with boardMinutes for scheduler consistency)
  staffId?: string;
  staffName?: string;
  period: 'morning' | 'afternoon' | 'evening';
  chainSlots?: BookingSlot[];
}

export interface DayAvailabilitySummary {
  dateKey: string;
  totalSlots: number;
  availableCount: number;
  slots: SmartSlot[];
  slotsByPeriod: {
    morning: SmartSlot[];
    afternoon: SmartSlot[];
    evening: SmartSlot[];
  };
  hasAvailability: boolean;
  eligibleStaff: Array<{ id: string; nameEn: string; nameAr: string; available: boolean }>;
}

export interface NextAvailableAlternative {
  found: boolean;
  dateKey: string | null;
  displayDateEn: string | null;
  displayDateAr: string | null;
  earliestSlot: SmartSlot | null;
  daysAhead: number | null;
  slotsCount: number;
}

export interface StagedItemForAvailability {
  id: string;
  serviceId: string;
  packageId?: string;
  variantId?: string;
  duration?: number;
  staffId?: string | null;
  isExplicitStaff?: boolean;
  sequenceOrder?: number;
}

const formatClockLabel = (date: Date, isRtl: boolean, timeZone = DEFAULT_TENANT_TIMEZONE): string => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  let hours = Number(parts.hour || '0');
  const minutes = Number(parts.minute || '0');
  const isPm = hours >= 12;
  const amPmEn = isPm ? 'PM' : 'AM';
  const amPmAr = isPm ? 'م' : 'ص';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${isRtl ? amPmAr : amPmEn}`;
};

const getPeriod = (minutesFromMidnight: number): 'morning' | 'afternoon' | 'evening' => {
  if (minutesFromMidnight < 720) return 'morning'; // before 12:00 PM
  if (minutesFromMidnight < 1020) return 'afternoon'; // 12:00 PM to 5:00 PM
  return 'evening'; // 5:00 PM and later
};

/**
 * Calculates smart availability slots for any combination of queued services and/or bundles.
 */
export async function calculateSmartAvailability({
  tenantId,
  stagedItems,
  dateKey,
  checkAllProfessionals = false,
  isRtl = false,
  allStylists = [],
  tenantTimezone = DEFAULT_TENANT_TIMEZONE,
  boardStartHour = 9
}: {
  tenantId: string;
  stagedItems: StagedItemForAvailability[];
  dateKey: string;
  checkAllProfessionals?: boolean;
  isRtl?: boolean;
  allStylists?: Array<{ id: string; nameEn?: string; nameAr?: string }>;
  tenantTimezone?: string;
  boardStartHour?: number;
}): Promise<DayAvailabilitySummary> {
  if (!tenantId || !stagedItems || stagedItems.length === 0 || !dateKey) {
    return {
      dateKey: dateKey || '',
      totalSlots: 0,
      availableCount: 0,
      slots: [],
      slotsByPeriod: { morning: [], afternoon: [], evening: [] },
      hasAvailability: false,
      eligibleStaff: []
    };
  }

  // Detect if the staged collection is a single package bundle
  const distinctPackageIds = Array.from(new Set(stagedItems.map(i => i.packageId).filter(Boolean)));
  const isPurePackage = distinctPackageIds.length === 1 && stagedItems.every(i => Boolean(i.packageId));

  let rawAvailableSlots: SmartSlot[] = [];

  if (isPurePackage) {
    const pkgId = distinctPackageIds[0] as string;
    const explicitStaffId = checkAllProfessionals
      ? undefined
      : (stagedItems.find(i => i.isExplicitStaff && i.staffId)?.staffId || undefined);

    const staffAssignments = checkAllProfessionals
      ? undefined
      : stagedItems.filter(i => i.isExplicitStaff && i.staffId).map(i => ({
          serviceId: i.serviceId,
          staffId: i.staffId as string
        }));

    try {
      const resp = await tenantApiAdapter.searchPackageAvailability({
        tenantId,
        packageId: pkgId,
        date: dateKey,
        staffId: explicitStaffId,
        staffAssignments
      });

      if (resp?.success && Array.isArray(resp.slots)) {
        rawAvailableSlots = resp.slots
          .filter((s: any) => s.available)
          .map((s: any) => {
            const startD = new Date(s.startTime);
            const endD = new Date(s.endTime);
            const parts = getDatePartsInTimeZone(startD, tenantTimezone);
            const startTotalMins = Number(parts.hour || '0') * 60 + Number(parts.minute || '0');
            const boardMinutes = Math.max(0, startTotalMins - (boardStartHour * 60));
            const stylist = allStylists.find(st => st.id === s.staffId);
            const resolvedStaffName = s.staffName || (stylist ? (isRtl ? (stylist.nameAr || stylist.nameEn) : (stylist.nameEn || stylist.nameAr)) : undefined);
            return {
              startTime: s.startTime,
              endTime: s.endTime,
              clockLabel: formatClockLabel(startD, isRtl, tenantTimezone),
              boardMinutes,
              timeMinutes: boardMinutes,
              staffId: s.staffId,
              staffName: resolvedStaffName,
              period: getPeriod(startTotalMins),
              chainSlots: s.steps ? s.steps.map((st: any) => ({
                startTime: st.startTime,
                endTime: st.endTime,
                available: true,
                staffId: st.staffId,
                staffName: st.staffName,
                serviceId: st.serviceId
              })) : undefined
            };
          });
      }
    } catch (e) {
      console.warn('[calculateSmartAvailability] Package availability failed:', e);
    }
  } else {
    // Multi-service or standalone service chain
    const layers: BookingSlot[][] = [];
    const durations: number[] = [];

    for (const item of stagedItems) {
      const requestedStaffId = checkAllProfessionals
        ? undefined
        : (item.isExplicitStaff && item.staffId ? item.staffId : undefined);

      try {
        const resp = await tenantApiAdapter.searchAvailability({
          tenantId,
          serviceId: item.serviceId,
          date: dateKey,
          staffId: requestedStaffId,
          variantId: item.variantId
        });

        if (resp?.success && Array.isArray(resp.slots)) {
          layers.push(resp.slots.map((s: any) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            available: Boolean(s.available),
            staffId: s.staffId,
            staffName: s.staffName,
            serviceId: item.serviceId
          })));
        } else {
          layers.push([]);
        }
      } catch (err) {
        layers.push([]);
      }
      durations.push(Number(item.duration || 30));
    }

    if (layers.length > 0 && layers.every(l => l.length > 0)) {
      const chains = calculateAllValidChains(layers, durations);
      rawAvailableSlots = chains.map((chain: ChainResult) => {
        const startD = new Date(chain.startTime);
        const endD = new Date(chain.endTime);
        const parts = getDatePartsInTimeZone(startD, tenantTimezone);
        const startTotalMins = Number(parts.hour || '0') * 60 + Number(parts.minute || '0');
        const boardMinutes = Math.max(0, startTotalMins - (boardStartHour * 60));
        const primaryStaffId = chain.slots[0]?.staffId;
        const primaryStaff = allStylists.find(s => s.id === primaryStaffId);
        const staffName = primaryStaff ? (isRtl ? primaryStaff.nameAr : primaryStaff.nameEn) : chain.slots[0]?.staffName;

        return {
          startTime: chain.startTime,
          endTime: chain.endTime,
          clockLabel: formatClockLabel(startD, isRtl, tenantTimezone),
          boardMinutes,
          timeMinutes: boardMinutes,
          staffId: primaryStaffId,
          staffName,
          period: getPeriod(startTotalMins),
          chainSlots: chain.slots
        };
      });
    }
  }

  // Deduplicate slots by startTime and sort chronologically
  const seenTimes = new Set<string>();
  const uniqueSlots: SmartSlot[] = [];
  for (const slot of rawAvailableSlots) {
    if (!seenTimes.has(slot.startTime)) {
      seenTimes.add(slot.startTime);
      uniqueSlots.push(slot);
    }
  }
  uniqueSlots.sort((a, b) => a.timeMinutes - b.timeMinutes);

  const slotsByPeriod = {
    morning: uniqueSlots.filter(s => s.period === 'morning'),
    afternoon: uniqueSlots.filter(s => s.period === 'afternoon'),
    evening: uniqueSlots.filter(s => s.period === 'evening')
  };

  // Build eligible staff availability indicators
  const eligibleStaff = allStylists.map(stylist => {
    const hasSlotWithStylist = uniqueSlots.some(s => 
      s.staffId === stylist.id || (s.chainSlots && s.chainSlots.some(cs => cs.staffId === stylist.id))
    );
    return {
      id: stylist.id,
      nameEn: stylist.nameEn || 'Stylist',
      nameAr: stylist.nameAr || 'مختص',
      available: hasSlotWithStylist
    };
  });

  return {
    dateKey,
    totalSlots: uniqueSlots.length,
    availableCount: uniqueSlots.length,
    slots: uniqueSlots,
    slotsByPeriod,
    hasAvailability: uniqueSlots.length > 0,
    eligibleStaff
  };
}

/**
 * Discovers the earliest upcoming date with available slots for the queued items.
 */
export async function findNextAvailableAlternative({
  tenantId,
  stagedItems,
  startDate,
  checkAllProfessionals = false,
  isRtl = false,
  daysToSearch = 14,
  tenantTimezone = DEFAULT_TENANT_TIMEZONE,
  boardStartHour = 9
}: {
  tenantId: string;
  stagedItems: StagedItemForAvailability[];
  startDate: string; // YYYY-MM-DD
  checkAllProfessionals?: boolean;
  isRtl?: boolean;
  daysToSearch?: number;
  tenantTimezone?: string;
  boardStartHour?: number;
}): Promise<NextAvailableAlternative> {
  if (!tenantId || !stagedItems || stagedItems.length === 0 || !startDate) {
    return {
      found: false,
      dateKey: null,
      displayDateEn: null,
      displayDateAr: null,
      earliestSlot: null,
      daysAhead: null,
      slotsCount: 0
    };
  }

  const distinctPackageIds = Array.from(new Set(stagedItems.map(i => i.packageId).filter(Boolean)));
  const isPurePackage = distinctPackageIds.length === 1 && stagedItems.every(i => Boolean(i.packageId));

  const explicitStaffId = checkAllProfessionals
    ? undefined
    : (stagedItems.find(i => i.isExplicitStaff && i.staffId)?.staffId || undefined);

  // Use the backend next-available endpoint
  try {
    const resp = await tenantApiAdapter.getNextAvailableSlot({
      tenantId,
      packageId: isPurePackage ? (distinctPackageIds[0] as string) : undefined,
      serviceId: !isPurePackage ? stagedItems[0]?.serviceId : undefined,
      staffId: explicitStaffId,
      startDate,
      daysToSearch
    });

    if (resp?.success && resp.date && resp.slot) {
      const slotD = new Date(resp.slot.startTime);
      const parts = getDatePartsInTimeZone(slotD, tenantTimezone);
      const startTotalMins = Number(parts.hour || '0') * 60 + Number(parts.minute || '0');
      const boardMinutes = Math.max(0, startTotalMins - (boardStartHour * 60));
      const smartSlot: SmartSlot = {
        startTime: resp.slot.startTime,
        endTime: resp.slot.endTime,
        clockLabel: formatClockLabel(slotD, isRtl, tenantTimezone),
        boardMinutes,
        timeMinutes: boardMinutes,
        staffId: resp.slot.staffId,
        staffName: resp.slot.staffName,
        period: getPeriod(startTotalMins),
        chainSlots: resp.slot.steps ? resp.slot.steps.map((st: any) => ({
          startTime: st.startTime,
          endTime: st.endTime,
          available: true,
          staffId: st.staffId,
          staffName: st.staffName,
          serviceId: st.serviceId
        })) : undefined
      };

      const dateObj = new Date(resp.date + 'T12:00:00Z');
      const displayEn = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const displayAr = dateObj.toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' });

      return {
        found: true,
        dateKey: resp.date,
        displayDateEn: displayEn,
        displayDateAr: displayAr,
        earliestSlot: smartSlot,
        daysAhead: resp.daysAhead ?? 0,
        slotsCount: Array.isArray(resp.slots) ? resp.slots.length : 1
      };
    }
  } catch (err) {
    console.warn('[findNextAvailableAlternative] Backend check failed:', err);
  }

  return {
    found: false,
    dateKey: null,
    displayDateEn: null,
    displayDateAr: null,
    earliestSlot: null,
    daysAhead: null,
    slotsCount: 0
  };
}

export interface MinimalStagedServiceForSlot {
  id: string;
  startTime: number;
  startTimeIso?: string;
  staffId?: string;
  isExplicitStaff?: boolean;
  resolvedStaffId?: string;
  [key: string]: any;
}

/**
 * Applies a selected SmartSlot to staged services.
 * When chainSlots exists (multi-service chains or packages), updates each staged service
 * with its chained start time, ISO timestamp, and assigned qualified staff.
 */
export function applySmartSlotToStagedServices<T extends MinimalStagedServiceForSlot>(
  stagedServices: T[],
  slot: SmartSlot,
  tenantTimezone = DEFAULT_TENANT_TIMEZONE,
  boardStartHour = 9
): T[] {
  if (!stagedServices || stagedServices.length === 0) {
    return [];
  }

  const slotBoardMinutes = slot.boardMinutes ?? slot.timeMinutes;

  if (slot.chainSlots && slot.chainSlots.length > 0) {
    return stagedServices.map((item, idx) => {
      const chainStep = slot.chainSlots?.[idx];
      if (!chainStep) return item;

      const stepStartD = new Date(chainStep.startTime);
      const stepParts = getDatePartsInTimeZone(stepStartD, tenantTimezone);
      const stepTotalMins = Number(stepParts.hour || '0') * 60 + Number(stepParts.minute || '0');
      const stepBoardMinutes = Math.max(0, stepTotalMins - (boardStartHour * 60));

      return {
        ...item,
        startTime: stepBoardMinutes,
        startTimeIso: chainStep.startTime,
        ...(chainStep.staffId ? {
          staffId: chainStep.staffId,
          isExplicitStaff: true,
          resolvedStaffId: chainStep.staffId
        } : {})
      };
    });
  }

  // Fallback for single service or slot without chainSlots: update anchor item
  return stagedServices.map((item, idx) => {
    if (idx === 0) {
      return {
        ...item,
        startTime: slotBoardMinutes,
        startTimeIso: slot.startTime,
        ...(slot.staffId ? {
          staffId: slot.staffId,
          isExplicitStaff: true,
          resolvedStaffId: slot.staffId
        } : {})
      };
    }
    return item;
  });
}
