import api from './api';
import { addRiyadhDays } from '../utils/riyadhDate';

export interface Shift {
    id: string; // Synthetic ID for React keys
    shiftId: string; // Real DB ID
    date: string;
    startTime: string;
    endTime: string;
    label?: string;
    type: 'shift' | 'specific';
}

export interface BreakWindow {
    id: string;
    breakId: string;
    date: string;
    startTime: string;
    endTime: string;
    label?: string;
    type: 'break' | 'specific';
}

export interface TimeOff {
    id: string;
    startDate: string;
    endDate: string;
    type: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
    reason?: string;
    isApproved: boolean;
    createdAt: string;
}

export interface ScheduleData {
    shifts: Shift[];
    breaks: BreakWindow[];
    timeOff: TimeOff[];
    displayHours?: {
        startMinute: number;
        endMinute: number;
    };
}

const toText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
};

const normalizeTimeOffType = (value: unknown): TimeOff['type'] => {
    const normalized = `${value || ''}`.toLowerCase();
    if (normalized === 'vacation' || normalized === 'sick' || normalized === 'personal' || normalized === 'training') {
        return normalized;
    }
    return 'other';
};

const buildDateRange = (startDate: string, endDate: string) => {
    const dates: string[] = [];
    let cursor = startDate;

    while (cursor <= endDate) {
        dates.push(cursor);
        cursor = addRiyadhDays(cursor, 1);
    }

    return dates;
};

const normalizeShift = (shift: any, date: string): Shift => ({
    id: `${date}-${toText(shift?.id)}`,
    shiftId: toText(shift?.id),
    date,
    startTime: toText(shift?.startTime),
    endTime: toText(shift?.endTime),
    label: shift?.label || undefined,
    type: shift?.specificDate ? 'specific' : 'shift',
});

const normalizeTimeOff = (item: any): TimeOff => ({
    id: toText(item?.id),
    startDate: toText(item?.startDate),
    endDate: toText(item?.endDate),
    type: normalizeTimeOffType(item?.type),
    reason: item?.reason,
    isApproved: Boolean(item?.isApproved),
    createdAt: toText(item?.createdAt),
});

export const normalizeBreak = (item: any, date: string): BreakWindow => ({
    id: `${date}-${toText(item?.id)}`,
    breakId: toText(item?.id),
    date,
    startTime: toText(item?.startTime),
    endTime: toText(item?.endTime),
    label: item?.label || undefined,
    type: item?.specificDate ? 'specific' : 'break',
});

/**
 * Fetch schedule for a given date range
 */
export const getSchedule = async (startDate: string, endDate: string): Promise<ScheduleData> => {
    try {
        const dates = buildDateRange(startDate, endDate);
        const responses = await Promise.all(
            dates.map((date) => api.get(`/staff/schedule?date=${date}`))
        );

        const shifts: Shift[] = [];
        const breaks: BreakWindow[] = [];
        const timeOffMap = new Map<string, TimeOff>();

        let displayHours: ScheduleData['displayHours'];
        responses.forEach((response, index) => {
            if (!response.data?.success || !response.data?.schedule) {
                return;
            }

            const date = dates[index];
            const schedule = response.data.schedule;
            if (!displayHours && schedule?.displayHours) {
                displayHours = {
                    startMinute: Number(schedule.displayHours.startMinute),
                    endMinute: Number(schedule.displayHours.endMinute),
                };
            }
            (schedule.shifts || []).forEach((shift: any) => {
                shifts.push(normalizeShift(shift, date));
            });
            (schedule.breaks || []).forEach((item: any) => {
                breaks.push(normalizeBreak(item, date));
            });

            (schedule.timeOff || []).forEach((item: any) => {
                const normalized = normalizeTimeOff(item);
                timeOffMap.set(normalized.id, normalized);
            });
        });

        return {
            shifts,
            breaks,
            timeOff: Array.from(timeOffMap.values()),
            displayHours: displayHours && Number.isFinite(displayHours.startMinute) && Number.isFinite(displayHours.endMinute)
                ? displayHours
                : undefined,
        };
    } catch (error) {
        console.error('Error fetching schedule:', error);
        throw error;
    }
};

/**
 * Get all time off requests for the logged in staff
 */
export const getTimeOffRequests = async (): Promise<TimeOff[]> => {
    const response = await api.get('/staff/time-off');
    if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to load time off requests');
    }

    return (response.data?.data || []).map((item: any) => normalizeTimeOff(item));
};

/**
 * Submit a new time off request
 */
export const submitTimeOffRequest = async (
    startDate: string,
    endDate: string,
    type: TimeOff['type'],
    reason?: string
): Promise<TimeOff> => {
    const response = await api.post('/staff/time-off', {
        startDate,
        endDate,
        type,
        reason,
    });

    if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Failed to submit time off request');
    }

    return normalizeTimeOff(response.data.data);
};

/**
 * Cancel a pending time off request
 */
export const cancelTimeOffRequest = async (id: string): Promise<boolean> => {
    const response = await api.delete(`/staff/time-off/${id}`);
    if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to cancel time off request');
    }

    return true;
};
