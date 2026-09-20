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

/**
 * Resolves staffing assignments for a list of staged services.
 * Respects:
 * 1. Explicit staff selections (hard constraint, never replaced)
 * 2. Any Professional ('') defaults
 * 3. Service capability (employeeAssignments)
 * 4. Time overlaps & parallel bundle sibling conflicts
 * 5. Uses MRV (Minimum Remaining Values) heuristic to avoid premature starvation
 */
export function resolveCompatibleStaffAssignments(
  stagedServices: StagedServiceWithAssignment[],
  availableStylists: any[],
  canonicalServices: any[]
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

    // Filter out stylists who are already explicitly booked in overlapping fixed items
    const availableForSlot = qualifiedStylists.filter(s => {
      const sId = String(s.id);
      return !fixedEntries.some(fixed => {
        return fixed.staffId === sId && areServicesOverlapping(item.startTime, item.duration, fixed.item.startTime, fixed.item.duration);
      });
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
