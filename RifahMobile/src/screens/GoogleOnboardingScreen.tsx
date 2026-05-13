import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { api } from '../api/client';
import { getGoogleAndroidClientId, getGoogleIosClientId, getGoogleWebClientId } from '../config/env';
import { useScreenSafeArea } from '../utils/safeArea';
import { useLanguage } from '../contexts/LanguageContext';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

interface GoogleOnboardingScreenProps {
    onSuccess: () => void;
    onBack: () => void;
}

type Step = 'google' | 'phone' | 'otp' | 'name';

const extractIdToken = (authResult: any, responseState: any): string => {
    const directToken =
        authResult?.params?.id_token ||
        responseState?.params?.id_token ||
        authResult?.authentication?.idToken ||
        responseState?.authentication?.idToken;

    if (directToken) {
        return `${directToken}`;
    }

    const rawUrl = `${authResult?.url || ''}`;
    if (!rawUrl) {
        return '';
    }

    const hashIndex = rawUrl.indexOf('#');
    if (hashIndex >= 0) {
        const hashParams = new URLSearchParams(rawUrl.slice(hashIndex + 1));
        const tokenFromHash = hashParams.get('id_token');
        if (tokenFromHash) {
            return tokenFromHash;
        }
    }

    const queryIndex = rawUrl.indexOf('?');
    if (queryIndex >= 0) {
        const queryParams = new URLSearchParams(rawUrl.slice(queryIndex + 1));
        const tokenFromQuery = queryParams.get('id_token');
        if (tokenFromQuery) {
            return tokenFromQuery;
        }
    }

    return '';
};

const normalizePhoneForApi = (value: string) => {
    const stripped = value.replace(/[\s\-()]/g, '');
    if (!stripped) return '';
    if (stripped.startsWith('+')) return stripped;
    if (stripped.startsWith('00')) return `+${stripped.slice(2)}`;
    if (stripped.startsWith('966')) return `+${stripped}`;
    if (stripped.startsWith('0')) return `+966${stripped.slice(1)}`;
    return `+${stripped}`;
};

export function GoogleOnboardingScreen({ onSuccess, onBack }: GoogleOnboardingScreenProps) {
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const { t } = useLanguage();
    const googleClientId = getGoogleWebClientId();
    const googleAndroidClientId = getGoogleAndroidClientId();
    const googleIosClientId = getGoogleIosClientId();

    const [step, setStep] = useState<Step>('google');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [onboardingToken, setOnboardingToken] = useState('');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [otpHint, setOtpHint] = useState('');
    const [googlePromptInFlight, setGooglePromptInFlight] = useState(false);
    const [googlePromptStarted, setGooglePromptStarted] = useState(false);

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        webClientId: googleClientId || undefined,
        androidClientId: googleAndroidClientId || undefined,
        iosClientId: googleIosClientId || undefined,
        clientId: googleClientId || undefined,
        scopes: ['openid', 'profile', 'email'],
    });

    const canStartGoogle = useMemo(() => {
        if (Platform.OS === 'android') {
            return Boolean(googleAndroidClientId);
        }
        if (Platform.OS === 'ios') {
            return Boolean(googleIosClientId);
        }
        return Boolean(googleClientId);
    }, [googleAndroidClientId, googleClientId, googleIosClientId]);

    const beginGoogleFlow = async () => {
        setError('');
        if (!canStartGoogle) {
            setError(t('googleMissingClientId'));
            return;
        }

        try {
            setLoading(true);
            setGooglePromptInFlight(true);
            const result = await promptAsync();
            if (result.type !== 'success') {
                setGooglePromptInFlight(false);
                setLoading(false);
            }
        } catch (err: any) {
            setGooglePromptInFlight(false);
            setError(err?.message || t('googleSignInFailed'));
            setLoading(false);
        }
    };

    useEffect(() => {
        if (step !== 'google' || googlePromptStarted || !request || !canStartGoogle) {
            return;
        }
        setGooglePromptStarted(true);
        beginGoogleFlow().catch(() => undefined);
    }, [step, googlePromptStarted, request, canStartGoogle]);

    useEffect(() => {
        const completeGoogleStart = async () => {
            if (!googlePromptInFlight) {
                return;
            }

            const idToken = extractIdToken(response as any, response as any);
            if (!idToken) {
                return;
            }

            try {
                const startResult = await api.googleStart(idToken);
                if (startResult.requiresOnboarding === false && startResult.accessToken && startResult.refreshToken && startResult.user) {
                    await api.setTokens(startResult.accessToken, startResult.refreshToken);
                    await api.setUser(startResult.user);
                    setError('');
                    onSuccess();
                    return;
                }

                if (!startResult.onboardingToken) {
                    throw new Error(t('googleSignInFailed'));
                }
                setOnboardingToken(startResult.onboardingToken);
                setEmail(startResult.profile?.email || '');
                setFirstName(startResult.profile?.firstName || '');
                setLastName(startResult.profile?.lastName || '');
                setStep('phone');
                setError('');
            } catch (err: any) {
                setError(err?.message || t('googleSignInFailed'));
                setGooglePromptStarted(false);
            } finally {
                setGooglePromptInFlight(false);
                setLoading(false);
            }
        };

        completeGoogleStart().catch(() => {
            setGooglePromptInFlight(false);
            setLoading(false);
            setError(t('googleSignInFailed'));
            setGooglePromptStarted(false);
        });
    }, [googlePromptInFlight, response, t]);

    const sendOtp = async () => {
        setError('');
        const normalizedPhone = normalizePhoneForApi(phone);
        if (!normalizedPhone) {
            setError(t('enterPhoneNumber'));
            return;
        }

        try {
            setLoading(true);
            const sendResult = await api.googleSendPhoneOtp(onboardingToken, normalizedPhone);
            setPhone(sendResult.phone || normalizedPhone);
            setOtpHint(sendResult.testCodeEnabled ? t('devOtpHint') : t('otpSentToPhone'));
            setStep('otp');
        } catch (err: any) {
            setError(err?.message || t('otpSendFailed'));
        } finally {
            setLoading(false);
        }
    };

    const completeFlow = async (forceNameStep = false) => {
        setError('');

        if (!otp.trim()) {
            setError(t('enterOtp'));
            return;
        }

        if (forceNameStep || !firstName.trim() || !lastName.trim()) {
            setStep('name');
            return;
        }

        try {
            setLoading(true);
            const completeResult = await api.googleComplete({
                onboardingToken,
                phone: normalizePhoneForApi(phone),
                otp: otp.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });

            await api.setTokens(completeResult.accessToken, completeResult.refreshToken);
            await api.setUser(completeResult.user);
            onSuccess();
        } catch (err: any) {
            setError(err?.message || t('completeRegistrationFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.xl + topInset, paddingBottom: scrollBottomPadding }]}
                keyboardShouldPersistTaps="handled"
            >
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text style={styles.backButtonText}>← {t('back')}</Text>
                </TouchableOpacity>

                <Text style={styles.title}>{t('googleOnboardingTitle')}</Text>
                <Text style={styles.subtitle}>
                    {t('stepOf').replace('{{current}}', step === 'google' ? '1' : step === 'phone' ? '2' : step === 'otp' ? '3' : '4').replace('{{total}}', '4')}
                </Text>

                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {step === 'google' ? (
                    <View style={styles.card}>
                        <Text style={styles.infoText}>{t('signInWithGoogleFirst')}</Text>
                        {loading ? <ActivityIndicator color={colors.primary} /> : null}
                    </View>
                ) : null}

                {step === 'phone' ? (
                    <View style={styles.card}>
                        <Text style={styles.label}>{t('googleEmailLabel')}</Text>
                        <TextInput style={[styles.input, styles.readOnlyInput]} value={email} editable={false} />

                        <Text style={styles.label}>{t('mobileNumberLabel')}</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            placeholder="+966 5X XXX XXXX"
                            editable={!loading}
                        />

                        <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} disabled={loading} onPress={sendOtp}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('sendOtp')}</Text>}
                        </TouchableOpacity>
                    </View>
                ) : null}

                {step === 'otp' ? (
                    <View style={styles.card}>
                        <Text style={styles.infoText}>{t('phoneLabel')}: {phone}</Text>
                        {otpHint ? <Text style={styles.hintText}>{otpHint}</Text> : null}

                        <Text style={styles.label}>{t('otpCodeLabel')}</Text>
                        <TextInput
                            style={styles.input}
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            placeholder="Enter OTP"
                            editable={!loading}
                        />

                        <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} disabled={loading} onPress={() => completeFlow()}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('verifyContinue')}</Text>}
                        </TouchableOpacity>
                    </View>
                ) : null}

                {step === 'name' ? (
                    <View style={styles.card}>
                        <Text style={styles.infoText}>{t('completeAccountDetails')}</Text>
                        <Text style={styles.label}>{t('firstName')}</Text>
                        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} editable={!loading} />
                        <Text style={styles.label}>{t('lastName')}</Text>
                        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} editable={!loading} />

                        <TouchableOpacity
                            style={[styles.primaryButton, loading && styles.disabledButton]}
                            disabled={loading}
                            onPress={() => {
                                if (!firstName.trim() || !lastName.trim()) {
                                    Alert.alert(t('missingFieldsTitle'), t('missingNamesMessage'));
                                    return;
                                }
                                completeFlow();
                            }}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('finishRegistration')}</Text>}
                        </TouchableOpacity>
                    </View>
                ) : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: spacing.lg },
    backButton: { paddingVertical: spacing.sm, marginBottom: spacing.md },
    backButtonText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
    title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.lg },
    errorContainer: { backgroundColor: '#fee2e2', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
    errorText: { color: '#b91c1c', fontSize: fontSize.sm, fontWeight: '600' },
    card: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: '#ede9fe' },
    label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
    infoText: { fontSize: fontSize.md, color: colors.text, marginBottom: spacing.xs },
    hintText: { fontSize: fontSize.sm, color: '#6d28d9', marginBottom: spacing.xs },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: fontSize.md,
        backgroundColor: '#fff',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    readOnlyInput: { backgroundColor: '#f3f4f6' },
    primaryButton: {
        backgroundColor: '#8B5ADF',
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: fontSize.md },
    disabledButton: { opacity: 0.6 },
});
