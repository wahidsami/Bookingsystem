import api from './api';

export interface Shift {
    id: string; // Synthetic ID for React keys
    shiftId: string; // Real DB ID
    date: string;
    startTime: string;
    endTime: string;
    label?: string;
    type: 'shift' | 'specific';
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
    timeOff: TimeOff[];
}

const buildDateRange = (startDate: string, endDate: string) => {
    const dates: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const limit = new Date(`${endDate}T00:00:00`);

    while (cursor <= limit) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
};

const normalizeShift = (shift: any, date: string): Shift => ({
    id: `${date}-${shift.id}`,
    shiftId: shift.id,
    date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    label: shift.label || undefined,
    type: shift.specificDate ? 'specific' : 'shift',
});

const normalizeTimeOff = (item: any): TimeOff => ({
    id: item.id,
    startDate: item.startDate,
    endDate: item.endDate,
    type: item.type || 'other',
    reason: item.reason,
    isApproved: Boolean(item.isApproved),
    createdAt: item.createdAt,
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
        const timeOffMap = new Map<string, TimeOff>();

        responses.forEach((response, index) => {
            if (!response.data?.success || !response.data?.schedule) {
                return;
            }

            const date = dates[index];
            const schedule = response.data.schedule;
            (schedule.shifts || []).forEach((shift: any) => {
                shifts.push(normalizeShift(shift, date));
            });

            (schedule.timeOff || []).forEach((item: any) => {
                const normalized = normalizeTimeOff(item);
                timeOffMap.set(normalized.id, normalized);
            });
        });

        return {
            shifts,
            timeOff: Array.from(timeOffMap.values()),
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
