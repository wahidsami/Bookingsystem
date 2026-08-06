export type WorkingHoursDayKey =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface WorkingHoursDayState {
  key: WorkingHoursDayKey;
  labelEn: string;
  labelAr: string;
  dayOfWeek: number;
  isOpen: boolean;
  open: string;
  close: string;
}

export interface TenantSchedulerConfig {
  slotMinutes: number;
  startHour: number;
  endHour: number;
  businessHours: Record<WorkingHoursDayKey, WorkingHoursDayState>;
}

export interface SchedulerBoardSettings {
  gridWidth: number;
  gridHeight: number;
  timeSlotHeight: number;
  staffColumnWidth: number;
  showCurrentTimeIndicator: boolean;
  showLunchBreaks: boolean;
  showStaffPhotos: boolean;
  showAppointmentStatusBadges: boolean;
}

const DAY_DEFINITIONS: WorkingHoursDayState[] = [
  { key: 'sunday', labelEn: 'Sunday', labelAr: 'الأحد', dayOfWeek: 0, isOpen: true, open: '09:00', close: '21:00' },
  { key: 'monday', labelEn: 'Monday', labelAr: 'الاثنين', dayOfWeek: 1, isOpen: true, open: '09:00', close: '21:00' },
  { key: 'tuesday', labelEn: 'Tuesday', labelAr: 'الثلاثاء', dayOfWeek: 2, isOpen: true, open: '09:00', close: '21:00' },
  { key: 'wednesday', labelEn: 'Wednesday', labelAr: 'الأربعاء', dayOfWeek: 3, isOpen: true, open: '09:00', close: '21:00' },
  { key: 'thursday', labelEn: 'Thursday', labelAr: 'الخميس', dayOfWeek: 4, isOpen: true, open: '09:00', close: '21:00' },
  { key: 'friday', labelEn: 'Friday', labelAr: 'الجمعة', dayOfWeek: 5, isOpen: false, open: '14:00', close: '21:00' },
  { key: 'saturday', labelEn: 'Saturday', labelAr: 'السبت', dayOfWeek: 6, isOpen: true, open: '09:00', close: '21:00' }
];

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 21;
const DEFAULT_SLOT_MINUTES = 5;

export const MIN_STAFF_COLUMN_WIDTH = 80;
export const MAX_STAFF_COLUMN_WIDTH = 200;
export const DEFAULT_STAFF_COLUMN_WIDTH = 90;

export const DEFAULT_SCHEDULER_BOARD_SETTINGS: SchedulerBoardSettings = {
  gridWidth: 100,
  gridHeight: 760,
  timeSlotHeight: 10,
  staffColumnWidth: DEFAULT_STAFF_COLUMN_WIDTH,
  showCurrentTimeIndicator: true,
  showLunchBreaks: true,
  showStaffPhotos: true,
  showAppointmentStatusBadges: true
};

function normalizeHourComponent(value: string): string {
  return String(Math.max(0, Math.min(23, Number(value) || 0))).padStart(2, '0');
}

export function normalizeTimeInput(value: unknown): string {
  const raw = `${value ?? ''}`.trim();
  if (!raw) return '';

  const match24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = normalizeHourComponent(match24[1]);
    const minutes = String(Math.max(0, Math.min(59, Number(match24[2]) || 0))).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = Number(match12[1]);
    const minutes = String(Math.max(0, Math.min(59, Number(match12[2]) || 0))).padStart(2, '0');
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${normalizeHourComponent(String(hours))}:${minutes}`;
  }

  const timeMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hours = normalizeHourComponent(timeMatch[1]);
    const minutes = String(Math.max(0, Math.min(59, Number(timeMatch[2]) || 0))).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return raw;
}

export function formatTimeTo12Hour(value: unknown): string {
  const normalized = normalizeTimeInput(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return normalized;
  }

  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function getDaySource(settings: any, tenant: any, key: WorkingHoursDayKey): any {
  const businessHours = settings?.businessHours || tenant?.workingHours || {};
  const fallback = DAY_DEFINITIONS.find((item) => item.key === key);
  const source = businessHours?.[key] || businessHours?.[fallback?.labelEn?.toLowerCase?.()] || businessHours?.[fallback?.labelAr] || {};

  return {
    isOpen: source?.isOpen !== undefined ? Boolean(source.isOpen) : Boolean(fallback?.isOpen),
    open: normalizeTimeInput(source?.open || fallback?.open || '09:00'),
    close: normalizeTimeInput(source?.close || fallback?.close || '21:00')
  };
}

export function getTenantBusinessHours(settings?: any, tenant?: any): Record<WorkingHoursDayKey, WorkingHoursDayState> {
  return DAY_DEFINITIONS.reduce((acc, day) => {
    acc[day.key] = {
      ...day,
      ...getDaySource(settings, tenant, day.key)
    };
    return acc;
  }, {} as Record<WorkingHoursDayKey, WorkingHoursDayState>);
}

export function getTenantSchedulerConfig(settings?: any, tenant?: any): TenantSchedulerConfig {
  const businessHours = getTenantBusinessHours(settings, tenant);
  const slotMinutes = Number(settings?.bookingSettings?.slotInterval || DEFAULT_SLOT_MINUTES);
  const validSlotMinutes = [5, 10, 15].includes(slotMinutes) ? slotMinutes : DEFAULT_SLOT_MINUTES;

  const openDays = Object.values(businessHours).filter((day) => day.isOpen);
  const openMinutes = openDays
    .map((day) => Number(day.open?.slice(0, 2) || DEFAULT_START_HOUR) * 60 + Number(day.open?.slice(3, 5) || 0))
    .filter((value) => Number.isFinite(value));
  const closeMinutes = openDays
    .map((day) => Number(day.close?.slice(0, 2) || DEFAULT_END_HOUR) * 60 + Number(day.close?.slice(3, 5) || 0))
    .filter((value) => Number.isFinite(value));

  const startHour = openMinutes.length > 0
    ? Math.max(0, Math.min(23, Math.floor(Math.min(...openMinutes) / 60)))
    : DEFAULT_START_HOUR;
  const endHour = closeMinutes.length > 0
    ? Math.max(startHour + 1, Math.min(24, Math.ceil(Math.max(...closeMinutes) / 60)))
    : DEFAULT_END_HOUR;

  return {
    slotMinutes: validSlotMinutes,
    startHour,
    endHour,
    businessHours
  };
}

export function normalizeSchedulerBoardSettings(value?: any): SchedulerBoardSettings {
  const source = value && typeof value === 'object' ? value : {};
  return {
    gridWidth: Math.max(80, Math.min(160, Number(source.gridWidth ?? DEFAULT_SCHEDULER_BOARD_SETTINGS.gridWidth))),
    gridHeight: Math.max(420, Math.min(1400, Number(source.gridHeight ?? DEFAULT_SCHEDULER_BOARD_SETTINGS.gridHeight))),
    timeSlotHeight: Math.max(8, Math.min(24, Number(source.timeSlotHeight ?? DEFAULT_SCHEDULER_BOARD_SETTINGS.timeSlotHeight))),
    staffColumnWidth: Math.max(MIN_STAFF_COLUMN_WIDTH, Math.min(MAX_STAFF_COLUMN_WIDTH, Number(source.staffColumnWidth ?? DEFAULT_STAFF_COLUMN_WIDTH))),
    showCurrentTimeIndicator: source.showCurrentTimeIndicator !== undefined ? Boolean(source.showCurrentTimeIndicator) : DEFAULT_SCHEDULER_BOARD_SETTINGS.showCurrentTimeIndicator,
    showLunchBreaks: source.showLunchBreaks !== undefined ? Boolean(source.showLunchBreaks) : DEFAULT_SCHEDULER_BOARD_SETTINGS.showLunchBreaks,
    showStaffPhotos: source.showStaffPhotos !== undefined ? Boolean(source.showStaffPhotos) : DEFAULT_SCHEDULER_BOARD_SETTINGS.showStaffPhotos,
    showAppointmentStatusBadges: source.showAppointmentStatusBadges !== undefined ? Boolean(source.showAppointmentStatusBadges) : DEFAULT_SCHEDULER_BOARD_SETTINGS.showAppointmentStatusBadges
  };
}

export function buildWeeklyHoursDisplay(settings?: any, tenant?: any) {
  const businessHours = getTenantBusinessHours(settings, tenant);
  return DAY_DEFINITIONS.map((day) => {
    const info = businessHours[day.key];
    return {
      ...day,
      isOpen: info.isOpen,
      open: info.open,
      close: info.close
    };
  });
}
