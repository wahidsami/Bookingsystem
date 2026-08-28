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

export const buildScheduleFromWorkingData = (employee: any, shifts: any[]): TeamMemberData['schedule'] => {
  if (Array.isArray(shifts) && shifts.length > 0) {
    return normalizeShiftsToSchedule(shifts);
  }

  return [];
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

    return {
      schedule: buildScheduleFromWorkingData(employeeFallback || null, shifts),
      error: null
    };
  } catch (err) {
    console.warn('Failed to load employee shifts:', err);
    return {
      schedule: buildScheduleFromWorkingData(employeeFallback || null, []),
      error: err instanceof Error ? err.message : 'Failed to fetch employee shifts'
    };
  }
};

export const mapApiEmployeeToTeamMember = (emp: any, schedule: TeamMemberData['schedule'] = []): TeamMemberData => {
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
    experienceEn: '',
    experienceAr: '',
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


