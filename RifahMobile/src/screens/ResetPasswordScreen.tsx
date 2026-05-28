import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { LinearGradient } from 'expo-linear-gradient';

interface ResetPasswordScreenProps {
    token: string;
    onBackToLogin: () => void;
}

export function ResetPasswordScreen({ token, onBackToLogin }: ResetPasswordScreenProps) {
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const tokenIsValid = useMemo(() => token.trim().length > 0, [token]);

    const handleSubmit = async () => {
        setError('');
        setSuccessMessage('');

        if (!tokenIsValid) {
            setError(t('invalidResetToken'));
            return;
        }

        if (password.length < 8) {
            setError(t('passwordMinLength'));
            return;
        }

        if (password !== confirmPassword) {
            setError(t('passwordsDoNotMatch'));
            return;
        }

        setLoading(true);
        try {
            const response = await api.resetPassword(token, password);
            setSuccessMessage(response.message || t('passwordResetSuccess'));
        } catch (err: any) {
            setError(err.message || t('passwordResetFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <LinearGradient
                colors={['#FFFFFF', '#F8F2FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: spacing.xl + topInset,
                        paddingBottom: scrollBottomPadding,
                    }
                ]}
                keyboardShouldPersistTaps="handled"
            >
                <TouchableOpacity style={styles.backButton} onPress={onBackToLogin}>
                    <Text style={styles.backButtonText}>← {t('signIn')}</Text>
                </TouchableOpacity>

                <Text style={[styles.title, isRTL && styles.rtlText]}>{t('resetPasswordTitle')}</Text>
                <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('resetPasswordSubtitle')}</Text>

                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {successMessage ? (
                    <View style={styles.successContainer}>
                        <Text style={styles.successText}>{successMessage}</Text>
                    </View>
                ) : null}

                <View style={styles.formCard}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('newPassword')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('confirmPassword')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        editable={!loading}
                    />
                </View>

                <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={loading}>
                    {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.submitButtonText}>{t('saveNewPassword')}</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={onBackToLogin}>
                    <Text style={styles.secondaryButtonText}>{t('backToLogin')}</Text>
                </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F4FF',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
    },
    backButton: {
        paddingVertical: spacing.sm,
        marginBottom: spacing.md,
    },
    backButtonText: {
        fontSize: fontSize.md,
        color: colors.primary,
        fontWeight: '600',
    },
    title: {
        fontSize: fontSize.xxxl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.xl,
    },
    rtlText: {
        writingDirection: 'rtl',
        textAlign: 'right',
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    errorText: {
        color: colors.error,
        fontSize: fontSize.sm,
    },
    successContainer: {
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#86EFAC',
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    successText: {
        color: colors.accentDark,
        fontSize: fontSize.sm,
    },
    formCard: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        backgroundColor: '#FFFFFFEB',
        padding: spacing.lg,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 2,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 14,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: '#FAFAFF',
        minHeight: 48,
    },
    rtlInput: {
        textAlign: 'right',
    },
    submitButton: {
        backgroundColor: '#7C3AED',
        borderRadius: 16,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        minHeight: 48,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.xl,
        fontWeight: '700',
    },
    secondaryButton: {
        marginTop: spacing.lg,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
        fontWeight: '600',
    },
});
