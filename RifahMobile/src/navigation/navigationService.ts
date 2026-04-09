import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export const navigateToNotificationDetail = (campaignId: string): boolean => {
    if (!campaignId || !navigationRef.isReady()) {
        return false;
    }

    navigationRef.navigate('NotificationDetail', { campaignId });
    return true;
};
