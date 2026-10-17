import { WEEKDAY_ROWS, TeamMemberData, getRoleLabel } from '../types/employee';
import { tenantApiAdapter } from './tenantApiAdapter';
import { resolveEmployeeImageUrl } from './employeeImage';

export function to12HourTime(value: string) {
  const raw = `${value || ''}`.trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

export function to24HourTime(value: string) {
  const raw = `${value || ''}`.trim();
  if (!raw) return '';

  const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = amPmMatch[2];
    const period = amPmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  const timeMatch = raw.match(/^(\d{2}):(\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`;
  }

  return raw.length >= 5 ? raw.slice(0, 5) : raw;
}

export function parseScheduleRange(hours: string) {
  const raw = `${hours || ''}`.trim();
  if (!raw || /^day off$/i.test(raw)) {
    return { startTime: '', endTime: '' };
  }
  const parts = raw.split('-').map((p) => p.trim());
  return {
    startTime: parts[0] ? to24HourTime(parts[0]) : '',
    endTime: parts[1] ? to24HourTime(parts[1]) : ''
  };
}

export function formatScheduleRange(startTime: string, endTime: string) {
  if (!startTime && !endTime) return 'Day Off';
  if (!startTime || !endTime) return startTime || endTime || 'Day Off';
  return `${to12HourTime(startTime)} - ${to12HourTime(endTime)}`;
}

export const formatScheduleTime = (time: string) => {
  const str = String(time || '').trim();
  if (!str) return '';
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return str;
  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
};

export const normalizeShiftsToSchedule = (shifts: any[]): TeamMemberData['schedule'] => {
  const grouped = new Map<number, any[]>();
  WEEKDAY_ROWS.forEach((day) => grouped.set(day.dayOfWeek, []));

  shifts.forEach((shift) => {
    const dayOfWeek = Number.isInteger(shift?.dayOfWeek) ? Number(shift.dayOfWeek) : null;
    let normalizedDay = dayOfWeek;

    if (normalizedDay === null && shift?.specificDate) {
      const parsedDate = new Date(shift.specificDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        normalizedDay = parsedDate.getDay();
      }
    }

    if (normalizedDay === null || !grouped.has(normalizedDay)) {
      return;
    }

    grouped.get(normalizedDay)!.push(shift);
  });

  return WEEKDAY_ROWS.map((day) => {
    const items = (grouped.get(day.dayOfWeek) || []).filter((shift) => shift?.isActive !== false);
    const ranges = items
      .map((shift) => `${formatScheduleTime(shift.startTime || '')} - ${formatScheduleTime(shift.endTime || '')}`.trim())
      .filter((range) => range && !range.startsWith(' - ') && !range.endsWith(' - '));
    const subShifts = items.map((shift: any, shiftIndex: number) => ({
      id: shift.id || `shift-${day.dayOfWeek}-${shiftIndex}`,
      label: shift.label || (shift.isRecurring !== false ? 'Shift' : 'One-time shift'),
      startTime: formatScheduleTime(shift.startTime || ''),
      endTime: formatScheduleTime(shift.endTime || '')
    }));

    return {
      dayEn: day.dayEn,
      dayAr: day.dayAr,
      hours: ranges.length > 0 ? ranges.join(' | ') : 'Day Off',
      status: items.length > 0 ? 'working' : 'off',
      slots: [],
      subShifts
    };
  });
};

export const normalizeWorkingHoursSchedule = (workingHours: any): TeamMemberData['schedule'] => {
  if (!workingHours || typeof workingHours !== 'object') {
    return [];
  }

  return WEEKDAY_ROWS.map((day) => {
    const keyLower = day.dayEn.toLowerCase();
    const keyUpper = day.dayEn;
    const dayHours =
      workingHours[keyLower] ??
      workingHours[keyUpper] ??
      workingHours[day.dayOfWeek] ??
      workingHours[String(day.dayOfWeek)];

    const isOpen = Boolean(dayHours?.isOpen);
    const rawOpen = dayHours?.open ?? dayHours?.start ?? dayHours?.startTime ?? '';
    const rawClose = dayHours?.close ?? dayHours?.end ?? dayHours?.endTime ?? '';
    const open = formatScheduleTime(String(rawOpen));
    const close = formatScheduleTime(String(rawClose));

    const isWorking = isOpen && Boolean(open) && Boolean(close);
    const hours = isWorking ? `${open} - ${close}` : 'Day Off';

    return {
      dayEn: day.dayEn,
      dayAr: day.dayAr,
      hours,
      status: isWorking ? 'working' : 'off',
      slots: [],
      subShifts: []
    };
  });
};

export const buildScheduleFromWorkingData = (employee: any, shifts: any[]): TeamMemberData['schedule'] => {
  if (Array.isArray(shifts) && shifts.length > 0) {
    return normalizeShiftsToSchedule(shifts);
  }

  if (employee?.workingHours && typeof employee.workingHours === 'object') {
    return normalizeWorkingHoursSchedule(employee.workingHours);
  }

  return [];
};

export interface ScheduleMeta {
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleContinues: boolean;
}

export const extractScheduleMetaFromShifts = (shifts: any[]): ScheduleMeta => {
  if (!Array.isArray(shifts) || shifts.length === 0) {
    return {
      scheduleStartDate: undefined,
      scheduleEndDate: '',
      scheduleContinues: true
    };
  }

  const normalizeDateStr = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    }
    if (val instanceof Date && !Number.isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
    return null;
  };

  const getMode = (arr: string[]): string | undefined => {
    if (arr.length === 0) return undefined;
    const counts = new Map<string, number>();
    let maxCount = 0;
    let modeVal = arr[0];
    for (const item of arr) {
      const c = (counts.get(item) || 0) + 1;
      counts.set(item, c);
      if (c > maxCount) {
        maxCount = c;
        modeVal = item;
      }
    }
    return modeVal;
  };

  // Authoritative pool: prioritize active recurring shifts (dayOfWeek != null, no specificDate)
  const activeRecurring = shifts.filter(
    (s) => s && s.isActive !== false && s.isRecurring !== false && !s.specificDate && s.dayOfWeek !== null && s.dayOfWeek !== undefined
  );

  const targetPool = activeRecurring.length > 0
    ? activeRecurring
    : shifts.filter((s) => s && s.isActive !== false);

  if (targetPool.length === 0) {
    return {
      scheduleStartDate: undefined,
      scheduleEndDate: '',
      scheduleContinues: true
    };
  }

  const startDates = targetPool.map((s) => normalizeDateStr(s.startDate)).filter(Boolean) as string[];
  const authoritativeStartDate = getMode(startDates);

  const endDates = targetPool.map((s) => normalizeDateStr(s.endDate)).filter(Boolean) as string[];

  // If recurring shifts have no non-null endDate, or less than half have an endDate, it's continuous
  const hasAuthoritativeEnd = endDates.length > 0 && endDates.length >= targetPool.length / 2;
  const authoritativeEndDate = hasAuthoritativeEnd ? getMode(endDates) : '';
  const scheduleContinues = !hasAuthoritativeEnd;

  return {
    scheduleStartDate: authoritativeStartDate,
    scheduleEndDate: authoritativeEndDate,
    scheduleContinues
  };
};

export const cloneScheduleDays = (schedule: TeamMemberData['schedule']) => {
  return schedule.map((day) => ({
    ...day,
    slots: day.slots ? day.slots.map((slot) => ({ ...slot })) : [],
    subShifts: day.subShifts ? day.subShifts.map((sub) => ({ ...sub })) : []
  }));
};

export const fetchEmployeeSchedule = async (employeeId: string, employeeFallback?: any) => {
  try {
    const response = await tenantApiAdapter.getEmployeeShifts(employeeId);
    const shifts = Array.isArray(response?.shifts)
      ? response.shifts
      : Array.isArray(response?.data?.shifts)
        ? response.data.shifts
        : [];

    const scheduleMeta = extractScheduleMetaFromShifts(shifts);

    return {
      schedule: buildScheduleFromWorkingData(employeeFallback || null, shifts),
      scheduleMeta,
      error: null
    };
  } catch (err) {
    console.warn('Failed to load employee shifts:', err);
    return {
      schedule: buildScheduleFromWorkingData(employeeFallback || null, []),
      scheduleMeta: {
        scheduleStartDate: undefined,
        scheduleEndDate: '',
        scheduleContinues: true
      },
      error: err instanceof Error ? err.message : 'Failed to fetch employee shifts'
    };
  }
};

export const mapApiEmployeeToTeamMember = (
  emp: any,
  schedule: TeamMemberData['schedule'] = [],
  scheduleMeta?: ScheduleMeta
): TeamMemberData => {
  const role = getRoleLabel(emp.position);
  return {
    id: emp.id,
    nameEn: emp.name || '',
    nameAr: emp.name || '',
    roleEn: role.roleEn,
    roleAr: role.roleAr,
    avatar: emp.avatar || resolveEmployeeImageUrl(emp.photo || emp.profileImage),
    rating: parseFloat(emp.rating || 5.0),
    status: emp.isActive ? 'active' : 'off',
    email: emp.email || '',
    phone: emp.phone || '',
    joinedDate: emp.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
    bioEn: emp.bio || '',
    bioAr: emp.bio || '',
    experienceEn: emp.experience || '',
    experienceAr: emp.experience || '',
    nationalityAr: emp.nationality || '',
    nationalityEn: emp.nationality || '',
    gender: emp.gender === 'male' ? 'male' : 'female',
    position: role.position,
    specialtiesEn: Array.isArray(emp.skills) ? emp.skills : [],
    specialtiesAr: Array.isArray(emp.skills) ? emp.skills : [],
    languagesEn: Array.isArray(emp.spokenLanguages) ? emp.spokenLanguages : [],
    languagesAr: Array.isArray(emp.spokenLanguages) ? emp.spokenLanguages : [],
    baseSalary: parseFloat(emp.salary || 0),
    commissionRatePct: parseFloat(emp.commissionRate || 0),
    serviceCommissionEnabled: Boolean(emp.serviceCommissionEnabled),
    productCommissionEnabled: Boolean(emp.productCommissionEnabled),
    scheduleVisibilityWeeks: parseInt(emp.scheduleVisibilityWeeks || 2),
    schedule: schedule.length > 0 ? schedule : buildScheduleFromWorkingData(emp, []),
    scheduleStartDate: scheduleMeta?.scheduleStartDate ?? emp.scheduleStartDate ?? emp.createdAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    scheduleEndDate: scheduleMeta?.scheduleEndDate ?? emp.scheduleEndDate ?? '',
    scheduleContinues: scheduleMeta !== undefined ? scheduleMeta.scheduleContinues : (emp.scheduleContinues !== undefined ? Boolean(emp.scheduleContinues) : true),
    bookingsCount: parseInt(emp.totalBookings || 0),
    utilizationRate: 100,
    retentionRate: 100,
    noShowCount: 0,
    servicesSales: 0,
    productSales: 0,
    tips: 0,
    dashboardPermissions: {
      view_dashboard: true,
      manage_appointments: false,
      view_employees: false,
      manage_financials: false,
      view_reports: false,
      manage_settings: false,
      ...(emp.dashboardPermissions || {})
    },
    reviewsList: []
  };
};

export interface ScheduleValidationResult {
  isValid: boolean;
  errorEn?: string;
  errorAr?: string;
}

export function validateWeeklySchedule(schedule: TeamMemberData['schedule']): ScheduleValidationResult {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return { isValid: true };
  }

  for (let i = 0; i < schedule.length; i++) {
    const day = schedule[i];
    if (day.status !== 'working') {
      continue;
    }

    const dayNameAr = day.dayAr || `اليوم ${i + 1}`;
    const dayNameEn = day.dayEn || `Day ${i + 1}`;

    const hasSubShifts = Array.isArray(day.subShifts) && day.subShifts.length > 0;

    if (hasSubShifts) {
      for (const sub of day.subShifts!) {
        const start = to24HourTime(sub.startTime);
        const end = to24HourTime(sub.endTime);
        if (!start || !end) {
          return {
            isValid: false,
            errorEn: `Missing or invalid shift times for ${dayNameEn}`,
            errorAr: `أوقات الشيفت غير مكتملة أو غير صالحة ليوم ${dayNameAr}`
          };
        }
        if (start === end) {
          return {
            isValid: false,
            errorEn: `Shift start and end time cannot be identical for ${dayNameEn}`,
            errorAr: `وقت بداية ونهاية الشيفت لا يمكن أن يكونا متطابقين ليوم ${dayNameAr}`
          };
        }
      }
    } else {
      const { startTime, endTime } = parseScheduleRange(day.hours);
      if (!startTime || !endTime) {
        return {
          isValid: false,
          errorEn: `Please set working hours for active working day: ${dayNameEn}`,
          errorAr: `يرجى تحديد ساعات العمل ليوم العمل النشط: ${dayNameAr}`
        };
      }
      if (startTime === endTime) {
        return {
          isValid: false,
          errorEn: `Working hours start and end time cannot be identical for ${dayNameEn}`,
          errorAr: `وقت بداية ونهاية ساعات العمل لا يمكن أن يكونا متطابقين ليوم ${dayNameAr}`
        };
      }
    }
  }

  return { isValid: true };
}

export function isScheduleEqual(
  a: TeamMemberData['schedule'] | undefined,
  b: TeamMemberData['schedule'] | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  return a.every((dayA, i) => {
    const dayB = b[i];
    if (!dayB) return false;
    if (dayA.status !== dayB.status) return false;
    if (dayA.hours !== dayB.hours) return false;

    const subsA = dayA.subShifts || [];
    const subsB = dayB.subShifts || [];
    if (subsA.length !== subsB.length) return false;

    return subsA.every((sA, j) => {
      const sB = subsB[j];
      return (
        sB &&
        to24HourTime(sA.startTime) === to24HourTime(sB.startTime) &&
        to24HourTime(sA.endTime) === to24HourTime(sB.endTime) &&
        (sA.label || '') === (sB.label || '')
      );
    });
  });
}

export interface PersistScheduleResult {
  savedCount: number;
  deletedCount: number;
}

export const persistEmployeeSchedule = async (
  employeeId: string,
  schedule: TeamMemberData['schedule'],
  scheduleStartDate?: string,
  scheduleEndDate?: string,
  scheduleContinues?: boolean
): Promise<PersistScheduleResult> => {
  if (!employeeId) {
    throw new Error('Employee ID is required to persist schedule');
  }

  const existingResponse = await tenantApiAdapter.getEmployeeShifts(employeeId);
  const existingShifts = Array.isArray(existingResponse?.shifts)
    ? existingResponse.shifts
    : Array.isArray(existingResponse?.data?.shifts)
      ? existingResponse.data.shifts
      : [];

  const recurringStart = scheduleStartDate || new Date().toISOString().split('T')[0];
  const recurringEnd = scheduleContinues ? null : (scheduleEndDate || null);

  const saveTasks: Array<() => Promise<any>> = [];

  schedule.forEach((day, index) => {
    if (day.status !== 'working') {
      return;
    }

    const dayOfWeek = WEEKDAY_ROWS[index]?.dayOfWeek ?? (index >= 0 && index <= 6 ? index : null);
    const hasSubShifts = Array.isArray(day.subShifts) && day.subShifts.length > 0;
    const { startTime: baseStart, endTime: baseEnd } = parseScheduleRange(day.hours);

    if (hasSubShifts) {
      const hasBaseInSubShifts = day.subShifts!.some(
        (sub) => to24HourTime(sub.startTime) === baseStart && to24HourTime(sub.endTime) === baseEnd
      );

      if (baseStart && baseEnd && !hasBaseInSubShifts) {
        saveTasks.push(() =>
          tenantApiAdapter.createEmployeeShift(employeeId, {
            dayOfWeek,
            specificDate: null,
            startTime: baseStart,
            endTime: baseEnd,
            isRecurring: true,
            startDate: recurringStart,
            endDate: recurringEnd,
            label: `${day.dayEn} Shift`
          })
        );
      }

      day.subShifts!.forEach((subShift) => {
        const start = to24HourTime(subShift.startTime);
        const end = to24HourTime(subShift.endTime);
        if (start && end) {
          saveTasks.push(() =>
            tenantApiAdapter.createEmployeeShift(employeeId, {
              dayOfWeek,
              specificDate: null,
              startTime: start,
              endTime: end,
              isRecurring: true,
              startDate: recurringStart,
              endDate: recurringEnd,
              label: subShift.label || 'Sub Shift'
            })
          );
        }
      });
    } else {
      if (baseStart && baseEnd) {
        saveTasks.push(() =>
          tenantApiAdapter.createEmployeeShift(employeeId, {
            dayOfWeek,
            specificDate: null,
            startTime: baseStart,
            endTime: baseEnd,
            isRecurring: true,
            startDate: recurringStart,
            endDate: recurringEnd,
            label: `${day.dayEn} Shift`
          })
        );
      }
    }
  });

  // Delete previous shifts
  await Promise.allSettled(
    existingShifts.map((shift: any) => tenantApiAdapter.deleteEmployeeShift(employeeId, shift.id))
  );

  // Execute all creations
  await Promise.all(saveTasks.map((task) => task()));

  return {
    savedCount: saveTasks.length,
    deletedCount: existingShifts.length
  };
};


