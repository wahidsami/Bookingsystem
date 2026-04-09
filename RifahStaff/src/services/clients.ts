import api from './api';

export interface StaffClientSummary {
    customer: {
        id: string;
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        profileImage?: string;
    };
    summary: {
        totalVisits: number;
        completedVisits: number;
        totalSpent: number;
        lastVisit?: string | null;
        firstVisit?: string | null;
        loyaltyTier: string;
        loyaltyPoints: number;
        averageBookingValue: number;
        noShowCount: number;
        cancellationCount: number;
        notes: string;
        tags: string[];
        isRepeatClient: boolean;
    };
    recentAppointments: Array<{
        id: string;
        startTime: string;
        status: string;
        price?: string | number | null;
        notes?: string | null;
        service?: {
            id: string;
            name_en?: string;
            name_ar?: string;
        } | null;
        staff?: {
            id: string;
            name: string;
        } | null;
    }>;
}

export const getClientSummary = async (clientId: string): Promise<StaffClientSummary> => {
    const response = await api.get(`/staff/clients/${clientId}`);
    if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Failed to load client summary');
    }

    return response.data.data;
};
