import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { getTimeMsSafe } from '../utils/safeDate';

type AppointmentLike = {
    id: string;
    startTime?: string;
    bookingNumber?: string;
    service?: {
        name_en?: string;
        name_ar?: string;
    } | null;
    user?: {
        firstName?: string;
        lastName?: string;
    } | null;
};

type AlertState = {
    title: string;
    body: string;
    appointmentId: string;
} | null;

const formatClock = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Riyadh',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
};

export function useAppointmentArrivalAlert() {
    const seenIdsRef = useRef<Set<string>>(new Set());
    const initializedRef = useRef(false);
    const lastPushAtRef = useRef(0);
    const [alert, setAlert] = useState<AlertState>(null);

    const clearAlert = useCallback(() => setAlert(null), []);

    const markPushReceived = useCallback(() => {
        lastPushAtRef.current = Date.now();
    }, []);

    useEffect(() => {
        if (!alert) return;
        const timer = setTimeout(() => setAlert(null), 6000);
        return () => clearTimeout(timer);
    }, [alert]);

    const syncAppointments = useCallback(async (appointments: AppointmentLike[], notifyOnNew = true) => {
        const normalized = Array.isArray(appointments) ? appointments : [];
        const currentIds = normalized.map((item) => `${item.id}`);

        if (!initializedRef.current) {
            initializedRef.current = true;
            seenIdsRef.current = new Set(currentIds);
            return [];
        }

        const newAppointments = normalized.filter((item) => !seenIdsRef.current.has(`${item.id}`));
        seenIdsRef.current = new Set(currentIds);

        if (newAppointments.length === 0 || !notifyOnNew) {
            return newAppointments;
        }

        const newest = [...newAppointments].sort((a, b) => getTimeMsSafe(b.startTime) - getTimeMsSafe(a.startTime))[0];

        const customerName = `${newest?.user?.firstName || ''} ${newest?.user?.lastName || ''}`.trim() || 'A customer';
        const serviceName = newest?.service?.name_en || newest?.service?.name_ar || 'service';
        const appointmentTime = formatClock(newest?.startTime);
        const body = appointmentTime
            ? `${customerName} booked ${serviceName} for ${appointmentTime}.`
            : `${customerName} booked ${serviceName}.`;

        setAlert({
            title: 'New appointment assigned',
            body,
            appointmentId: `${newest?.id || ''}`
        });

        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            Vibration.vibrate([0, 160, 80, 160]);
        }

        if (Platform.OS !== 'web' && AppState.currentState === 'active' && Date.now() - lastPushAtRef.current > 8000) {
            Notifications.scheduleNotificationAsync({
                content: {
                    title: 'New appointment assigned',
                    body,
                    sound: 'default',
                    data: {
                        type: 'staff_appointment_assigned',
                        appointmentId: newest?.id
                    }
                },
                trigger: null
            }).catch(() => undefined);
        }

        return newAppointments;
    }, []);

    return {
        alert,
        clearAlert,
        markPushReceived,
        syncAppointments
    };
}
