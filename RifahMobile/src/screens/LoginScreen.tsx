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
import { useScreenSafeArea } from '../utils/safeArea';
import GoogleIcon from '../../assets/icons/icon_google_brand.svg';
import AppleIcon from '../../assets/icons/icon_apple_brand.svg';
import EyeOpenIcon from '../../assets/icons/icon_eye_open.svg';
import EyeClosedIcon from '../../assets/icons/icon_eye_closed.svg';
import { LinearGradient } from 'expo-linear-gradient';
import { sessionManager } from '../services/SessionManager';

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
            await sessionManager.loginWithPassword(email.trim(), password);
            onLoginSuccess();
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: spacing.lg + topInset,
                        paddingBottom: scrollBottomPadding + 20,
                    }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header with Logo */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../../assets/barspa_logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={[styles.title, isRTL && styles.rtlText]}>
                        {isRTL ? 'تسجيل الدخول إلى حسابك' : 'Sign in to your Account'}
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

                {/* Form Card */}
                <View style={styles.formCard}>
                    <View style={styles.form}>
                        {/* Email */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, isRTL && styles.rtlText]}>{t('email')}</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.emailInputRtl]}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="ahmed@example.com"
                                placeholderTextColor="#9E98B0"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading}
                                accessibilityLabel={t('email')}
                            />
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, isRTL && styles.rtlText]}>{t('password')}</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={[styles.input, isRTL ? styles.passwordInputRtl : styles.passwordInputLtr, isRTL && styles.rtlInput]}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    placeholderTextColor="#9E98B0"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!loading}
                                    accessibilityLabel={t('password')}
                                />
                                <TouchableOpacity
                                    style={[styles.eyeButton, isRTL ? styles.eyeButtonRtl : styles.eyeButtonLtr]}
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOpenIcon width={20} height={20} color="#716B88" />
                                    ) : (
                                        <EyeClosedIcon width={20} height={20} color="#716B88" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Forgot Password */}
                        <TouchableOpacity
                            style={[styles.forgotPasswordButton, isRTL && styles.forgotPasswordRtl]}
                            onPress={onForgotPassword}
                        >
                            <Text style={styles.forgotPasswordText}>{t('forgotPassword')}</Text>
                        </TouchableOpacity>

                        {/* Login Button */}
                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.85}
                            accessibilityLabel={t('signIn')}
                        >
                            <LinearGradient
                                colors={['#6537C0', '#5028A4']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientFill}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.loginButtonText}>{t('signIn')}</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Social Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>
                                {isRTL ? 'أو المتابعة باستخدام' : 'or continue with'}
                            </Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Google Button */}
                        <TouchableOpacity
                            style={[styles.socialButton, isRTL && styles.rowRTL]}
                            onPress={onGoogleSignIn}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            <GoogleIcon width={20} height={20} style={isRTL ? styles.leadingIconRtl : styles.leadingIconLtr} />
                            <Text style={styles.socialButtonText}>{t('continueWithGoogle')}</Text>
                        </TouchableOpacity>

                        {/* Apple Button (Informational / Coming Soon) */}
                        <TouchableOpacity
                            style={[styles.socialButton, styles.appleButtonDisabled, isRTL && styles.rowRTL]}
                            disabled={true}
                        >
                            <AppleIcon width={20} height={20} style={isRTL ? styles.leadingIconRtl : styles.leadingIconLtr} />
                            <Text style={styles.appleButtonText}>
                                Continue with Apple {isRTL ? '(قريباً)' : '(Coming Soon)'}
                            </Text>
                        </TouchableOpacity>

                        {/* Register Link */}
                        <View style={[styles.registerContainer, isRTL && styles.rowRTL]}>
                            <Text style={styles.registerText}>{t('noAccount')} </Text>
                            <TouchableOpacity onPress={onGoToRegister}>
                                <Text style={styles.registerLink}>{t('registerButton')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
    },
    header: {
        marginBottom: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.md,
        width: '100%',
        maxWidth: 440,
    },
    logoContainer: {
        marginBottom: spacing.md,
        alignItems: 'center',
    },
    logo: {
        width: 170,
        height: 95,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1D035F',
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#716B88',
        textAlign: 'center',
        lineHeight: 20,
    },
    rtlText: {
        writingDirection: 'rtl',
    },
    errorContainer: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    errorText: {
        color: colors.error,
        fontSize: fontSize.sm,
    },
    form: {
        width: '100%',
    },
    formCard: {
        width: '100%',
        maxWidth: 440,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FFFFFF',
        padding: 24,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E7DDFC',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1D035F',
        backgroundColor: '#FAF9FC',
        minHeight: 50,
    },
    rtlInput: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    emailInputRtl: {
        textAlign: 'left',
        writingDirection: 'ltr',
    },
    passwordContainer: {
        position: 'relative',
    },
    passwordInputLtr: {
        paddingRight: 50,
        paddingLeft: 16,
    },
    passwordInputRtl: {
        paddingLeft: 50,
        paddingRight: 16,
    },
    eyeButton: {
        position: 'absolute',
        top: 14,
        padding: 4,
    },
    eyeButtonLtr: {
        right: 14,
    },
    eyeButtonRtl: {
        left: 14,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordRtl: {
        alignSelf: 'flex-start',
    },
    forgotPasswordText: {
        color: '#6537C0',
        fontSize: 13,
        fontWeight: '600',
    },
    loginButton: {
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 52,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    gradientFill: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
    },
    loginButtonDisabled: {
        opacity: 0.6,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 18,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E7DDFC',
    },
    dividerText: {
        marginHorizontal: 12,
        fontSize: 12,
        color: '#9E98B0',
        fontWeight: '500',
    },
    socialButton: {
        borderWidth: 1.5,
        borderColor: '#E7DDFC',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginBottom: 10,
        minHeight: 50,
    },
    appleButtonDisabled: {
        opacity: 0.75,
        backgroundColor: '#FAF9FC',
    },
    leadingIcon: {
        marginRight: 8,
    },
    leadingIconLtr: {
        marginRight: 8,
        marginLeft: 0,
    },
    leadingIconRtl: {
        marginRight: 0,
        marginLeft: 8,
    },
    socialButtonText: {
        color: '#1D035F',
        fontSize: 14,
        fontWeight: '600',
    },
    appleButtonText: {
        color: '#1D035F',
        fontSize: 14,
        fontWeight: '600',
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 18,
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    registerText: {
        color: '#716B88',
        fontSize: 14,
    },
    registerLink: {
        color: '#6537C0',
        fontSize: 14,
        fontWeight: '700',
    },
});
