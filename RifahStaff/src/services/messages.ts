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
    return [];
};

/**
 * Mark a message as read
 */
export const markMessageAsRead = async (id: string): Promise<boolean> => {
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
