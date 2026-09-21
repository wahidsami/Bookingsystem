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

interface RegisterScreenProps {
    onRegisterSuccess: () => void;
    onBackToWelcome: () => void;
    onGoToLogin: () => void;
    onGoogleSignIn: () => void;
}

export function RegisterScreen({ onRegisterSuccess, onBackToWelcome, onGoToLogin, onGoogleSignIn }: RegisterScreenProps) {
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        dateOfBirth: '',
        gender: '' as 'male' | 'female' | 'other' | '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string): boolean => {
        const phoneRegex = /^\+966[0-9]{9}$|^0[0-9]{9}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    };

    const validatePassword = (password: string): boolean => {
        return password.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
    };

    const formatPhone = (phone: string): string => {
        let formatted = phone.replace(/\s/g, '');
        if (formatted.startsWith('0')) {
            formatted = '+966' + formatted.substring(1);
        } else if (!formatted.startsWith('+966')) {
            formatted = '+966' + formatted;
        }
        return formatted;
    };

    const handleRegister = async () => {
        setError('');

        // Validation
        if (formData.firstName.length < 2) {
            setError(t('firstNameTooShort'));
            return;
        }

        if (formData.lastName.length < 2) {
            setError(t('lastNameTooShort'));
            return;
        }

        if (!validateEmail(formData.email.trim())) {
            setError(t('invalidEmail'));
            return;
        }

        if (!validatePhone(formData.phone)) {
            setError(t('invalidPhone'));
            return;
        }

        if (!validatePassword(formData.password)) {
            if (formData.password.length < 8) {
                setError(t('passwordTooShort'));
            } else {
                setError(t('passwordWeak'));
            }
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError(t('passwordMismatch'));
            return;
        }

        setLoading(true);

        try {
            await sessionManager.registerCustomer({
                email: formData.email.trim(),
                phone: formatPhone(formData.phone),
                password: formData.password,
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                dateOfBirth: formData.dateOfBirth || undefined,
                gender: formData.gender || undefined,
            });
            onRegisterSuccess();
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || t('registrationFailed'));
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
                        {t('createAccount')}
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
                        {/* Name Fields */}
                        <View style={[styles.row, isRTL && styles.rowRTL]}>
                            <View style={[styles.inputGroup, styles.halfWidth]}>
                                <Text style={[styles.label, isRTL && styles.rtlText]}>{t('firstName')} *</Text>
                                <TextInput
                                    style={[styles.input, isRTL && styles.rtlInput]}
                                    value={formData.firstName}
                                    onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                                    placeholder="Ahmed"
                                    placeholderTextColor="#9E98B0"
                                    editable={!loading}
                                />
                            </View>
                            <View style={[styles.inputGroup, styles.halfWidth]}>
                                <Text style={[styles.label, isRTL && styles.rtlText]}>{t('lastName')} *</Text>
                                <TextInput
                                    style={[styles.input, isRTL && styles.rtlInput]}
                                    value={formData.lastName}
                                    onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                                    placeholder="Al-Saud"
                                    placeholderTextColor="#9E98B0"
                                    editable={!loading}
                                />
                            </View>
                        </View>

                        {/* Email */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, isRTL && styles.rtlText]}>{t('email')} *</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.emailInputRtl]}
                                value={formData.email}
                                onChangeText={(text) => setFormData({ ...formData, email: text })}
                                placeholder="ahmed@example.com"
                                placeholderTextColor="#9E98B0"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading}
                            />
                        </View>

                        {/* Phone */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, isRTL && styles.rtlText]}>{t('phone')} *</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.phoneInputRtl]}
                                value={formData.phone}
                                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                placeholder="+966 50 123 4567"
                                placeholderTextColor="#9E98B0"
                                keyboardType="phone-pad"
                                editable={!loading}
                            />
                            <Text style={[styles.hint, isRTL && styles.rtlText]}>
                                {isRTL ? 'الصيغة السعودية: +966XXXXXXXXX أو 05XXXXXXXX' : 'Saudi format: +966XXXXXXXXX or 05XXXXXXXX'}
                            </Text>
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, isRTL && styles.rtlText]}>{t('password')} *</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={[styles.input, isRTL ? styles.passwordInputRtl : styles.passwordInputLtr, isRTL && styles.rtlInput]}
                                    value={formData.password}
                                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                                    placeholder="••••••••"
                                    placeholderTextColor="#9E98B0"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    editable={!loading}
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
                            <Text style={[styles.hint, isRTL && styles.rtlText]}>
                                {isRTL ? 'على الأقل 8 خانات، حرف كبير، حرف صغير، ورقم' : 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number'}
                            </Text>
                        </View>

                        {/* Confirm Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, isRTL && styles.rtlText]}>{t('confirmPassword')} *</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={[styles.input, isRTL ? styles.passwordInputRtl : styles.passwordInputLtr, isRTL && styles.rtlInput]}
                                    value={formData.confirmPassword}
                                    onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                                    placeholder="••••••••"
                                    placeholderTextColor="#9E98B0"
                                    secureTextEntry={!showConfirmPassword}
                                    autoCapitalize="none"
                                    editable={!loading}
                                />
                                <TouchableOpacity
                                    style={[styles.eyeButton, isRTL ? styles.eyeButtonRtl : styles.eyeButtonLtr]}
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOpenIcon width={20} height={20} color="#716B88" />
                                    ) : (
                                        <EyeClosedIcon width={20} height={20} color="#716B88" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Register Button */}
                        <TouchableOpacity
                            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                            activeOpacity={0.85}
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
                                    <Text style={styles.registerButtonText}>{t('createAccountButton')}</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Social Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>
                                {isRTL ? 'أو التسجيل باستخدام' : 'or continue with'}
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
                            <GoogleIcon width={20} height={20} style={[styles.leadingIcon, isRTL ? styles.leadingIconRtl : styles.leadingIconLtr]} />
                            <Text style={styles.socialButtonText}>{t('continueWithGoogle')}</Text>
                        </TouchableOpacity>

                        {/* Apple Button (Informational / Coming Soon) */}
                        <TouchableOpacity
                            style={[styles.socialButton, styles.appleButtonDisabled, isRTL && styles.rowRTL]}
                            disabled={true}
                        >
                            <AppleIcon width={20} height={20} style={[styles.leadingIcon, isRTL ? styles.leadingIconRtl : styles.leadingIconLtr]} />
                            <Text style={styles.appleButtonText}>
                                Continue with Apple {isRTL ? '(قريباً)' : '(Coming Soon)'}
                            </Text>
                        </TouchableOpacity>

                        {/* Login Link */}
                        <View style={[styles.loginContainer, isRTL && styles.rowRTL]}>
                            <Text style={styles.loginText}>{t('hasAccount')} </Text>
                            <TouchableOpacity onPress={onGoToLogin}>
                                <Text style={styles.loginLink}>{t('signIn')}</Text>
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
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    inputGroup: {
        marginBottom: 14,
    },
    halfWidth: {
        flex: 1,
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
    phoneInputRtl: {
        textAlign: 'left',
        writingDirection: 'ltr',
    },
    hint: {
        fontSize: 11,
        color: '#716B88',
        marginTop: 4,
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
    registerButton: {
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 52,
        marginTop: 6,
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
    registerButtonDisabled: {
        opacity: 0.6,
    },
    registerButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
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
    leadingIcon: {},
    leadingIconLtr: {
        marginRight: 8,
    },
    leadingIconRtl: {
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
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    loginText: {
        color: '#716B88',
        fontSize: 14,
    },
    loginLink: {
        color: '#6537C0',
        fontSize: 14,
        fontWeight: '700',
    },
});
