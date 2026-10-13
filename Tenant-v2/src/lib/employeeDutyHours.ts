/**
 * Employee Duty Hours Resolution & Shading Helper
 * Resolves active duty time intervals for salon employees on a given date,
 * respecting recurring shifts, date-specific schedules, effective date windows,
 * and split shifts (sub-shifts).
 */

export interface StaffShiftRecord {
  id?: string;
  staffId: string;
  dayOfWeek?: number | null;
  specificDate?: string | null;
  startTime: string;
  endTime: string;
  isRecurring?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
  label?: string | null;
}

export interface DutyInterval {
  startMinutes: number; // 0..1440 minutes from midnight
  endMinutes: number;   // 0..1440 minutes from midnight
}

/**
 * Converts time strings like "14:00", "14:00:00", "02:00 PM", "9:30 AM" into minutes from midnight.
 */
export function parseTimeToMinutes(value: string | undefined | null): number {
  if (!value) return 0;
  const raw = `${value}`.trim();

  // Match 12-hour format: "02:00 PM"
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2]);
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return (hours * 60) + minutes;
  }

  // Match 24-hour format: "14:00" or "14:00:00"
  const match24 = raw.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hours = Number(match24[1]);
    const minutes = Number(match24[2]);
    return (hours * 60) + minutes;
  }

  return 0;
}

/**
 * Extracts 0-indexed day of week (0 = Sunday, 6 = Saturday) from a YYYY-MM-DD date key in UTC.
 */
export function getDayOfWeekFromDateKey(dateKey: string): number {
  const parts = dateKey.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return utcDate.getUTCDay();
  }
  return new Date(dateKey).getDay();
}

/**
 * Merges overlapping or contiguous duty intervals and sorts them ascending.
 */
export function normalizeDutyIntervals(intervals: DutyInterval[]): DutyInterval[] {
  if (intervals.length <= 1) return intervals;

  const sorted = [...intervals].sort((a, b) => a.startMinutes - b.startMinutes);
  const merged: DutyInterval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = merged[merged.length - 1];

    if (current.startMinutes <= prev.endMinutes) {
      prev.endMinutes = Math.max(prev.endMinutes, current.endMinutes);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

export interface ResolveDutyIntervalsParams {
  staffId: string;
  dateKey: string; // YYYY-MM-DD
  shifts?: StaffShiftRecord[] | null;
  fallbackSchedule?: any[] | null;
}

/**
 * Resolves authoritative duty intervals (in minutes from midnight) for an employee on a given date.
 * Returns empty array if employee is off or has no duty hours on that date.
 */
export function resolveEmployeeDutyIntervals({
  staffId,
  dateKey,
  shifts,
  fallbackSchedule
}: ResolveDutyIntervalsParams): DutyInterval[] {
  if (!staffId || !dateKey) return [];

  const targetDayOfWeek = getDayOfWeekFromDateKey(dateKey);
  const staffShifts = (shifts || []).filter(
    s => s.staffId === staffId && s.isActive !== false
  );

  // 1. Check for date-specific shifts first
  const dateSpecificShifts = staffShifts.filter(
    s => s.specificDate === dateKey || (!s.isRecurring && s.specificDate === dateKey)
  );

  if (dateSpecificShifts.length > 0) {
    const rawIntervals: DutyInterval[] = [];
    for (const s of dateSpecificShifts) {
      const startMinutes = parseTimeToMinutes(s.startTime);
      const endMinutes = parseTimeToMinutes(s.endTime);
      if (endMinutes > startMinutes) {
        rawIntervals.push({ startMinutes, endMinutes });
      }
    }
    return normalizeDutyIntervals(rawIntervals);
  }

  // 2. Evaluate recurring shifts
  const recurringShifts = staffShifts.filter(s => {
    if (s.isRecurring === false) return false;
    if (typeof s.dayOfWeek !== 'number' || s.dayOfWeek !== targetDayOfWeek) return false;

    // Check effective date window if specified
    if (s.startDate && dateKey < s.startDate) return false;
    if (s.endDate && dateKey > s.endDate) return false;

    return true;
  });

  if (recurringShifts.length > 0) {
    const rawIntervals: DutyInterval[] = [];
    for (const s of recurringShifts) {
      const startMinutes = parseTimeToMinutes(s.startTime);
      const endMinutes = parseTimeToMinutes(s.endTime);
      if (endMinutes > startMinutes) {
        rawIntervals.push({ startMinutes, endMinutes });
      }
    }
    return normalizeDutyIntervals(rawIntervals);
  }

  // 3. Fallback to weekly schedule model if shifts table has no records for this staff
  if (Array.isArray(fallbackSchedule) && fallbackSchedule.length > 0) {
    const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = DAYS_EN[targetDayOfWeek];

    const daySchedule = fallbackSchedule.find(
      (d: any) => d.dayOfWeek === targetDayOfWeek || d.dayEn?.toLowerCase() === targetDayName.toLowerCase()
    );

    if (daySchedule && daySchedule.status === 'working') {
      const rawIntervals: DutyInterval[] = [];

      // Primary shift window
      if (daySchedule.startTime && daySchedule.endTime) {
        const startMinutes = parseTimeToMinutes(daySchedule.startTime);
        const endMinutes = parseTimeToMinutes(daySchedule.endTime);
        if (endMinutes > startMinutes) {
          rawIntervals.push({ startMinutes, endMinutes });
        }
      }

      // Sub-shifts (e.g. split shifts, evening shifts)
      if (Array.isArray(daySchedule.subShifts)) {
        for (const sub of daySchedule.subShifts) {
          if (sub.startTime && sub.endTime) {
            const startMinutes = parseTimeToMinutes(sub.startTime);
            const endMinutes = parseTimeToMinutes(sub.endTime);
            if (endMinutes > startMinutes) {
              rawIntervals.push({ startMinutes, endMinutes });
            }
          }
        }
      }

      return normalizeDutyIntervals(rawIntervals);
    }
  }

  // No shifts configured or day is off
  return [];
}

/**
 * Checks whether a given slot interval [slotStartMinutes, slotEndMinutes) overlaps any duty interval.
 * Returns true if the slot is on duty, false if off duty.
 * If dutyIntervals is undefined (not provided/applicable), returns true to preserve normal styling.
 */
export function isSlotOnDuty(
  slotStartMinutes: number,
  slotEndMinutes: number,
  dutyIntervals?: DutyInterval[] | null
): boolean {
  if (dutyIntervals === undefined) {
    return true; // Unrestricted / unknown
  }
  if (!dutyIntervals || dutyIntervals.length === 0) {
    return false; // Scheduled off all day
  }

  // Half-open overlap rule: slotStart < dutyEnd && slotEnd > dutyStart
  return dutyIntervals.some(
    interval => slotStartMinutes < interval.endMinutes && slotEndMinutes > interval.startMinutes
  );
}
