import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { getSchedule, getTimeOffRequests, cancelTimeOffRequest, Shift, TimeOff } from '../../src/services/schedule';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function ScheduleScreen() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'shifts' | 'timeoff'>('shifts');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Shifts State
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Time Off State
    const [timeOffRequests, setTimeOffRequests] = useState<TimeOff[]>([]);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    // Calculate current week dates for the header (Mon-Sun)
    // startOfWeek in date-fns defaults to Sunday (0). We want Monday (1).
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    // Stable string key for the current week — prevents re-creating loadData on every render
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');

    const loadData = useCallback(async () => {
        try {
            if (activeTab === 'shifts') {
                const start = weekStartStr;
                const end = format(addDays(new Date(weekStartStr), 6), 'yyyy-MM-dd');
                const data = await getSchedule(start, end);
                setShifts(data.shifts);
            } else {
                const data = await getTimeOffRequests();
                setTimeOffRequests(data);
            }
        } catch (error) {
            console.error('Failed to load schedule data', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, weekStartStr]); // String dep = stable across renders

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        loadData();
    }, [loadData, user]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCancelTimeOff = async (id: string) => {
        if (cancellingId) return;
        try {
            setCancellingId(id);
            await cancelTimeOffRequest(id);
            // Reload to reflect the deletion
            loadData();
        } catch (error) {
            console.error('Failed to cancel time off request', error);
        } finally {
            setCancellingId(null);
        }
    };

    // Filter shifts based on the currently selected date tile
    const shiftsForSelectedDate = shifts.filter(
        s => s.date === format(selectedDate, 'yyyy-MM-dd')
    );

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
        </View>
    );

    const renderTimeOffTab = () => (
        <View style={styles.tabContent}>
            <TouchableOpacity
                style={styles.requestButton}
                onPress={() => router.push('/(modals)/request-time-off')}
            >
                <Ionicons name="add-circle-outline" size={24} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.requestButtonText}>{t('schedule.requestTimeOff')}</Text>
            </TouchableOpacity>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#8B5ADF" />
                </View>
            ) : timeOffRequests.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="airplane-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('schedule.noRequests')}</Text>
                    <Text style={styles.emptySubtitle}>{t('schedule.noRequestsSub')}</Text>
                </View>
            ) : (
                timeOffRequests.map((request) => (
                    <View key={request.id} style={styles.timeOffCard}>
                        <View style={styles.timeOffHeader}>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeText}>{request.type.toUpperCase()}</Text>
                            </View>
                            <Text style={[
                                styles.statusText,
                                { color: request.isApproved ? '#10b981' : '#f59e0b' }
                            ]}>
                                {request.isApproved ? t('schedule.approved') : t('schedule.pendingReview')}
                            </Text>
                        </View>

                        <View style={styles.timeOffDates}>
                            <Ionicons name="calendar-outline" size={16} color="#4b5563" style={{ marginRight: 6 }} />
                            <Text style={styles.datesText}>
                                {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                            </Text>
                        </View>

                        {request.reason && (
                            <Text style={styles.reasonText}>"{request.reason}"</Text>
                        )}

                        {/* Cancel button for pending (not yet approved) requests */}
                        {!request.isApproved && (
                            <TouchableOpacity
                                style={[styles.cancelBtn, cancellingId === request.id && { opacity: 0.5 }]}
                                onPress={() => handleCancelTimeOff(request.id)}
                                disabled={!!cancellingId}
                            >
                                {cancellingId === request.id ? (
                                    <ActivityIndicator size="small" color="#ef4444" />
                                ) : (
                                    <>
                                        <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                        <Text style={styles.cancelBtnText}>{t('schedule.cancelRequest')}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                ))
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <Text style={styles.headerTitle}>{t('schedule.title')}</Text>

                <View style={styles.segmentedControl}>
                    <TouchableOpacity
                        style={[styles.segmentBtn, activeTab === 'shifts' && styles.segmentBtnActive]}
                        onPress={() => setActiveTab('shifts')}
                    >
                        <Text style={[styles.segmentText, activeTab === 'shifts' && styles.segmentTextActive]}>
                            {t('schedule.myShifts')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentBtn, activeTab === 'timeoff' && styles.segmentBtnActive]}
                        onPress={() => setActiveTab('timeoff')}
                    >
                        <Text style={[styles.segmentText, activeTab === 'timeoff' && styles.segmentTextActive]}>
                            {t('schedule.timeOff')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B5ADF']} />}
            >
                {activeTab === 'shifts' ? renderShiftsTab() : renderTimeOffTab()}
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
