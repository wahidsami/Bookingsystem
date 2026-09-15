import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    TextInput,
    Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { submitTimeOffRequest, getTimeOffRequests, cancelTimeOffRequest, TimeOff } from '../../src/services/schedule';
import { useTranslation } from 'react-i18next';
import { getRiyadhDateKey } from '../../src/utils/riyadhDate';
import { AppHeader } from '../../src/components/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function RequestTimeOffModal() {
    const { t } = useTranslation();
    const [isCreating, setIsCreating] = useState(false);
    
    // Dashboard state
    const [timeOffRequests, setTimeOffRequests] = useState<TimeOff[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Form state
    const [type, setType] = useState<'vacation' | 'sick' | 'personal' | 'training' | 'other'>('vacation');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const formatDate = (value: Date) => getRiyadhDateKey(value);

    const leaveTypes = [
        { value: 'vacation', label: t('timeOff.vacation') || 'Vacation' },
        { value: 'sick', label: t('timeOff.sickLeave') || 'Sick Leave' },
        { value: 'personal', label: t('timeOff.personal') || 'Personal' },
        { value: 'training', label: t('timeOff.training') || 'Training' },
        { value: 'other', label: 'Other' },
    ] as const;

    useEffect(() => {
        if (!isCreating) {
            loadTimeOff();
        }
    }, [isCreating]);

    const loadTimeOff = async () => {
        setLoading(true);
        try {
            const data = await getTimeOffRequests();
            setTimeOffRequests(data);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to load time off requests');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelTimeOff = (id: string) => {
        Alert.alert(
            'Cancel Request',
            'Do you want to cancel this time off request?',
            [
                { text: t('common.no', 'No'), style: 'cancel' },
                {
                    text: t('common.yesCancel', 'Yes, Cancel'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelTimeOffRequest(id);
                            loadTimeOff();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Could not cancel request');
                        }
                    },
                },
            ]
        );
    };

    const handleSubmit = async () => {
        if (endDate < startDate) {
            Alert.alert(t('common.error'), t('timeOff.errorDateEndBeforeStart') || 'End date cannot be before start date');
            return;
        }

        try {
            setSubmitting(true);
            await submitTimeOffRequest(
                formatDate(startDate),
                formatDate(endDate),
                type,
                reason.trim() || undefined
            );

            Alert.alert(t('common.success'), 'Your time off has been submitted.', [
                {
                    text: t('common.ok'),
                    onPress: () => {
                        setIsCreating(false);
                        loadTimeOff();
                    },
                }
            ]);
        } catch (error: any) {
            Alert.alert(t('common.error'), error?.response?.data?.message || error?.message || t('timeOff.errorSubmit'));
        } finally {
            setSubmitting(false);
        }
    };

    const todayKey = getRiyadhDateKey();
    const activeTimeOff = timeOffRequests.filter((item) => item.startDate <= todayKey && item.endDate >= todayKey);
    const upcomingTimeOff = timeOffRequests.filter((item) => item.startDate > todayKey);
    const pastTimeOff = timeOffRequests.filter((item) => item.endDate < todayKey);

    const renderTimeOffGroup = (title: string, items: TimeOff[], allowCancel = false) => (
        <View style={styles.timeOffGroup}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {items.length === 0 ? (
                <View style={styles.infoCard}>
                    <Ionicons name="calendar-clear-outline" size={18} color="#6b7280" />
                    <Text style={styles.infoCardText}>{t('timeOff.noItems', 'No items in this section.')}</Text>
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
                            {item.startDate} to {item.endDate}
                        </Text>
                        {item.reason ? <Text style={styles.notesText}>{item.reason}</Text> : null}
                        {allowCancel ? (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancelTimeOff(item.id)}
                            >
                                <Ionicons name="close-circle-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                <Text style={styles.cancelButtonText}>{t('timeOff.cancelRequest', 'Cancel Request')}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ))
            )}
        </View>
    );

    if (!isCreating) {
        return (
            <SafeAreaView style={styles.mainContainer} edges={['top', 'bottom']}>
                <AppHeader title="Time Off" showBack={true} />
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => setIsCreating(true)}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.primaryButtonText}>{t('timeOff.requestTimeOff', 'Request Time Off')}</Text>
                    </TouchableOpacity>
                    
                    {loading ? (
                        <ActivityIndicator size="large" color="#6537C0" style={{ marginTop: 40 }} />
                    ) : (
                        <>
                            {renderTimeOffGroup('Active', activeTimeOff)}
                            {renderTimeOffGroup('Upcoming', upcomingTimeOff, true)}
                            {renderTimeOffGroup('History', pastTimeOff)}
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.mainContainer} edges={['top', 'bottom']}>
            <AppHeader title="New Request" showBack={true} onBackPress={() => setIsCreating(false)} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('timeOff.typeLabel') || 'Leave Type'}</Text>
                        <View style={styles.typeGrid}>
                            {leaveTypes.map((option) => {
                                const active = option.value === type;
                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[styles.typeButton, active && styles.typeButtonActive]}
                                        onPress={() => setType(option.value)}
                                    >
                                        <Text style={[styles.typeButtonText, active && styles.typeButtonTextActive]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('timeOff.startDate') || 'Start Date'}</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
                            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                            <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
                        </TouchableOpacity>
                        {showStartPicker && (
                            <DateTimePicker
                                value={startDate}
                                mode="date"
                                display="default"
                                onChange={(event, date) => {
                                    setShowStartPicker(false);
                                    if (date) setStartDate(date);
                                }}
                            />
                        )}
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('timeOff.endDate') || 'End Date'}</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
                            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                            <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
                        </TouchableOpacity>
                        {showEndPicker && (
                            <DateTimePicker
                                value={endDate}
                                mode="date"
                                display="default"
                                minimumDate={startDate}
                                onChange={(event, date) => {
                                    setShowEndPicker(false);
                                    if (date) setEndDate(date);
                                }}
                            />
                        )}
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('timeOff.reason') || 'Reason (Optional)'}</Text>
                        <TextInput
                            style={styles.textArea}
                            value={reason}
                            onChangeText={setReason}
                            multiline
                            numberOfLines={4}
                            placeholder="Add any notes..."
                            placeholderTextColor="#9ca3af"
                            textAlignVertical="top"
                        />
                    </View>
                    
                    <TouchableOpacity
                        style={[styles.primaryButton, submitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>{t('timeOff.submit') || 'Submit Request'}</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Cairo_600SemiBold',
        fontWeight: '600',
        color: '#1D035F',
        marginBottom: 8,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    typeButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    typeButtonActive: {
        backgroundColor: '#f3e8ff',
        borderColor: '#a855f7',
    },
    typeButtonText: {
        fontSize: 14,
        color: '#6E6188',
        fontWeight: '500',
    },
    typeButtonTextActive: {
        color: '#7e22ce',
        fontWeight: '600',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        borderRadius: 12,
        padding: 14,
    },
    dateButtonText: {
        marginLeft: 10,
        fontSize: 16,
        color: '#1D035F',
    },
    textArea: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#1D035F',
        minHeight: 120,
    },
    primaryButton: {
        backgroundColor: '#6537C0',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    timeOffGroup: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Cairo_700Bold',
        fontWeight: '600',
        color: '#1D035F',
        marginBottom: 12,
    },
    timeOffCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    timeOffHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    typeBadge: {
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6E6188',
    },
    timeOffStatusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    shiftLabel: {
        fontSize: 15,
        color: '#1D035F',
        marginBottom: 4,
    },
    notesText: {
        fontSize: 14,
        fontFamily: 'Cairo_400Regular',
        color: '#6E6188',
        fontStyle: 'italic',
        marginTop: 4,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    cancelButtonText: {
        color: '#ef4444',
        fontSize: 14,
        fontWeight: '500',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAF9FC',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    infoCardText: {
        marginLeft: 8,
        fontFamily: 'Cairo_400Regular',
        fontSize: 14,
        color: '#6E6188',
    }
});
