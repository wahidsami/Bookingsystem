import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Platform,
    Alert,
    Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { differenceInCalendarDays } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { canRequestTimeOff, canViewBookingNotes, canViewClients } from '../../src/utils/capabilities';
import { Appointment, getAppointmentsForDate, updateAppointmentStatus } from '../../src/services/appointments';
import { BreakWindow, cancelTimeOffRequest, getSchedule, Shift, TimeOff } from '../../src/services/schedule';
import { getImageUrl } from '../../src/services/api';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { useAppointmentArrivalAlert } from '../../src/hooks/useAppointmentArrivalAlert';
import { AppState } from 'react-native';
import {
    addRiyadhDays,
    formatRiyadhLongDate,
    formatRiyadhMonthDay,
    formatRiyadhWeekdayShort,
    getRiyadhDateKey,
    getRiyadhWeekStartKey,
    parseRiyadhDateKey,
    parseRiyadhDateTime,
} from '../../src/utils/riyadhDate';

const minutesBetween = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    return ((endHour * 60) + endMinute) - ((startHour * 60) + startMinute);
};

const formatClock = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
};

const formatDurationHours = (minutes: number) => `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;

export default function ScheduleScreen() {
    const { user } = useAuth();
    const { notification } = usePushNotifications();
    const { alert: appointmentAlert, clearAlert, markPushReceived, syncAppointments } = useAppointmentArrivalAlert();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [breaks, setBreaks] = useState<BreakWindow[]>([]);
    const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedDateKey, setSelectedDateKey] = useState(getRiyadhDateKey());
    const [weekOffset, setWeekOffset] = useState(0);
    const [appointmentsLoading, setAppointmentsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [scheduleViewMode, setScheduleViewMode] = useState<'overview' | 'grid'>('overview');
    const timeOffEnabled = canRequestTimeOff(user);
    const canSeeBookingNotes = canViewBookingNotes(user);
    const canViewClientContext = canViewClients(user);
    const scheduleVisibilityWeeks = Math.min(Math.max(Number(user?.scheduleVisibilityWeeks || 1), 1), 4);

    const baseWeekStartKey = useMemo(() => getRiyadhWeekStartKey(), []);
    const weekStartKey = useMemo(() => addRiyadhDays(baseWeekStartKey, weekOffset * 7), [baseWeekStartKey, weekOffset]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addRiyadhDays(weekStartKey, i)), [weekStartKey]);
    const canGoPrev = weekOffset > 0;
    const canGoNext = weekOffset < scheduleVisibilityWeeks - 1;

    const loadData = useCallback(async () => {
        try {
            const start = weekStartKey;
            const end = addRiyadhDays(weekStartKey, 6);
            const data = await getSchedule(start, end);
            setShifts(data.shifts);
            setBreaks(data.breaks);
            setTimeOff(data.timeOff);
        } catch (error) {
            console.error('Failed to load schedule data', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [weekStartKey]);

    const loadAppointmentsForSelectedDate = useCallback(async (shouldNotify = false) => {
        try {
            setAppointmentsLoading(true);
            const data = await getAppointmentsForDate(selectedDateKey);
            await syncAppointments(data, shouldNotify);
            setAppointments(data);
        } catch (error) {
            console.error('Failed to load appointments for selected day', error);
            setAppointments([]);
        } finally {
            setAppointmentsLoading(false);
        }
    }, [selectedDateKey, syncAppointments]);

    const handleAppointmentStatusUpdate = async (id: string, newStatus: 'started' | 'completed' | 'no-show') => {
        if (updatingId) {
            return;
        }

        try {
            setUpdatingId(id);
            await updateAppointmentStatus(id, newStatus);
            loadAppointmentsForSelectedDate(false);
        } catch (error) {
            console.error('Failed to update appointment status', error);
        } finally {
            setUpdatingId(null);
        }
    };

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        loadData();
    }, [loadData, user]);

    useEffect(() => {
        if (!user) {
            setAppointmentsLoading(false);
            return;
        }

        loadAppointmentsForSelectedDate(false);
    }, [loadAppointmentsForSelectedDate, user]);

    useFocusEffect(
        useCallback(() => {
            if (user) {
                loadData();
                loadAppointmentsForSelectedDate(true);
            }
        }, [user, loadData, loadAppointmentsForSelectedDate])
    );

    useEffect(() => {
        if (!user) return;
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                loadData();
                loadAppointmentsForSelectedDate(true);
            }
        });

        return () => subscription.remove();
    }, [user, loadData, loadAppointmentsForSelectedDate]);

    useEffect(() => {
        if (user && notification) {
            markPushReceived();
            loadData();
            loadAppointmentsForSelectedDate(false);
        }
    }, [notification, user, loadData, loadAppointmentsForSelectedDate, markPushReceived]);

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            loadAppointmentsForSelectedDate(true);
        }, 45000);

        return () => clearInterval(interval);
    }, [user, loadAppointmentsForSelectedDate]);

    useEffect(() => {
        setSelectedDateKey(weekOffset === 0 ? getRiyadhDateKey() : weekStartKey);
    }, [weekOffset, weekStartKey]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCancelTimeOff = (id: string) => {
        Alert.alert(
            'Cancel Request',
            'Do you want to cancel this upcoming time off request?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelTimeOffRequest(id);
                            loadData();
                        } catch (error: any) {
                            Alert.alert(
                                'Error',
                                error?.response?.data?.message || error?.message || 'Could not cancel this time off request.'
                            );
                        }
                    }
                }
            ]
        );
    };

    const shiftsForSelectedDate = shifts.filter((shift) => shift.date === selectedDateKey);
    const breaksForSelectedDate = breaks.filter((item) => item.date === selectedDateKey);
    const timeOffForSelectedDate = timeOff.filter((item) => item.startDate <= selectedDateKey && item.endDate >= selectedDateKey);
    const selectedDayAppointments = appointments;

    const weekShiftMinutes = shifts.reduce((sum, shift) => sum + Math.max(minutesBetween(shift.startTime, shift.endTime), 0), 0);
    const workingDays = new Set(shifts.map((shift) => shift.date)).size;
    const timeOffDays = weekDays.filter((dayKey) => timeOff.some((item) => item.startDate <= dayKey && item.endDate >= dayKey)).length;

    const nextShift = useMemo(() => {
        const now = Date.now();
        return shifts
            .map((shift) => ({
                ...shift,
                startsAt: parseRiyadhDateTime(shift.date, shift.startTime).getTime()
            }))
            .filter((shift) => shift.startsAt >= now)
            .sort((a, b) => a.startsAt - b.startsAt)[0] || null;
    }, [shifts]);

    const selectedDayShiftMinutes = shiftsForSelectedDate.reduce((sum, shift) => sum + Math.max(minutesBetween(shift.startTime, shift.endTime), 0), 0);
    const selectedDayBreakMinutes = breaksForSelectedDate.reduce((sum, item) => sum + Math.max(minutesBetween(item.startTime, item.endTime), 0), 0);
    const appointmentsForSelectedDate = appointments;

    const upcomingTimeOff = timeOff
        .filter((item) => item.startDate > getRiyadhDateKey())
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const activeTimeOff = timeOff
        .filter((item) => item.startDate <= getRiyadhDateKey() && item.endDate >= getRiyadhDateKey())
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const pastTimeOff = timeOff
        .filter((item) => item.endDate < getRiyadhDateKey())
        .sort((a, b) => b.endDate.localeCompare(a.endDate));

    const getDayState = (key: string) => {
        if (timeOff.some((item) => item.startDate <= key && item.endDate >= key)) {
            return 'timeoff';
        }
        if (shifts.some((shift) => shift.date === key)) {
            return 'working';
        }
        return 'off';
    };

    const formatTime = (value: string) =>
        new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Riyadh',
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date(value));

    const getUrgencyInfo = (item: Appointment): { label: string; color: string; background: string; priority: number } => {
        if (item.status === 'started') {
            return { label: 'In Service', color: '#92400e', background: '#fef3c7', priority: 0 };
        }

        if (['completed', 'no_show', 'cancelled'].includes(item.status)) {
            return { label: 'Closed', color: '#4b5563', background: '#f3f4f6', priority: 4 };
        }

        const minutesToStart = Math.round((new Date(item.startTime).getTime() - Date.now()) / 60000);
        if (minutesToStart < -10) {
            return { label: 'Late', color: '#b91c1c', background: '#fee2e2', priority: 1 };
        }
        if (minutesToStart <= 30) {
            return { label: 'Starting Soon', color: '#9a3412', background: '#ffedd5', priority: 2 };
        }

        return { label: 'Upcoming', color: '#1d4ed8', background: '#dbeafe', priority: 3 };
    };

    const getMinutesFromClock = (timeString: string) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return (hours * 60) + minutes;
    };

    const getRiyadhMinutes = (value: string) => {
        const formatted = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Riyadh',
            hourCycle: 'h23',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value));
        return getMinutesFromClock(formatted);
    };

    const renderGridView = () => {
        const gridStartMinute = 6 * 60;
        const gridEndMinute = 22 * 60;
        const slotMinutes = 30;
        const rowHeight = 36;
        const totalRows = Math.max(1, Math.ceil((gridEndMinute - gridStartMinute) / slotMinutes));
        const gridHeight = totalRows * rowHeight + 24;

        return (
            <View style={styles.gridCard}>
                <View style={styles.gridHeaderRow}>
                    <Text style={styles.sectionTitle}>Day Grid</Text>
                    <Text style={styles.gridHint}>
                        {selectedDayAppointments.length} appointment{selectedDayAppointments.length === 1 ? '' : 's'}
                    </Text>
                </View>

                {selectedDayAppointments.length === 0 ? (
                    <View style={styles.infoCard}>
                        <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                        <Text style={styles.infoCardText}>No appointments for this day.</Text>
                    </View>
                ) : (
                    <View style={[styles.gridTimeline, { height: gridHeight }]}>
                        <View style={styles.gridTimeColumn}>
                            {Array.from({ length: totalRows }, (_, index) => {
                                const minuteMark = gridStartMinute + (index * slotMinutes);
                                const hours = Math.floor(minuteMark / 60);
                                const minutes = minuteMark % 60;
                                const labelHour = hours % 12 || 12;
                                const ampm = hours >= 12 ? 'PM' : 'AM';

                                return (
                                    <View key={`time-${minuteMark}`} style={[styles.gridTimeSlot, { height: rowHeight }]}>
                                        <Text style={styles.gridTimeLabel}>
                                            {minutes === 0 ? `${labelHour} ${ampm}` : `${labelHour}:${minutes.toString().padStart(2, '0')}`}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        <View style={[styles.gridCanvas, { height: gridHeight }]}>
                            {Array.from({ length: totalRows + 1 }, (_, index) => (
                                <View
                                    key={`line-${index}`}
                                    style={[
                                        styles.gridLine,
                                        {
                                            top: index * rowHeight
                                        }
                                    ]}
                                />
                            ))}

                            {selectedDayAppointments.map((appointment) => {
                                const startMinute = getRiyadhMinutes(appointment.startTime);
                                const endMinute = getRiyadhMinutes(appointment.endTime);
                                const topOffset = Math.max(0, ((startMinute - gridStartMinute) / slotMinutes) * rowHeight);
                                const height = Math.max(72, Math.max(1, ((endMinute - startMinute) / slotMinutes) * rowHeight));
                                const urgency = getUrgencyInfo(appointment);
                                const isStarted = appointment.status === 'started';
                                const isCompleted = appointment.status === 'completed' || appointment.status === 'no_show' || appointment.status === 'cancelled';
                                const customerInitial = appointment.user?.firstName?.charAt(0)?.toUpperCase() || appointment.user?.lastName?.charAt(0)?.toUpperCase() || 'C';

                                return (
                                    <View
                                        key={`grid-${appointment.id}`}
                                        style={[
                                            styles.gridAppointmentCard,
                                            { top: topOffset, height },
                                            isCompleted && styles.gridAppointmentCardCompleted
                                        ]}
                                    >
                                        <View style={styles.gridAppointmentHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.gridAppointmentTitle} numberOfLines={1}>
                                                    {appointment.service?.name_en || 'Service'}
                                                </Text>
                                                <Text style={styles.gridAppointmentTime}>
                                                    {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                                                </Text>
                                            </View>
                                            <View style={[styles.gridUrgencyBadge, { backgroundColor: urgency.background }]}>
                                                <Text style={[styles.gridUrgencyText, { color: urgency.color }]}>{urgency.label}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.gridAppointmentCustomer}>
                                            <View style={styles.gridAppointmentAvatar}>
                                                {appointment.user?.profileImage ? (
                                                    <Image source={{ uri: getImageUrl(appointment.user.profileImage) }} style={styles.gridAppointmentAvatarImage} />
                                                ) : (
                                                    <Text style={styles.gridAppointmentAvatarInitial}>{customerInitial}</Text>
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.gridAppointmentCustomerName} numberOfLines={1}>
                                                    {appointment.user?.firstName} {appointment.user?.lastName}
                                                </Text>
                                                <Text style={styles.gridAppointmentMeta} numberOfLines={1}>
                                                    {appointment.status.toUpperCase().replace('_', ' ')}{appointment.paymentStatus ? ` • ${appointment.paymentStatus.replace(/_/g, ' ')}` : ''}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.gridAppointmentFooter}>
                                            <Text style={styles.gridAppointmentPrice}>
                                                SAR {Number(appointment.service?.finalPrice || appointment.service?.basePrice || appointment.price || 0).toFixed(2)}
                                            </Text>
                                            <Text style={[styles.gridAppointmentAction, isStarted && { color: '#047857' }]} numberOfLines={1}>
                                                {isStarted ? 'In Service' : 'Upcoming'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderSelectedDayContent = () => {
        if (loading) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#8B5ADF" />
                </View>
            );
        }

        const hasScheduleEntries = shiftsForSelectedDate.length > 0 || breaksForSelectedDate.length > 0 || timeOffForSelectedDate.length > 0;

        if (scheduleViewMode === 'grid') {
            return renderGridView();
        }

        return (
            <>
                {!hasScheduleEntries ? (
                    <View style={styles.centerContainerCompact}>
                        <Ionicons name="calendar-clear-outline" size={52} color="#d1d5db" />
                        <Text style={styles.emptyTitle}>No schedule for this day</Text>
                        <Text style={styles.emptySubtitle}>This day is currently clear with no shifts or approved time off.</Text>
                    </View>
                ) : null}

                {shiftsForSelectedDate.map((shift) => (
                    <View key={shift.id} style={styles.shiftCard}>
                        <View style={styles.shiftTopRow}>
                            <View>
                                <Text style={styles.shiftTime}>
                                    {formatClock(shift.startTime)} - {formatClock(shift.endTime)}
                                </Text>
                                <Text style={styles.shiftLabel}>
                                    {shift.label || 'Regular Working Hours'}
                                </Text>
                            </View>
                            <View style={styles.shiftBadges}>
                                <View style={[styles.badge, shift.type === 'specific' ? styles.badgeSpecific : styles.badgeRecurring]}>
                                    <Text style={[styles.badgeText, shift.type === 'specific' ? styles.badgeSpecificText : styles.badgeRecurringText]}>
                                        {shift.type === 'specific' ? 'Override' : 'Recurring'}
                                    </Text>
                                </View>
                                <View style={styles.hoursBadge}>
                                    <Text style={styles.hoursBadgeText}>{formatDurationHours(minutesBetween(shift.startTime, shift.endTime))}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                {breaksForSelectedDate.length > 0 ? (
                    <View style={styles.breaksCard}>
                        <Text style={styles.sectionTitle}>Breaks</Text>
                        {breaksForSelectedDate.map((item) => (
                            <View key={item.id} style={styles.breakRow}>
                                <View style={styles.breakDot} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.breakLabel}>{item.label || 'Break'}</Text>
                                    <Text style={styles.breakTime}>
                                        {formatClock(item.startTime)} - {formatClock(item.endTime)} ({formatDurationHours(minutesBetween(item.startTime, item.endTime))})
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : null}

                {timeOffForSelectedDate.length > 0 ? (
                    <View style={styles.timeOffSection}>
                        <Text style={styles.sectionTitle}>Time Off</Text>
                        {timeOffForSelectedDate.map((item) => (
                            <View key={item.id} style={styles.timeOffCard}>
                                <View style={styles.timeOffHeader}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.timeOffStatusText, { color: item.isApproved ? '#10b981' : '#f59e0b' }]}>
                                        {item.isApproved ? 'APPROVED' : 'PENDING'}
                                    </Text>
                                </View>
                                <Text style={styles.shiftLabel}>{item.startDate} to {item.endDate}</Text>
                                {item.reason ? <Text style={styles.notesText}>{item.reason}</Text> : null}
                            </View>
                        ))}
                    </View>
                ) : null}

                <View style={styles.appointmentsSection}>
                    <Text style={styles.sectionTitle}>Appointments</Text>
                    {appointmentsLoading ? (
                        <View style={styles.infoCard}>
                            <ActivityIndicator size="small" color="#8B5ADF" />
                            <Text style={styles.infoCardText}>Loading appointments for this day...</Text>
                        </View>
                    ) : appointmentsForSelectedDate.length === 0 ? (
                        <View style={styles.infoCard}>
                            <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                            <Text style={styles.infoCardText}>No appointments for this day.</Text>
                        </View>
                    ) : (
                        appointmentsForSelectedDate.map((appointment) => {
                            const customerInitial = appointment.user?.firstName?.charAt(0)?.toUpperCase() || appointment.user?.lastName?.charAt(0)?.toUpperCase() || 'C';
                            const amount = Number(appointment.service?.finalPrice || appointment.service?.basePrice || appointment.price || 0);
                            const urgency = getUrgencyInfo(appointment);
                            const isStarted = appointment.status === 'started';
                            const isCompleted = appointment.status === 'completed' || appointment.status === 'no_show' || appointment.status === 'cancelled';

                            return (
                                <View key={appointment.id} style={[styles.appointmentCard, isCompleted && styles.appointmentCardCompleted]}>
                                    <View style={styles.appointmentCardHeader}>
                                        <View>
                                            <Text style={styles.appointmentTime}>
                                                {formatTime(appointment.startTime)} to {formatTime(appointment.endTime)}
                                            </Text>
                                            <Text style={styles.appointmentDuration}>
                                                {appointment.service?.duration || 0} min
                                            </Text>
                                        </View>
                                        <View style={styles.appointmentCardBadges}>
                                            <View style={[styles.urgencyBadge, { backgroundColor: urgency.background }]}>
                                                <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
                                            </View>
                                            <View style={styles.statusBadge}>
                                                <Text style={[styles.appointmentStatusText, appointment.status === 'started' && { color: '#fbbf24' }, appointment.status === 'completed' && { color: '#10b981' }, appointment.status === 'cancelled' && { color: '#ef4444' }]}>
                                                    {appointment.status.toUpperCase().replace('_', ' ')}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.appointmentCardBody}>
                                        <View style={styles.appointmentCustomerRow}>
                                            <View style={styles.appointmentAvatar}>
                                                {appointment.user?.profileImage ? (
                                                    <Image source={{ uri: getImageUrl(appointment.user.profileImage) }} style={styles.appointmentAvatarImage} />
                                                ) : (
                                                    <Text style={styles.appointmentAvatarInitial}>{customerInitial}</Text>
                                                )}
                                            </View>
                                            <View style={styles.appointmentCustomerMeta}>
                                                <Text style={styles.appointmentCustomerName}>
                                                    {appointment.user?.firstName} {appointment.user?.lastName}
                                                </Text>
                                                <Text style={styles.appointmentBookingMeta}>
                                                    Booking #{appointment.bookingNumber?.slice(0, 8) || appointment.id.slice(0, 8)}
                                                </Text>
                                            </View>
                                            <View style={styles.appointmentAmountBox}>
                                                <Text style={styles.appointmentAmountText}>SAR {amount.toFixed(2)}</Text>
                                            </View>
                                        </View>

                                        <Text style={styles.appointmentServiceName}>{appointment.service?.name_en || 'Service'}</Text>

                                        <View style={styles.appointmentMetaRow}>
                                            <View style={styles.appointmentMetaBadge}>
                                                <Ionicons name="card-outline" size={13} color="#6b7280" />
                                                <Text style={styles.appointmentMetaBadgeText}>{appointment.paymentStatus ? appointment.paymentStatus.replace(/_/g, ' ') : 'payment unknown'}</Text>
                                            </View>
                                            {appointment.paymentMethod ? (
                                                <View style={styles.appointmentMetaBadge}>
                                                    <Ionicons name="wallet-outline" size={13} color="#6b7280" />
                                                    <Text style={styles.appointmentMetaBadgeText}>{appointment.paymentMethod.replace(/_/g, ' ')}</Text>
                                                </View>
                                            ) : null}
                                            <View style={styles.appointmentMetaBadge}>
                                                <Ionicons name={appointment.assignmentMode === 'customer_selected' ? 'person-circle-outline' : 'sparkles-outline'} size={13} color="#6b7280" />
                                                <Text style={styles.appointmentMetaBadgeText}>
                                                    {appointment.assignmentMode === 'customer_selected' ? 'Customer picked staff' : 'Auto-assigned'}
                                                </Text>
                                            </View>
                                        </View>

                                        {canSeeBookingNotes && appointment.notes ? (
                                            <View style={styles.appointmentNotesContainer}>
                                                <Ionicons name="document-text-outline" size={14} color="#6b7280" />
                                                <Text style={styles.appointmentNotesText} numberOfLines={2}>{appointment.notes}</Text>
                                            </View>
                                        ) : null}

                                        {canViewClientContext && appointment.user?.id ? (
                                            <TouchableOpacity
                                                style={styles.appointmentClientButton}
                                                onPress={() => router.push((`/client/${appointment.user?.id}` as any))}
                                            >
                                                <Ionicons name="person-circle-outline" size={16} color="#6d28d9" style={styles.appointmentClientButtonIcon} />
                                                <Text style={styles.appointmentClientButtonText}>View Client</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    {!isCompleted && appointment.status !== 'cancelled' ? (
                                        <View style={styles.appointmentActions}>
                                            {!isStarted ? (
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, styles.startBtn, updatingId === appointment.id && { opacity: 0.6 }]}
                                                    onPress={() => handleAppointmentStatusUpdate(appointment.id, 'started')}
                                                    disabled={!!updatingId}
                                                >
                                                    {updatingId === appointment.id
                                                        ? <ActivityIndicator size="small" color="#ffffff" style={styles.btnIcon} />
                                                        : <Ionicons name="play" size={16} color="#ffffff" style={styles.btnIcon} />}
                                                    <Text style={styles.btnTextWhite}>Start</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, styles.completeBtn, updatingId === appointment.id && { opacity: 0.6 }]}
                                                    onPress={() => handleAppointmentStatusUpdate(appointment.id, 'completed')}
                                                    disabled={!!updatingId}
                                                >
                                                    {updatingId === appointment.id
                                                        ? <ActivityIndicator size="small" color="#ffffff" style={styles.btnIcon} />
                                                        : <Ionicons name="checkmark-done" size={16} color="#ffffff" style={styles.btnIcon} />}
                                                    <Text style={styles.btnTextWhite}>Complete</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.noShowBtn, updatingId === appointment.id && { opacity: 0.4 }]}
                                                onPress={() => handleAppointmentStatusUpdate(appointment.id, 'no-show')}
                                                disabled={!!updatingId}
                                            >
                                                <Text style={styles.btnTextGray}>No Show</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })
                    )}
                </View>
            </>
        );
    };

    const renderTimeOffGroup = (title: string, items: TimeOff[], allowCancel = false) => (
        <View style={styles.timeOffGroup}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {items.length === 0 ? (
                <View style={styles.infoCard}>
                    <Ionicons name="calendar-clear-outline" size={18} color="#6b7280" />
                    <Text style={styles.infoCardText}>No items in this section.</Text>
                </View>
            ) : (
                items.map((item) => (
                    <View key={item.id} style={styles.timeOffCard}>
                        <View style={styles.timeOffHeader}>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                            </View>
                            <Text style={[styles.timeOffStatusText, { color: item.isApproved ? '#10b981' : '#f59e0b' }]}>
                                {item.isApproved ? 'APPROVED' : 'PENDING'}
                            </Text>
                        </View>
                        <Text style={styles.shiftLabel}>
                            {item.startDate} to {item.endDate} • {differenceInCalendarDays(parseRiyadhDateKey(item.endDate), parseRiyadhDateKey(item.startDate)) + 1} day(s)
                        </Text>
                        {item.reason ? <Text style={styles.notesText}>{item.reason}</Text> : null}
                        {allowCancel ? (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancelTimeOff(item.id)}
                            >
                                <Ionicons name="close-circle-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                <Text style={styles.cancelButtonText}>Cancel Request</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ))
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <Text style={styles.headerTitle}>Schedule & Availability</Text>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B5ADF']} />}
            >
                {appointmentAlert && (
                    <TouchableOpacity style={styles.alertBanner} activeOpacity={0.9} onPress={clearAlert}>
                        <View style={styles.alertIconWrap}>
                            <Ionicons name="notifications-outline" size={18} color="#7c3aed" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.alertTitle}>{appointmentAlert.title}</Text>
                            <Text style={styles.alertBody} numberOfLines={2}>{appointmentAlert.body}</Text>
                        </View>
                        <Ionicons name="close" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                )}

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{formatDurationHours(weekShiftMinutes)}</Text>
                        <Text style={styles.statLabel}>Week Hours</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{workingDays}</Text>
                        <Text style={styles.statLabel}>Working Days</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{timeOffDays}</Text>
                        <Text style={styles.statLabel}>Time Off Days</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>
                            {nextShift ? `${formatRiyadhWeekdayShort(nextShift.date)} ${formatClock(nextShift.startTime)}` : 'None'}
                        </Text>
                        <Text style={styles.statLabel}>Next Shift</Text>
                    </View>
                </View>

                <View style={styles.weekNavigatorCard}>
                    <TouchableOpacity
                        style={[styles.weekNavButton, !canGoPrev && styles.weekNavButtonDisabled]}
                        onPress={() => canGoPrev && setWeekOffset((current) => current - 1)}
                        disabled={!canGoPrev}
                    >
                        <Ionicons name="chevron-back" size={18} color={canGoPrev ? '#6d28d9' : '#9ca3af'} />
                    </TouchableOpacity>

                    <View style={styles.weekNavigatorCenter}>
                        <Text style={styles.weekNavigatorTitle}>
                            {formatRiyadhMonthDay(weekStartKey)} - {formatRiyadhMonthDay(addRiyadhDays(weekStartKey, 6))}
                        </Text>
                        <Text style={styles.weekNavigatorSubtitle}>
                            Week {weekOffset + 1} of {scheduleVisibilityWeeks} visible week(s)
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.weekNavButton, !canGoNext && styles.weekNavButtonDisabled]}
                        onPress={() => canGoNext && setWeekOffset((current) => current + 1)}
                        disabled={!canGoNext}
                    >
                        <Ionicons name="chevron-forward" size={18} color={canGoNext ? '#6d28d9' : '#9ca3af'} />
                    </TouchableOpacity>
                </View>

                <View style={styles.viewModeSwitcher}>
                    <TouchableOpacity
                        style={[styles.viewModeButton, scheduleViewMode === 'overview' && styles.viewModeButtonActive]}
                        onPress={() => setScheduleViewMode('overview')}
                    >
                        <Text style={[styles.viewModeButtonText, scheduleViewMode === 'overview' && styles.viewModeButtonTextActive]}>Overview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewModeButton, scheduleViewMode === 'grid' && styles.viewModeButtonActive]}
                        onPress={() => setScheduleViewMode('grid')}
                    >
                        <Text style={[styles.viewModeButtonText, scheduleViewMode === 'grid' && styles.viewModeButtonTextActive]}>Grid</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.calendarStrip}>
                    {weekDays.map((dayKey) => {
                        const isSelected = dayKey === selectedDateKey;
                        const state = getDayState(dayKey);
                        return (
                            <TouchableOpacity
                                key={dayKey}
                                style={[
                                    styles.dayCard,
                                    isSelected && styles.dayCardSelected,
                                    !isSelected && state === 'timeoff' && styles.dayCardTimeOff,
                                    !isSelected && state === 'working' && styles.dayCardWorking,
                                ]}
                                onPress={() => setSelectedDateKey(dayKey)}
                            >
                                <Text style={[styles.dayName, isSelected && styles.textSelected]}>
                                    {formatRiyadhWeekdayShort(dayKey)}
                                </Text>
                                <Text style={[styles.dayNumber, isSelected && styles.textSelected]}>
                                    {parseRiyadhDateKey(dayKey).getUTCDate()}
                                </Text>
                                <View style={[
                                    styles.dayStateDot,
                                    isSelected && styles.dayStateDotSelected,
                                    !isSelected && state === 'timeoff' && styles.dayStateDotTimeOff,
                                    !isSelected && state === 'working' && styles.dayStateDotWorking,
                                    !isSelected && state === 'off' && styles.dayStateDotOff,
                                ]} />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.dayOverviewCard}>
                    <View style={styles.dayOverviewHeader}>
                        <View>
                            <Text style={styles.dateTitle}>{formatRiyadhLongDate(selectedDateKey)}</Text>
                            <Text style={styles.dateSubtitle}>
                                {shiftsForSelectedDate.length > 0
                                    ? `${shiftsForSelectedDate.length} shift(s) • ${formatDurationHours(selectedDayShiftMinutes)} total`
                                    : timeOffForSelectedDate.length > 0
                                        ? 'Time off is active on this day'
                                        : 'No shift assigned for this day'}
                            </Text>
                        </View>
                        <View style={styles.dayOverviewStats}>
                            <Text style={styles.dayOverviewValue}>{formatDurationHours(selectedDayBreakMinutes)}</Text>
                            <Text style={styles.dayOverviewLabel}>Breaks</Text>
                        </View>
                    </View>
                </View>

                {renderSelectedDayContent()}

                <View style={styles.timeOffSection}>
                    <View style={styles.timeOffHeaderRow}>
                        <Text style={styles.sectionTitle}>Time Off Requests</Text>
                        {timeOffEnabled ? (
                            <TouchableOpacity style={styles.requestButton} onPress={() => router.push('/(modals)/request-time-off')}>
                                <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.requestButtonText}>Request Time Off</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {!timeOffEnabled ? (
                        <View style={styles.infoCard}>
                            <Ionicons name="information-circle-outline" size={18} color="#6b7280" />
                            <Text style={styles.infoCardText}>
                                Time off requests are not enabled for this account yet. Please contact your salon manager.
                            </Text>
                        </View>
                    ) : (
                        <>
                            {renderTimeOffGroup('Active', activeTimeOff)}
                            {renderTimeOffGroup('Upcoming', upcomingTimeOff, true)}
                            {renderTimeOffGroup('History', pastTimeOff)}
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        borderRadius: 16,
        padding: 14,
        marginBottom: 18,
    },
    alertIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ede9fe',
    },
    alertTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4c1d95',
        marginBottom: 2,
    },
    alertBody: {
        fontSize: 13,
        color: '#6b7280',
        lineHeight: 18,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 18,
    },
    weekNavigatorCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    weekNavigatorCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    weekNavigatorTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 2,
    },
    weekNavigatorSubtitle: {
        fontSize: 12,
        color: '#6b7280',
    },
    weekNavButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f3ff',
    },
    weekNavButtonDisabled: {
        backgroundColor: '#f3f4f6',
    },
    viewModeSwitcher: {
        flexDirection: 'row',
        backgroundColor: '#ede9fe',
        borderRadius: 999,
        padding: 4,
        marginBottom: 18,
        gap: 4,
    },
    viewModeButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 999,
    },
    viewModeButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 1,
    },
    viewModeButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6b7280',
    },
    viewModeButtonTextActive: {
        color: '#6d28d9',
    },
    statCard: {
        width: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#6d28d9',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    calendarStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    dayCard: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        width: '13%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    dayCardSelected: {
        backgroundColor: '#8B5ADF',
    },
    dayCardWorking: {
        backgroundColor: '#eff6ff',
    },
    dayCardTimeOff: {
        backgroundColor: '#fef3c7',
    },
    dayName: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    dayNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    textSelected: {
        color: '#ffffff',
    },
    dayStateDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 8,
    },
    dayStateDotSelected: {
        backgroundColor: '#ffffff',
    },
    dayStateDotWorking: {
        backgroundColor: '#2563eb',
    },
    dayStateDotTimeOff: {
        backgroundColor: '#d97706',
    },
    dayStateDotOff: {
        backgroundColor: '#d1d5db',
    },
    dayOverviewCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    dayOverviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    dateSubtitle: {
        fontSize: 14,
        color: '#6b7280',
    },
    dayOverviewStats: {
        alignItems: 'flex-end',
    },
    gridCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    gridHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    gridHint: {
        fontSize: 12,
        color: '#6b7280',
    },
    gridTimeline: {
        flexDirection: 'row',
    },
    gridTimeColumn: {
        width: 56,
        paddingTop: 8,
    },
    gridTimeSlot: {
        justifyContent: 'flex-start',
    },
    gridTimeLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    gridCanvas: {
        flex: 1,
        marginLeft: 6,
        borderLeftWidth: 1,
        borderLeftColor: '#e5e7eb',
        position: 'relative',
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#f3f4f6',
    },
    gridAppointmentCard: {
        position: 'absolute',
        left: 10,
        right: 10,
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        borderRadius: 16,
        padding: 12,
        overflow: 'hidden',
    },
    gridAppointmentCardCompleted: {
        backgroundColor: '#f8fafc',
        borderColor: '#e5e7eb',
    },
    gridAppointmentHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 10,
    },
    gridAppointmentTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 2,
    },
    gridAppointmentTime: {
        fontSize: 12,
        color: '#6b7280',
    },
    gridUrgencyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    gridUrgencyText: {
        fontSize: 11,
        fontWeight: '700',
    },
    gridAppointmentCustomer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    gridAppointmentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ede9fe',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridAppointmentAvatarImage: {
        width: '100%',
        height: '100%',
    },
    gridAppointmentAvatarInitial: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6d28d9',
    },
    gridAppointmentCustomerName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    gridAppointmentMeta: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    gridAppointmentFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    gridAppointmentPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4c1d95',
    },
    gridAppointmentAction: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6d28d9',
    },
    dayOverviewValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#6d28d9',
    },
    dayOverviewLabel: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
    },
    shiftCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    shiftTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    shiftTime: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    shiftLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    shiftBadges: {
        alignItems: 'flex-end',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        marginBottom: 8,
    },
    badgeRecurring: {
        backgroundColor: '#eff6ff',
    },
    badgeRecurringText: {
        color: '#2563eb',
    },
    badgeSpecific: {
        backgroundColor: '#f3e8ff',
    },
    badgeSpecificText: {
        color: '#7c3aed',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    hoursBadge: {
        backgroundColor: '#f3f4f6',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    hoursBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4b5563',
    },
    breaksCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    breakRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
    },
    breakDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#8B5ADF',
        marginTop: 6,
        marginRight: 10,
    },
    breakLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    breakTime: {
        fontSize: 13,
        color: '#6b7280',
    },
    timeOffSection: {
        marginTop: 8,
    },
    appointmentsSection: {
        marginTop: 8,
    },
    timeOffHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    timeOffGroup: {
        marginBottom: 16,
    },
    infoCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    infoCardText: {
        flex: 1,
        marginLeft: 10,
        color: '#4b5563',
        fontSize: 14,
        lineHeight: 20,
    },
    requestButton: {
        flexDirection: 'row',
        backgroundColor: '#8B5ADF',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    requestButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    timeOffCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#8B5ADF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    timeOffHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    typeBadge: {
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6b21a8',
    },
    timeOffStatusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    notesText: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 8,
        lineHeight: 18,
    },
    appointmentCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    appointmentCardCompleted: {
        opacity: 0.72,
        backgroundColor: '#f9fafb',
    },
    appointmentCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    urgencyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    urgencyText: {
        fontSize: 12,
        fontWeight: '700',
    },
    statusBadge: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 6,
    },
    appointmentStatusText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6b7280',
    },
    appointmentTime: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#8B5ADF',
        marginBottom: 4,
    },
    appointmentDuration: {
        fontSize: 13,
        color: '#6b7280',
    },
    appointmentCardBadges: {
        alignItems: 'flex-end',
        gap: 8,
    },
    appointmentCardBody: {
        marginTop: 10,
    },
    appointmentCustomerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    appointmentAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginRight: 12,
    },
    appointmentAvatarImage: {
        width: '100%',
        height: '100%',
    },
    appointmentAvatarInitial: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#6d28d9',
    },
    appointmentCustomerMeta: {
        flex: 1,
    },
    appointmentCustomerName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    appointmentBookingMeta: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    appointmentAmountBox: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    appointmentAmountText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1f2937',
    },
    appointmentServiceName: {
        fontSize: 15,
        color: '#4b5563',
    },
    appointmentMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    appointmentMetaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    appointmentMetaBadgeText: {
        fontSize: 12,
        color: '#4b5563',
        marginLeft: 6,
        textTransform: 'capitalize',
    },
    appointmentNotesContainer: {
        flexDirection: 'row',
        backgroundColor: '#fef3c7',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        alignItems: 'flex-start',
    },
    appointmentNotesText: {
        fontSize: 13,
        color: '#92400e',
        marginLeft: 6,
        flex: 1,
    },
    appointmentClientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f5f3ff',
        borderRadius: 999,
    },
    appointmentClientButtonIcon: {
        marginRight: 6,
    },
    appointmentClientButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6d28d9',
    },
    appointmentActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 16,
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    startBtn: {
        backgroundColor: '#8B5ADF',
    },
    completeBtn: {
        backgroundColor: '#10b981',
    },
    noShowBtn: {
        backgroundColor: '#f3f4f6',
    },
    btnIcon: {
        marginRight: 6,
    },
    btnTextWhite: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    btnTextGray: {
        color: '#4b5563',
        fontWeight: '500',
        fontSize: 14,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: '#fef2f2',
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ef4444',
    },
    centerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4b5563',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    },
});
