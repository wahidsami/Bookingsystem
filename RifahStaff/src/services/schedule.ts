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

/**
 * Fetch schedule for a given date range
 */
export const getSchedule = async (startDate: string, endDate: string): Promise<ScheduleData> => {
    try {
        const response = await api.get(`/staff/me/schedule?startDate=${startDate}&endDate=${endDate}`);
        if (response.data.success) {
            return response.data.data;
        }
        return { shifts: [], timeOff: [] };
    } catch (error) {
        console.error('Error fetching schedule:', error);
        throw error;
    }
};

/**
 * Get all time off requests for the logged in staff
 */
export const getTimeOffRequests = async (): Promise<TimeOff[]> => {
    try {
        const response = await api.get('/staff/me/time-off');
        if (response.data.success) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        console.error('Error fetching time off requests:', error);
        throw error;
    }
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
    try {
        const response = await api.post('/staff/me/time-off', {
            startDate,
            endDate,
            type,
            reason,
        });

        if (response.data.success) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to submit time off request');
    } catch (error) {
        console.error('Error submitting time off:', error);
        throw error;
    }
};

/**
 * Cancel a pending time off request
 */
export const cancelTimeOffRequest = async (id: string): Promise<boolean> => {
    try {
        const response = await api.delete(`/staff/me/time-off/${id}`);
        return response.data.success;
    } catch (error) {
        console.error('Error cancelling time off request:', error);
        throw error;
    }
};
