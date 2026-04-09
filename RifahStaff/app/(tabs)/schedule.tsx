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
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { addDays, differenceInCalendarDays, format, isSameDay, startOfWeek } from 'date-fns';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { canRequestTimeOff } from '../../src/utils/capabilities';
import { BreakWindow, cancelTimeOffRequest, getSchedule, Shift, TimeOff } from '../../src/services/schedule';

const getDateKey = (value: Date) => format(value, 'yyyy-MM-dd');

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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [breaks, setBreaks] = useState<BreakWindow[]>([]);
    const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [weekOffset, setWeekOffset] = useState(0);
    const timeOffEnabled = canRequestTimeOff(user);
    const scheduleVisibilityWeeks = Math.min(Math.max(Number(user?.scheduleVisibilityWeeks || 1), 1), 4);

    const baseWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
    const weekStart = useMemo(() => addDays(baseWeekStart, weekOffset * 7), [baseWeekStart, weekOffset]);
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    const weekStartStr = getDateKey(weekStart);
    const canGoPrev = weekOffset > 0;
    const canGoNext = weekOffset < scheduleVisibilityWeeks - 1;

    const loadData = useCallback(async () => {
        try {
            const start = weekStartStr;
            const end = getDateKey(addDays(new Date(weekStartStr), 6));
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
    }, [weekStartStr]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        loadData();
    }, [loadData, user]);

    useEffect(() => {
        setSelectedDate(weekOffset === 0 ? new Date() : weekStart);
    }, [weekOffset, weekStartStr]);

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

    const selectedDateKey = getDateKey(selectedDate);
    const shiftsForSelectedDate = shifts.filter((shift) => shift.date === selectedDateKey);
    const breaksForSelectedDate = breaks.filter((item) => item.date === selectedDateKey);
    const timeOffForSelectedDate = timeOff.filter((item) => item.startDate <= selectedDateKey && item.endDate >= selectedDateKey);

    const weekShiftMinutes = shifts.reduce((sum, shift) => sum + Math.max(minutesBetween(shift.startTime, shift.endTime), 0), 0);
    const workingDays = new Set(shifts.map((shift) => shift.date)).size;
    const timeOffDays = weekDays.filter((day) => {
        const key = getDateKey(day);
        return timeOff.some((item) => item.startDate <= key && item.endDate >= key);
    }).length;

    const nextShift = useMemo(() => {
        const now = Date.now();
        return shifts
            .map((shift) => ({
                ...shift,
                startsAt: new Date(`${shift.date}T${shift.startTime}`).getTime()
            }))
            .filter((shift) => shift.startsAt >= now)
            .sort((a, b) => a.startsAt - b.startsAt)[0] || null;
    }, [shifts]);

    const selectedDayShiftMinutes = shiftsForSelectedDate.reduce((sum, shift) => sum + Math.max(minutesBetween(shift.startTime, shift.endTime), 0), 0);
    const selectedDayBreakMinutes = breaksForSelectedDate.reduce((sum, item) => sum + Math.max(minutesBetween(item.startTime, item.endTime), 0), 0);

    const upcomingTimeOff = timeOff
        .filter((item) => item.startDate > getDateKey(new Date()))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const activeTimeOff = timeOff
        .filter((item) => item.startDate <= getDateKey(new Date()) && item.endDate >= getDateKey(new Date()))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const pastTimeOff = timeOff
        .filter((item) => item.endDate < getDateKey(new Date()))
        .sort((a, b) => b.endDate.localeCompare(a.endDate));

    const getDayState = (day: Date) => {
        const key = getDateKey(day);
        if (timeOff.some((item) => item.startDate <= key && item.endDate >= key)) {
            return 'timeoff';
        }
        if (shifts.some((shift) => shift.date === key)) {
            return 'working';
        }
        return 'off';
    };

    const renderSelectedDayContent = () => {
        if (loading) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#8B5ADF" />
                </View>
            );
        }

        if (shiftsForSelectedDate.length === 0 && timeOffForSelectedDate.length === 0) {
            return (
                <View style={styles.centerContainer}>
                    <Ionicons name="calendar-clear-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>No schedule for this day</Text>
                    <Text style={styles.emptySubtitle}>This day is currently clear with no shifts or approved time off.</Text>
                </View>
            );
        }

        return (
            <>
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
                                    <Text style={[styles.statusText, { color: item.isApproved ? '#10b981' : '#f59e0b' }]}>
                                        {item.isApproved ? 'APPROVED' : 'PENDING'}
                                    </Text>
                                </View>
                                <Text style={styles.shiftLabel}>{item.startDate} to {item.endDate}</Text>
                                {item.reason ? <Text style={styles.notesText}>{item.reason}</Text> : null}
                            </View>
                        ))}
                    </View>
                ) : null}
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
                            <Text style={[styles.statusText, { color: item.isApproved ? '#10b981' : '#f59e0b' }]}>
                                {item.isApproved ? 'APPROVED' : 'PENDING'}
                            </Text>
                        </View>
                        <Text style={styles.shiftLabel}>
                            {item.startDate} to {item.endDate} • {differenceInCalendarDays(new Date(item.endDate), new Date(item.startDate)) + 1} day(s)
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
                            {nextShift ? format(new Date(`${nextShift.date}T${nextShift.startTime}`), 'EEE h:mm a') : 'None'}
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
                            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
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

                <View style={styles.calendarStrip}>
                    {weekDays.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const state = getDayState(day);
                        return (
                            <TouchableOpacity
                                key={getDateKey(day)}
                                style={[
                                    styles.dayCard,
                                    isSelected && styles.dayCardSelected,
                                    !isSelected && state === 'timeoff' && styles.dayCardTimeOff,
                                    !isSelected && state === 'working' && styles.dayCardWorking,
                                ]}
                                onPress={() => setSelectedDate(day)}
                            >
                                <Text style={[styles.dayName, isSelected && styles.textSelected]}>
                                    {format(day, 'EEE')}
                                </Text>
                                <Text style={[styles.dayNumber, isSelected && styles.textSelected]}>
                                    {format(day, 'd')}
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
                            <Text style={styles.dateTitle}>{format(selectedDate, 'EEEE, MMMM d')}</Text>
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
    statusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    notesText: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 8,
        lineHeight: 18,
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
