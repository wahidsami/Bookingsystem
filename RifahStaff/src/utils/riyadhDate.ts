import { addDays } from 'date-fns';

export const RIYADH_TIME_ZONE = 'Asia/Riyadh';

const weekdayToIndex: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
};

const parseDateKeyAsUtc = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);

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
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: RIYADH_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const parts = formatter.formatToParts(date).reduce<Record<string, string>>((accumulator, part) => {
        if (part.type !== 'literal') {
            accumulator[part.type] = part.value;
        }
        return accumulator;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}`;
};

export const addRiyadhDays = (dateKey: string, days: number): string => {
    const nextDate = addDays(parseDateKeyAsUtc(dateKey), days);
    return getRiyadhDateKey(nextDate);
};

export const getRiyadhWeekStartKey = (date = new Date()): string => {
    const dateKey = getRiyadhDateKey(date);
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'short',
    }).format(date).slice(0, 3).toLowerCase();

    const dayIndex = weekdayToIndex[weekday] ?? 0;
    return addRiyadhDays(dateKey, -(dayIndex - 1 + 7) % 7);
};

export const formatRiyadhDayLabel = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

export const formatRiyadhLongDate = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(date);
};

export const formatRiyadhWeekdayShort = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        weekday: 'short',
    }).format(date);
};

export const formatRiyadhMonthDay = (dateKey: string): string => {
    const date = parseRiyadhDateKey(dateKey);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        month: 'short',
        day: 'numeric',
    }).format(date);
};

export const formatRiyadhDateTime = (value: string | Date): string => {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('en-US', {
        timeZone: RIYADH_TIME_ZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

