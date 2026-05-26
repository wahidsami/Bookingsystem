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
    Image,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import GoogleIcon from '../../assets/icons/icon_google_brand.svg';
import AppleIcon from '../../assets/icons/icon_apple_brand.svg';
import EyeOpenIcon from '../../assets/icons/icon_eye_open.svg';
import EyeClosedIcon from '../../assets/icons/icon_eye_closed.svg';
import { LinearGradient } from 'expo-linear-gradient';

interface LoginScreenProps {
    onLoginSuccess: () => void;
    onBackToWelcome: () => void;
    onGoToRegister: () => void;
    onForgotPassword: () => void;
    onGoogleSignIn: () => void;
}

export function LoginScreen({ onLoginSuccess, onBackToWelcome, onGoToRegister, onForgotPassword, onGoogleSignIn }: LoginScreenProps) {
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
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
            }>('/auth/user/login', loginData, { timeoutMs: 30000 });

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
            setError(err?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
                        Sign in to your Account
                    </Text>
                    <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                        {t('welcomeSubtitle')}
                    </Text>
                </View>

                {/* Error Message */}
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Form */}
                <View style={styles.formCard}>
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
                                {showPassword ? (
                                    <EyeOpenIcon width={20} height={20} color={colors.textSecondary} />
                                ) : (
                                    <EyeClosedIcon width={20} height={20} color={colors.textSecondary} />
                                )}
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

                    <TouchableOpacity
                        style={[styles.googleButton, loading && styles.loginButtonDisabled]}
                        onPress={onGoogleSignIn}
                        disabled={loading}
                    >
                        <GoogleIcon width={20} height={20} style={styles.leadingIcon} />
                        <Text style={styles.googleButtonText}>{t('continueWithGoogle')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.appleButton} disabled={true}>
                        <AppleIcon width={20} height={20} style={styles.leadingIcon} />
                        <Text style={styles.appleButtonText}>Continue with Apple</Text>
                    </TouchableOpacity>

                    {/* Register Link */}
                    <View style={styles.registerContainer}>
                        <Text style={styles.registerText}>{t('noAccount')} </Text>
                        <TouchableOpacity onPress={onGoToRegister}>
                            <Text style={styles.registerLink}>{t('registerButton')}</Text>
                        </TouchableOpacity>
                    </View>
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
    },
    header: {
        marginBottom: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    logoContainer: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    logo: {
        width: 110,
        height: 110,
    },
    title: {
        fontSize: fontSize.xxxl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    rtlText: {
        writingDirection: 'rtl',
    },
    errorContainer: {
        backgroundColor: `${colors.error}22`,
        borderWidth: 1,
        borderColor: `${colors.error}66`,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    errorText: {
        color: colors.error,
        fontSize: fontSize.sm,
    },
    form: {
        flex: 1,
    },
    formCard: {
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: `${colors.surface}D9`,
        padding: spacing.lg,
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
    googleButton: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: spacing.sm,
        minHeight: 48,
    },
    leadingIcon: {
        marginRight: spacing.sm,
    },
    googleButtonText: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: '700',
    },
    appleButton: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: spacing.sm,
        minHeight: 48,
        opacity: 0.7,
    },
    appleButtonText: {
        color: colors.text,
        fontSize: fontSize.lg,
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
