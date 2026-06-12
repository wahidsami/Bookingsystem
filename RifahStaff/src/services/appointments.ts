import api from './api';
import { getRiyadhDateKey } from '../utils/riyadhDate';

export interface Appointment {
    id: string;
    bookingNumber?: string;
    bookingReference?: string | null;
    bookingSessionId?: string | null;
    bookingItemIndex?: number | null;
    startTime: string;
    endTime: string;
    status: 'pending' | 'confirmed' | 'started' | 'completed' | 'cancelled' | 'no_show';
    notes?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    price?: string | number | null;
    assignmentMode?: 'customer_selected' | 'auto_assigned' | string;
    serviceStartedAt?: string | null;
    serviceCompletedAt?: string | null;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        profileImage?: string;
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

const getTodayDateKey = () => getRiyadhDateKey();

const toText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
};

const normalizeAppointment = (appointment: any): Appointment => {
    const backendStatus = `${appointment?.status || ''}`;
    const normalizedStatus: Appointment['status'] =
        backendStatus === 'in_service'
            ? 'started'
            : backendStatus === 'no_show'
                ? 'no_show'
                : backendStatus === 'checked_in'
                    ? 'confirmed'
                    : ['pending', 'confirmed', 'completed', 'cancelled'].includes(backendStatus)
                        ? backendStatus as Appointment['status']
                        : 'pending';

    return {
        id: toText(appointment?.id),
        bookingNumber: toText(appointment?.bookingNumber || appointment?.id),
        bookingReference: appointment?.bookingReference || null,
        bookingSessionId: appointment?.bookingSessionId || null,
        bookingItemIndex: Number.isFinite(Number(appointment?.bookingItemIndex))
            ? Number(appointment.bookingItemIndex)
            : null,
        startTime: toText(appointment?.startTime),
        endTime: toText(appointment?.endTime),
        status: normalizedStatus,
        notes: appointment?.notes,
        paymentStatus: appointment?.paymentStatus,
        paymentMethod: appointment?.paymentMethod,
        price: appointment?.price,
        assignmentMode: appointment?.assignmentMode,
        serviceStartedAt: appointment?.serviceStartedAt || null,
        serviceCompletedAt: appointment?.serviceCompletedAt || null,
        user: appointment?.user,
        service: appointment?.service,
    };
};

/**
 * Fetch appointments for a specific day for the logged-in staff
 */
export const getAppointmentsForDate = async (date: string): Promise<Appointment[]> => {
    try {
        const response = await api.get(`/staff/appointments?date=${date}`);
        if (response.data.success) {
            return Array.isArray(response.data.appointments)
                ? response.data.appointments.map(normalizeAppointment)
                : [];
        }
        return [];
    } catch (error) {
        console.error('Error fetching today appointments:', error);
        throw error;
    }
};

/**
 * Fetch today's appointments for the logged-in staff
 */
export const getTodayAppointments = async (): Promise<Appointment[]> => {
    return getAppointmentsForDate(getTodayDateKey());
};

/**
 * Update the status of a specific appointment
 */
export const updateAppointmentStatus = async (
    appointmentId: string,
    status: 'started' | 'completed' | 'no-show'
): Promise<Appointment> => {
    try {
        const backendStatus =
            status === 'started'
                ? 'in_service'
                : status === 'no-show'
                    ? 'no_show'
                    : 'completed';

        const response = await api.patch(`/staff/appointments/${appointmentId}/status`, {
            status: backendStatus
        });

        if (response.data.success) {
            return normalizeAppointment(response.data.appointment);
        }
        throw new Error(response.data.message || 'Failed to update status');
    } catch (error) {
        console.error('Error updating appointment status:', error);
        throw error;
    }
};
