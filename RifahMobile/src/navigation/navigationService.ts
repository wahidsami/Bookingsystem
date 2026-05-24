import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export const navigateToNotifications = (): boolean => {
    if (!navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('Notifications');
    return true;
};

export const navigateToNotificationDetail = (campaignId: string): boolean => {
    if (!campaignId || !navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('NotificationDetail', { campaignId });
    return true;
};

export const navigateToAppointmentInvite = (token: string): boolean => {
    if (!token || !navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('AppointmentInvite', { token });
    return true;
};

export const navigateToReview = (appointmentId: string): boolean => {
    if (!appointmentId || !navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('Review', { appointmentId });
    return true;
};
