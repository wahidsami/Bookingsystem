import api from './api';

export interface Appointment {
    id: string;
    startTime: string;
    endTime: string;
    // DB/API response status (server uses underscore for no_show)
    status: 'pending' | 'confirmed' | 'started' | 'completed' | 'cancelled' | 'no_show';

    customerNotes?: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    };
    service?: {
        id: string;
        name_en: string;
        name_ar: string;
        duration: number;
        finalPrice: string;
        basePrice?: string;
    };
}

/**
 * Fetch today's appointments for the logged-in staff
 */
export const getTodayAppointments = async (): Promise<Appointment[]> => {
    try {
        const response = await api.get('/staff/me/appointments/today');
        if (response.data.success) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        console.error('Error fetching today appointments:', error);
        throw error;
    }
};

/**
 * Update the status of a specific appointment
 */
export const updateAppointmentStatus = async (
    appointmentId: string,
    status: 'started' | 'completed' | 'no-show'
): Promise<Appointment> => {
    try {
        const response = await api.patch(`/staff/me/appointments/${appointmentId}/status`, {
            status
        });

        if (response.data.success) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to update status');
    } catch (error) {
        console.error('Error updating appointment status:', error);
        throw error;
    }
};
