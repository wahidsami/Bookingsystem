import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { submitTimeOffRequest } from '../../src/services/schedule';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

export default function RequestTimeOffModal() {
    const { t } = useTranslation();
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const [type, setType] = useState<'vacation' | 'sick' | 'personal' | 'training' | 'other'>('vacation');
    const [reason, setReason] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const types = [
        { label: t('timeOff.vacation'), value: 'vacation' },
        { label: t('timeOff.sickLeave'), value: 'sick' },
        { label: t('timeOff.personal'), value: 'personal' },
        { label: t('timeOff.training'), value: 'training' },
    ];

    const handleSubmit = async () => {
        if (endDate < startDate) {
            setError(t('timeOff.errorDateEndBeforeStart'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Format dates as YYYY-MM-DD for the backend
            const formattedStart = startDate.toISOString().split('T')[0];
            const formattedEnd = endDate.toISOString().split('T')[0];

            await submitTimeOffRequest(formattedStart, formattedEnd, type, reason);
            router.back(); // Dismiss modal on success
        } catch (err: any) {
            setError(err.message || t('timeOff.errorSubmit'));
            setLoading(false);
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

                {error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('timeOff.typeLabel')}</Text>
                    <View style={styles.typeGrid}>
                        {types.map((t) => (
                            <TouchableOpacity
                                key={t.value}
                                style={[styles.typeButton, type === t.value && styles.typeButtonActive]}
                                onPress={() => setType(t.value as any)}
                            >
                                <Text style={[styles.typeButtonText, type === t.value && styles.typeButtonTextActive]}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.datesRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>{t('timeOff.startDate')}</Text>
                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => setShowStartPicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color="#6b7280" style={{ marginRight: 8 }} />
                            <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                        {showStartPicker && (
                            <DateTimePicker
                                value={startDate}
                                mode="date"
                                display="default"
                                onChange={(event, date) => {
                                    setShowStartPicker(Platform.OS === 'ios');
                                    if (date) setStartDate(date);
                                }}
                            />
                        )}
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>{t('timeOff.endDate')}</Text>
                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => setShowEndPicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color="#6b7280" style={{ marginRight: 8 }} />
                            <Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                        {showEndPicker && (
                            <DateTimePicker
                                value={endDate}
                                mode="date"
                                minimumDate={startDate}
                                display="default"
                                onChange={(event, date) => {
                                    setShowEndPicker(Platform.OS === 'ios');
                                    if (date) setEndDate(date);
                                }}
                            />
                        )}
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('timeOff.reasonLabel')}</Text>
                    <TextInput
                        style={styles.textInput}
                        multiline
                        numberOfLines={4}
                        placeholder={t('timeOff.reasonPlaceholder')}
                        value={reason}
                        onChangeText={setReason}
                        textAlignVertical="top"
                    />
                </View>

                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Ionicons name="send" size={20} color="#ffffff" style={{ marginRight: 8 }} />
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
    errorBox: {
        backgroundColor: '#fee2e2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
    },
    errorText: {
        color: '#991b1b',
        fontSize: 14,
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
    datesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
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
    submitText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
