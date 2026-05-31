import { addDays } from 'date-fns';

export const RIYADH_TIME_ZONE = 'Asia/Riyadh';
const CLOCK_TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const weekdayToIndex: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
};

const parseDateKeyAsUtc = (dateKey: string) => {
    if (!DATE_KEY_PATTERN.test(`${dateKey || ''}`)) {
        return new Date(NaN);
    }
    return new Date(`${dateKey}T00:00:00Z`);
};

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

const normalizeTimeString = (timeString: string) => {
    if (/^\d{2}:\d{2}$/.test(timeString)) {
        return `${timeString}:00`;
    }

    return timeString;
};

export const parseRiyadhDateKey = (dateKey: string) => parseDateKeyAsUtc(dateKey);

export const parseRiyadhDateTime = (dateKey: string, timeString: string): Date => {
    return new Date(`${dateKey}T${normalizeTimeString(timeString)}+03:00`);
};

export const getRiyadhDateKey = (date = new Date()): string => {
    const safeDate = isValidDate(date) ? date : new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: RIYADH_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const parts = formatter.formatToParts(safeDate).reduce<Record<string, string>>((accumulator, part) => {
        if (part.type !== 'literal') {
            accumulator[part.type] = part.value;
        }
        return accumulator;
    }, {});

    if (!parts.year || !parts.month || !parts.day) {
        return '1970-01-01';
    }

    return `${parts.year}-${parts.month}-${parts.day}`;
};

export const addRiyadhDays = (dateKey: string, days: number): string => {
    const parsedDate = parseDateKeyAsUtc(dateKey);
    const baseDate = isValidDate(parsedDate) ? parsedDate : new Date();
    const nextDate = addDays(baseDate, days);
    return getRiyadhDateKey(nextDate);
};

export const getRiyadhWeekStartKey = (date = new Date()): string => {
    const safeDate = isValidDate(date) ? date : new Date();
    const dateKey = getRiyadhDateKey(safeDate);
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'short',
    }).format(safeDate).slice(0, 3).toLowerCase();

    const dayIndex = weekdayToIndex[weekday] ?? 0;
    return addRiyadhDays(dateKey, -(dayIndex - 1 + 7) % 7);
};

export const formatRiyadhDayLabel = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    if (!isValidDate(date)) return '--';
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

export const formatRiyadhLongDate = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    if (!isValidDate(date)) return 'Invalid date';
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(date);
};

export const formatRiyadhWeekdayShort = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    if (!isValidDate(date)) return '--';
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'short',
    }).format(date);
};

export const formatRiyadhMonthDay = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    if (!isValidDate(date)) return '--';
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        month: 'short',
        day: 'numeric',
    }).format(date);
};

export const formatRiyadhDateTime = (value: string | Date): string => {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

export const formatRiyadhTime = (value?: string | null): string => {
    if (!value) return '--:--';
    const trimmed = `${value}`.trim();

    const clockMatch = trimmed.match(CLOCK_TIME_PATTERN);
    if (clockMatch) {
        const hours = Number(clockMatch[1]);
        const minutes = Number(clockMatch[2]);
        if (
            Number.isFinite(hours) &&
            Number.isFinite(minutes) &&
            hours >= 0 &&
            hours <= 23 &&
            minutes >= 0 &&
            minutes <= 59
        ) {
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const normalizedHour = hours % 12 || 12;
            return `${normalizedHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
        return '--:--';
    }

    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};
