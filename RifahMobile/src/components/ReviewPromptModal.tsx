import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { AppIcon } from './AppIcon';
import { api, Booking } from '../api/client';

const { width } = Dimensions.get('window');

interface ReviewPromptModalProps {
    visible: boolean;
    onClose: () => void;
    appointment: Booking | null;
    onSuccess: () => void;
}

export function ReviewPromptModal({ visible, onClose, appointment, onSuccess }: ReviewPromptModalProps) {
    const { t } = useLanguage();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!appointment) return null;

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert(t('error' as any) || 'Error', 'Please select a rating.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                tenantId: appointment.tenantId,
                staffId: appointment.staffId,
                appointmentId: appointment.id,
                rating,
                comment,
                customerName: (appointment as any).user?.firstName || (appointment as any).legacyCustomer?.firstName || 'Valued Customer'
            };

            const res = await api.post<{ success: boolean; message?: string }>(`/users/reviews`, payload);
            if (res.success) {
                Alert.alert('Success', 'Thank you for your review!');
                onSuccess();
                onClose();
            } else {
                Alert.alert('Error', res.message || 'Failed to submit review.');
            }
        } catch (error: any) {
            const backendMessage = error?.response?.data?.message || error?.message || 'Failed to submit review.';
            const isDuplicate = `${backendMessage}`.toLowerCase().includes('already submitted a review');
            if (isDuplicate) {
                Alert.alert('Info', 'You have already reviewed this appointment.');
                onClose();
                return;
            }
            Alert.alert('Error', backendMessage);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>How was your experience?</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <AppIcon name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Rate your appointment with {appointment.Staff?.name} at {appointment.tenant?.name}.
                    </Text>

                    <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                <AppIcon
                                    name="star"
                                    size={40}
                                    color={star <= rating ? '#F59E0B' : '#D1D5DB'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="Share details of your experience (optional)"
                        multiline
                        numberOfLines={4}
                        value={comment}
                        onChangeText={setComment}
                        textAlignVertical="top"
                    />

                    <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.submitText}>Submit Review</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: 'bold',
        color: colors.text,
    },
    closeButton: {
        padding: spacing.xs,
    },
    subtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    starIcon: {
        marginHorizontal: spacing.xs,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        marginBottom: spacing.xl,
        minHeight: 100,
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitText: {
        color: 'white',
        fontSize: fontSize.lg,
        fontWeight: 'bold',
    },
});
