import api from './api';

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
    try {
        const response = await api.get('/staff/me/messages');
        if (response.data.success) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

/**
 * Mark a message as read
 */
export const markMessageAsRead = async (id: string): Promise<boolean> => {
    try {
        const response = await api.patch(`/staff/me/messages/${id}/read`);
        return response.data.success;
    } catch (error) {
        console.error('Error marking message read:', error);
        throw error;
    }
};

/**
 * Register push notification FCM token
 */
export const registerFcmToken = async (fcmToken: string): Promise<boolean> => {
    try {
        const response = await api.post('/staff/me/fcm-token', { fcmToken });
        return response.data.success;
    } catch (error) {
        console.error('Error registering FCM token:', error);
        throw error;
    }
};
