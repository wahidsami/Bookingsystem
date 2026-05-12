import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { navigateToAppointmentInvite, navigateToNotifications } from '../navigation/navigationService';

const PUSH_TOKEN_STORAGE_KEY = 'refah_customer_push_token';
const PUSH_DEBUG_STORAGE_KEY = 'refah_customer_push_debug';
const PENDING_NOTIFICATION_CAMPAIGN_KEY = 'refah_pending_notification_campaign';
const PENDING_NOTIFICATION_INVITE_TOKEN_KEY = 'refah_pending_notification_invite_token';

export type CustomerPushDebugState = {
    status:
        | 'idle'
        | 'started'
        | 'permission_denied'
        | 'token_received'
        | 'registered'
        | 'register_failed'
        | 'unregistered'
        | 'auth_missing';
    message: string;
    lastAttemptAt: string;
    permissionStatus?: string;
    tokenPreview?: string;
    projectId?: string;
    error?: string;
};

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const getProjectId = (): string | undefined =>
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

const getAppVersion = (): string | undefined =>
    Constants.expoConfig?.version || undefined;

const ensureChannel = async () => {
    if (Platform.OS !== 'android') {
        return;
    }

    await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
        sound: 'default',
    });
};

const getStoredPushToken = async (): Promise<string | null> =>
    AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

const setStoredPushToken = async (token: string) =>
    AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

const clearStoredPushToken = async () =>
    AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);

const setPendingNotificationCampaignId = async (campaignId: string) =>
    AsyncStorage.setItem(PENDING_NOTIFICATION_CAMPAIGN_KEY, campaignId);
const setPendingNotificationInviteToken = async (inviteToken: string) =>
    AsyncStorage.setItem(PENDING_NOTIFICATION_INVITE_TOKEN_KEY, inviteToken);

export const consumePendingNotificationCampaignId = async (): Promise<string | null> => {
    const campaignId = await AsyncStorage.getItem(PENDING_NOTIFICATION_CAMPAIGN_KEY);
    if (campaignId) {
        await AsyncStorage.removeItem(PENDING_NOTIFICATION_CAMPAIGN_KEY);
    }
    return campaignId;
};

export const consumePendingNotificationInviteToken = async (): Promise<string | null> => {
    const inviteToken = await AsyncStorage.getItem(PENDING_NOTIFICATION_INVITE_TOKEN_KEY);
    if (inviteToken) {
        await AsyncStorage.removeItem(PENDING_NOTIFICATION_INVITE_TOKEN_KEY);
    }
    return inviteToken;
};

const setPushDebugState = async (state: CustomerPushDebugState) =>
    AsyncStorage.setItem(PUSH_DEBUG_STORAGE_KEY, JSON.stringify(state));

export const getCustomerPushDebugState = async (): Promise<CustomerPushDebugState | null> => {
    try {
        const value = await AsyncStorage.getItem(PUSH_DEBUG_STORAGE_KEY);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.warn('Failed to read push debug state:', error);
        return null;
    }
};

const getTokenPreview = (token: string | null | undefined) => {
    if (!token) {
        return undefined;
    }

    const normalized = `${token}`.trim();
    if (normalized.length <= 18) {
        return normalized;
    }

    return `${normalized.slice(0, 10)}...${normalized.slice(-6)}`;
};

const resolveExpoPushToken = async (): Promise<{ token: string | null; permissionStatus: string }> => {
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
        return {
            token: null,
            permissionStatus: finalStatus,
        };
    }

    await ensureChannel();

    const projectId = getProjectId();
    const response = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

    return {
        token: response.data || null,
        permissionStatus: finalStatus,
    };
};

export const initializeNotificationHandling = () => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
        // Intentionally left blank. Foreground presentation is handled by the notification handler.
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
        const payload = response?.notification?.request?.content?.data || {};
        const inviteToken = `${(payload as any).inviteToken || ''}`.trim();
        const campaignId = `${(payload as any).campaignId || ''}`.trim();
        const type = `${(payload as any).type || ''}`.trim();

        if (inviteToken || type === 'booking_confirmation_required') {
            const navigated = inviteToken ? navigateToAppointmentInvite(inviteToken) : false;
            if (!navigated && inviteToken) {
                await setPendingNotificationInviteToken(inviteToken);
            }
            return;
        }

        const navigated = navigateToNotifications();
        if (!navigated && campaignId) {
            await setPendingNotificationCampaignId(campaignId);
        }
    });

    return () => {
        receivedSubscription.remove();
        responseSubscription.remove();
    };
};

export const registerCustomerPushNotifications = async (): Promise<string | null> => {
    if (!(await api.isAuthenticated())) {
        await setPushDebugState({
            status: 'auth_missing',
            message: 'Customer is not authenticated yet.',
            lastAttemptAt: new Date().toISOString(),
        });
        return null;
    }

    const projectId = getProjectId();
    await setPushDebugState({
        status: 'started',
        message: 'Starting push registration.',
        lastAttemptAt: new Date().toISOString(),
        projectId,
    });

    const { token, permissionStatus } = await resolveExpoPushToken();
    if (!token) {
        await setPushDebugState({
            status: 'permission_denied',
            message: 'Notification permission was not granted.',
            lastAttemptAt: new Date().toISOString(),
            permissionStatus,
            projectId,
        });
        return null;
    }

    await setPushDebugState({
        status: 'token_received',
        message: 'Expo push token generated on device.',
        lastAttemptAt: new Date().toISOString(),
        permissionStatus,
        projectId,
        tokenPreview: getTokenPreview(token),
    });

    try {
        await api.registerPushToken({
            token,
            platform: Platform.OS,
            appVersion: getAppVersion(),
        });
    } catch (error: any) {
        await setPushDebugState({
            status: 'register_failed',
            message: 'Backend failed to save the Expo push token.',
            lastAttemptAt: new Date().toISOString(),
            permissionStatus,
            projectId,
            tokenPreview: getTokenPreview(token),
            error: error?.message || 'Unknown push registration error',
        });
        throw error;
    }

    await setStoredPushToken(token);
    await setPushDebugState({
        status: 'registered',
        message: 'Push token registered successfully.',
        lastAttemptAt: new Date().toISOString(),
        permissionStatus,
        projectId,
        tokenPreview: getTokenPreview(token),
    });
    return token;
};

export const unregisterCustomerPushNotifications = async (): Promise<void> => {
    const storedToken = await getStoredPushToken();
    if (!storedToken) {
        await setPushDebugState({
            status: 'unregistered',
            message: 'No stored push token was found on this device.',
            lastAttemptAt: new Date().toISOString(),
        });
        return;
    }

    try {
        if (await api.isAuthenticated()) {
            await api.unregisterPushToken(storedToken);
        }
    } finally {
        await clearStoredPushToken();
        await setPushDebugState({
            status: 'unregistered',
            message: 'Push token removed from this device.',
            lastAttemptAt: new Date().toISOString(),
            tokenPreview: getTokenPreview(storedToken),
            projectId: getProjectId(),
        });
    }
};
