export type ConflictReasonType =
  | 'blocked_time'
  | 'existing_booking'
  | 'outside_working_hours'
  | 'staff_break'
  | 'time_off'
  | 'unavailable'
  | 'unknown'
  | 'available';

export interface AvailabilityDiagnostic {
  staffId?: string | null;
  serviceId?: string | null;
  staffName?: string | null;
  avatar?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  reasonType?: ConflictReasonType | string | null;
  reasonStartTime?: string | null;
  reasonEndTime?: string | null;
  workingHoursEnd?: string | null;
  conflictType?: string | null;
  message?: string | null;
  messageAr?: string | null;
  actionableGuidance?: string | null;
  actionableGuidanceAr?: string | null;
  conflicts?: any[] | null;
  conflictDetails?: any | null;
}

export interface ConflictCard {
  staffId: string;
  staffName: string;
  avatar?: string;
  reasonType: ConflictReasonType;
  reasonTitle: string;
  reasonDescription: string;
  conflictStartTime?: string;
  conflictEndTime?: string;
  workingHoursEnd?: string;
}

const REASON_PRIORITY: Record<ConflictReasonType, number> = {
  existing_booking: 600,
  blocked_time: 500,
  staff_break: 400,
  time_off: 300,
  unavailable: 200,
  outside_working_hours: 100,
  unknown: 0,
  available: -1
};

const normalizeReasonType = (value?: string | null): ConflictReasonType => {
  const raw = `${value || ''}`.trim().toLowerCase();
  if (raw === 'existing_booking') return 'existing_booking';
  if (raw === 'blocked_time') return 'blocked_time';
  if (raw === 'staff_break') return 'staff_break';
  if (raw === 'time_off') return 'time_off';
  if (raw === 'outside_working_hours') return 'outside_working_hours';
  if (raw === 'unavailable') return 'unavailable';
  if (raw === 'available') return 'available';
  return 'unknown';
};

const hasValidTime = (value?: string | null) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const toMs = (value?: string | null) => {
  if (!hasValidTime(value)) return null;
  return new Date(value!).getTime();
};

const overlaps = (
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null
) => {
  const startA = toMs(aStart);
  const endA = toMs(aEnd);
  const startB = toMs(bStart);
  const endB = toMs(bEnd);
  if (startA === null || endA === null || startB === null || endB === null) {
    return false;
  }
  return startA < endB && endA > startB;
};

const getDiagnosticInterval = (diagnostic: AvailabilityDiagnostic) => {
  const startTime = diagnostic.reasonStartTime || diagnostic.startTime || null;
  const endTime = diagnostic.reasonEndTime || diagnostic.endTime || null;
  return { startTime, endTime };
};

const isRelevantToRequestedInterval = ({
  diagnostic,
  requestedStartTime,
  requestedEndTime
}: {
  diagnostic: AvailabilityDiagnostic;
  requestedStartTime?: string | null;
  requestedEndTime?: string | null;
}) => {
  const reasonType = normalizeReasonType(diagnostic.reasonType);
  const { startTime, endTime } = getDiagnosticInterval(diagnostic);

  if (reasonType === 'outside_working_hours') {
    const requestedEndMs = toMs(requestedEndTime);
    const workingHoursEndMs = toMs(diagnostic.workingHoursEnd || diagnostic.reasonEndTime || diagnostic.endTime);
    if (requestedEndMs === null || workingHoursEndMs === null) {
      return false;
    }
    return requestedEndMs > workingHoursEndMs;
  }

  return overlaps(startTime, endTime, requestedStartTime, requestedEndTime);
};

export const formatConflictTime = (value?: string | null, isRtl = false) => {
  if (!hasValidTime(value)) return '';
  try {
    return new Intl.DateTimeFormat(isRtl ? 'ar-SA' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(value!));
  } catch {
    return '';
  }
};

export const pickBestConflictDiagnostic = ({
  diagnostics,
  serviceId,
  staffId,
  requestedStartTime,
  requestedEndTime,
  exactSlotStartTime,
  exactSlotEndTime
}: {
  diagnostics: AvailabilityDiagnostic[];
  serviceId?: string | null;
  staffId?: string | null;
  requestedStartTime?: string | null;
  requestedEndTime?: string | null;
  exactSlotStartTime?: string | null;
  exactSlotEndTime?: string | null;
}) => {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return null;
  }

  const requestedStartMs = toMs(requestedStartTime);
  const requestedEndMs = toMs(requestedEndTime);

  const relevantDiagnostics = diagnostics.filter((diagnostic) => {
    const diagnosticServiceId = `${diagnostic.serviceId || ''}`.trim();
    if (serviceId && diagnosticServiceId && diagnosticServiceId !== `${serviceId}`.trim()) {
      return false;
    }

    return isRelevantToRequestedInterval({
      diagnostic,
      requestedStartTime,
      requestedEndTime
    });
  });

  if (relevantDiagnostics.length === 0) {
    return null;
  }

  const scored = relevantDiagnostics.map((diagnostic, index) => {
    const reasonType = normalizeReasonType(diagnostic.reasonType);
    let score = REASON_PRIORITY[reasonType] ?? 0;

    if (staffId && `${diagnostic.staffId || ''}` === `${staffId}`) {
      score += 200;
    }

    const { startTime: diagnosticStartTime, endTime: diagnosticEndTime } = getDiagnosticInterval(diagnostic);
    const exactSlotStartMs = toMs(exactSlotStartTime);
    const exactSlotEndMs = toMs(exactSlotEndTime);

    if (exactSlotStartMs !== null && exactSlotEndMs !== null) {
      if (toMs(diagnosticStartTime) === exactSlotStartMs && toMs(diagnosticEndTime) === exactSlotEndMs) {
        score += 160;
      }

      if (overlaps(diagnosticStartTime, diagnosticEndTime, exactSlotStartTime, exactSlotEndTime)) {
        score += 120;
      }
    }

    if (requestedStartMs !== null && requestedEndMs !== null) {
      if (toMs(diagnosticStartTime) === requestedStartMs && toMs(diagnosticEndTime) === requestedEndMs) {
        score += 90;
      }

      if (overlaps(diagnosticStartTime, diagnosticEndTime, requestedStartTime, requestedEndTime)) {
        score += 80;
      }
    }

    if (serviceId && `${diagnostic.serviceId || ''}`.trim() === `${serviceId}`.trim()) {
      score += 30;
    }

    return { diagnostic, score, index };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });

  return scored[0]?.diagnostic || null;
};

export const buildConflictCard = ({
  diagnostic,
  staffId,
  staffName,
  avatar,
  isRtl
}: {
  diagnostic: AvailabilityDiagnostic | null;
  staffId: string;
  staffName?: string | null;
  avatar?: string | null;
  isRtl: boolean;
}): ConflictCard => {
  // If diagnostic is null, it means no specific blocker diagnostic was provided for this rejection card; never label it as available.
  const normalizedReason = diagnostic === null ? 'unavailable' : normalizeReasonType(diagnostic?.reasonType);
  const resolvedName = `${staffName || diagnostic?.staffName || ''}`.trim() || (isRtl ? 'المختص' : 'Professional');
  const reasonTitles: Record<ConflictReasonType, { ar: string; en: string }> = {
    blocked_time: { ar: 'وقت محظور', en: 'Blocked Time' },
    existing_booking: { ar: 'لديها حجز آخر في هذا الوقت', en: 'Another booking at this time' },
    outside_working_hours: { ar: 'خارج ساعات العمل', en: 'Outside working hours' },
    staff_break: { ar: 'استراحة الموظفة', en: 'Staff break' },
    time_off: { ar: 'إجازة / غياب', en: 'Time off' },
    unavailable: { ar: 'غير متاحة', en: 'Unavailable' },
    unknown: { ar: 'تعذر تحديد السبب', en: 'Reason unavailable' },
    available: { ar: 'متاحة', en: 'Available' }
  };

  const reasonDescriptions: Record<ConflictReasonType, { ar: string; en: string }> = {
    blocked_time: {
      ar: 'لديها فترة حظر تتداخل مع وقت الخدمة المطلوبة.',
      en: 'A blocked period overlaps the requested service time.'
    },
    existing_booking: {
      ar: 'لديها حجز آخر في نفس الفترة الزمنية.',
      en: 'Another booking already occupies this time.'
    },
    outside_working_hours: {
      ar: 'لا يمكنها إكمال الخدمة لأن نهاية الخدمة تتجاوز نهاية دوامها.',
      en: 'This service extends beyond the staff member’s working hours.'
    },
    staff_break: {
      ar: 'الموعد يتداخل مع استراحة مجدولة.',
      en: 'The appointment overlaps a scheduled break.'
    },
    time_off: {
      ar: 'الموعد يقع ضمن فترة إجازة أو غياب معتمدة.',
      en: 'The appointment falls inside an approved time-off period.'
    },
    unavailable: {
      ar: 'هذه الفترة غير متاحة حالياً.',
      en: 'This period is not available right now.'
    },
    unknown: {
      ar: 'تعذر تحديد سبب عدم الإتاحة بدقة.',
      en: 'The availability reason could not be determined precisely.'
    },
    available: {
      ar: 'الموظفة متاحة لتقديم الخدمة في هذا الوقت.',
      en: 'The professional is available for this requested time.'
    }
  };

  return {
    staffId,
    staffName: resolvedName,
    avatar: avatar || diagnostic?.avatar || undefined,
    reasonType: normalizedReason,
    reasonTitle: isRtl ? reasonTitles[normalizedReason].ar : reasonTitles[normalizedReason].en,
    reasonDescription: isRtl ? reasonDescriptions[normalizedReason].ar : reasonDescriptions[normalizedReason].en,
    conflictStartTime: diagnostic?.reasonStartTime || diagnostic?.startTime || undefined,
    conflictEndTime: diagnostic?.reasonEndTime || diagnostic?.endTime || undefined,
    workingHoursEnd: diagnostic?.workingHoursEnd || undefined
  };
};

export const getConflictBadgeClasses = (reasonType: ConflictReasonType): string => {
  switch (reasonType) {
    case 'existing_booking':
      return 'bg-rose-50 text-rose-600';
    case 'outside_working_hours':
      return 'bg-amber-50 text-amber-700';
    case 'time_off':
      return 'bg-slate-100 text-slate-600';
    case 'blocked_time':
      return 'bg-orange-50 text-orange-700';
    case 'staff_break':
      return 'bg-indigo-50 text-indigo-700';
    case 'available':
      return 'bg-emerald-50 text-emerald-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export interface ScheduleContextItem {
  tenantHours?: { open: string; close: string; closed: boolean } | null;
  employeeDutyWindows?: Array<{ startTime: string; endTime: string }>;
  breaks?: Array<{ startTime: string; endTime: string; type?: string | null; label?: string | null }>;
  timeOff?: Array<{ startTime: string; endTime: string }>;
  existingAppointments?: Array<{ id?: string; startTime: string; endTime: string }>;
  bufferBefore?: number;
  bufferAfter?: number;
  duration?: number;
  timezone?: string;
}

export interface EvaluateIntervalOptions {
  serviceId?: string | null;
  staffId?: string | null;
  requestedStartTime: string;
  requestedEndTime: string;
  exactSlot?: any | null;
  diagnostics?: AvailabilityDiagnostic[];
  scheduleContext?: ScheduleContextItem | null;
  priorChainAllocations?: Array<{ staffId?: string | null; startMs: number; endMs: number }>;
}

export interface IntervalEvaluationResult {
  isValid: boolean;
  diagnostic: AvailabilityDiagnostic | null;
}

/**
 * Robustly evaluates whether a requested time interval is available for a staff member.
 * Supports off-grid boundaries (e.g. 2:10 PM, 3:10 PM) by cross-checking duty windows,
 * breaks, existing appointments, and chain allocations even when discrete candidate slot is missing.
 */
export const evaluateIntervalFeasibility = ({
  serviceId,
  staffId,
  requestedStartTime,
  requestedEndTime,
  exactSlot,
  diagnostics = [],
  scheduleContext,
  priorChainAllocations = []
}: EvaluateIntervalOptions): IntervalEvaluationResult => {
  const reqStartMs = toMs(requestedStartTime);
  const reqEndMs = toMs(requestedEndTime);

  if (reqStartMs === null || reqEndMs === null || reqEndMs <= reqStartMs) {
    return {
      isValid: false,
      diagnostic: {
        reasonType: 'unknown',
        staffId: staffId || null,
        serviceId: serviceId || null
      }
    };
  }

  // Case 1: An exact discrete slot exists
  if (exactSlot) {
    if (!exactSlot.available) {
      const diagnostic = pickBestConflictDiagnostic({
        diagnostics,
        serviceId,
        staffId: staffId || exactSlot.staffId,
        requestedStartTime,
        requestedEndTime,
        exactSlotStartTime: exactSlot.startTime,
        exactSlotEndTime: exactSlot.endTime
      }) || {
        reasonType: 'unavailable',
        staffId: staffId || exactSlot.staffId,
        serviceId
      };
      return { isValid: false, diagnostic };
    }

    // Check collision with prior chain allocations for same staff
    const assignedStaffId = staffId || exactSlot.staffId;
    if (assignedStaffId) {
      const priorOverlap = priorChainAllocations.find(
        (a) => a.staffId && `${a.staffId}` === `${assignedStaffId}` && reqStartMs < a.endMs && reqEndMs > a.startMs
      );
      if (priorOverlap) {
        return {
          isValid: false,
          diagnostic: {
            reasonType: 'existing_booking',
            staffId: assignedStaffId,
            serviceId,
            startTime: new Date(priorOverlap.startMs).toISOString(),
            endTime: new Date(priorOverlap.endMs).toISOString(),
            reasonStartTime: new Date(priorOverlap.startMs).toISOString(),
            reasonEndTime: new Date(priorOverlap.endMs).toISOString()
          }
        };
      }
    }

    return { isValid: true, diagnostic: null };
  }

  // Case 2: Discrete slot does NOT exist (e.g. off-grid boundary like 2:10 PM, 3:10 PM)
  // Check if backend returned explicit conflict diagnostic overlapping this interval
  const conflictDiagnostic = pickBestConflictDiagnostic({
    diagnostics,
    serviceId,
    staffId,
    requestedStartTime,
    requestedEndTime
  });

  if (conflictDiagnostic) {
    return { isValid: false, diagnostic: conflictDiagnostic };
  }

  // Check scheduleContext (duty windows, breaks, existing appointments)
  if (scheduleContext) {
    const dutyWindows = scheduleContext.employeeDutyWindows || [];
    if (Array.isArray(dutyWindows)) {
      if (dutyWindows.length === 0) {
        return {
          isValid: false,
          diagnostic: {
            reasonType: 'outside_working_hours',
            staffId,
            serviceId
          }
        };
      }

      const coveredByShift = dutyWindows.some((w) => {
        const wStartMs = toMs(w.startTime);
        const wEndMs = toMs(w.endTime);
        return wStartMs !== null && wEndMs !== null && wStartMs <= reqStartMs && wEndMs >= reqEndMs;
      });

      if (!coveredByShift) {
        return {
          isValid: false,
          diagnostic: {
            reasonType: 'outside_working_hours',
            staffId,
            serviceId,
            workingHoursEnd: dutyWindows[0]?.endTime
          }
        };
      }
    }

    const breaks = scheduleContext.breaks || [];
    const breakOverlap = breaks.find((b) => {
      const bStartMs = toMs(b.startTime);
      const bEndMs = toMs(b.endTime);
      return bStartMs !== null && bEndMs !== null && reqStartMs < bEndMs && reqEndMs > bStartMs;
    });
    if (breakOverlap) {
      return {
        isValid: false,
        diagnostic: {
          reasonType: 'staff_break',
          staffId,
          serviceId,
          startTime: breakOverlap.startTime,
          endTime: breakOverlap.endTime,
          reasonStartTime: breakOverlap.startTime,
          reasonEndTime: breakOverlap.endTime
        }
      };
    }

    const timeOff = scheduleContext.timeOff || [];
    const timeOffOverlap = timeOff.find((t) => {
      const tStartMs = toMs(t.startTime);
      const tEndMs = toMs(t.endTime);
      return tStartMs !== null && tEndMs !== null && reqStartMs < tEndMs && reqEndMs > tStartMs;
    });
    if (timeOffOverlap) {
      return {
        isValid: false,
        diagnostic: {
          reasonType: 'time_off',
          staffId,
          serviceId,
          startTime: timeOffOverlap.startTime,
          endTime: timeOffOverlap.endTime,
          reasonStartTime: timeOffOverlap.startTime,
          reasonEndTime: timeOffOverlap.endTime
        }
      };
    }

    const existingAppointments = scheduleContext.existingAppointments || [];
    const apptOverlap = existingAppointments.find((a) => {
      const aStartMs = toMs(a.startTime);
      const aEndMs = toMs(a.endTime);
      return aStartMs !== null && aEndMs !== null && reqStartMs < aEndMs && reqEndMs > aStartMs;
    });
    if (apptOverlap) {
      return {
        isValid: false,
        diagnostic: {
          reasonType: 'existing_booking',
          staffId,
          serviceId,
          startTime: apptOverlap.startTime,
          endTime: apptOverlap.endTime,
          reasonStartTime: apptOverlap.startTime,
          reasonEndTime: apptOverlap.endTime
        }
      };
    }
  }

  // Check collision with prior chain allocations for same staff
  if (staffId) {
    const priorOverlap = priorChainAllocations.find(
      (a) => a.staffId && `${a.staffId}` === `${staffId}` && reqStartMs < a.endMs && reqEndMs > a.startMs
    );
    if (priorOverlap) {
      return {
        isValid: false,
        diagnostic: {
          reasonType: 'existing_booking',
          staffId,
          serviceId,
          startTime: new Date(priorOverlap.startMs).toISOString(),
          endTime: new Date(priorOverlap.endMs).toISOString(),
          reasonStartTime: new Date(priorOverlap.startMs).toISOString(),
          reasonEndTime: new Date(priorOverlap.endMs).toISOString()
        }
      };
    }
  }

  // No blockers identified, interval is feasible!
  return { isValid: true, diagnostic: null };
};

