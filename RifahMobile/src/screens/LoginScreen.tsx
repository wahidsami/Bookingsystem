import React, { useState } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Image,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../api/client';

interface LoginScreenProps {
    onLoginSuccess: () => void;
    onBackToWelcome: () => void;
    onGoToRegister: () => void;
    onForgotPassword: () => void;
}

export function LoginScreen({ onLoginSuccess, onBackToWelcome, onGoToRegister, onForgotPassword }: LoginScreenProps) {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleLogin = async () => {
        setError('');

        // Validation
        if (!email.trim()) {
            setError(t('invalidEmail'));
            return;
        }

        if (!validateEmail(email.trim())) {
            setError(t('invalidEmail'));
            return;
        }

        if (!password) {
            setError(t('passwordTooShort'));
            return;
        }

        setLoading(true);

        try {
            const loginData = {
                email: email.trim(),
                password: password,
            };

            const response = await api.post<{
                success: boolean;
                accessToken: string;
                refreshToken: string;
                user: any;
            }>('/auth/user/login', loginData);

            if (response.success && response.accessToken) {
                // Store tokens and user data
                await api.setTokens(response.accessToken, response.refreshToken);
                await api.setUser(response.user);
                onLoginSuccess();
            } else {
                setError('Login failed. Please check your credentials.');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Back Button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBackToWelcome}
                    accessibilityLabel="Back to welcome"
                >
                    <Text style={styles.backButtonText}>← {t('welcomeTitle')}</Text>
                </TouchableOpacity>

                {/* Header with Logo */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../../assets/refahlogo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={[styles.title, isRTL && styles.rtlText]}>
                        {t('welcomeBack')}
                    </Text>
                    <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                        {t('loginSubtitle')}
                    </Text>
                </View>

                {/* Error Message */}
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Form */}
                <View style={styles.form}>
                    {/* Email */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('email')}</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="ahmed@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                            accessibilityLabel={t('email')}
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('password')}</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={[styles.input, styles.passwordInput, isRTL && styles.rtlInput]}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading}
                                accessibilityLabel={t('password')}
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Forgot Password */}
                    <TouchableOpacity style={styles.forgotPasswordButton} onPress={onForgotPassword}>
                        <Text style={styles.forgotPasswordText}>{t('forgotPassword')}</Text>
                    </TouchableOpacity>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        accessibilityLabel={t('signIn')}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <Text style={styles.loginButtonText}>{t('signIn')}</Text>
                        )}
                    </TouchableOpacity>

                    {/* Register Link */}
                    <View style={styles.registerContainer}>
                        <Text style={styles.registerText}>{t('noAccount')} </Text>
                        <TouchableOpacity onPress={onGoToRegister}>
                            <Text style={styles.registerLink}>{t('registerButton')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxl,
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
    header: {
        marginBottom: spacing.xl,
        alignItems: 'center',
    },
    logoContainer: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    logo: {
        width: 140,
        height: 140,
    },
    title: {
        fontSize: fontSize.xxxl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: fontSize.lg,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    rtlText: {
        writingDirection: 'rtl',
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    errorText: {
        color: '#DC2626',
        fontSize: fontSize.sm,
    },
    form: {
        flex: 1,
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
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: colors.background,
        minHeight: 48,
    },
    rtlInput: {
        textAlign: 'right',
    },
    passwordContainer: {
        position: 'relative',
    },
    passwordInput: {
        paddingRight: 50,
    },
    eyeButton: {
        position: 'absolute',
        right: spacing.md,
        top: spacing.md,
        padding: spacing.xs,
    },
    eyeText: {
        fontSize: 20,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: spacing.lg,
    },
    forgotPasswordText: {
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        marginTop: spacing.md,
        minHeight: 48,
    },
    loginButtonDisabled: {
        opacity: 0.6,
    },
    loginButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.xl,
        fontWeight: '700',
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    registerText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
    },
    registerLink: {
        color: colors.primary,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
});
