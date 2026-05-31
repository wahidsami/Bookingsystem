import api from './api';
import { Platform } from 'react-native';

export interface StaffMessage {
    id: string;
    senderType: string;
    senderId: string;
    recipientType: string | null;
    recipientId: string | null;
    subject: string;
    body: string;
    isPinned: boolean;
    readBy: string[];
    createdAt: string;
}

/**
 * Fetch all messages for the authenticated staff member
 */
export const getMessages = async (): Promise<StaffMessage[]> => {
    const response = await api.get('/staff/messages');
    if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to load messages');
    }

    return (response.data?.data || []).map((item: any) => ({
        id: `${item.id}`,
        senderType: `${item.senderType || ''}`,
        senderId: `${item.senderId || ''}`,
        recipientType: item.recipientType ?? null,
        recipientId: item.recipientId ?? null,
        subject: item.subject || '',
        body: item.body || '',
        isPinned: Boolean(item.isPinned),
        readBy: Array.isArray(item.readBy) ? item.readBy.map((value: any) => `${value}`) : [],
        createdAt: item.createdAt,
    }));
};

/**
 * Mark a message as read
 */
export const markMessageAsRead = async (id: string): Promise<boolean> => {
    const response = await api.post(`/staff/messages/${id}/read`);
    if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to mark message as read');
    }

    return true;
};

/**
 * Register push notification FCM token
 */
export const registerFcmToken = async (fcmToken: string): Promise<boolean> => {
    try {
        const response = await api.post('/staff/me/push-token', {
            token: fcmToken,
            platform: Platform.OS,
        });
        return response.data.success;
    } catch (error) {
        console.error('Error registering Expo push token:', error);
        throw error;
    }
};
