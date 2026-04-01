import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../api/client';

const PUSH_TOKEN_STORAGE_KEY = 'refah_customer_push_token';

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
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
    });
};

const ensurePermission = async (): Promise<boolean> => {
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
    }

    return finalStatus === 'granted';
};

const getStoredPushToken = async (): Promise<string | null> =>
    AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

const setStoredPushToken = async (token: string) =>
    AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

const clearStoredPushToken = async () =>
    AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);

const resolveExpoPushToken = async (): Promise<string | null> => {
    const hasPermission = await ensurePermission();
    if (!hasPermission) {
        return null;
    }

    await ensureChannel();

    const projectId = getProjectId();
    const response = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

    return response.data || null;
};

export const initializeNotificationHandling = () => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
        // Intentionally left blank. Foreground presentation is handled by the notification handler.
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
        // Future enhancement: route users into the matching booking or order screen.
    });

    return () => {
        receivedSubscription.remove();
        responseSubscription.remove();
    };
};

export const registerCustomerPushNotifications = async (): Promise<string | null> => {
    if (!(await api.isAuthenticated())) {
        return null;
    }

    const token = await resolveExpoPushToken();
    if (!token) {
        return null;
    }

    await api.registerPushToken({
        token,
        platform: Platform.OS,
        appVersion: getAppVersion(),
    });

    await setStoredPushToken(token);
    return token;
};

export const unregisterCustomerPushNotifications = async (): Promise<void> => {
    const storedToken = await getStoredPushToken();
    if (!storedToken) {
        return;
    }

    try {
        if (await api.isAuthenticated()) {
            await api.unregisterPushToken(storedToken);
        }
    } finally {
        await clearStoredPushToken();
    }
};
