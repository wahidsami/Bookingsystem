import React, { useState } from 'react';
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
import { submitTimeOffRequest } from '../../src/services/schedule';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

export default function RequestTimeOffModal() {
    const { t } = useTranslation();
    const [type, setType] = useState<'vacation' | 'sick' | 'personal' | 'training' | 'other'>('vacation');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [reason, setReason] = useState('');
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const formatDate = (value: Date) => value.toISOString().split('T')[0];

    const leaveTypes = [
        { value: 'vacation', label: t('timeOff.vacation') },
        { value: 'sick', label: t('timeOff.sickLeave') },
        { value: 'personal', label: t('timeOff.personal') },
        { value: 'training', label: t('timeOff.training') },
        { value: 'other', label: 'Other' },
    ] as const;

    const handleSubmit = async () => {
        if (endDate < startDate) {
            Alert.alert(t('common.error'), t('timeOff.errorDateEndBeforeStart'));
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
                    onPress: () => router.back(),
                }
            ]);
        } catch (error: any) {
            Alert.alert(t('common.error'), error?.response?.data?.message || error?.message || t('timeOff.errorSubmit'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('timeOff.title')}</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="close" size={28} color="#4b5563" />
                    </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('timeOff.typeLabel')}</Text>
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
                    <Text style={styles.label}>{t('timeOff.startDate')}</Text>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
                        <Ionicons name="calendar-outline" size={18} color="#6b7280" style={{ marginRight: 8 }} />
                        <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('timeOff.endDate')}</Text>
                    <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
                        <Ionicons name="calendar-outline" size={18} color="#6b7280" style={{ marginRight: 8 }} />
                        <Text style={styles.dateText}>{formatDate(endDate)}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('timeOff.reasonLabel')}</Text>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder={t('timeOff.reasonPlaceholder')}
                        placeholderTextColor="#9ca3af"
                        multiline
                        style={styles.textInput}
                        textAlignVertical="top"
                    />
                </View>

                {showStartPicker ? (
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={new Date()}
                        onChange={(_, value) => {
                            setShowStartPicker(Platform.OS === 'ios');
                            if (!value) {
                                return;
                            }
                            setStartDate(value);
                            if (value > endDate) {
                                setEndDate(value);
                            }
                        }}
                    />
                ) : null}

                {showEndPicker ? (
                    <DateTimePicker
                        value={endDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={startDate}
                        onChange={(_, value) => {
                            setShowEndPicker(Platform.OS === 'ios');
                            if (value) {
                                setEndDate(value);
                            }
                        }}
                    />
                ) : null}

                <TouchableOpacity
                    style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.submitText}>{t('timeOff.submitBtn')}</Text>
                        </>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        backgroundColor: '#ffffff',
        flexGrow: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    typeButton: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    typeButtonActive: {
        backgroundColor: '#f3e8ff',
        borderColor: '#8B5ADF',
    },
    typeButtonText: {
        color: '#4b5563',
        fontWeight: '500',
    },
    typeButtonTextActive: {
        color: '#8B5ADF',
        fontWeight: 'bold',
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
    },
    dateText: {
        fontSize: 15,
        color: '#1f2937',
    },
    textInput: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: '#1f2937',
        minHeight: 100,
    },
    submitButton: {
        flexDirection: 'row',
        backgroundColor: '#8B5ADF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#8B5ADF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
