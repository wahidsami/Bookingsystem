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
    DeviceEventEmitter,
    Linking,
    I18nManager,
    GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { canMarkNoShow, canRequestTimeOff, canStartService, canViewBookingNotes, canViewClients } from '../../src/utils/capabilities';
import { Appointment, getAppointmentsForDate, updateAppointmentStatus } from '../../src/services/appointments';
import { BreakWindow, cancelTimeOffRequest, getSchedule, Shift, TimeOff } from '../../src/services/schedule';
import { getImageUrl } from '../../src/services/api';
import { useAppointmentArrivalAlert } from '../../src/hooks/useAppointmentArrivalAlert';
import {
    addRiyadhDays,
    formatRiyadhMonthDay,
    formatRiyadhTime,
    formatRiyadhWeekdayShort,
    getRiyadhDateKey,
    getRiyadhWeekStartKey,
    parseRiyadhDateKey,
    getRiyadhCurrentMinutes,
    formatRiyadhClockTime,
} from '../../src/utils/riyadhDate';
import { BARSPA_COLORS, CAIRO_FONTS } from '../../constants/theme';
import { loadSchedulePreferences, saveSchedulePreferences, MIN_GRID_SCALE, MAX_GRID_SCALE } from '../../src/services/schedulePreferences';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getAppointmentGroupKey = (appointment: Appointment) =>
    appointment.bookingSessionId || appointment.bookingReference || appointment.bookingNumber || appointment.id;

const getAppointmentPrice = (appointment: Appointment) =>
    Number(appointment.service?.finalPrice || appointment.service?.basePrice || appointment.price || 0);

const getAppointmentServiceLabel = (appointment: Appointment, language: string = 'en') =>
    language === 'ar'
        ? (appointment.service?.name_ar || appointment.service?.name_en || 'خدمة')
        : (appointment.service?.name_en || appointment.service?.name_ar || 'Service');

const getAppointmentCardLabel = (appointment: Appointment, groupCount: number, language: string = 'en') =>
    groupCount > 1
        ? (language === 'ar' ? `${groupCount} خدمات` : `${groupCount} services`)
        : getAppointmentServiceLabel(appointment, language);

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

const formatClock = (timeString: string, language: string = 'en') => {
    const minutesTotal = parseClockToMinutes(timeString);
    if (minutesTotal === null) {
        return '--:--';
    }

    const hour24 = Math.floor(minutesTotal / 60);
    const minute = minutesTotal % 60;
    const isPM = hour24 >= 12;
    const ampm = language === 'ar' ? (isPM ? 'م' : 'ص') : (isPM ? 'PM' : 'AM');
    const formattedH = hour24 % 12 || 12;
    return `${formattedH}:${minute.toString().padStart(2, '0')} ${ampm}`;
};

const formatDurationHours = (minutes: number) => `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;

const getAppointmentStatusLabel = (status?: string, t?: any) => {
    const normalized = `${status || ''}`.trim().toLowerCase();
    switch (normalized) {
        case 'pending':
            return t ? t('status.pending') : 'Pending';
        case 'confirmed':
            return t ? t('status.confirmed') : 'Confirmed';
        case 'checked_in':
        case 'arrived':
            return t ? (t('status.confirmed') || 'Arrived') : 'Arrived';
        case 'in_service':
        case 'started':
            return t ? t('schedule.inService') : 'In Service';
        case 'completed':
            return t ? t('status.completed') : 'Completed';
        case 'cancelled':
            return t ? t('status.cancelled') : 'Cancelled';
        case 'no_show':
            return t ? t('status.noShow') : 'No Show';
        default:
            return String(status || 'Pending').replace(/_/g, ' ');
    }
};

const getAppointmentStatusColors = (status?: string) => {
    const normalized = `${status || ''}`.trim().toLowerCase();
    switch (normalized) {
        case 'pending':
        case 'booked':
            return BARSPA_COLORS.status.pending;
        case 'confirmed':
            return BARSPA_COLORS.status.confirmed;
        case 'arrived':
        case 'checked_in':
            return { bg: '#F6F3FE', text: '#6537C0', border: '#E7DDFC' };
        case 'in_service':
        case 'started':
            return BARSPA_COLORS.status.inService;
        case 'completed':
            return BARSPA_COLORS.status.completed;
        case 'cancelled':
            return BARSPA_COLORS.status.cancelled;
        case 'no_show':
            return BARSPA_COLORS.status.noShow;
        default:
            return { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
    }
};

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
    const { t } = useTranslation();
    const { language } = useLanguage();
    const isCurrentRTL = language === 'ar' || language === 'ur';
    // On Android, if I18nManager.isRTL is true, flexDirection: 'row' is natively laid out from right to left.
    // If the active language is English while I18nManager.isRTL is true,
    // or if the active language is Arabic while I18nManager.isRTL is false,
    // we invert with 'row-reverse' so the visual direction strictly matches the active language:
    // English -> earliest day on left, progressing rightwards.
    // Arabic -> earliest day on right, progressing leftwards.
    const shouldReverseRow = isCurrentRTL ? !I18nManager.isRTL : I18nManager.isRTL;
    const weekLayoutDirection = shouldReverseRow ? 'row-reverse' : 'row';
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
    const [dayScopeMode, setDayScopeMode] = useState<'day' | 'week'>('day');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [visibleWeeks, setVisibleWeeks] = useState(1);
    const [gridScalePercent, setGridScalePercent] = useState(42);
    const [settingsSliderWidth, setSettingsSliderWidth] = useState(1);
    const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
    const [displayHours, setDisplayHours] = useState<{ startMinute: number; endMinute: number }>({
        startMinute: 6 * 60,
        endMinute: 22 * 60,
    });
    const [currentRiyadhTime, setCurrentRiyadhTime] = useState(() => ({
        dateKey: getRiyadhDateKey(),
        minutes: getRiyadhCurrentMinutes(),
    }));

    useEffect(() => {
        const updateNow = () => {
            setCurrentRiyadhTime({
                dateKey: getRiyadhDateKey(),
                minutes: getRiyadhCurrentMinutes(),
            });
        };

        const intervalId = setInterval(updateNow, 30000);

        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                updateNow();
            }
        });

        return () => {
            clearInterval(intervalId);
            appStateSubscription.remove();
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            setCurrentRiyadhTime({
                dateKey: getRiyadhDateKey(),
                minutes: getRiyadhCurrentMinutes(),
            });
        }, [])
    );
    const timeOffEnabled = canRequestTimeOff(user);
    const canSeeBookingNotes = canViewBookingNotes(user);
    const canViewClientContext = canViewClients(user);
    const canShowStartAction = canStartService(user);
    const canShowNoShowAction = canMarkNoShow(user);
    const scheduleVisibilityWeeks = Math.min(Math.max(Number(user?.scheduleVisibilityWeeks || 1), 1), 4);
    
    const isDraggingSliderRef = useRef(false);
    const scaleRef = useRef(gridScalePercent);
    scaleRef.current = gridScalePercent;

    // Hydrate persisted schedule preferences scoped to authenticated staff
    useEffect(() => {
        let isMounted = true;
        loadSchedulePreferences(user?.id, scheduleVisibilityWeeks).then((prefs) => {
            if (!isMounted) return;
            if (isDraggingSliderRef.current) return;
            setGridScalePercent(prefs.gridScalePercent);
            setVisibleWeeks(prefs.visibleWeeks);
            setDayScopeMode(prefs.dayScopeMode);
            setScheduleViewMode(prefs.scheduleViewMode);
        });
        return () => {
            isMounted = false;
        };
    }, [user?.id, scheduleVisibilityWeeks]);

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

    const appointmentGroups = useMemo(() => {
        const grouped = new Map<string, Appointment[]>();
        appointments.forEach((appointment) => {
            const key = getAppointmentGroupKey(appointment);
            const current = grouped.get(key) || [];
            current.push(appointment);
            grouped.set(key, current);
        });

        return Array.from(grouped.entries())
            .map(([key, items]) => {
                const sortedItems = [...items].sort((left, right) => {
                    const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
                    const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
                    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
                    return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
                });
                return {
                    key,
                    items: sortedItems,
                    primary: sortedItems[0],
                    count: sortedItems.length,
                    totalPrice: sortedItems.reduce((sum, item) => sum + getAppointmentPrice(item), 0),
                };
            })
            .sort((left, right) => new Date(left.primary.startTime).getTime() - new Date(right.primary.startTime).getTime());
    }, [appointments]);

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
            if (data.displayHours && Number.isFinite(data.displayHours.startMinute) && Number.isFinite(data.displayHours.endMinute)) {
                setDisplayHours({
                    startMinute: Math.max(0, Math.min(23 * 60, Math.floor(data.displayHours.startMinute))),
                    endMinute: Math.max(60, Math.min(24 * 60, Math.ceil(data.displayHours.endMinute))),
                });
            }
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
            const updated = await updateAppointmentStatus(id, newStatus);
            await loadAppointmentsForSelectedDate(true);
            const hasOutstanding = Boolean((updated as any)?.hasOutstandingBalance);
            const breakdown = (updated as any)?.financialBreakdown;

            if (newStatus === 'completed' && hasOutstanding && breakdown?.outstandingAmount > 0) {
                Alert.alert(
                    isCurrentRTL ? 'تم إكمال الخدمة (رصيد مستحق)' : 'Service Completed (Outstanding Balance)',
                    isCurrentRTL
                        ? `تم تأكيد إكمال الخدمة بنجاح. يوجد رصيد متبقٍ على العميل قدره ${breakdown.outstandingAmount} ${breakdown.currency || 'SAR'} بانتظار التحصيل في الاستقبال.`
                        : `Service completed successfully. An outstanding customer balance of ${breakdown.outstandingAmount} ${breakdown.currency || 'SAR'} remains to be collected at reception.`
                );
            } else {
                Alert.alert(
                    newStatus === 'started' ? 'Service started' : newStatus === 'completed' ? 'Service completed' : 'Marked as no-show',
                    newStatus === 'started'
                        ? 'The appointment is now in service.'
                        : newStatus === 'completed'
                            ? 'The appointment was completed successfully.'
                            : 'The appointment was marked as no-show.'
                );
            }
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
        const subscription = DeviceEventEmitter.addListener('staff_appointment_assigned', () => {
            console.log('Push notification received: refreshing schedule');
            loadData();
            if (dayScopeMode === 'week') {
                loadAppointmentsForVisibleWeek();
            } else {
                loadAppointmentsForSelectedDate(true);
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
        const scrollIndex = shouldReverseRow ? (weekDays.length - 1 - selectedIndex) : selectedIndex;
        weekGridScrollRef.current.scrollTo({
            x: scrollIndex * weekSnapInterval,
            animated: true,
        });
    }, [dayScopeMode, selectedDateKey, weekDays, weekSnapInterval, shouldReverseRow]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
        if (dayScopeMode === 'week') {
            loadAppointmentsForVisibleWeek();
        } else {
            loadAppointmentsForSelectedDate();
        }
    };

    const computeScaleFromLocationX = useCallback((locationX: number): number => {
        if (!Number.isFinite(locationX)) return scaleRef.current;
        const thumbRadius = 11;
        const travelDistance = Math.max(1, settingsSliderWidth - (thumbRadius * 2));
        const clampedLocation = clamp(locationX - thumbRadius, 0, travelDistance);
        const ratio = clampedLocation / travelDistance;
        return Math.round(MIN_GRID_SCALE + (ratio * (MAX_GRID_SCALE - MIN_GRID_SCALE)));
    }, [settingsSliderWidth]);

    const handleSliderGrant = useCallback((event: GestureResponderEvent) => {
        isDraggingSliderRef.current = true;
        const locX = event?.nativeEvent?.locationX ?? 0;
        const nextScale = computeScaleFromLocationX(locX);
        setGridScalePercent(nextScale);
        scaleRef.current = nextScale;
    }, [computeScaleFromLocationX]);

    const handleSliderMove = useCallback((event: GestureResponderEvent) => {
        if (!isDraggingSliderRef.current) return;
        const locX = event?.nativeEvent?.locationX ?? 0;
        const nextScale = computeScaleFromLocationX(locX);
        setGridScalePercent(nextScale);
        scaleRef.current = nextScale;
    }, [computeScaleFromLocationX]);

    const handleSliderRelease = useCallback((event: GestureResponderEvent) => {
        isDraggingSliderRef.current = false;
        const locX = event?.nativeEvent?.locationX ?? 0;
        const finalScale = computeScaleFromLocationX(locX);
        setGridScalePercent(finalScale);
        scaleRef.current = finalScale;
        void saveSchedulePreferences({ gridScalePercent: finalScale }, user?.id);
    }, [computeScaleFromLocationX, user?.id]);

    const handleSliderTerminate = useCallback(() => {
        if (!isDraggingSliderRef.current) return;
        isDraggingSliderRef.current = false;
        void saveSchedulePreferences({ gridScalePercent: scaleRef.current }, user?.id);
    }, [user?.id]);

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

    const handleWeekGridMomentumEnd = (offsetX: number) => {
        if (dayScopeMode !== 'week') {
            return;
        }
        const approxIndex = Math.round(offsetX / weekSnapInterval);
        const clampedIndex = clamp(approxIndex, 0, weekDays.length - 1);
        const dayIndex = shouldReverseRow ? (weekDays.length - 1 - clampedIndex) : clampedIndex;
        const dayKey = weekDays[dayIndex];
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
            t('schedule.cancelRequest', 'Cancel Request'),
            t('schedule.cancelRequestConfirm', 'Do you want to cancel this upcoming time off request?'),
            [
                { text: t('common.no', 'No'), style: 'cancel' },
                {
                    text: 'Yes',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelTimeOffRequest(id);
                            loadData();
                        } catch (error: any) {
                            Alert.alert(
                                t('common.error', 'Error'),
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

    const upcomingTimeOff = timeOff
        .filter((item) => item.startDate > getRiyadhDateKey())
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const activeTimeOff = timeOff
        .filter((item) => item.startDate <= getRiyadhDateKey() && item.endDate >= getRiyadhDateKey())
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const pastTimeOff = timeOff
        .filter((item) => item.endDate < getRiyadhDateKey())
        .sort((a, b) => b.endDate.localeCompare(a.endDate));

    const formatTime = (value: string) => formatRiyadhTime(value, language);

    const getUrgencyInfo = (item: Appointment): { label: string; color: string; background: string; priority: number } => {
        if (item.status === 'started') {
            return { label: t('schedule.inService', 'In Service'), color: '#92400e', background: '#fef3c7', priority: 0 };
        }

        if (['completed', 'no_show', 'cancelled'].includes(item.status)) {
            return { label: t('schedule.closed', 'Closed'), color: '#4b5563', background: '#f3f4f6', priority: 4 };
        }

        const startTimestamp = new Date(item.startTime).getTime();
        if (!Number.isFinite(startTimestamp)) {
            return { label: t('schedule.upcoming', 'Upcoming'), color: '#1d4ed8', background: '#dbeafe', priority: 3 };
        }

        const minutesToStart = Math.round((startTimestamp - Date.now()) / 60000);
        if (minutesToStart < -10) {
            return { label: t('schedule.late', 'Late'), color: '#b91c1c', background: '#fee2e2', priority: 1 };
        }
        if (minutesToStart <= 30) {
            return { label: t('schedule.startingSoon', 'Starting Soon'), color: '#9a3412', background: '#ffedd5', priority: 2 };
        }

        return { label: 'Upcoming', color: '#1d4ed8', background: '#dbeafe', priority: 3 };
    };

    const getMinutesFromClock = (timeString: string) => {
        return parseClockToMinutes(timeString) ?? 0;
    };

    const getRiyadhMinutes = (value: string) => {
        if (!value) return null;

        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
            return getMinutesFromClock(value);
        }

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
        const gridStartMinute = Math.max(0, Math.min((23 * 60), displayHours.startMinute));
        const gridEndMinute = Math.max(gridStartMinute + 60, Math.min((24 * 60), displayHours.endMinute));
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
        const isCurrentTimeInRange =
            currentRiyadhTime.minutes >= gridStartMinute && currentRiyadhTime.minutes <= gridEndMinute;
        const currentTimeTopOffset = Math.max(
            0,
            ((currentRiyadhTime.minutes - gridStartMinute) / slotMinutes) * rowHeight
        );
        const formattedCurrentTime = formatRiyadhClockTime(currentRiyadhTime.minutes, language);

        return (
            <View style={styles.gridCard}>
                <View style={styles.gridHeaderRow}>
                    <Text style={styles.sectionTitle}>{dayScopeMode === 'week' ? t('schedule.weekGrid') : t('schedule.dayGrid')}</Text>
                    <Text style={styles.gridHint}>
                        {t('schedule.appointmentsCount', { count: totalAppointmentsInScope })}
                    </Text>
                </View>

                <View style={[styles.gridTimeline, { height: gridHeight, flexDirection: weekLayoutDirection }]}>
                        <View style={styles.gridTimeColumn}>
                            {Array.from({ length: totalRows }, (_, index) => {
                                const minuteMark = gridStartMinute + (index * slotMinutes);
                                const hours = Math.floor(minuteMark / 60);
                                const minutes = minuteMark % 60;
                                const labelHour = hours % 12 || 12;
                                const ampm = language === 'ar' ? (hours >= 12 ? 'م' : 'ص') : (hours >= 12 ? 'PM' : 'AM');

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
                            <View style={[styles.gridColumnsRow, { flexDirection: weekLayoutDirection }]}>
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
                                                    <Text style={styles.gridDayHeaderTitle}>{formatRiyadhWeekdayShort(dayKey, language)}</Text>
                                                    <Text style={styles.gridDayHeaderSub}>{formatRiyadhMonthDay(dayKey, language)}</Text>
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
                                                        <Text style={styles.gridTimeOffOverlayText}>{t('schedule.timeOff')}</Text>
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
                                                    const serviceLabel = getAppointmentServiceLabel(appointment, language);
                                                    const customerLabel = `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.trim() || t('common.client', 'Client');
                                                    const compactHeader = `${formatTime(appointment.startTime)} • ${isStarted ? t('schedule.inService') : t('schedule.upcoming')}`;
                                                    const group = appointmentGroups.find((item) => item.items.some((entry) => entry.id === appointment.id));
                                                    const groupCount = group?.count || 1;

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
                                                                                {groupCount > 1 ? `${serviceLabel} ${t('schedule.moreServices', { count: groupCount - 1 })}` : serviceLabel}
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
                                                                                {getAppointmentStatusLabel(appointment.status, t)}{appointment.paymentStatus ? ` • ${appointment.paymentStatus.replace(/_/g, ' ')}` : ''}
                                                                            </Text>
                                                                        </View>
                                                                    </View>

                                                                    {!compactGridCards ? (
                                                                        <View style={styles.gridAppointmentFooter}>
                                                                            <Text style={[styles.gridAppointmentAction, compactGridCards && styles.gridAppointmentActionCompact, isStarted && { color: '#047857' }]} numberOfLines={1}>
                                                                                {groupCount > 1 ? t('schedule.servicesCount', { count: groupCount }) : (isStarted ? t('schedule.inService') : t('schedule.upcoming'))}
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
                                                                    {breakItem.label || t('schedule.blockedTime')}
                                                                </Text>
                                                                <Text style={styles.gridBreakTime} numberOfLines={1}>
                                                                    {formatTime(breakItem.startTime)} - {formatTime(breakItem.endTime)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })}

                                                {dayKey === currentRiyadhTime.dateKey && isCurrentTimeInRange ? (
                                                    <View
                                                        pointerEvents="none"
                                                        style={[styles.currentTimeContainer, { top: currentTimeTopOffset }]}
                                                        accessibilityRole="text"
                                                        accessibilityLabel={`${t('schedule.now', isCurrentRTL ? 'الآن' : 'NOW')}: ${formattedCurrentTime}`}
                                                    >
                                                        <View style={styles.currentTimeLine} />
                                                        <View
                                                            style={[
                                                                styles.currentTimeBadgeRow,
                                                                isCurrentRTL ? styles.currentTimeBadgeRowRTL : styles.currentTimeBadgeRowLTR,
                                                            ]}
                                                        >
                                                            <View style={styles.currentTimeDot} />
                                                            <View style={styles.currentTimePill}>
                                                                <Text style={styles.currentTimePillText}>
                                                                    {t('schedule.now', isCurrentRTL ? 'الآن' : 'NOW')} • {formattedCurrentTime}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    {isGridLoading ? (
                        <View style={styles.gridLoadingOverlay}>
                            <ActivityIndicator size="small" color="#6537C0" />
                            <Text style={styles.gridLoadingText}>{t('schedule.updatingCalendar')}</Text>
                        </View>
                    ) : null}

                    {!hasTimelineItems ? (
                        <View style={styles.gridInlineEmptyState}>
                            <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                            <Text style={styles.gridInlineEmptyText}>{t('schedule.emptyGridScope')}</Text>
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
                    <ActivityIndicator size="large" color={BARSPA_COLORS.royalPurple} />
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
                        <Text style={styles.emptyTitle}>{t('schedule.noScheduleForDay')}</Text>
                        <Text style={styles.emptySubtitle}>{t('schedule.noScheduleSubtitle')}</Text>
                    </View>
                ) : null}

                {shiftsForSelectedDate.map((shift) => (
                    <View key={shift.id} style={styles.shiftCard}>
                        <View style={styles.shiftTopRow}>
                            <View>
                                <Text style={styles.shiftTime}>
                                    {formatClock(shift.startTime, language)} - {formatClock(shift.endTime, language)}
                                </Text>
                                <Text style={styles.shiftLabel}>
                                    {shift.label || t('schedule.regularHours')}
                                </Text>
                            </View>
                            <View style={styles.shiftBadges}>
                                <View style={[styles.badge, shift.type === 'specific' ? styles.badgeSpecific : styles.badgeRecurring]}>
                                    <Text style={[styles.badgeText, shift.type === 'specific' ? styles.badgeSpecificText : styles.badgeRecurringText]}>
                                        {shift.type === 'specific' ? t('schedule.override') : t('schedule.recurring')}
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
                    <View style={styles.stitchBlockedSection}>
                        <Text style={styles.sectionTitle}>{t('schedule.breaks', 'Blocked Intervals & Breaks')}</Text>
                        {breaksForSelectedDate.map((item) => (
                            <View key={item.id} style={styles.stitchBlockedCard}>
                                <View style={styles.stitchBlockedLeft}>
                                    <View style={styles.stitchBlockedIconWrap}>
                                        <Ionicons name="lock-closed-outline" size={16} color="#79747E" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.stitchBlockedLabel}>{item.label || t('schedule.breakLabel', 'Blocked Time')}</Text>
                                        <Text style={styles.stitchBlockedTime}>
                                            {formatClock(item.startTime, language)} - {formatClock(item.endTime, language)} ({formatDurationHours(minutesBetween(item.startTime, item.endTime))})
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.stitchBlockedBadge}>
                                    <Text style={styles.stitchBlockedBadgeText}>{t('schedule.blocked', 'BLOCKED')}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : null}

                {timeOffForSelectedDate.length > 0 ? (
                    <View style={styles.timeOffSection}>
                        <Text style={styles.sectionTitle}>{t('schedule.timeOff')}</Text>
                        {timeOffForSelectedDate.map((item) => (
                            <View key={item.id} style={styles.timeOffCard}>
                                <View style={styles.timeOffHeader}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.timeOffStatusText, { color: item.isApproved ? '#10b981' : '#f59e0b' }]}>
                                        {item.isApproved ? t('schedule.approved').toUpperCase() : t('schedule.pendingReview').toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.shiftLabel}>{item.startDate} to {item.endDate}</Text>
                                {item.reason ? <Text style={styles.notesText}>{item.reason}</Text> : null}
                            </View>
                        ))}
                    </View>
                ) : null}

                <View style={styles.appointmentsSection}>
                    <Text style={styles.sectionTitle}>{t('schedule.appointments')}</Text>
                    {appointmentsLoading ? (
                        <View style={styles.infoCard}>
                            <ActivityIndicator size="small" color="#6537C0" />
                            <Text style={styles.infoCardText}>{t('schedule.loadingAppointments')}</Text>
                        </View>
                    ) : appointmentGroups.length === 0 ? (
                        <View style={styles.infoCard}>
                            <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                            <Text style={styles.infoCardText}>{t('schedule.noAppointmentsForDay')}</Text>
                        </View>
                    ) : (
                        appointmentGroups.map((group) => {
                            const appointment = group.primary;
                            const isStarted = appointment.status === 'started';
                            const isCompleted = appointment.status === 'completed' || appointment.status === 'no_show' || appointment.status === 'cancelled';
                            const groupedCount = group.count || 1;
                            const statusColors = getAppointmentStatusColors(appointment.status);
                            const customerName = `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.trim() || t('common.client', 'Client');

                            let accentStripeColor = '#6537C0';
                            if (appointment.status === 'confirmed') accentStripeColor = '#1D035F';
                            else if (appointment.status === 'started') accentStripeColor = '#6537C0';
                            else if (appointment.status === 'completed') accentStripeColor = '#059669';
                            else if (appointment.status === 'cancelled' || appointment.status === 'no_show') accentStripeColor = '#DC2626';
                            else if (appointment.status === 'pending') accentStripeColor = '#D97706';

                            return (
                                <TouchableOpacity
                                    key={group.key}
                                    style={[
                                        styles.stitchCard,
                                        isCompleted && styles.stitchCardCompleted,
                                    ]}
                                    activeOpacity={0.88}
                                    onPress={() => setActiveAppointment(appointment)}
                                >
                                    {/* 4px Status Accent Stripe */}
                                    <View style={[styles.stitchCardStripe, { backgroundColor: accentStripeColor }]} />

                                    <View style={styles.stitchCardContent}>
                                        {/* Top Row: Customer Name, Duration pill, Status pill */}
                                        <View style={styles.stitchCardTopRow}>
                                            <View style={styles.stitchCustomerNameWrap}>
                                                <Text style={styles.stitchCustomerName} numberOfLines={1}>
                                                    {customerName}
                                                </Text>
                                            </View>
                                            <View style={styles.stitchCardBadges}>
                                                <View style={styles.stitchDurationBadge}>
                                                    <Text style={styles.stitchDurationText}>
                                                        {appointment.duration || appointment.service?.duration || 0}m
                                                    </Text>
                                                </View>
                                                <View style={[styles.stitchStatusBadge, { backgroundColor: statusColors.bg }]}>
                                                    <Text style={[styles.stitchStatusBadgeText, { color: statusColors.text }]}>
                                                        {getAppointmentStatusLabel(appointment.status, t)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Middle: Service Title */}
                                        <Text style={styles.stitchServiceTitle} numberOfLines={1}>
                                            {getAppointmentCardLabel(appointment, groupedCount, language)}
                                        </Text>
                                        {groupedCount > 1 ? (
                                            <Text style={styles.stitchMultiServiceHint} numberOfLines={1}>
                                                {t('schedule.multiServiceHint', `${groupedCount} services included`)}
                                            </Text>
                                        ) : null}

                                        {/* Bottom Row: Time, Staff/Assignment, and Bold Purple Price */}
                                        <View style={styles.stitchCardBottomRow}>
                                            <View style={styles.stitchCardMetaLeft}>
                                                <View style={styles.stitchMetaChip}>
                                                    <Ionicons name="time-outline" size={13} color="#49398B" style={{ marginRight: 4 }} />
                                                    <Text style={styles.stitchMetaChipText}>
                                                        {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                                                    </Text>
                                                </View>
                                                <View style={styles.stitchMetaChip}>
                                                    <Ionicons name="location-outline" size={13} color="#49398B" style={{ marginRight: 4 }} />
                                                    <Text style={styles.stitchMetaChipText}>
                                                        {appointment.assignmentMode === 'customer_selected' ? t('schedule.customerPickedStaff', 'Client Selected') : t('schedule.autoAssigned', 'Direct Assignment')}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Notes snippet if present */}
                                        {canSeeBookingNotes && appointment.notes ? (
                                            <View style={styles.stitchCardNotes}>
                                                <Ionicons name="document-text-outline" size={12} color="#6B7280" style={{ marginRight: 4 }} />
                                                <Text style={styles.stitchCardNotesText} numberOfLines={1}>
                                                    {appointment.notes}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {/* Quick inline actions */}
                                        {!isCompleted && appointment.status !== 'cancelled' ? (
                                            <View style={styles.stitchQuickActions}>
                                                {!isStarted && canShowStartAction ? (
                                                    <TouchableOpacity
                                                        style={[styles.stitchQuickBtnPrimary, updatingId === appointment.id && { opacity: 0.6 }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleAppointmentStatusUpdate(appointment.id, 'started');
                                                        }}
                                                        disabled={!!updatingId}
                                                    >
                                                        {updatingId === appointment.id
                                                            ? <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
                                                            : <Ionicons name="play" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                                                        <Text style={styles.stitchQuickBtnTextWhite}>{t('schedule.start', 'Start')}</Text>
                                                    </TouchableOpacity>
                                                ) : isStarted ? (
                                                    <TouchableOpacity
                                                        style={[styles.stitchQuickBtnSuccess, updatingId === appointment.id && { opacity: 0.6 }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleAppointmentStatusUpdate(appointment.id, 'completed');
                                                        }}
                                                        disabled={!!updatingId}
                                                    >
                                                        {updatingId === appointment.id
                                                            ? <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
                                                            : <Ionicons name="checkmark-done" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                                                        <Text style={styles.stitchQuickBtnTextWhite}>{t('schedule.complete', 'Complete')}</Text>
                                                    </TouchableOpacity>
                                                ) : null}

                                                {canShowNoShowAction ? (
                                                    <TouchableOpacity
                                                        style={[styles.stitchQuickBtnSecondary, updatingId === appointment.id && { opacity: 0.4 }]}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleAppointmentStatusUpdate(appointment.id, 'no-show');
                                                        }}
                                                        disabled={!!updatingId}
                                                    >
                                                        <Text style={styles.stitchQuickBtnTextSecondary}>{t('schedule.noShow', 'No Show')}</Text>
                                                    </TouchableOpacity>
                                                ) : null}
                                            </View>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
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
                    <Text style={styles.infoCardText}>{t('schedule.noItems')}</Text>
                </View>
            ) : (
                items.map((item) => (
                    <View key={item.id} style={styles.timeOffCard}>
                        <View style={styles.timeOffHeader}>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                            </View>
                            <Text style={[styles.timeOffStatusText, { color: item.isApproved ? '#10b981' : '#f59e0b' }]}>
                                {item.isApproved ? t('schedule.approved', 'Approved') : t('schedule.pendingReview', 'Pending')}
                            </Text>
                        </View>
                        <Text style={styles.shiftLabel}>
                            {item.startDate} to {item.endDate} • {t('schedule.daySpan', { days: getDateSpanDays(item.startDate, item.endDate) ?? '-' })}
                        </Text>
                        {item.reason ? <Text style={styles.notesText}>{item.reason}</Text> : null}
                        {allowCancel ? (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancelTimeOff(item.id)}
                            >
                                <Ionicons name="close-circle-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                <Text style={styles.cancelButtonText}>{t('schedule.cancelRequest')}</Text>
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
        const customerFullName = `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.trim() || t('common.client', 'Client');
        const customerPhone = appointment.user?.phone || '';
        const group = appointmentGroups.find((item) => item.items.some((entry) => entry.id === appointment.id));
        const isStarted = appointment.status === 'started';
        const isCompleted = appointment.status === 'completed' || appointment.status === 'no_show' || appointment.status === 'cancelled';
        const statusColors = getAppointmentStatusColors(appointment.status);

        const handleCallPhone = () => {
            if (!customerPhone) return;
            const cleaned = customerPhone.replace(/[^\d+]/g, '');
            Linking.openURL(`tel:${cleaned}`).catch((err) => {
                console.warn('Could not open phone dialer', err);
            });
        };

        return (
            <Modal
                visible={Boolean(activeAppointment)}
                transparent
                animationType="slide"
                onRequestClose={() => setActiveAppointment(null)}
            >
                <Pressable style={styles.stitchModalBackdrop} onPress={() => setActiveAppointment(null)}>
                    <Pressable style={styles.stitchModalSheet} onPress={(event) => event.stopPropagation()}>
                        {/* Drag Handle Indicator */}
                        <View style={styles.stitchDragHandle} />

                        {/* Customer Identity Row */}
                        <View style={styles.stitchModalCustomerRow}>
                            <View style={styles.stitchModalCustomerLeft}>
                                <View style={styles.stitchModalAvatar}>
                                    {appointment.user?.profileImage ? (
                                        <Image source={{ uri: getImageUrl(appointment.user.profileImage) }} style={styles.stitchModalAvatarImg} />
                                    ) : (
                                        <Text style={styles.stitchModalAvatarText}>{customerInitial}</Text>
                                    )}
                                </View>
                                <View style={styles.stitchModalCustomerDetails}>
                                    <View style={styles.stitchModalNameAndStatus}>
                                        <Text style={styles.stitchModalCustomerName} numberOfLines={1}>{customerFullName}</Text>
                                        <View style={[styles.stitchModalStatusPill, { backgroundColor: statusColors.bg }]}>
                                            <Text style={[styles.stitchModalStatusPillText, { color: statusColors.text }]}>
                                                {getAppointmentStatusLabel(appointment.status, t)}
                                            </Text>
                                        </View>
                                    </View>
                                    {customerPhone ? (
                                        <TouchableOpacity
                                            style={styles.stitchModalPhoneRow}
                                            onPress={handleCallPhone}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="call-outline" size={13} color="#49398B" style={{ marginRight: 4 }} />
                                            <Text style={styles.stitchModalPhoneText}>{customerPhone}</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={styles.stitchModalBookingSub}>
                                            Booking #{appointment.bookingNumber?.slice(0, 8) || appointment.id.slice(0, 8)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.stitchModalCloseBtn}
                                onPress={() => setActiveAppointment(null)}
                                accessibilityLabel={t('common.close', 'Close')}
                            >
                                <Ionicons name="close" size={22} color="#79747E" />
                            </TouchableOpacity>
                        </View>

                        {/* Service Structural Card */}
                        <View style={styles.stitchServiceStructuralCard}>
                            <View style={styles.stitchServiceStructuralTop}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.stitchServiceStructuralName}>
                                        {getAppointmentServiceLabel(appointment, language)}
                                    </Text>
                                    <Text style={styles.stitchServiceStructuralDuration}>
                                        {appointment.duration || appointment.service?.duration || 0} mins • {appointment.assignmentMode === 'customer_selected' ? t('schedule.customerPickedStaff', 'Client Selected') : t('schedule.autoAssigned', 'Direct Assignment')}
                                    </Text>
                                </View>
                            </View>

                            {/* Multi-Service Breakdown (if group > 1) */}
                            {group && group.count > 1 ? (
                                <View style={styles.stitchMultiServiceBox}>
                                    <Text style={styles.stitchMultiServiceHeader}>
                                        {t('schedule.servicesCount', { count: group.count, defaultValue: `${group.count} Services in Session` })}
                                    </Text>
                                    {group.items.map((item, idx) => (
                                        <View key={item.id} style={styles.stitchMultiServiceItemRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.stitchMultiServiceItemName}>
                                                    {idx + 1}. {getAppointmentServiceLabel(item, language)}
                                                </Text>
                                                <Text style={styles.stitchMultiServiceItemTime}>
                                                    {formatTime(item.startTime)} - {formatTime(item.endTime)}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            {/* 3-Column Micro-Strip: Time, Staff, Room */}
                            <View style={styles.stitchMicroStripContainer}>
                                <View style={styles.stitchMicroStripColumn}>
                                    <Text style={styles.stitchMicroStripLabel}>{t('schedule.time', 'Time')}</Text>
                                    <Text style={styles.stitchMicroStripValue} numberOfLines={1}>{formatTime(appointment.startTime)}</Text>
                                </View>
                                <View style={styles.stitchMicroStripDivider} />
                                <View style={styles.stitchMicroStripColumn}>
                                    <Text style={styles.stitchMicroStripLabel}>{t('schedule.staff', 'Staff')}</Text>
                                    <Text style={styles.stitchMicroStripValue} numberOfLines={1}>
                                        {user?.name || 'Staff'}
                                    </Text>
                                </View>
                                <View style={styles.stitchMicroStripDivider} />
                                <View style={styles.stitchMicroStripColumn}>
                                    <Text style={styles.stitchMicroStripLabel}>{t('schedule.room', 'Room')}</Text>
                                    <Text style={styles.stitchMicroStripValue} numberOfLines={1}>Suite 1</Text>
                                </View>
                            </View>
                        </View>

                        {/* Special Instructions / Notes Card */}
                        {canSeeBookingNotes && appointment.notes ? (
                            <View style={styles.stitchNotesCard}>
                                <Ionicons name="information-circle-outline" size={18} color="#6537C0" style={{ marginTop: 2, marginRight: 8 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.stitchNotesTitle}>{t('schedule.clientNotes', 'Client Notes')}</Text>
                                    <Text style={styles.stitchNotesBody}>{appointment.notes}</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Booking Session / Reference (if present) */}
                        {appointment.bookingSessionId || appointment.bookingReference ? (
                            <View style={styles.stitchBookingSessionBadge}>
                                <Text style={styles.stitchBookingSessionLabel}>{t('schedule.bookingSession', 'Booking Session')}:</Text>
                                <Text style={styles.stitchBookingSessionValue}>
                                    {appointment.bookingReference || appointment.bookingNumber || appointment.id.slice(0, 8)}
                                </Text>
                            </View>
                        ) : null}

                        {/* Action Buttons */}
                        <View style={styles.stitchModalActionsArea}>
                            {!isCompleted && appointment.status !== 'cancelled' ? (
                                <>
                                    {!isStarted && canShowStartAction ? (
                                        <TouchableOpacity
                                            style={[styles.stitchModalBtnPrimary, updatingId === appointment.id && { opacity: 0.6 }]}
                                            onPress={() => handleAppointmentStatusUpdate(appointment.id, 'started')}
                                            disabled={!!updatingId}
                                        >
                                            {updatingId === appointment.id
                                                ? <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                                                : <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />}
                                            <Text style={styles.stitchModalBtnPrimaryText}>{t('schedule.startAppointment', 'Start Appointment')}</Text>
                                        </TouchableOpacity>
                                    ) : isStarted ? (
                                        <TouchableOpacity
                                            style={[styles.stitchModalBtnSuccess, updatingId === appointment.id && { opacity: 0.6 }]}
                                            onPress={() => handleAppointmentStatusUpdate(appointment.id, 'completed')}
                                            disabled={!!updatingId}
                                        >
                                            {updatingId === appointment.id
                                                ? <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                                                : <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />}
                                            <Text style={styles.stitchModalBtnPrimaryText}>{t('schedule.completeAppointment', 'Complete Appointment')}</Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    <View style={styles.stitchModalSecondaryGrid}>
                                        {canShowNoShowAction ? (
                                            <TouchableOpacity
                                                style={[styles.stitchModalBtnSecondary, updatingId === appointment.id && { opacity: 0.4 }]}
                                                onPress={() => handleAppointmentStatusUpdate(appointment.id, 'no-show')}
                                                disabled={!!updatingId}
                                            >
                                                <Ionicons name="person-remove-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                                                <Text style={styles.stitchModalBtnSecondaryTextRed}>{t('schedule.noShow', 'Mark as No Show')}</Text>
                                            </TouchableOpacity>
                                        ) : null}

                                        {canViewClientContext && appointment.user?.id ? (
                                            <TouchableOpacity
                                                style={styles.stitchModalBtnProfile}
                                                onPress={() => {
                                                    setActiveAppointment(null);
                                                    router.push((`/client/${appointment.user?.id}` as any));
                                                }}
                                            >
                                                <Ionicons name="person-circle-outline" size={16} color="#6537C0" style={{ marginRight: 6 }} />
                                                <Text style={styles.stitchModalBtnProfileText}>{t('schedule.viewProfile', 'View Profile')}</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </>
                            ) : (
                                <View style={styles.stitchModalCompletedNotice}>
                                    <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 8 }} />
                                    <Text style={styles.stitchModalCompletedText}>
                                        {t('schedule.appointmentClosed', 'This appointment is completed and closed.')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    };

    
    const getFormattedBookingsCount = (count: number) => {
        if (language === 'ar') {
            if (count === 0) return 'لا توجد حجوزات';
            if (count === 1) return 'حجز واحد';
            if (count === 2) return 'حجزان';
            if (count >= 3 && count <= 10) return `${count} حجوزات`;
            return `${count} حجز`;
        }
        return count === 1 ? '1 Booking' : `${count} Bookings`;
    };

    const getFormattedBlocksCount = (count: number) => {
        if (language === 'ar') {
            if (count === 0) return 'لا فترات محجوبة';
            if (count === 1) return 'فترة محجوبة واحدة';
            if (count === 2) return 'فترتان محجوبتان';
            if (count >= 3 && count <= 10) return `${count} فترات محجوبة`;
            return `${count} فترة محجوبة`;
        }
        return count === 1 ? '1 Block' : `${count} Block(s)`;
    };

return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BARSPA_COLORS.royalPurple]} />}
            >
                {appointmentAlert && (
                    <TouchableOpacity style={styles.alertBanner} activeOpacity={0.9} onPress={clearAlert}>
                        <View style={styles.alertIconWrap}>
                            <Ionicons name="notifications-outline" size={18} color="#6537C0" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.alertTitle}>{appointmentAlert.title}</Text>
                            <Text style={styles.alertBody} numberOfLines={2}>{appointmentAlert.body}</Text>
                        </View>
                        <Ionicons name="close" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                )}

                {/* Stitch Calendar & Navigation Controls */}
                <View style={[styles.stitchNavHeader, { flexDirection: weekLayoutDirection }]}>
                    <View style={[styles.stitchNavLeft, { flexDirection: weekLayoutDirection }]}>
                        <TouchableOpacity
                            style={[
                                styles.stitchNavIconButton,
                                (dayScopeMode === 'week' ? !canGoPrev : !canGoPrevDay) && styles.stitchNavIconButtonDisabled
                            ]}
                            onPress={() => {
                                if (dayScopeMode === 'week') {
                                    canGoPrev && setWeekOffset((current) => current - 1);
                                } else {
                                    moveSelectedDay(-1);
                                }
                            }}
                            disabled={dayScopeMode === 'week' ? !canGoPrev : !canGoPrevDay}
                            accessibilityLabel={t('schedule.previous', 'Previous')}
                        >
                            <Ionicons
                                name={isCurrentRTL ? "chevron-forward" : "chevron-back"}
                                size={20}
                                color={(dayScopeMode === 'week' ? canGoPrev : canGoPrevDay) ? BARSPA_COLORS.royalPurple : '#9CA3AF'}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.stitchNavIconButton,
                                (dayScopeMode === 'week' ? !canGoNext : !canGoNextDay) && styles.stitchNavIconButtonDisabled
                            ]}
                            onPress={() => {
                                if (dayScopeMode === 'week') {
                                    canGoNext && setWeekOffset((current) => current + 1);
                                } else {
                                    moveSelectedDay(1);
                                }
                            }}
                            disabled={dayScopeMode === 'week' ? !canGoNext : !canGoNextDay}
                            accessibilityLabel={t('schedule.next', 'Next')}
                        >
                            <Ionicons
                                name={isCurrentRTL ? "chevron-back" : "chevron-forward"}
                                size={20}
                                color={(dayScopeMode === 'week' ? canGoNext : canGoNextDay) ? BARSPA_COLORS.royalPurple : '#9CA3AF'}
                            />
                        </TouchableOpacity>

                        <Text style={styles.stitchNavDateTitle}>
                            {dayScopeMode === 'week'
                                ? `${formatRiyadhMonthDay(weekStartKey, language)} - ${formatRiyadhMonthDay(addRiyadhDays(weekStartKey, 6), language)}`
                                : formatRiyadhMonthDay(selectedDateKey, language)}
                        </Text>

                        <TouchableOpacity
                            style={styles.stitchTodayPill}
                            onPress={jumpToTodayInSchedule}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.stitchTodayPillText}>{t('common.today', 'Today')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.stitchNavRight, { flexDirection: weekLayoutDirection }]}>
                        <View style={[styles.stitchSegmentedToggle, { flexDirection: weekLayoutDirection }]}>
                            <TouchableOpacity
                                style={[styles.stitchSegmentedBtn, dayScopeMode === 'day' && styles.stitchSegmentedBtnActive]}
                                onPress={() => setDayScopeMode('day')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.stitchSegmentedBtnText, dayScopeMode === 'day' && styles.stitchSegmentedBtnTextActive]}>
                                    {t('schedule.day', 'Day')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.stitchSegmentedBtn, dayScopeMode === 'week' && styles.stitchSegmentedBtnActive]}
                                onPress={() => setDayScopeMode('week')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.stitchSegmentedBtnText, dayScopeMode === 'week' && styles.stitchSegmentedBtnTextActive]}>
                                    {t('schedule.week', 'Week')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.stitchSettingsBtn}
                            onPress={() => setSettingsOpen(true)}
                            accessibilityLabel={t('schedule.settings', 'Settings')}
                        >
                            <Ionicons name="options-outline" size={20} color="#49398B" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stitch 7-Day Micro Strip */}
                <View style={[styles.stitchWeekStrip, { flexDirection: weekLayoutDirection }]}>
                    {weekDays.map((dayKey) => {
                        const isSelected = dayKey === selectedDateKey;
                        const dayDate = parseRiyadhDateKey(dayKey);
                        const dayNum = Number.isNaN(dayDate.getTime()) ? '--' : dayDate.getUTCDate();
                        const dayAppts = appointmentsByDate[dayKey] || [];
                        const hasActivity = dayAppts.length > 0;
                        const isToday = dayKey === getRiyadhDateKey();

                        return (
                            <TouchableOpacity
                                key={dayKey}
                                style={[
                                    styles.stitchDayCell,
                                    isSelected && styles.stitchDayCellActive,
                                ]}
                                onPress={() => setSelectedDateKey(dayKey)}
                                activeOpacity={0.75}
                            >
                                <Text style={[
                                    styles.stitchDayWeekday,
                                    isSelected && styles.stitchDayWeekdayActive,
                                ]}>
                                    {formatRiyadhWeekdayShort(dayKey, language)}
                                </Text>
                                <Text style={[
                                    styles.stitchDayNumber,
                                    isSelected && styles.stitchDayNumberActive,
                                    isToday && !isSelected && styles.stitchDayNumberToday,
                                ]}>
                                    {dayNum}
                                </Text>
                                <View style={styles.stitchActivityContainer}>
                                    {hasActivity ? (
                                        <View style={[
                                            styles.stitchActivityDot,
                                            isSelected && styles.stitchActivityDotActive,
                                        ]} />
                                    ) : (
                                        <View style={styles.stitchActivityDotPlaceholder} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Stitch Operational Quick Metric Bar */}
                <View style={[styles.stitchMetricBar, { flexDirection: weekLayoutDirection }]}>
                    <View style={[styles.stitchMetricLeft, { flexDirection: weekLayoutDirection }]}>
                        <View style={[styles.stitchMetricItem, { flexDirection: weekLayoutDirection, alignItems: 'center' }]}>
                            <View style={[styles.stitchMetricDotPurple, isCurrentRTL ? { marginLeft: 6, marginRight: 0 } : { marginRight: 6, marginLeft: 0 }]} />
                            <Text style={styles.stitchMetricText}>
                                {getFormattedBookingsCount(appointments.length)}
                            </Text>
                        </View>
                        <View style={styles.stitchMetricDivider} />
                        <View style={[styles.stitchMetricItem, { flexDirection: weekLayoutDirection, alignItems: 'center' }]}>
                            <View style={[styles.stitchMetricDotGray, isCurrentRTL ? { marginLeft: 6, marginRight: 0 } : { marginRight: 6, marginLeft: 0 }]} />
                            <Text style={styles.stitchMetricText}>
                                {getFormattedBlocksCount(breaksForSelectedDate.length + timeOffForSelectedDate.length)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.stitchMetricRight}>
                        <Text style={styles.stitchProviderText} numberOfLines={1}>
                            {t('schedule.provider', 'Provider')}: {user?.name || t('schedule.staff', 'Staff')}
                        </Text>
                    </View>
                </View>

                {renderSelectedDayContent()}

                <View style={styles.timeOffSection}>
                    <View style={styles.timeOffHeaderRow}>
                        <Text style={styles.sectionTitle}>{t('schedule.timeOffRequests')}</Text>
                        {timeOffEnabled ? (
                            <TouchableOpacity style={styles.requestButton} onPress={() => router.push('/(modals)/request-time-off')}>
                                <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.requestButtonText}>{t('schedule.requestTimeOff')}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {!timeOffEnabled ? (
                        <View style={styles.infoCard}>
                            <Ionicons name="information-circle-outline" size={18} color="#6b7280" />
                            <Text style={styles.infoCardText}>
                                {t('schedule.timeOffDisabled')}
                            </Text>
                        </View>
                    ) : (
                        <>
                            {renderTimeOffGroup(t('schedule.active', 'Active'), activeTimeOff)}
                            {renderTimeOffGroup(t('schedule.upcomingTimeOff', 'Upcoming'), upcomingTimeOff, true)}
                            {renderTimeOffGroup(t('schedule.history', 'History'), pastTimeOff)}
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
                            <Text style={styles.settingsTitle}>{t('schedule.settings')}</Text>
                            <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                                <Ionicons name="close" size={22} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.settingsSectionTitle}>{t('schedule.gridSize')}</Text>
                        {(() => {
                            const sliderRatio = clamp((gridScalePercent - MIN_GRID_SCALE) / (MAX_GRID_SCALE - MIN_GRID_SCALE), 0, 1);
                            const hasMeasured = settingsSliderWidth > 22;
                            const thumbLeft = hasMeasured
                                ? sliderRatio * (settingsSliderWidth - 22)
                                : undefined;

                            return (
                                <View
                                    style={styles.customSliderTrack}
                                    onLayout={(event) => setSettingsSliderWidth(event.nativeEvent.layout.width)}
                                    onStartShouldSetResponder={() => true}
                                    onMoveShouldSetResponder={() => true}
                                    onResponderGrant={handleSliderGrant}
                                    onResponderMove={handleSliderMove}
                                    onResponderRelease={handleSliderRelease}
                                    onResponderTerminate={handleSliderTerminate}
                                >
                                    <View
                                        pointerEvents="none"
                                        style={[
                                            styles.customSliderFill,
                                            hasMeasured
                                                ? { width: thumbLeft! + 11 }
                                                : { width: `${sliderRatio * 100}%` },
                                        ]}
                                    />
                                    <View
                                        pointerEvents="none"
                                        style={[
                                            styles.customSliderThumb,
                                            hasMeasured
                                                ? { left: thumbLeft, marginLeft: 0 }
                                                : { left: `${sliderRatio * 100}%`, marginLeft: -11 },
                                        ]}
                                    />
                                </View>
                            );
                        })()}
                        <Text style={styles.settingsHint}>{t('schedule.scale', { percent: gridScalePercent })}</Text>

                        <Text style={styles.settingsSectionTitle}>{t('schedule.visibleRange')}</Text>
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
                                            void saveSchedulePreferences({ visibleWeeks: weekCount }, user?.id);
                                        }}
                                    >
                                        <Text style={[styles.optionChipText, active && styles.optionChipTextActive, disabled && styles.optionChipTextDisabled]}>
                                            {weekCount}{t('schedule.weeksShort', 'W')}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={styles.settingsHint}>{t('schedule.adminLimit', { weeks: scheduleVisibilityWeeks })}</Text>

                        <Text style={styles.settingsSectionTitle}>{t('schedule.showScope')}</Text>
                        <View style={styles.optionRow}>
                            <TouchableOpacity
                                style={[styles.optionChip, dayScopeMode === 'day' && styles.optionChipActive]}
                                onPress={() => {
                                    setDayScopeMode('day');
                                    void saveSchedulePreferences({ dayScopeMode: 'day' }, user?.id);
                                }}
                            >
                                <Text style={[styles.optionChipText, dayScopeMode === 'day' && styles.optionChipTextActive]}>{t('schedule.selectedDay')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.optionChip, dayScopeMode === 'week' && styles.optionChipActive]}
                                onPress={() => {
                                    setDayScopeMode('week');
                                    void saveSchedulePreferences({ dayScopeMode: 'week' }, user?.id);
                                }}
                            >
                                <Text style={[styles.optionChipText, dayScopeMode === 'week' && styles.optionChipTextActive]}>{t('schedule.entireWeek')}</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.settingsSectionTitle}>{t('schedule.layout')}</Text>
                        <View style={styles.optionRow}>
                            <TouchableOpacity
                                style={[styles.optionChip, scheduleViewMode === 'grid' && styles.optionChipActive]}
                                onPress={() => {
                                    setScheduleViewMode('grid');
                                    void saveSchedulePreferences({ scheduleViewMode: 'grid' }, user?.id);
                                }}
                            >
                                <Text style={[styles.optionChipText, scheduleViewMode === 'grid' && styles.optionChipTextActive]}>{t('schedule.gridLayout')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.optionChip, scheduleViewMode === 'cards' && styles.optionChipActive]}
                                onPress={() => {
                                    setScheduleViewMode('cards');
                                    void saveSchedulePreferences({ scheduleViewMode: 'cards' }, user?.id);
                                }}
                            >
                                <Text style={[styles.optionChipText, scheduleViewMode === 'cards' && styles.optionChipTextActive]}>{t('schedule.cardsLayout')}</Text>
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#1f2937',
        marginBottom: 2,
    },
    singleDaySubtitle: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 12,
        color: '#6b7280',
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FAF8FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
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
        backgroundColor: '#E7DDFC',
    },
    alertTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#1D035F',
        marginBottom: 2,
    },
    alertBody: {
        fontFamily: CAIRO_FONTS.regular,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 16,
        color: '#1f2937',
        marginBottom: 2,
    },
    weekNavigatorSubtitle: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 12,
        color: '#6b7280',
    },
    weekNavButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF8FC',
    },
    weekNavButtonDisabled: {
        backgroundColor: '#f3f4f6',
    },
    viewModeSwitcher: {
        flexDirection: 'row',
        backgroundColor: '#E7DDFC',
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#6b7280',
    },
    viewModeButtonTextActive: {
        color: '#6537C0',
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 16,
        color: '#6537C0',
        marginBottom: 4,
    },
    statLabel: {
        fontFamily: CAIRO_FONTS.regular,
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
        backgroundColor: '#6537C0',
    },
    dayCardWorking: {
        backgroundColor: '#eff6ff',
    },
    dayCardTimeOff: {
        backgroundColor: '#fef3c7',
    },
    dayName: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    dayNumber: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 16,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 18,
        color: '#1f2937',
        marginBottom: 4,
    },
    dateSubtitle: {
        fontFamily: CAIRO_FONTS.regular,
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
        fontFamily: CAIRO_FONTS.regular,
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
        fontFamily: CAIRO_FONTS.medium,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#111827',
        textTransform: 'uppercase',
    },
    gridDayHeaderSub: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    gridTimeSlot: {
        justifyContent: 'flex-start',
    },
    gridTimeLabel: {
        fontFamily: CAIRO_FONTS.medium,
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
    currentTimeContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        zIndex: 50,
        justifyContent: 'center',
    },
    currentTimeLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#DC2626',
    },
    currentTimeBadgeRow: {
        position: 'absolute',
        top: -11,
        alignItems: 'center',
        gap: 5,
        zIndex: 51,
    },
    currentTimeBadgeRowLTR: {
        left: 0,
        flexDirection: 'row',
    },
    currentTimeBadgeRowRTL: {
        right: 0,
        flexDirection: 'row-reverse',
    },
    currentTimeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#DC2626',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    currentTimePill: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 10,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    currentTimePillText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 10,
        color: '#FFFFFF',
        includeFontPadding: false,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 10,
        color: '#b45309',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    gridAppointmentCard: {
        position: 'absolute',
        left: 8,
        right: 8,
        backgroundColor: '#FAF8FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#1f2937',
        marginBottom: 2,
    },
    gridAppointmentTitleCompact: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 12,
    },
    gridAppointmentTime: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 12,
        color: '#6b7280',
    },
    gridAppointmentTimeCompact: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 10,
    },
    gridUrgencyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    gridUrgencyText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
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
        backgroundColor: '#E7DDFC',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridAppointmentAvatarImage: {
        width: '100%',
        height: '100%',
    },
    gridAppointmentAvatarInitial: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#6537C0',
    },
    gridAppointmentCustomerName: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 13,
        color: '#111827',
    },
    gridAppointmentCustomerNameCompact: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 11,
    },
    gridAppointmentMeta: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    gridAppointmentMetaCompact: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 10,
        marginTop: 1,
    },
    gridAppointmentFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    gridAppointmentPrice: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#1D035F',
    },
    gridAppointmentPriceCompact: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
    },
    gridAppointmentAction: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 12,
        color: '#6537C0',
    },
    gridAppointmentActionCompact: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 10,
    },
    gridAppointmentUltraCompact: {
        flex: 1,
        justifyContent: 'center',
        gap: 1,
    },
    gridAppointmentUltraCompactTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
        color: '#1f2937',
    },
    gridAppointmentUltraCompactSub: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 10,
        color: '#374151',
    },
    gridAppointmentUltraCompactMeta: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 9,
        color: '#6b7280',
        marginTop: 1,
    },
    gridBreakBlock: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        borderWidth: 1,
        borderColor: '#fbbf24',
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderRadius: 0,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#92400e',
    },
    gridBreakTime: {
        fontFamily: CAIRO_FONTS.regular,
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
        borderColor: '#E7DDFC',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
        zIndex: 20,
    },
    gridLoadingText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#6537C0',
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
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 12,
        color: '#6b7280',
    },
    dayOverviewValue: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 16,
        color: '#6537C0',
    },
    dayOverviewLabel: {
        fontFamily: CAIRO_FONTS.medium,
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    sectionTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 18,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 18,
        color: '#1f2937',
        marginBottom: 4,
    },
    shiftLabel: {
        fontFamily: CAIRO_FONTS.regular,
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
        color: '#6537C0',
    },
    badgeText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
    },
    hoursBadge: {
        backgroundColor: '#f3f4f6',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    hoursBadgeText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
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
        backgroundColor: '#6537C0',
        marginTop: 6,
        marginRight: 10,
    },
    breakLabel: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 14,
        color: '#1f2937',
        marginBottom: 2,
    },
    breakTime: {
        fontFamily: CAIRO_FONTS.regular,
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
        fontFamily: CAIRO_FONTS.regular,
        flex: 1,
        marginLeft: 10,
        color: '#4b5563',
        fontSize: 14,
        lineHeight: 20,
    },
    requestButton: {
        flexDirection: 'row',
        backgroundColor: '#6537C0',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    requestButtonText: {
        fontFamily: CAIRO_FONTS.bold,
        color: '#ffffff',
        fontSize: 14,
    },
    timeOffCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#6537C0',
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#6b21a8',
    },
    timeOffStatusText: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 13,
    },
    notesText: {
        fontFamily: CAIRO_FONTS.regular,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
    },
    statusBadge: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 6,
    },
    appointmentStatusText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#6b7280',
    },
    appointmentTime: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 18,
        color: '#6537C0',
        marginBottom: 4,
    },
    appointmentDuration: {
        fontFamily: CAIRO_FONTS.regular,
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
        backgroundColor: '#E7DDFC',
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 16,
        color: '#6537C0',
    },
    appointmentCustomerMeta: {
        flex: 1,
    },
    appointmentCustomerName: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 18,
        color: '#1f2937',
    },
    appointmentBookingMeta: {
        fontFamily: CAIRO_FONTS.regular,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#1f2937',
    },
    appointmentServiceName: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 15,
        color: '#4b5563',
    },
    appointmentServiceHint: {
        fontFamily: CAIRO_FONTS.semiBold,
        marginTop: 4,
        fontSize: 12,
        color: '#8b5cf6',
    },
    groupSummaryCard: {
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#FAF8FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    groupSummaryTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#6537C0',
        marginBottom: 8,
    },
    groupServiceRow: {
        paddingTop: 8,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E7DDFC',
    },
    groupServiceRowTitle: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 13,
        color: '#111827',
    },
    groupServiceRowMeta: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 12,
        color: '#6b7280',
        marginTop: 3,
    },
    bookingSessionInfoCard: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#ecfeff',
        borderWidth: 1,
        borderColor: '#a5f3fc',
    },
    bookingSessionInfoLabel: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
        color: '#0e7490',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    bookingSessionInfoValue: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#155e75',
        marginTop: 4,
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
        fontFamily: CAIRO_FONTS.regular,
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
        fontFamily: CAIRO_FONTS.regular,
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
        backgroundColor: '#FAF8FC',
        borderRadius: 999,
    },
    appointmentClientButtonIcon: {
        marginRight: 6,
    },
    appointmentClientButtonText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#6537C0',
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
        backgroundColor: '#6537C0',
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
        fontFamily: CAIRO_FONTS.semiBold,
        color: '#ffffff',
        fontSize: 14,
    },
    btnTextGray: {
        fontFamily: CAIRO_FONTS.medium,
        color: '#4b5563',
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
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 13,
        color: '#ef4444',
    },
    settingsBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.32)',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
    },
    settingsPanel: {
        width: '94%',
        maxWidth: 460,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 19,
        color: '#111827',
    },
    settingsSectionTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#4b5563',
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 10,
    },
    settingsHint: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 12,
        color: '#6b7280',
        marginTop: 8,
        marginBottom: 8,
    },
    customSliderTrack: {
        height: 34,
        borderRadius: 999,
        backgroundColor: '#E7DDFC',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
    },
    customSliderFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#6537C0',
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
        borderColor: '#6537C0',
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
        backgroundColor: '#E7DDFC',
        borderColor: '#6537C0',
    },
    optionChipDisabled: {
        backgroundColor: '#f3f4f6',
        borderColor: '#e5e7eb',
    },
    optionChipText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#4b5563',
    },
    optionChipTextActive: {
        color: '#1D035F',
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
        width: '100%',
        maxWidth: 560,
        alignSelf: 'center',
        maxHeight: '92%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 18,
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
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 18,
        color: '#4b5563',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    },

    // --- Stitch Redesign Styles (Screen 2985f6999e274b7289c572f3ab40c4a0 & Modal e21caf2d58c64eb3bce4551d76694ebc) ---
    stitchNavHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
    },
    stitchNavLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    stitchNavIconButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F4F3F6',
    },
    stitchNavIconButtonDisabled: {
        opacity: 0.4,
    },
    stitchNavDateTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 15,
        color: '#1D035F',
        marginHorizontal: 4,
    },
    stitchTodayPill: {
        backgroundColor: '#E6DEFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    stitchTodayPillText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
        color: '#49398B',
    },
    stitchNavRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stitchSegmentedToggle: {
        flexDirection: 'row',
        backgroundColor: '#F4F3F6',
        borderRadius: 8,
        padding: 2,
    },
    stitchSegmentedBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    stitchSegmentedBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    stitchSegmentedBtnText: {
        fontFamily: CAIRO_FONTS.medium,
        fontSize: 12,
        color: '#79747E',
    },
    stitchSegmentedBtnTextActive: {
        fontFamily: CAIRO_FONTS.bold,
        color: '#6537C0',
    },
    stitchSettingsBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F4F3F6',
    },

    // Stitch 7-Day Micro Strip
    stitchWeekStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
    },
    stitchDayCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 10,
        marginHorizontal: 2,
    },
    stitchDayCellActive: {
        backgroundColor: '#6537C0',
    },
    stitchDayWeekday: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 11,
        color: '#79747E',
        marginBottom: 2,
    },
    stitchDayWeekdayActive: {
        fontFamily: CAIRO_FONTS.semiBold,
        color: '#E6DEFF',
    },
    stitchDayNumber: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#1D035F',
    },
    stitchDayNumberActive: {
        fontFamily: CAIRO_FONTS.bold,
        color: '#FFFFFF',
    },
    stitchDayNumberToday: {
        fontFamily: CAIRO_FONTS.bold,
        color: '#6537C0',
    },
    stitchActivityContainer: {
        height: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 3,
    },
    stitchActivityDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#6537C0',
    },
    stitchActivityDotActive: {
        backgroundColor: '#FFFFFF',
    },
    stitchActivityDotPlaceholder: {
        width: 4,
        height: 4,
    },

    // Stitch Operational Quick Metric Bar
    stitchMetricBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F4F3F6',
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
    },
    stitchMetricLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stitchMetricItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stitchMetricDotPurple: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6537C0',
        marginRight: 6,
    },
    stitchMetricDotGray: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#9CA3AF',
        marginRight: 6,
    },
    stitchMetricText: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 12,
        color: '#49398B',
    },
    stitchMetricDivider: {
        width: 1,
        height: 12,
        backgroundColor: '#CBC3D6',
        marginHorizontal: 10,
    },
    stitchMetricRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stitchProviderText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#1D035F',
    },

    // Stitch Blocked Intervals & Breaks
    stitchBlockedSection: {
        marginBottom: 16,
    },
    stitchBlockedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F4F3F6',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    stitchBlockedLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    stitchBlockedIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    stitchBlockedLabel: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 13,
        color: '#1D035F',
    },
    stitchBlockedTime: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 11,
        color: '#79747E',
        marginTop: 1,
    },
    stitchBlockedBadge: {
        backgroundColor: '#E6DEFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    stitchBlockedBadgeText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 10,
        color: '#49398B',
        letterSpacing: 0.5,
    },

    // Stitch Appointment Cards
    stitchCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        overflow: 'hidden',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    stitchCardCompleted: {
        opacity: 0.75,
        backgroundColor: '#FAFAFC',
    },
    stitchCardStripe: {
        width: 5,
        alignSelf: 'stretch',
    },
    stitchCardContent: {
        flex: 1,
        padding: 14,
    },
    stitchCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    stitchCustomerNameWrap: {
        flex: 1,
        marginRight: 8,
    },
    stitchCustomerName: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 15,
        color: '#1D035F',
    },
    stitchCardBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    stitchDurationBadge: {
        backgroundColor: '#F4F3F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    stitchDurationText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
        color: '#49398B',
    },
    stitchStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    stitchStatusBadgeText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    stitchServiceTitle: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 14,
        color: '#2A2535',
        marginBottom: 4,
    },
    stitchMultiServiceHint: {
        fontFamily: CAIRO_FONTS.medium,
        fontSize: 11,
        color: '#6537C0',
        marginBottom: 6,
    },
    stitchCardBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    stitchCardMetaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    stitchMetaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F3F6',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
    },
    stitchMetaChipText: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 11,
        color: '#49398B',
    },
    stitchPriceBold: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#6537C0',
    },
    stitchCardNotes: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAF8FC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    stitchCardNotesText: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 11,
        color: '#6B7280',
        flex: 1,
    },
    stitchQuickActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F4F3F6',
    },
    stitchQuickBtnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6537C0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    stitchQuickBtnSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#059669',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    stitchQuickBtnSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F3F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    stitchQuickBtnTextWhite: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#FFFFFF',
    },
    stitchQuickBtnTextSecondary: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 12,
        color: '#6B7280',
    },

    // Stitch Appointment Actions Modal (Bottom Sheet e21caf2d58c64eb3bce4551d76694ebc)
    stitchModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(29, 3, 95, 0.45)',
        justifyContent: 'flex-end',
    },
    stitchModalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
        maxHeight: '90%',
    },
    stitchDragHandle: {
        width: 48,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#CBC3D6',
        alignSelf: 'center',
        marginBottom: 16,
    },
    stitchModalCustomerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    stitchModalCustomerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    stitchModalAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#E6DEFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    stitchModalAvatarImg: {
        width: 46,
        height: 46,
        borderRadius: 23,
    },
    stitchModalAvatarText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 18,
        color: '#49398B',
    },
    stitchModalCustomerDetails: {
        flex: 1,
    },
    stitchModalNameAndStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    stitchModalCustomerName: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 16,
        color: '#1D035F',
    },
    stitchModalStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    stitchModalStatusPillText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 10,
        textTransform: 'uppercase',
    },
    stitchModalPhoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    stitchModalPhoneText: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 12,
        color: '#49398B',
        textDecorationLine: 'underline',
    },
    stitchModalBookingSub: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 11,
        color: '#79747E',
        marginTop: 2,
    },
    stitchModalCloseBtn: {
        padding: 6,
        borderRadius: 16,
        backgroundColor: '#F4F3F6',
    },
    stitchServiceStructuralCard: {
        backgroundColor: '#F4F3F6',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 12,
    },
    stitchServiceStructuralTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    stitchServiceStructuralName: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#1D035F',
        marginBottom: 2,
    },
    stitchServiceStructuralDuration: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 11,
        color: '#79747E',
    },
    stitchServiceStructuralPrice: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 15,
        color: '#6537C0',
    },
    stitchMultiServiceBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    stitchMultiServiceHeader: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
        color: '#1D035F',
        marginBottom: 6,
    },
    stitchMultiServiceItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderTopWidth: 1,
        borderTopColor: '#F4F3F6',
    },
    stitchMultiServiceItemName: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 12,
        color: '#2A2535',
    },
    stitchMultiServiceItemTime: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 10,
        color: '#79747E',
    },
    stitchMultiServiceItemPrice: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#6537C0',
    },
    stitchMicroStripContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    stitchMicroStripColumn: {
        flex: 1,
        alignItems: 'center',
    },
    stitchMicroStripLabel: {
        fontFamily: CAIRO_FONTS.medium,
        fontSize: 10,
        color: '#79747E',
        marginBottom: 2,
    },
    stitchMicroStripValue: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#1D035F',
    },
    stitchMicroStripDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#E7DDFC',
    },
    stitchNotesCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FAF8FC',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 12,
    },
    stitchNotesTitle: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
        color: '#1D035F',
        marginBottom: 2,
    },
    stitchNotesBody: {
        fontFamily: CAIRO_FONTS.regular,
        fontSize: 12,
        color: '#49398B',
        lineHeight: 16,
    },
    stitchBookingSessionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F3F6',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 14,
    },
    stitchBookingSessionLabel: {
        fontFamily: CAIRO_FONTS.medium,
        fontSize: 11,
        color: '#79747E',
        marginRight: 6,
    },
    stitchBookingSessionValue: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 11,
        color: '#1D035F',
    },
    stitchModalActionsArea: {
        marginTop: 4,
        gap: 10,
    },
    stitchModalBtnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6537C0',
        height: 48,
        borderRadius: 14,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    stitchModalBtnSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#059669',
        height: 48,
        borderRadius: 14,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    stitchModalBtnPrimaryText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 14,
        color: '#FFFFFF',
    },
    stitchModalSecondaryGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    stitchModalBtnSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
    },
    stitchModalBtnSecondaryTextRed: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#DC2626',
    },
    stitchModalBtnProfile: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#F4F3F6',
    },
    stitchModalBtnProfileText: {
        fontFamily: CAIRO_FONTS.bold,
        fontSize: 12,
        color: '#6537C0',
    },
    stitchModalCompletedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    stitchModalCompletedText: {
        fontFamily: CAIRO_FONTS.semiBold,
        fontSize: 13,
        color: '#065F46',
    },
});
