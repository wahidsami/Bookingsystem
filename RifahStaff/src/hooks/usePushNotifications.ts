import { useState, useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { registerFcmToken } from '../services/messages';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';

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
                    registerFcmToken(token).catch(err => console.error("Failed to register Expo token on server:", err));
                }
            })
            .catch((error: any) => console.log('Error registering for push notifications', error));

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
                    // Ignore haptics failures on devices that do not support it.
                });

                Vibration.vibrate([0, 140, 80, 140]);
            }
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Notification clicked', response);
            const data = response?.notification?.request?.content?.data || {};
            const type = `${(data as any).type || ''}`.trim();
            const appointmentId = `${(data as any).appointmentId || ''}`.trim();

            // Route all appointment-related events to schedule tab for immediate visibility.
            if (
                type.startsWith('staff_appointment_')
                || type.startsWith('booking_')
                || appointmentId
            ) {
                router.push('/(tabs)/appointments');
                return;
            }

            // Route non-appointment events to the dedicated notifications tab.
            router.push('/(tabs)/notifications');
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

        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

        try {
            if (projectId) {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } else {
                token = (await Notifications.getExpoPushTokenAsync()).data;
            }
            console.log('[Push] Expo push token obtained:', token?.substring(0, 20) + '...');
        } catch (e: any) {
            console.log('[Push] Error fetching Expo push token', e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

