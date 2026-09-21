import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './routes';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const navigateToSearch = (query?: string): boolean => {
    if (!navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('Search', query ? { query } : undefined);
    return true;
};

export const navigateToTenant = (tenantId: string, slug?: string, tenant?: any): boolean => {
    if (!tenantId || !navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('Tenant', { tenantId, slug, tenant });
    return true;
};

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

export const navigateToPurchases = (orderId?: string): boolean => {
    if (!navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('MyPurchases', orderId ? { orderId } : undefined);
    return true;
};

export const navigateToWalletBalanceDetails = (): boolean => {
    if (!navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('Gifts');
    return true;
};

export const navigateToProfile = (): boolean => {
    if (!navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('Profile');
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

export const navigateToGiftClaim = (token: string): boolean => {
    if (!token || !navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('Gifts', { claimToken: token });
    return true;
};
