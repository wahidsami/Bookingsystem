import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Platform,
    AppState,
    Alert,
    Image,
    Modal,
    Pressable,
    useWindowDimensions,
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
import { useAppointmentArrivalAlert } from '../../src/hooks/useAppointmentArrivalAlert';
import {
    addRiyadhDays,
    formatRiyadhLongDate,
    formatRiyadhMonthDay,
    formatRiyadhTime,
    formatRiyadhWeekdayShort,
    getRiyadhDateKey,
    getRiyadhWeekStartKey,
    parseRiyadhDateKey,
} from '../../src/utils/riyadhDate';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseClockToMinutes = (value?: string | null): number | null => {
    if (!value) return null;
    const [hoursRaw, minutesRaw] = `${value}`.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }
    return (hours * 60) + minutes;
};

const minutesBetween = (startTime: string, endTime: string) => {
    const startMinutes = parseClockToMinutes(startTime);
    const endMinutes = parseClockToMinutes(endTime);
    if (startMinutes === null || endMinutes === null) {
        return 0;
    }
    return endMinutes - startMinutes;
};

const formatClock = (timeString: string) => {
    const minutesTotal = parseClockToMinutes(timeString);
    if (minutesTotal === null) {
        return '--:--';
    }

    const hour24 = Math.floor(minutesTotal / 60);
    const minute = minutesTotal % 60;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const formattedH = hour24 % 12 || 12;
    return `${formattedH}:${minute.toString().padStart(2, '0')} ${ampm}`;
};

const formatDurationHours = (minutes: number) => `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;

const getDateSpanDays = (startDate: string, endDate: string) => {
    const start = parseRiyadhDateKey(startDate);
    const end = parseRiyadhDateKey(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }

    try {
        return differenceInCalendarDays(end, start) + 1;
    } catch {
        return null;
    }
};

export default function ScheduleScreen() {
    const { user } = useAuth();
    const { width: viewportWidth } = useWindowDimensions();
    const weekGridScrollRef = useRef<ScrollView | null>(null);
    const { alert: appointmentAlert, clearAlert, syncAppointments } = useAppointmentArrivalAlert();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [breaks, setBreaks] = useState<BreakWindow[]>([]);
    const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, Appointment[]>>({});
    const [selectedDateKey, setSelectedDateKey] = useState(getRiyadhDateKey());
    const [weekOffset, setWeekOffset] = useState(0);
    const [appointmentsLoading, setAppointmentsLoading] = useState(true);
    const [weekAppointmentsLoading, setWeekAppointmentsLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [scheduleViewMode, setScheduleViewMode] = useState<'grid' | 'cards'>('grid');
    const [dayScopeMode, setDayScopeMode] = useState<'day' | 'week'>('week');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [visibleWeeks, setVisibleWeeks] = useState(1);
    const [gridScalePercent, setGridScalePercent] = useState(42);
    const [settingsSliderWidth, setSettingsSliderWidth] = useState(1);
    const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
    const timeOffEnabled = canRequestTimeOff(user);
    const canSeeBookingNotes = canViewBookingNotes(user);
    const canViewClientContext = canViewClients(user);
    const scheduleVisibilityWeeks = Math.min(Math.max(Number(user?.scheduleVisibilityWeeks || 1), 1), 4);
    const weekColumnGap = 10;
    const weekColumnWidth = useMemo(
        () => clamp(Math.round(viewportWidth * 0.54), 190, 255),
        [viewportWidth]
    );
    const singleDayColumnWidth = useMemo(
        () => clamp(Math.round(viewportWidth - 98), 290, 480),
        [viewportWidth]
    );
    const weekSnapInterval = weekColumnWidth + weekColumnGap;

    const baseWeekStartKey = useMemo(() => getRiyadhWeekStartKey(), []);
    const weekStartKey = useMemo(() => addRiyadhDays(baseWeekStartKey, weekOffset * 7), [baseWeekStartKey, weekOffset]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addRiyadhDays(weekStartKey, i)), [weekStartKey]);
    const canGoPrev = weekOffset > 0;
    const canGoNext = weekOffset < visibleWeeks - 1;
    const firstVisibleDayKey = baseWeekStartKey;
    const lastVisibleDayKey = addRiyadhDays(baseWeekStartKey, (visibleWeeks * 7) - 1);
    const canGoPrevDay = selectedDateKey > firstVisibleDayKey;
    const canGoNextDay = selectedDateKey < lastVisibleDayKey;

    useEffect(() => {
        setVisibleWeeks(scheduleVisibilityWeeks);
    }, [scheduleVisibilityWeeks]);

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
            setAppointmentsByDate((current) => ({ ...current, [selectedDateKey]: data }));
        } catch (error) {
            console.error('Failed to load appointments for selected day', error);
            setAppointments([]);
            setAppointmentsByDate((current) => ({ ...current, [selectedDateKey]: [] }));
        } finally {
            setAppointmentsLoading(false);
        }
    }, [selectedDateKey, syncAppointments]);

    const loadAppointmentsForVisibleWeek = useCallback(async () => {
        if (!user) return;
        try {
            setWeekAppointmentsLoading(true);
            const responses = await Promise.all(
                weekDays.map(async (dayKey) => ({
                    dayKey,
                    appointments: await getAppointmentsForDate(dayKey),
                }))
            );

            setAppointmentsByDate((current) => {
                const next = { ...current };
                responses.forEach(({ dayKey, appointments: dayAppointments }) => {
                    next[dayKey] = dayAppointments;
                });
                return next;
            });
        } catch (error) {
            console.error('Failed to load appointments for visible week', error);
        } finally {
            setWeekAppointmentsLoading(false);
        }
    }, [user, weekDays]);

    const handleAppointmentStatusUpdate = async (id: string, newStatus: 'started' | 'completed' | 'no-show') => {
        if (updatingId) {
            return;
        }

        try {
            setUpdatingId(id);
            await updateAppointmentStatus(id, newStatus);
            await loadAppointmentsForSelectedDate(true);
            Alert.alert(
                newStatus === 'started' ? 'Service started' : newStatus === 'completed' ? 'Service completed' : 'Marked as no-show',
                newStatus === 'started'
                    ? 'The appointment is now in service.'
                    : newStatus === 'completed'
                        ? 'The appointment was completed successfully.'
                        : 'The appointment was marked as no-show.'
            );
        } catch (error) {
            console.error('Failed to update appointment status', error);
            const message =
                (error as any)?.response?.data?.message ||
                (error as any)?.message ||
                'Could not update the appointment status.';
            Alert.alert('Update failed', message);
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

    useEffect(() => {
        if (!user || dayScopeMode !== 'week') {
            return;
        }
        loadAppointmentsForVisibleWeek();
    }, [user, dayScopeMode, loadAppointmentsForVisibleWeek]);

    useFocusEffect(
        useCallback(() => {
            if (user) {
                // Always default back to calendar grid when the Schedule tab is focused.
                setScheduleViewMode('grid');
                loadData();
                if (dayScopeMode === 'week') {
                    loadAppointmentsForVisibleWeek();
                } else {
                    loadAppointmentsForSelectedDate(true);
                }
            }
        }, [user, loadData, dayScopeMode, loadAppointmentsForVisibleWeek, loadAppointmentsForSelectedDate])
    );

    useEffect(() => {
        if (!user) return;
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                loadData();
                if (dayScopeMode === 'week') {
                    loadAppointmentsForVisibleWeek();
                } else {
                    loadAppointmentsForSelectedDate(true);
                }
            }
        });

        return () => subscription.remove();
    }, [user, loadData, dayScopeMode, loadAppointmentsForVisibleWeek, loadAppointmentsForSelectedDate]);

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            if (dayScopeMode === 'week') {
                loadAppointmentsForVisibleWeek();
            } else {
                loadAppointmentsForSelectedDate(true);
            }
        }, 45000);

        return () => clearInterval(interval);
    }, [user, dayScopeMode, loadAppointmentsForVisibleWeek, loadAppointmentsForSelectedDate]);

    useEffect(() => {
        setSelectedDateKey(weekOffset === 0 ? getRiyadhDateKey() : weekStartKey);
    }, [weekOffset, weekStartKey]);

    useEffect(() => {
        if (dayScopeMode !== 'week' || !weekGridScrollRef.current) {
            return;
        }
        const selectedIndex = weekDays.indexOf(selectedDateKey);
        if (selectedIndex < 0) {
            return;
        }
        weekGridScrollRef.current.scrollTo({
            x: selectedIndex * weekSnapInterval,
            animated: true,
        });
    }, [dayScopeMode, selectedDateKey, weekDays, weekSnapInterval]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
        if (dayScopeMode === 'week') {
            loadAppointmentsForVisibleWeek();
        } else {
            loadAppointmentsForSelectedDate();
        }
    };

    const handleSliderTouch = (locationX: number) => {
        if (!Number.isFinite(locationX)) return;
        const ratio = clamp(locationX / Math.max(1, settingsSliderWidth), 0, 1);
        // Keep a usable minimum to avoid unreadable or zero-height rows.
        const minScale = 20;
        setGridScalePercent(Math.round(minScale + (ratio * (100 - minScale))));
    };

    const moveSelectedDay = (direction: -1 | 1) => {
        const candidate = addRiyadhDays(selectedDateKey, direction);
        if (candidate < firstVisibleDayKey || candidate > lastVisibleDayKey) {
            return;
        }
        setSelectedDateKey(candidate);

        if (direction < 0 && candidate < weekStartKey) {
            setWeekOffset((current) => Math.max(0, current - 1));
        } else if (direction > 0 && candidate > addRiyadhDays(weekStartKey, 6)) {
            setWeekOffset((current) => Math.min(visibleWeeks - 1, current + 1));
        }
    };

    const getCurrentRiyadhHour = () => {
        try {
            const hour = Number(new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Riyadh',
                hour: '2-digit',
                hour12: false,
            }).format(new Date()));
            return Number.isFinite(hour) ? hour : 12;
        } catch {
            return 12;
        }
    };

    const handleWeekGridMomentumEnd = (offsetX: number) => {
        if (dayScopeMode !== 'week') {
            return;
        }
        const approxIndex = Math.round(offsetX / weekSnapInterval);
        const clampedIndex = clamp(approxIndex, 0, weekDays.length - 1);
        const dayKey = weekDays[clampedIndex];
        if (dayKey && dayKey !== selectedDateKey) {
            setSelectedDateKey(dayKey);
        }
    };

    const jumpToTodayInSchedule = () => {
        const todayKey = getRiyadhDateKey();
        setWeekOffset(0);
        setSelectedDateKey(todayKey);
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
    const selectedDayAppointments = dayScopeMode === 'week'
        ? (appointmentsByDate[selectedDateKey] || [])
        : appointments;

    const selectedDayShiftMinutes = shiftsForSelectedDate.reduce((sum, shift) => sum + Math.max(minutesBetween(shift.startTime, shift.endTime), 0), 0);
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

    const formatTime = (value: string) => formatRiyadhTime(value);

    const getUrgencyInfo = (item: Appointment): { label: string; color: string; background: string; priority: number } => {
        if (item.status === 'started') {
            return { label: 'In Service', color: '#92400e', background: '#fef3c7', priority: 0 };
        }

        if (['completed', 'no_show', 'cancelled'].includes(item.status)) {
            return { label: 'Closed', color: '#4b5563', background: '#f3f4f6', priority: 4 };
        }

        const startTimestamp = new Date(item.startTime).getTime();
        if (!Number.isFinite(startTimestamp)) {
            return { label: 'Upcoming', color: '#1d4ed8', background: '#dbeafe', priority: 3 };
        }

        const minutesToStart = Math.round((startTimestamp - Date.now()) / 60000);
        if (minutesToStart < -10) {
            return { label: 'Late', color: '#b91c1c', background: '#fee2e2', priority: 1 };
        }
        if (minutesToStart <= 30) {
            return { label: 'Starting Soon', color: '#9a3412', background: '#ffedd5', priority: 2 };
        }

        return { label: 'Upcoming', color: '#1d4ed8', background: '#dbeafe', priority: 3 };
    };

    const getMinutesFromClock = (timeString: string) => {
        return parseClockToMinutes(timeString) ?? 0;
    };

    const getRiyadhMinutes = (value: string) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        try {
            const formatted = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Riyadh',
                hourCycle: 'h23',
                hour: '2-digit',
                minute: '2-digit',
            }).format(parsed);
            return getMinutesFromClock(formatted);
        } catch {
            return null;
        }
    };

    const renderGridView = () => {
        const gridStartMinute = 6 * 60;
        const gridEndMinute = 22 * 60;
        const slotMinutes = 30;
        const rowHeight = Math.round(12 + (gridScalePercent / 100) * 48);
        const totalRows = Math.max(1, Math.ceil((gridEndMinute - gridStartMinute) / slotMinutes));
        const gridHeight = totalRows * rowHeight + 24;
        const dayKeysForGrid = dayScopeMode === 'week' ? weekDays : [selectedDateKey];
        const compactGridCards = dayScopeMode === 'week' || gridScalePercent <= 55;
        const ultraCompactGridCards = gridScalePercent <= 38;
        const dayColumnWidth = dayScopeMode === 'week' ? weekColumnWidth : singleDayColumnWidth;
        const isGridLoading = dayScopeMode === 'week' ? weekAppointmentsLoading : appointmentsLoading;
        const totalAppointmentsInScope = dayKeysForGrid.reduce((sum, dayKey) => {
            const dayAppointments = dayScopeMode === 'week' ? (appointmentsByDate[dayKey] || []) : selectedDayAppointments;
            return sum + dayAppointments.length;
        }, 0);
        const hasTimelineItems = dayKeysForGrid.some((dayKey) => {
            const dayAppointments = dayScopeMode === 'week' ? (appointmentsByDate[dayKey] || []) : selectedDayAppointments;
            const dayBreaks = breaks.filter((item) => item.date === dayKey);
            const hasDayTimeOff = timeOff.some((item) => item.startDate <= dayKey && item.endDate >= dayKey);
            return dayAppointments.length > 0 || dayBreaks.length > 0 || hasDayTimeOff;
        });
        const clampToGrid = (minute: number) => Math.min(gridEndMinute, Math.max(gridStartMinute, minute));

        return (
            <View style={styles.gridCard}>
                <View style={styles.gridHeaderRow}>
                    <Text style={styles.sectionTitle}>{dayScopeMode === 'week' ? 'Week Grid' : 'Day Grid'}</Text>
                    <Text style={styles.gridHint}>
                        {totalAppointmentsInScope} appointment{totalAppointmentsInScope === 1 ? '' : 's'}
                    </Text>
                </View>

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

                        <ScrollView
                            ref={weekGridScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={dayScopeMode === 'week' ? weekSnapInterval : undefined}
                            decelerationRate={dayScopeMode === 'week' ? 'fast' : 'normal'}
                            snapToAlignment={dayScopeMode === 'week' ? 'start' : undefined}
                            onMomentumScrollEnd={(event) => handleWeekGridMomentumEnd(event.nativeEvent.contentOffset.x)}
                            contentContainerStyle={styles.gridColumnsScrollContent}
                        >
                            <View style={styles.gridColumnsRow}>
                                {dayKeysForGrid.map((dayKey) => {
                                    const dayAppointments = dayScopeMode === 'week' ? (appointmentsByDate[dayKey] || []) : selectedDayAppointments;
                                    const dayBreaks = breaks.filter((item) => item.date === dayKey);
                                    const hasDayTimeOff = timeOff.some((item) => item.startDate <= dayKey && item.endDate >= dayKey);

                                    return (
                                        <View
                                            key={`grid-day-${dayKey}`}
                                            style={[
                                                styles.gridDayColumn,
                                                dayScopeMode === 'week' ? styles.gridDayColumnWeek : styles.gridDayColumnSingle,
                                                { width: dayColumnWidth },
                                            ]}
                                        >
                                            {dayScopeMode === 'week' ? (
                                                <View style={styles.gridDayHeader}>
                                                    <Text style={styles.gridDayHeaderTitle}>{formatRiyadhWeekdayShort(dayKey)}</Text>
                                                    <Text style={styles.gridDayHeaderSub}>{formatRiyadhMonthDay(dayKey)}</Text>
                                                </View>
                                            ) : null}

                                            <View style={[styles.gridCanvas, { height: gridHeight }]}>
                                                {Array.from({ length: totalRows + 1 }, (_, index) => (
                                                    <View
                                                        key={`line-${dayKey}-${index}`}
                                                        style={[
                                                            styles.gridLine,
                                                            {
                                                                top: index * rowHeight
                                                            }
                                                        ]}
                                                    />
                                                ))}

                                                {hasDayTimeOff ? (
                                                    <View style={styles.gridTimeOffOverlay}>
                                                        <Text style={styles.gridTimeOffOverlayText}>Time Off</Text>
                                                    </View>
                                                ) : null}

                                                {dayAppointments.map((appointment) => {
                                                    const startMinute = getRiyadhMinutes(appointment.startTime);
                                                    const endMinute = getRiyadhMinutes(appointment.endTime);
                                                    if (startMinute === null || endMinute === null) {
                                                        return null;
                                                    }
                                                    const normalizedStart = clampToGrid(startMinute);
                                                    const normalizedEnd = clampToGrid(endMinute);
                                                    const topOffset = Math.max(0, ((normalizedStart - gridStartMinute) / slotMinutes) * rowHeight);
                                                    const dynamicMinHeight = ultraCompactGridCards ? 34 : compactGridCards ? 44 : 56;
                                                    const height = Math.max(dynamicMinHeight, Math.max(1, ((normalizedEnd - normalizedStart) / slotMinutes) * rowHeight));
                                                    const urgency = getUrgencyInfo(appointment);
                                                    const isStarted = appointment.status === 'started';
                                                    const isCompleted = appointment.status === 'completed' || appointment.status === 'no_show' || appointment.status === 'cancelled';
                                                    const customerInitial = appointment.user?.firstName?.charAt(0)?.toUpperCase() || appointment.user?.lastName?.charAt(0)?.toUpperCase() || 'C';
                                                    const serviceLabel = appointment.service?.name_en || 'Service';
                                                    const customerLabel = `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.trim() || 'Client';
                                                    const compactHeader = `${formatTime(appointment.startTime)} • ${isStarted ? 'In Service' : 'Upcoming'}`;

                                                    return (
                                                        <TouchableOpacity
                                                            key={`grid-${dayKey}-${appointment.id}`}
                                                            style={[
                                                                styles.gridAppointmentCard,
                                                                { top: topOffset, height },
                                                                compactGridCards && styles.gridAppointmentCardCompact,
                                                                isCompleted && styles.gridAppointmentCardCompleted
                                                            ]}
                                                            activeOpacity={0.9}
                                                            onPress={() => setActiveAppointment(appointment)}
                                                        >
                                                            {ultraCompactGridCards ? (
                                                                <View style={styles.gridAppointmentUltraCompact}>
                                                                    <Text style={styles.gridAppointmentUltraCompactTitle} numberOfLines={1}>
                                                                        {serviceLabel}
                                                                    </Text>
                                                                    <Text style={styles.gridAppointmentUltraCompactSub} numberOfLines={1}>
                                                                        {customerLabel}
                                                                    </Text>
                                                                    <Text style={styles.gridAppointmentUltraCompactMeta} numberOfLines={1}>
                                                                        {compactHeader}
                                                                    </Text>
                                                                </View>
                                                            ) : (
                                                                <>
                                                                    <View style={styles.gridAppointmentHeader}>
                                                                        <View style={{ flex: 1 }}>
                                                                            <Text style={[styles.gridAppointmentTitle, compactGridCards && styles.gridAppointmentTitleCompact]} numberOfLines={1}>
                                                                                {serviceLabel}
                                                                            </Text>
                                                                            <Text style={[styles.gridAppointmentTime, compactGridCards && styles.gridAppointmentTimeCompact]}>
                                                                                {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                                                                            </Text>
                                                                        </View>
                                                                        {!compactGridCards ? (
                                                                            <View style={[styles.gridUrgencyBadge, { backgroundColor: urgency.background }]}>
                                                                                <Text style={[styles.gridUrgencyText, { color: urgency.color }]}>{urgency.label}</Text>
                                                                            </View>
                                                                        ) : null}
                                                                    </View>

                                                                    <View style={[styles.gridAppointmentCustomer, compactGridCards && styles.gridAppointmentCustomerCompact]}>
                                                                        <View style={styles.gridAppointmentAvatar}>
                                                                            {appointment.user?.profileImage ? (
                                                                                <Image source={{ uri: getImageUrl(appointment.user.profileImage) }} style={styles.gridAppointmentAvatarImage} />
                                                                            ) : (
                                                                                <Text style={styles.gridAppointmentAvatarInitial}>{customerInitial}</Text>
                                                                            )}
                                                                        </View>
                                                                        <View style={{ flex: 1 }}>
                                                                            <Text style={[styles.gridAppointmentCustomerName, compactGridCards && styles.gridAppointmentCustomerNameCompact]} numberOfLines={1}>
                                                                                {customerLabel}
                                                                            </Text>
                                                                            <Text style={[styles.gridAppointmentMeta, compactGridCards && styles.gridAppointmentMetaCompact]} numberOfLines={1}>
                                                                                {appointment.status.toUpperCase().replace('_', ' ')}{appointment.paymentStatus ? ` • ${appointment.paymentStatus.replace(/_/g, ' ')}` : ''}
                                                                            </Text>
                                                                        </View>
                                                                    </View>

                                                                    {!compactGridCards ? (
                                                                        <View style={styles.gridAppointmentFooter}>
                                                                            <Text style={[styles.gridAppointmentPrice, compactGridCards && styles.gridAppointmentPriceCompact]}>
                                                                                SAR {Number(appointment.service?.finalPrice || appointment.service?.basePrice || appointment.price || 0).toFixed(2)}
                                                                            </Text>
                                                                            <Text style={[styles.gridAppointmentAction, compactGridCards && styles.gridAppointmentActionCompact, isStarted && { color: '#047857' }]} numberOfLines={1}>
                                                                                {isStarted ? 'In Service' : 'Upcoming'}
                                                                            </Text>
                                                                        </View>
                                                                    ) : null}
                                                                </>
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                })}

                                                {dayBreaks.map((breakItem) => {
                                                    const startMinute = getRiyadhMinutes(breakItem.startTime);
                                                    const endMinute = getRiyadhMinutes(breakItem.endTime);
                                                    if (startMinute === null || endMinute === null) {
                                                        return null;
                                                    }
                                                    const normalizedStart = clampToGrid(startMinute);
                                                    const normalizedEnd = clampToGrid(endMinute);
                                                    const topOffset = Math.max(0, ((normalizedStart - gridStartMinute) / slotMinutes) * rowHeight);
                                                    const height = Math.max(24, Math.max(1, ((normalizedEnd - normalizedStart) / slotMinutes) * rowHeight));

                                                    return (
                                                        <View
                                                            key={`break-${dayKey}-${breakItem.id}`}
                                                            style={[
                                                                styles.gridBreakBlock,
                                                                {
                                                                    top: topOffset,
                                                                    height,
                                                                }
                                                            ]}
                                                        >
                                                            <View style={styles.gridBreakDot} />
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.gridBreakLabel} numberOfLines={1}>
                                                                    {breakItem.label || 'Blocked time'}
                                                                </Text>
                                                                <Text style={styles.gridBreakTime} numberOfLines={1}>
                                                                    {formatTime(breakItem.startTime)} - {formatTime(breakItem.endTime)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    {isGridLoading ? (
                        <View style={styles.gridLoadingOverlay}>
                            <ActivityIndicator size="small" color="#8B5ADF" />
                            <Text style={styles.gridLoadingText}>Updating calendar...</Text>
                        </View>
                    ) : null}

                    {!hasTimelineItems ? (
                        <View style={styles.gridInlineEmptyState}>
                            <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                            <Text style={styles.gridInlineEmptyText}>No appointments, blocked time, or leave in this scope.</Text>
                        </View>
                    ) : null}
                </View>
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
                            {item.startDate} to {item.endDate} • {getDateSpanDays(item.startDate, item.endDate) ?? '-'} day(s)
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

    const renderAppointmentModal = () => {
        if (!activeAppointment) return null;

        const appointment = activeAppointment;
        const customerInitial = appointment.user?.firstName?.charAt(0)?.toUpperCase() || appointment.user?.lastName?.charAt(0)?.toUpperCase() || 'C';
        const amount = Number(appointment.service?.finalPrice || appointment.service?.basePrice || appointment.price || 0);
        const urgency = getUrgencyInfo(appointment);
        const isStarted = appointment.status === 'started';
        const isCompleted = appointment.status === 'completed' || appointment.status === 'no_show' || appointment.status === 'cancelled';

        return (
            <Modal
                visible={Boolean(activeAppointment)}
                transparent
                animationType="fade"
                onRequestClose={() => setActiveAppointment(null)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setActiveAppointment(null)}>
                    <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Appointment</Text>
                            <TouchableOpacity onPress={() => setActiveAppointment(null)}>
                                <Ionicons name="close" size={22} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

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
                            </View>
                        </View>

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

                        {canSeeBookingNotes && appointment.notes ? (
                            <View style={styles.appointmentNotesContainer}>
                                <Ionicons name="document-text-outline" size={14} color="#6b7280" />
                                <Text style={styles.appointmentNotesText} numberOfLines={3}>{appointment.notes}</Text>
                            </View>
                        ) : null}

                        {canViewClientContext && appointment.user?.id ? (
                            <TouchableOpacity
                                style={styles.appointmentClientButton}
                                onPress={() => {
                                    setActiveAppointment(null);
                                    router.push((`/client/${appointment.user?.id}` as any));
                                }}
                            >
                                <Ionicons name="person-circle-outline" size={16} color="#6d28d9" style={styles.appointmentClientButtonIcon} />
                                <Text style={styles.appointmentClientButtonText}>Appointment Details</Text>
                            </TouchableOpacity>
                        ) : null}

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
                    </Pressable>
                </Pressable>
            </Modal>
        );
    };

    const currentHour = getCurrentRiyadhHour();
    const greeting = currentHour < 12 ? 'Good morning,' : currentHour < 17 ? 'Good afternoon,' : 'Good evening,';
    const controllerTitle = dayScopeMode === 'week'
        ? `${formatRiyadhMonthDay(weekStartKey)} - ${formatRiyadhMonthDay(addRiyadhDays(weekStartKey, 6))}`
        : formatRiyadhLongDate(selectedDateKey);
    const controllerSubtitle = dayScopeMode === 'week'
        ? `Week ${weekOffset + 1} of ${visibleWeeks} visible week(s)`
        : `Day view in week ${weekOffset + 1} of ${visibleWeeks}`;
    const showLegacyDayStripAndSummary = false;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <View style={styles.headerTopRow}>
                    <View>
                        <Text style={styles.headerGreeting}>{greeting}</Text>
                        <Text style={styles.headerStaffName}>{user?.name?.split(' ')[0] || 'Staff'} {currentHour < 17 ? '☀️' : '🌙'}</Text>
                    </View>
                    <View style={styles.headerAvatarWrap}>
                        {user?.photo ? (
                            <Image source={{ uri: getImageUrl(user.photo) }} style={styles.headerAvatar} />
                        ) : (
                            <View style={styles.headerAvatarFallback}>
                                <Text style={styles.headerAvatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'S'}</Text>
                            </View>
                        )}
                    </View>
                </View>
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

                <View style={styles.primaryControlsRow}>
                    <TouchableOpacity
                        style={styles.todayAppointmentsButton}
                        onPress={jumpToTodayInSchedule}
                    >
                        <Ionicons name="today-outline" size={18} color="#1f2937" />
                    </TouchableOpacity>

                    <View style={styles.primaryDayController}>
                        <TouchableOpacity
                            style={[styles.weekNavButton, dayScopeMode === 'week' ? (!canGoPrev && styles.weekNavButtonDisabled) : (!canGoPrevDay && styles.weekNavButtonDisabled)]}
                            onPress={() => dayScopeMode === 'week' ? (canGoPrev && setWeekOffset((current) => current - 1)) : moveSelectedDay(-1)}
                            disabled={dayScopeMode === 'week' ? !canGoPrev : !canGoPrevDay}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={18}
                                color={dayScopeMode === 'week' ? (canGoPrev ? '#6d28d9' : '#9ca3af') : (canGoPrevDay ? '#6d28d9' : '#9ca3af')}
                            />
                        </TouchableOpacity>

                        <View style={styles.weekNavigatorCenter}>
                            <Text style={styles.weekNavigatorTitle}>{controllerTitle}</Text>
                            <Text style={styles.weekNavigatorSubtitle}>
                                {controllerSubtitle}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.weekNavButton, dayScopeMode === 'week' ? (!canGoNext && styles.weekNavButtonDisabled) : (!canGoNextDay && styles.weekNavButtonDisabled)]}
                            onPress={() => dayScopeMode === 'week' ? (canGoNext && setWeekOffset((current) => current + 1)) : moveSelectedDay(1)}
                            disabled={dayScopeMode === 'week' ? !canGoNext : !canGoNextDay}
                        >
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={dayScopeMode === 'week' ? (canGoNext ? '#6d28d9' : '#9ca3af') : (canGoNextDay ? '#6d28d9' : '#9ca3af')}
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.settingsButton} onPress={() => setSettingsOpen(true)}>
                        <Ionicons name="settings-outline" size={22} color="#1f2937" />
                    </TouchableOpacity>
                </View>

                {showLegacyDayStripAndSummary ? (
                    <>
                        {dayScopeMode === 'week' ? (
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
                                                {(() => {
                                                    const dayDate = parseRiyadhDateKey(dayKey);
                                                    return Number.isNaN(dayDate.getTime()) ? '--' : dayDate.getUTCDate();
                                                })()}
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
                        ) : (
                            <View style={styles.singleDayPill}>
                                <Text style={styles.singleDayTitle}>{formatRiyadhLongDate(selectedDateKey)}</Text>
                                <Text style={styles.singleDaySubtitle}>Focused day view</Text>
                            </View>
                        )}

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
                                    <Text style={styles.dayOverviewValue}>{appointmentsForSelectedDate.length}</Text>
                                    <Text style={styles.dayOverviewLabel}>Appointments</Text>
                                </View>
                            </View>
                        </View>
                    </>
                ) : null}

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

            <Modal
                visible={settingsOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setSettingsOpen(false)}
            >
                <Pressable style={styles.settingsBackdrop} onPress={() => setSettingsOpen(false)}>
                    <Pressable style={styles.settingsPanel} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.settingsHeader}>
                            <Text style={styles.settingsTitle}>Schedule Settings</Text>
                            <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                                <Ionicons name="close" size={22} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.settingsSectionTitle}>Calendar Grid Size</Text>
                        <View
                            style={styles.customSliderTrack}
                            onLayout={(event) => setSettingsSliderWidth(event.nativeEvent.layout.width)}
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            onResponderGrant={(event) => handleSliderTouch(event.nativeEvent.locationX)}
                            onResponderMove={(event) => handleSliderTouch(event.nativeEvent.locationX)}
                        >
                            <View style={[styles.customSliderFill, { width: `${gridScalePercent}%` }]} />
                            <View style={[styles.customSliderThumb, { left: `${gridScalePercent}%` }]} />
                        </View>
                        <Text style={styles.settingsHint}>Scale: {gridScalePercent}%</Text>

                        <Text style={styles.settingsSectionTitle}>Visible Range</Text>
                        <View style={styles.optionRow}>
                            {[1, 2, 3, 4].map((weekCount) => {
                                const disabled = weekCount > scheduleVisibilityWeeks;
                                const active = weekCount === visibleWeeks;
                                return (
                                    <TouchableOpacity
                                        key={`weeks-${weekCount}`}
                                        style={[styles.optionChip, active && styles.optionChipActive, disabled && styles.optionChipDisabled]}
                                        disabled={disabled}
                                        onPress={() => {
                                            setVisibleWeeks(weekCount);
                                            setWeekOffset((current) => Math.min(current, weekCount - 1));
                                        }}
                                    >
                                        <Text style={[styles.optionChipText, active && styles.optionChipTextActive, disabled && styles.optionChipTextDisabled]}>
                                            {weekCount}W
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={styles.settingsHint}>Admin limit: {scheduleVisibilityWeeks} week(s)</Text>

                        <Text style={styles.settingsSectionTitle}>Show Scope</Text>
                        <View style={styles.optionRow}>
                            <TouchableOpacity
                                style={[styles.optionChip, dayScopeMode === 'day' && styles.optionChipActive]}
                                onPress={() => setDayScopeMode('day')}
                            >
                                <Text style={[styles.optionChipText, dayScopeMode === 'day' && styles.optionChipTextActive]}>Selected Day</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.optionChip, dayScopeMode === 'week' && styles.optionChipActive]}
                                onPress={() => setDayScopeMode('week')}
                            >
                                <Text style={[styles.optionChipText, dayScopeMode === 'week' && styles.optionChipTextActive]}>Entire Week</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.settingsSectionTitle}>Layout</Text>
                        <View style={styles.optionRow}>
                            <TouchableOpacity
                                style={[styles.optionChip, scheduleViewMode === 'grid' && styles.optionChipActive]}
                                onPress={() => setScheduleViewMode('grid')}
                            >
                                <Text style={[styles.optionChipText, scheduleViewMode === 'grid' && styles.optionChipTextActive]}>Grid (Default)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.optionChip, scheduleViewMode === 'cards' && styles.optionChipActive]}
                                onPress={() => setScheduleViewMode('cards')}
                            >
                                <Text style={[styles.optionChipText, scheduleViewMode === 'cards' && styles.optionChipTextActive]}>Cards</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {renderAppointmentModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 14 : 8,
        paddingBottom: 12,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerGreeting: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
    },
    headerStaffName: {
        fontSize: 32,
        fontWeight: '800',
        color: '#ffffff',
    },
    headerAvatarWrap: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 28,
        padding: 2,
    },
    headerAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
    },
    headerAvatarFallback: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatarInitial: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ffffff',
    },
    content: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 28,
    },
    primaryControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    todayAppointmentsButton: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    primaryDayController: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    settingsButton: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    singleDayPill: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    singleDayTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 2,
    },
    singleDaySubtitle: {
        fontSize: 12,
        color: '#6b7280',
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
        padding: 12,
        marginBottom: 12,
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
        padding: 10,
        marginBottom: 12,
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
        marginBottom: 10,
    },
    gridHint: {
        fontSize: 12,
        color: '#6b7280',
    },
    gridNotice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fcd34d',
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
    },
    gridNoticeText: {
        flex: 1,
        fontSize: 12,
        color: '#92400e',
        lineHeight: 17,
    },
    gridTimeline: {
        flexDirection: 'row',
        position: 'relative',
    },
    gridTimeColumn: {
        width: 50,
        paddingTop: 6,
    },
    gridColumnsScrollContent: {
        paddingLeft: 6,
    },
    gridColumnsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    gridDayColumn: {
        position: 'relative',
    },
    gridDayColumnWeek: {
        width: 220,
    },
    gridDayColumnSingle: {
        width: 300,
        flex: 1,
    },
    gridDayHeader: {
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    gridDayHeaderTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        textTransform: 'uppercase',
    },
    gridDayHeaderSub: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
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
    gridTimeOffOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
        borderRadius: 14,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        paddingTop: 6,
        paddingRight: 8,
        zIndex: 0,
    },
    gridTimeOffOverlayText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    gridAppointmentCard: {
        position: 'absolute',
        left: 8,
        right: 8,
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        borderRadius: 14,
        padding: 10,
        overflow: 'hidden',
        zIndex: 2,
    },
    gridAppointmentCardCompact: {
        left: 6,
        right: 6,
        padding: 9,
        borderRadius: 12,
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
    gridAppointmentTitleCompact: {
        fontSize: 12,
    },
    gridAppointmentTime: {
        fontSize: 12,
        color: '#6b7280',
    },
    gridAppointmentTimeCompact: {
        fontSize: 10,
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
    gridAppointmentCustomerCompact: {
        gap: 6,
        marginBottom: 6,
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
    gridAppointmentCustomerNameCompact: {
        fontSize: 11,
    },
    gridAppointmentMeta: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    gridAppointmentMetaCompact: {
        fontSize: 10,
        marginTop: 1,
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
    gridAppointmentPriceCompact: {
        fontSize: 11,
    },
    gridAppointmentAction: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6d28d9',
    },
    gridAppointmentActionCompact: {
        fontSize: 10,
    },
    gridAppointmentUltraCompact: {
        flex: 1,
        justifyContent: 'center',
        gap: 1,
    },
    gridAppointmentUltraCompactTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#1f2937',
    },
    gridAppointmentUltraCompactSub: {
        fontSize: 10,
        fontWeight: '600',
        color: '#374151',
    },
    gridAppointmentUltraCompactMeta: {
        fontSize: 9,
        color: '#6b7280',
        marginTop: 1,
    },
    gridBreakBlock: {
        position: 'absolute',
        left: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderWidth: 1,
        borderColor: '#fbbf24',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        zIndex: 1,
    },
    gridBreakDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#f59e0b',
    },
    gridBreakLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#92400e',
    },
    gridBreakTime: {
        fontSize: 11,
        color: '#b45309',
        marginTop: 1,
    },
    gridLoadingOverlay: {
        position: 'absolute',
        right: 10,
        top: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
        zIndex: 20,
    },
    gridLoadingText: {
        fontSize: 12,
        color: '#6d28d9',
        fontWeight: '700',
    },
    gridInlineEmptyState: {
        position: 'absolute',
        top: 16,
        left: 80,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 10,
        paddingHorizontal: 12,
        zIndex: 18,
    },
    gridInlineEmptyText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '600',
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
    settingsBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.32)',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
    },
    settingsPanel: {
        width: '88%',
        maxWidth: 380,
        height: '100%',
        backgroundColor: '#ffffff',
        paddingHorizontal: 18,
        paddingTop: 54,
        paddingBottom: 24,
    },
    settingsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 22,
    },
    settingsTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#111827',
    },
    settingsSectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4b5563',
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 10,
    },
    settingsHint: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 8,
        marginBottom: 8,
    },
    customSliderTrack: {
        height: 34,
        borderRadius: 999,
        backgroundColor: '#ede9fe',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
    },
    customSliderFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#8B5ADF',
        borderRadius: 999,
    },
    customSliderThumb: {
        position: 'absolute',
        top: '50%',
        marginTop: -11,
        marginLeft: -11,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#6d28d9',
    },
    optionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    optionChip: {
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#ffffff',
    },
    optionChipActive: {
        backgroundColor: '#ede9fe',
        borderColor: '#8B5ADF',
    },
    optionChipDisabled: {
        backgroundColor: '#f3f4f6',
        borderColor: '#e5e7eb',
    },
    optionChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4b5563',
    },
    optionChipTextActive: {
        color: '#5b21b6',
    },
    optionChipTextDisabled: {
        color: '#9ca3af',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.45)',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    centerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    centerContainerCompact: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        marginBottom: 12,
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
