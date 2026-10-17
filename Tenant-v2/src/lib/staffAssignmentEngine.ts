import {
  resolveEmployeeDutyIntervals,
  formatMinutesToClockLabel,
  type StaffShiftRecord
} from './employeeDutyHours';

// Use a local interface that extends StagedService with optional fields needed by the engine
export interface StagedServiceWithAssignment {
  id: string;
  serviceId: string;
  staffId: string;
  isExplicitStaff?: boolean;
  resolvedStaffId?: string;
  startTime: number;
  duration: number;
  itemType?: 'service' | 'package';
  packageId?: string;
  packageInstanceId?: string;
  participantId?: string;
}

export interface StaffAssignmentResolution {
  success: boolean;
  resolvedStaffMap: Map<string, string>; // itemId -> staffId
  reason?: 'explicit_overlap' | 'no_qualified_staff' | 'parallel_staff_conflict';
  conflictingItemId?: string;
  conflictingServiceId?: string;
  conflictingStaffId?: string;
  messageEn?: string;
  messageAr?: string;
}

export interface StylistAvailabilityCheckParams {
  stylist: any;
  service?: any;
  item: {
    id: string;
    startTime: number; // Board minutes from boardStartHour
    duration: number; // in minutes
    participantId?: string;
  };
  selectedDate: string | Date;
  boardStartHour?: number;
  tenantShifts?: StaffShiftRecord[] | null;
  appointments?: any[] | null;
  stagedServices?: any[] | null;
}

export interface StylistAvailabilityResult {
  available: boolean;
  reason?:
    | 'not_qualified'
    | 'status_off'
    | 'no_duty'
    | 'before_shift'
    | 'after_shift'
    | 'shift_gap'
    | 'overlapping_booking'
    | 'overlapping_staged';
  earliestStart?: number;
  latestEnd?: number;
  messageEn?: string;
  messageAr?: string;
}

/**
 * Checks whether a specific stylist is eligible and available to perform a service item
 * at the requested date, start time, and duration.
 */
export function isStylistAvailableForServiceItem(
  params: StylistAvailabilityCheckParams
): StylistAvailabilityResult {
  const {
    stylist,
    service,
    item,
    selectedDate,
    boardStartHour = 9,
    tenantShifts,
    appointments,
    stagedServices
  } = params;

  if (!stylist) {
    return {
      available: false,
      reason: 'not_qualified',
      messageEn: 'Specialist not found.',
      messageAr: 'لم يتم العثور على المختص.'
    };
  }

  // 1. Status Check
  const status = `${stylist?.status || ''}`.toLowerCase();
  if (status === 'off' || stylist?.isActive === false) {
    return {
      available: false,
      reason: 'status_off',
      messageEn: `${stylist.nameEn || 'Specialist'} is currently inactive.`,
      messageAr: `${stylist.nameAr || 'المختص'} غير متاح حالياً.`
    };
  }

  // 2. Qualification Check
  if (service && !isStaffQualifiedForService(service, stylist.id)) {
    return {
      available: false,
      reason: 'not_qualified',
      messageEn: `${stylist.nameEn || 'Specialist'} is not qualified for this service.`,
      messageAr: `${stylist.nameAr || 'المختص'} غير مؤهل لتقديم هذه الخدمة.`
    };
  }

  // 3. Resolve date string YYYY-MM-DD
  const dateKey = typeof selectedDate === 'string'
    ? selectedDate
    : `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  // 4. Duty Hours / Shifts Check
  const startHour = Number(boardStartHour ?? 9);
  const itemStartOfDay = (startHour * 60) + Math.max(0, Number(item.startTime || 0));
  const itemEndOfDay = itemStartOfDay + Math.max(1, Number(item.duration || 0));

  const dutyIntervals = resolveEmployeeDutyIntervals({
    staffId: String(stylist.id),
    dateKey,
    shifts: tenantShifts,
    fallbackSchedule: stylist.schedule
  });

  if (dutyIntervals.length === 0) {
    return {
      available: false,
      reason: 'no_duty',
      messageEn: `${stylist.nameEn || 'Specialist'} has no scheduled duty on this date.`,
      messageAr: `${stylist.nameAr || 'المختص'} ليس لديه دوام في هذا اليوم.`
    };
  }

  const fits = dutyIntervals.some(
    interval => itemStartOfDay >= interval.startMinutes && itemEndOfDay <= interval.endMinutes
  );

  if (!fits) {
    const earliestStart = Math.min(...dutyIntervals.map(i => i.startMinutes));
    const latestEnd = Math.max(...dutyIntervals.map(i => i.endMinutes));
    if (itemStartOfDay < earliestStart) {
      return {
        available: false,
        reason: 'before_shift',
        earliestStart,
        messageEn: `${stylist.nameEn || 'Specialist'} starts at ${formatMinutesToClockLabel(earliestStart, false)}. Please select a different time or employee.`,
        messageAr: `يبدأ دوام ${stylist.nameAr || 'المختص'} في الساعة ${formatMinutesToClockLabel(earliestStart, true)}. يرجى اختيار وقت آخر أو موظف مختلف.`
      };
    }
    if (itemEndOfDay > latestEnd) {
      return {
        available: false,
        reason: 'after_shift',
        latestEnd,
        messageEn: `${stylist.nameEn || 'Specialist'}'s working hours end at ${formatMinutesToClockLabel(latestEnd, false)}, but this service would finish at ${formatMinutesToClockLabel(itemEndOfDay, false)}.`,
        messageAr: `ينتهي دوام ${stylist.nameAr || 'المختص'} في الساعة ${formatMinutesToClockLabel(latestEnd, true)}، بينما تنتهي هذه الخدمة في ${formatMinutesToClockLabel(itemEndOfDay, true)}.`
      };
    }
    return {
      available: false,
      reason: 'shift_gap',
      messageEn: `${stylist.nameEn || 'Specialist'} is on break or between shifts at this time.`,
      messageAr: `${stylist.nameAr || 'المختص'} في فترة استراحة بين الفترات في هذا الوقت.`
    };
  }

  // 5. Existing Board Appointments & Breaks Check
  if (Array.isArray(appointments) && appointments.length > 0) {
    const overlappingBooking = appointments.find(apt => {
      if (String(apt.staffId) !== String(stylist.id)) return false;
      if (apt.status === 'cancelled' || apt.status === 'no_show') return false;
      if (apt.date && apt.date !== dateKey) return false;
      return areServicesOverlapping(item.startTime, item.duration, apt.startTime, apt.duration);
    });

    if (overlappingBooking) {
      return {
        available: false,
        reason: 'overlapping_booking',
        messageEn: `${stylist.nameEn || 'Specialist'} has another appointment or scheduled break at this time.`,
        messageAr: `${stylist.nameAr || 'المختص'} لديه موعد آخر أو فترة راحة مجدولة في هذا الوقت.`
      };
    }
  }

  // 6. Current Booking Staged Services Check
  if (Array.isArray(stagedServices) && stagedServices.length > 0) {
    const overlappingStaged = stagedServices.find(other => {
      if (other.id === item.id) return false;
      if (String(other.staffId) !== String(stylist.id)) return false;
      if (!other.isExplicitStaff) return false;
      return areServicesOverlapping(item.startTime, item.duration, other.startTime, other.duration);
    });

    if (overlappingStaged) {
      return {
        available: false,
        reason: 'overlapping_staged',
        messageEn: `${stylist.nameEn || 'Specialist'} is already assigned to another overlapping service in this booking.`,
        messageAr: `${stylist.nameAr || 'المختص'} مخصص بالفعل لخدمة أخرى متزامنة في هذا الحجز.`
      };
    }
  }

  return { available: true };
}

/**
 * Filters the list of stylists to only those eligible and available for the given service item.
 */
export function getEligibleStylistsForServiceItem(
  params: Omit<StylistAvailabilityCheckParams, 'stylist'> & { stylists: any[] }
): any[] {
  const { stylists, ...checkParams } = params;
  return (stylists || []).filter(stylist => {
    const res = isStylistAvailableForServiceItem({
      ...checkParams,
      stylist
    });
    return res.available;
  });
}

function makeFailure(
  fields: Omit<StaffAssignmentResolution, 'resolvedStaffMap' | 'success'>
): StaffAssignmentResolution {
  return {
    success: false,
    resolvedStaffMap: new Map(),
    ...fields
  };
}

export function areServicesOverlapping(
  startA: number,
  durationA: number,
  startB: number,
  durationB: number
): boolean {
  const safeStartA = Number(startA || 0);
  const safeEndA = safeStartA + Math.max(1, Number(durationA || 0));
  const safeStartB = Number(startB || 0);
  const safeEndB = safeStartB + Math.max(1, Number(durationB || 0));
  return safeStartA < safeEndB && safeEndA > safeStartB;
}

export function isStaffQualifiedForService(
  service: any,
  staffId: string | number
): boolean {
  if (!service) return true;
  const assignments = (service.employeeAssignments || []).map((id: any) => String(id));
  if (assignments.length === 0) return true;
  return assignments.includes(String(staffId));
}

export interface StaffAssignmentContext {
  selectedDate?: string | Date;
  boardStartHour?: number;
  tenantShifts?: StaffShiftRecord[] | null;
  appointments?: any[] | null;
}

/**
 * Resolves staffing assignments for a list of staged services.
 * Respects:
 * 1. Explicit staff selections (hard constraint, never replaced)
 * 2. Any Professional ('') defaults
 * 3. Service capability (employeeAssignments)
 * 4. Time overlaps & parallel bundle sibling conflicts
 * 5. Uses MRV (Minimum Remaining Values) heuristic to avoid premature starvation
 * 6. (Optional) duty hours and existing board appointments when context is provided
 */
export function resolveCompatibleStaffAssignments(
  stagedServices: StagedServiceWithAssignment[],
  availableStylists: any[],
  canonicalServices: any[],
  context?: StaffAssignmentContext
): StaffAssignmentResolution {
  const resolvedStaffMap = new Map<string, string>();
  if (!stagedServices || stagedServices.length === 0) {
    return { success: true, resolvedStaffMap };
  }

  const fixedAssignments = new Map<string, string>(); // itemId -> staffId
  const unassignedItems: StagedServiceWithAssignment[] = [];

  // Step 1: Categorize into explicit (fixed) vs "Any Professional" (unassigned)
  for (const item of stagedServices) {
    const srv = canonicalServices.find(s => s.id === item.serviceId);
    const srvName = srv?.nameEn || item.serviceId;
    const srvNameAr = srv?.nameAr || item.serviceId;

    if (item.isExplicitStaff && item.staffId) {
      // Validate that the explicitly chosen staff is actually qualified
      const isQualified = isStaffQualifiedForService(srv, item.staffId);
      if (!isQualified) {
        return makeFailure({
          reason: 'no_qualified_staff',
          conflictingItemId: item.id,
          conflictingServiceId: item.serviceId,
          conflictingStaffId: item.staffId,
          messageEn: `Selected staff member is not qualified to perform service "${srvName}".`,
          messageAr: `الموظف المحدد غير مؤهل لتقديم خدمة "${srvNameAr}".`
        });
      }

      // If availability context is provided, validate duty hours, shift start/end, and appointments
      if (context?.selectedDate) {
        const staffObj = availableStylists.find(s => String(s.id) === String(item.staffId));
        const availCheck = isStylistAvailableForServiceItem({
          stylist: staffObj,
          service: srv,
          item: {
            id: item.id,
            startTime: item.startTime,
            duration: item.duration,
            participantId: item.participantId
          },
          selectedDate: context.selectedDate,
          boardStartHour: context.boardStartHour,
          tenantShifts: context.tenantShifts,
          appointments: context.appointments,
          stagedServices: stagedServices as any[]
        });

        if (!availCheck.available) {
          return makeFailure({
            reason: 'no_qualified_staff',
            conflictingItemId: item.id,
            conflictingServiceId: item.serviceId,
            conflictingStaffId: item.staffId,
            messageEn: availCheck.messageEn || `Specialist is not available for service "${srvName}".`,
            messageAr: availCheck.messageAr || `المختص غير متاح لخدمة "${srvNameAr}".`
          });
        }
      }

      fixedAssignments.set(item.id, String(item.staffId));
      resolvedStaffMap.set(item.id, String(item.staffId));
    } else {
      unassignedItems.push(item);
    }
  }

  // Step 2: Validate explicit assignments do not collide with overlapping explicit assignments
  const fixedEntries = Array.from(fixedAssignments.entries()).map(([itemId, staffId]) => {
    const item = stagedServices.find(s => s.id === itemId)!;
    return { item, staffId };
  });

  for (let i = 0; i < fixedEntries.length; i++) {
    for (let j = i + 1; j < fixedEntries.length; j++) {
      const a = fixedEntries[i];
      const b = fixedEntries[j];
      if (a.staffId === b.staffId && areServicesOverlapping(a.item.startTime, a.item.duration, b.item.startTime, b.item.duration)) {
        const staff = availableStylists.find(s => String(s.id) === a.staffId);
        const staffName = staff?.nameEn || a.staffId;
        const staffNameAr = staff?.nameAr || a.staffId;
        return makeFailure({
          reason: 'explicit_overlap',
          conflictingItemId: b.item.id,
          conflictingServiceId: b.item.serviceId,
          conflictingStaffId: a.staffId,
          messageEn: `Specialist "${staffName}" is explicitly selected for multiple overlapping services. Please assign different specialists.`,
          messageAr: `تم تعيين الموظف "${staffNameAr}" يدوياً لأكثر من خدمة متزامنة في نفس الوقت. يرجى اختيار موظف مختلف.`
        });
      }
    }
  }

  if (unassignedItems.length === 0) {
    return { success: true, resolvedStaffMap };
  }

  // Step 3: For each unassigned item, determine qualified candidates that don't conflict with overlapping fixed assignments
  interface CandidatePool {
    item: StagedServiceWithAssignment;
    candidates: any[];
  }

  const pools: CandidatePool[] = [];

  for (const item of unassignedItems) {
    const srv = canonicalServices.find(s => s.id === item.serviceId);
    const srvName = srv?.nameEn || item.serviceId;
    const srvNameAr = srv?.nameAr || item.serviceId;

    // Filter availableStylists by service qualification
    const qualifiedStylists = (availableStylists || []).filter(s => isStaffQualifiedForService(srv, s.id));
    if (qualifiedStylists.length === 0) {
      return makeFailure({
        reason: 'no_qualified_staff',
        conflictingItemId: item.id,
        conflictingServiceId: item.serviceId,
        messageEn: `No qualified professionals available for service "${srvName}".`,
        messageAr: `لا يوجد موظفون مؤهلون متاحون لخدمة "${srvNameAr}".`
      });
    }

    // Filter out stylists who are already explicitly booked in overlapping fixed items,
    // or who fail duty hours/appointments if context is provided
    const availableForSlot = qualifiedStylists.filter(s => {
      const sId = String(s.id);
      const isFixedOverlapping = fixedEntries.some(fixed => {
        return fixed.staffId === sId && areServicesOverlapping(item.startTime, item.duration, fixed.item.startTime, fixed.item.duration);
      });
      if (isFixedOverlapping) return false;

      if (context?.selectedDate) {
        const check = isStylistAvailableForServiceItem({
          stylist: s,
          service: srv,
          item: {
            id: item.id,
            startTime: item.startTime,
            duration: item.duration,
            participantId: item.participantId
          },
          selectedDate: context.selectedDate,
          boardStartHour: context.boardStartHour,
          tenantShifts: context.tenantShifts,
          appointments: context.appointments,
          stagedServices: stagedServices as any[]
        });
        if (!check.available) return false;
      }

      return true;
    });

    if (availableForSlot.length === 0) {
      return makeFailure({
        reason: 'parallel_staff_conflict',
        conflictingItemId: item.id,
        conflictingServiceId: item.serviceId,
        messageEn: `No available professional for "${srvName}" at this time because all qualified staff are booked for overlapping services.`,
        messageAr: `لا يوجد موظف مؤهل متاح لخدمة "${srvNameAr}" في هذا الوقت لأن جميع المؤهلين محجوزون لخدمات متزامنة أخرى.`
      });
    }

    pools.push({ item, candidates: availableForSlot });
  }

  // Step 4: MRV (Minimum Remaining Values) sorting:
  // Items with fewer candidate professionals are resolved first to avoid starvation
  pools.sort((a, b) => a.candidates.length - b.candidates.length);

  // Step 5: Backtracking search to assign compatible distinct professionals across unassigned overlapping items
  const currentAssignments = new Map<string, string>(); // itemId -> staffId

  const backtrack = (index: number): boolean => {
    if (index === pools.length) {
      return true;
    }

    const { item, candidates } = pools[index];

    for (const cand of candidates) {
      const candId = String(cand.id);

      // Verify no overlap with already assigned items in currentAssignments
      let hasOverlap = false;
      for (const [assignedItemId, assignedStaffId] of currentAssignments.entries()) {
        if (assignedStaffId === candId) {
          const assignedItem = stagedServices.find(s => s.id === assignedItemId)!;
          if (areServicesOverlapping(item.startTime, item.duration, assignedItem.startTime, assignedItem.duration)) {
            hasOverlap = true;
            break;
          }
        }
      }

      if (!hasOverlap) {
        currentAssignments.set(item.id, candId);
        if (backtrack(index + 1)) {
          return true;
        }
        currentAssignments.delete(item.id);
      }
    }

    return false;
  };

  const solved = backtrack(0);

  if (!solved) {
    const failingItem = pools[0]?.item;
    const failingSrv = canonicalServices.find(s => s.id === failingItem?.serviceId);
    const srvName = failingSrv?.nameEn || failingItem?.serviceId || 'Service';
    const srvNameAr = failingSrv?.nameAr || failingItem?.serviceId || 'خدمة';
    return makeFailure({
      reason: 'parallel_staff_conflict',
      conflictingItemId: failingItem?.id,
      conflictingServiceId: failingItem?.serviceId,
      messageEn: `Could not find compatible distinct staff members for all overlapping services including "${srvName}".`,
      messageAr: `تعذر إيجاد مختصين مستقلين لجميع الخدمات المتزامنة بما في ذلك "${srvNameAr}".`
    });
  }

  // Populate resolvedStaffMap with all assignments
  for (const [itemId, staffId] of currentAssignments.entries()) {
    resolvedStaffMap.set(itemId, staffId);
  }

  return { success: true, resolvedStaffMap };
}
