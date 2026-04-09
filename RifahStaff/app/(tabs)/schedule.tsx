import React, { useState, useEffect, useCallback } from 'react';
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
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { getSchedule, cancelTimeOffRequest, Shift, TimeOff } from '../../src/services/schedule';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { canRequestTimeOff } from '../../src/utils/capabilities';

export default function ScheduleScreen() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Shifts State
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const timeOffEnabled = canRequestTimeOff(user);

    // Calculate current week dates for the header (Mon-Sun)
    // startOfWeek in date-fns defaults to Sunday (0). We want Monday (1).
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    // Stable string key for the current week — prevents re-creating loadData on every render
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');

    const loadData = useCallback(async () => {
        try {
            const start = weekStartStr;
            const end = format(addDays(new Date(weekStartStr), 6), 'yyyy-MM-dd');
            const data = await getSchedule(start, end);
            setShifts(data.shifts);
            setTimeOff(data.timeOff);
        } catch (error) {
            console.error('Failed to load schedule data', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [weekStartStr]);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        loadData();
    }, [loadData, user]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCancelTimeOff = (id: string) => {
        Alert.alert(
            t('schedule.cancelRequest'),
            'Do you want to cancel this upcoming time off request?',
            [
                { text: t('common.no'), style: 'cancel' },
                {
                    text: t('common.yes'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelTimeOffRequest(id);
                            loadData();
                        } catch (error: any) {
                            Alert.alert(
                                t('common.error'),
                                error?.response?.data?.message || error?.message || 'Could not cancel this time off request.'
                            );
                        }
                    }
                }
            ]
        );
    };

    // Filter shifts based on the currently selected date tile
    const shiftsForSelectedDate = shifts.filter(
        s => s.date === format(selectedDate, 'yyyy-MM-dd')
    );
    const timeOffForSelectedDate = timeOff.filter((item) => {
        const selected = format(selectedDate, 'yyyy-MM-dd');
        return item.startDate <= selected && item.endDate >= selected;
    });

    const formatTime = (timeString: string) => {
        // timeString is often HH:mm:ss
        const [hours, minutes] = timeString.split(':');
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedH = h % 12 || 12;
        return `${formattedH}:${minutes} ${ampm}`;
    };

    const renderShiftsTab = () => (
        <View style={styles.tabContent}>
            {/* Week Calendar Strip */}
            <View style={styles.calendarStrip}>
                {weekDays.map((day, index) => {
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[styles.dayCard, isSelected && styles.dayCardSelected]}
                            onPress={() => setSelectedDate(day)}
                        >
                            <Text style={[styles.dayName, isSelected && styles.textSelected]}>
                                {format(day, 'EEE')}
                            </Text>
                            <Text style={[styles.dayNumber, isSelected && styles.textSelected]}>
                                {format(day, 'd')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.dateHeader}>
                <Text style={styles.dateTitle}>{format(selectedDate, 'EEEE, MMMM d')}</Text>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#8B5ADF" />
                </View>
            ) : shiftsForSelectedDate.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="cafe-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('schedule.noShifts')}</Text>
                    <Text style={styles.emptySubtitle}>{t('schedule.noShiftsSub')}</Text>
                </View>
            ) : (
                shiftsForSelectedDate.map((shift) => (
                    <View key={shift.id} style={styles.shiftCard}>
                        <View style={styles.shiftTimeline}>
                            <View style={styles.timelineDot} />
                            <View style={styles.timelineLine} />
                        </View>
                        <View style={styles.shiftDetails}>
                            <Text style={styles.shiftTime}>
                                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                            </Text>
                            <Text style={styles.shiftLabel}>
                                {shift.label || 'Regular Working Hours'}
                            </Text>
                        </View>
                    </View>
                ))
            )}

            <View style={styles.timeOffSection}>
                <View style={styles.timeOffHeaderRow}>
                    <Text style={styles.sectionTitle}>Time Off</Text>
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
                ) : timeOffForSelectedDate.length === 0 ? (
                    <View style={styles.infoCard}>
                        <Ionicons name="calendar-clear-outline" size={18} color="#6b7280" />
                        <Text style={styles.infoCardText}>
                            No time off is recorded for the selected day.
                        </Text>
                    </View>
                ) : (
                    timeOffForSelectedDate.map((item) => (
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
                                {item.startDate} to {item.endDate}
                            </Text>
                            {item.reason ? (
                                <Text style={styles.notesText}>{item.reason}</Text>
                            ) : null}
                            {timeOffEnabled && item.startDate >= format(new Date(), 'yyyy-MM-dd') ? (
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
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <Text style={styles.headerTitle}>{t('schedule.title')}</Text>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B5ADF']} />}
            >
                {renderShiftsTab()}
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
        marginBottom: 20,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
        padding: 4,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    segmentBtnActive: {
        backgroundColor: '#ffffff',
    },
    segmentText: {
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        fontSize: 15,
    },
    segmentTextActive: {
        color: '#8B5ADF',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    tabContent: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
    },
    // Week Calendar
    calendarStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
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
    dateHeader: {
        marginBottom: 16,
    },
    dateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
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
    // Shifts
    shiftCard: {
        flexDirection: 'row',
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
    shiftTimeline: {
        alignItems: 'center',
        marginRight: 16,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#8B5ADF',
        marginTop: 4,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#e5e7eb',
        marginTop: 4,
    },
    shiftDetails: {
        flex: 1,
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
    // Time Off
    requestButton: {
        flexDirection: 'row',
        backgroundColor: '#8B5ADF',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#8B5ADF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    requestButtonText: {
        color: '#ffffff',
        fontSize: 16,
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
    timeOffDates: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    datesText: {
        fontSize: 15,
        color: '#374151',
        fontWeight: '500',
    },
    reasonText: {
        fontSize: 14,
        color: '#6b7280',
        fontStyle: 'italic',
    },
    // Empty State
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
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ef4444',
    }
});
