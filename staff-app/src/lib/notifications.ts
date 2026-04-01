import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerStaffPushToken, StaffSession, unregisterStaffPushToken } from './api';

const PUSH_TOKEN_STORAGE_KEY = 'rifah_staff_push_token';

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
    lightColor: '#4c1d95',
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

const getStoredToken = async (): Promise<string | null> =>
  AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

const setStoredToken = async (token: string) =>
  AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

const clearStoredToken = async () =>
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

export const initializeStaffNotificationHandling = () => {
  const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
    // Foreground display is handled by Notifications.setNotificationHandler.
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
    // Future enhancement: deep-link directly into a specific appointment.
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};

export const registerStaffPushNotifications = async (session: StaffSession): Promise<string | null> => {
  const token = await resolveExpoPushToken();
  if (!token) {
    return null;
  }

  await registerStaffPushToken(session, {
    token,
    platform: Platform.OS,
    appVersion: getAppVersion(),
  });

  await setStoredToken(token);
  return token;
};

export const unregisterStaffPushNotifications = async (session: StaffSession | null): Promise<void> => {
  const storedToken = await getStoredToken();
  if (!storedToken) {
    return;
  }

  try {
    if (session) {
      await unregisterStaffPushToken(session, storedToken);
    }
  } finally {
    await clearStoredToken();
  }
};
