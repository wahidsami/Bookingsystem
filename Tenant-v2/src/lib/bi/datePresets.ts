import type { BIDatePresetValue, BIDateRange } from './types';

export const BI_DATE_PRESET_OPTIONS: { value: BIDatePresetValue; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'custom', label: 'Custom' }
];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function shiftMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function firstDayOfMonth(date: Date): Date {
  const next = new Date(date);
  next.setDate(1);
  return startOfDay(next);
}

function lastDayOfPreviousMonth(date: Date): Date {
  const next = new Date(date);
  next.setDate(0);
  return endOfDay(next);
}

function previousFullWeek(date: Date): BIDateRange {
  const today = startOfDay(date);
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() + mondayOffset);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(currentWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(currentWeekStart);
  previousWeekEnd.setDate(currentWeekStart.getDate() - 1);
  return {
    from: startOfDay(previousWeekStart).toISOString(),
    to: endOfDay(previousWeekEnd).toISOString()
  };
}

export function resolveBIDateRange(
  preset: BIDatePresetValue,
  customRange?: Partial<BIDateRange> | null,
  referenceDate = new Date()
): BIDateRange {
  if (preset === 'custom') {
    const from = customRange?.from ? new Date(customRange.from) : null;
    const to = customRange?.to ? new Date(customRange.to) : null;

    if (from && !Number.isNaN(from.getTime()) && to && !Number.isNaN(to.getTime()) && to >= from) {
      return {
        from: startOfDay(from).toISOString(),
        to: endOfDay(to).toISOString()
      };
    }

    const fallback = endOfDay(referenceDate);
    return {
      from: startOfDay(referenceDate).toISOString(),
      to: fallback.toISOString()
    };
  }

  const now = new Date(referenceDate);

  switch (preset) {
    case 'today':
      return {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString()
      };
    case 'yesterday': {
      const day = new Date(now);
      day.setDate(day.getDate() - 1);
      return {
        from: startOfDay(day).toISOString(),
        to: endOfDay(day).toISOString()
      };
    }
    case 'last_7_days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() };
    }
    case 'last_30_days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() };
    }
    case 'last_90_days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 89);
      return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() };
    }
    case 'last_week':
      return previousFullWeek(now);
    case 'last_month': {
      const previousMonth = new Date(now);
      previousMonth.setMonth(previousMonth.getMonth() - 1, 1);
      return {
        from: firstDayOfMonth(previousMonth).toISOString(),
        to: lastDayOfPreviousMonth(now).toISOString()
      };
    }
    case 'last_3_months': {
      const from = firstDayOfMonth(shiftMonths(now, -3));
      return { from: from.toISOString(), to: endOfDay(now).toISOString() };
    }
    case 'last_6_months': {
      const from = firstDayOfMonth(shiftMonths(now, -6));
      return { from: from.toISOString(), to: endOfDay(now).toISOString() };
    }
    default:
      return {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString()
      };
  }
}

export function formatBIDatePresetLabel(preset: BIDatePresetValue): string {
  return BI_DATE_PRESET_OPTIONS.find((option) => option.value === preset)?.label || 'Custom';
}

