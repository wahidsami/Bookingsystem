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
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../api/client';

interface RegisterScreenProps {
    onRegisterSuccess: () => void;
    onBackToWelcome: () => void;
    onGoToLogin: () => void;
}

export function RegisterScreen({ onRegisterSuccess, onBackToWelcome, onGoToLogin }: RegisterScreenProps) {
    const { t, isRTL } = useLanguage();
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

    const [avatar, setAvatar] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const pickImage = async () => {
        try {
            // Request permission first
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                alert('Permission to access camera roll is required!');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled) {
                setAvatar(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            alert('Failed to pick image');
        }
    };

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
            // Create FormData for file upload
            const registrationData = new FormData();
            registrationData.append('email', formData.email.trim());
            registrationData.append('phone', formatPhone(formData.phone));
            registrationData.append('password', formData.password);
            registrationData.append('firstName', formData.firstName.trim());
            registrationData.append('lastName', formData.lastName.trim());

            if (formData.dateOfBirth) {
                registrationData.append('dateOfBirth', formData.dateOfBirth);
            }
            if (formData.gender) {
                registrationData.append('gender', formData.gender);
            }

            // Add avatar if selected
            if (avatar) {
                const uriParts = avatar.split('.');
                const fileType = uriParts[uriParts.length - 1];

                registrationData.append('avatar', {
                    uri: avatar,
                    name: `avatar.${fileType}`,
                    type: `image/${fileType}`,
                } as any);
            }

            const response = await api.post<{
                success: boolean;
                accessToken: string;
                refreshToken: string;
                user: any;
            }>('/auth/user/register', registrationData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.success && response.accessToken) {
                // Store tokens and user data
                await api.setTokens(response.accessToken, response.refreshToken);
                await api.setUser(response.user);
                onRegisterSuccess();
            } else {
                setError('Registration failed. Please try again.');
            }
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || 'Registration failed. Please try again.');
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
                        {t('createAccount')}
                    </Text>
                    <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                        {t('registerSubtitle')}
                    </Text>
                </View>

                {/* Error Message */}
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Avatar Picker */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity
                        style={styles.avatarPicker}
                        onPress={pickImage}
                        disabled={loading}
                    >
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatarPreview} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarIcon}>📷</Text>
                                <Text style={styles.avatarText}>{t('addPhoto')}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.avatarHint}>{t('optional')}</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Name Fields */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>{t('firstName')} *</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.rtlInput]}
                                value={formData.firstName}
                                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                                placeholder="Ahmed"
                                editable={!loading}
                            />
                        </View>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>{t('lastName')} *</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.rtlInput]}
                                value={formData.lastName}
                                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                                placeholder="Al-Saud"
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Email */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('email')} *</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder="ahmed@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                    </View>

                    {/* Phone */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('phone')} *</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.phone}
                            onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            placeholder="+966 50 123 4567"
                            keyboardType="phone-pad"
                            editable={!loading}
                        />
                        <Text style={styles.hint}>Saudi format: +966XXXXXXXXX or 05XXXXXXXX</Text>
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('password')} *</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={[styles.input, styles.passwordInput, isRTL && styles.rtlInput]}
                                value={formData.password}
                                onChangeText={(text) => setFormData({ ...formData, password: text })}
                                placeholder="••••••••"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                editable={!loading}
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hint}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number</Text>
                    </View>

                    {/* Confirm Password */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('confirmPassword')} *</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={[styles.input, styles.passwordInput, isRTL && styles.rtlInput]}
                                value={formData.confirmPassword}
                                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                                placeholder="••••••••"
                                secureTextEntry={!showConfirmPassword}
                                autoCapitalize="none"
                                editable={!loading}
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                <Text style={styles.eyeText}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Optional Fields */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>{t('dateOfBirth')}</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.rtlInput]}
                                value={formData.dateOfBirth}
                                onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
                                placeholder="YYYY-MM-DD"
                                editable={!loading}
                            />
                        </View>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>{t('gender')}</Text>
                            <View style={styles.genderButtons}>
                                <TouchableOpacity
                                    style={[styles.genderButton, formData.gender === 'male' && styles.genderButtonSelected]}
                                    onPress={() => setFormData({ ...formData, gender: 'male' })}
                                    disabled={loading}
                                >
                                    <Text style={[styles.genderButtonText, formData.gender === 'male' && styles.genderButtonTextSelected]}>
                                        {t('male')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.genderButton, formData.gender === 'female' && styles.genderButtonSelected]}
                                    onPress={() => setFormData({ ...formData, gender: 'female' })}
                                    disabled={loading}
                                >
                                    <Text style={[styles.genderButtonText, formData.gender === 'female' && styles.genderButtonTextSelected]}>
                                        {t('female')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Register Button */}
                    <TouchableOpacity
                        style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <Text style={styles.registerButtonText}>{t('createAccountButton')}</Text>
                        )}
                    </TouchableOpacity>

                    {/* Login Link */}
                    <View style={styles.loginContainer}>
                        <Text style={styles.loginText}>{t('hasAccount')} </Text>
                        <TouchableOpacity onPress={onGoToLogin}>
                            <Text style={styles.loginLink}>{t('signIn')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
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
        marginBottom: spacing.lg,
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
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    halfWidth: {
        flex: 1,
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
    hint: {
        fontSize: fontSize.xs,
        color: colors.textTertiary,
        marginTop: spacing.xs,
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
    genderButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    genderButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    genderButtonSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    genderButtonText: {
        fontSize: fontSize.sm,
        color: colors.text,
    },
    genderButtonTextSelected: {
        color: colors.textInverse,
    },
    registerButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        marginTop: spacing.lg,
        minHeight: 48,
    },
    registerButtonDisabled: {
        opacity: 0.6,
    },
    registerButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.xl,
        fontWeight: '700',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    loginText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
    },
    loginLink: {
        color: colors.primary,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    avatarPicker: {
        width: 120,
        height: 120,
        borderRadius: 60,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    avatarPreview: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarIcon: {
        fontSize: 40,
        marginBottom: spacing.xs,
    },
    avatarText: {
        fontSize: fontSize.sm,
        color: colors.primary,
        fontWeight: '600',
    },
    avatarHint: {
        fontSize: fontSize.xs,
        color: colors.textTertiary,
    },
});
