import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerFcmToken } from '../services/messages';
import { useAuth } from '../context/AuthContext';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true
    }),
});

export function usePushNotifications() {
    const { user } = useAuth();
    const [deviceToken, setDeviceToken] = useState<string>('');
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(
        undefined
    );

    const notificationListener = useRef<Notifications.Subscription>(undefined);
    const responseListener = useRef<Notifications.Subscription>(undefined);

    useEffect(() => {
        if (!user) return; // Only register if logged in

        registerForPushNotificationsAsync()
            .then(token => {
                if (token) {
                    setDeviceToken(token);
                    // Send the NATIVE FCM token to our backend
                    registerFcmToken(token).catch(err => console.error("Failed to register FCM token on server:", err));
                }
            })
            .catch((error: any) => console.log('Error registering for push notifications', error));

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Notification clicked', response);
            // We can handle navigation here based on response.notification.request.content.data
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [user]);

    return {
        deviceToken,
        notification,
    };
}

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8B5ADF',
            sound: 'default',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return undefined;
        }

        // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

        try {
            // Try native FCM token first (for production builds)
            const pushTokenData = await Notifications.getDevicePushTokenAsync();
            token = pushTokenData.data;
            console.log('[Push] Native FCM token obtained:', token?.substring(0, 20) + '...');
        } catch (e: any) {
            // This error is expected in Expo Go because it lacks the google-services.json context
            // We don't want to print the massive error, just a clean info log
            console.log('[Push] Native FCM token not available, falling back to Expo Token...');

            try {
                // Fallback to Expo push token (useful for Expo Go testing)
                // projectId MUST be passed explicitly in newer Expo SDKs
                if (projectId) {
                    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                    token = expoPushToken;
                    console.log('[Push] Fallback Expo Push Token obtained:', token?.substring(0, 20) + '...');
                } else {
                    console.log('[Push] Cannot fetch Expo token: EAS projectId missing in app.json');
                }
            } catch (e2) {
                console.log('[Push] Error fetching Expo push token as final fallback', e2);
            }
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

