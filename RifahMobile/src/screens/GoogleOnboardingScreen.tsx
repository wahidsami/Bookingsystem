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
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

interface GoogleOnboardingScreenProps {
    onSuccess: () => void;
    onBack: () => void;
}

type Step = 'google' | 'phone' | 'otp' | 'name';
const GOOGLE_ONBOARDING_STATE_KEY = 'refah_google_onboarding_state_v1';

type PersistedGoogleOnboardingState = {
    onboardingToken: string;
    phone: string;
    email: string;
    firstName: string;
    lastName: string;
    step: Exclude<Step, 'google'>;
};

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

    const persistOnboardingState = async (patch: Partial<PersistedGoogleOnboardingState> = {}) => {
        const nextState: PersistedGoogleOnboardingState = {
            onboardingToken: patch.onboardingToken ?? onboardingToken,
            phone: patch.phone ?? phone,
            email: patch.email ?? email,
            firstName: patch.firstName ?? firstName,
            lastName: patch.lastName ?? lastName,
            step: patch.step ?? (step === 'google' ? 'phone' : step),
        };

        if (!nextState.onboardingToken || !nextState.step) {
            return;
        }

        await AsyncStorage.setItem(GOOGLE_ONBOARDING_STATE_KEY, JSON.stringify(nextState));
    };

    const clearPersistedOnboardingState = async () => {
        await AsyncStorage.removeItem(GOOGLE_ONBOARDING_STATE_KEY);
    };

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        webClientId: googleClientId || undefined,
        androidClientId: googleAndroidClientId || undefined,
        iosClientId: googleIosClientId || undefined,
        clientId: googleClientId || undefined,
        scopes: ['openid', 'profile', 'email'],
        extraParams: {
            prompt: 'select_account',
        },
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
        const startFreshGoogleFlow = async () => {
            // Avoid re-opening stale OTP/phone steps from previous partial attempts.
            await clearPersistedOnboardingState();
            setStep('google');
            setOnboardingToken('');
            setPhone('');
            setOtp('');
            setOtpHint('');
            setError('');
        };

        startFreshGoogleFlow().catch(() => undefined);
    }, []);

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
                await persistOnboardingState({
                    onboardingToken: startResult.onboardingToken,
                    email: startResult.profile?.email || '',
                    firstName: startResult.profile?.firstName || '',
                    lastName: startResult.profile?.lastName || '',
                    step: 'phone',
                });
                setError('');
            } catch (err: any) {
                setError(err?.message || t('googleSignInFailed'));
            } finally {
                setGooglePromptInFlight(false);
                setLoading(false);
            }
        };

        completeGoogleStart().catch(() => {
            setGooglePromptInFlight(false);
            setLoading(false);
            setError(t('googleSignInFailed'));
        });
    }, [googlePromptInFlight, response, t]);

    const sendOtp = async () => {
        setError('');
        const token = onboardingToken.trim();
        if (!token) {
            setError(t('googleSignInFailed'));
            setStep('google');
            return;
        }
        const normalizedPhone = normalizePhoneForApi(phone);
        if (!normalizedPhone) {
            setError(t('enterPhoneNumber'));
            return;
        }

        try {
            setLoading(true);
            const sendResult = await api.googleSendPhoneOtp(token, normalizedPhone);
            setPhone(sendResult.phone || normalizedPhone);
            setOtpHint(sendResult.testCodeEnabled ? t('devOtpHint') : t('otpSentToPhone'));
            setStep('otp');
            await persistOnboardingState({
                onboardingToken: token,
                phone: sendResult.phone || normalizedPhone,
                step: 'otp',
            });
        } catch (err: any) {
            setError(err?.message || t('otpSendFailed'));
        } finally {
            setLoading(false);
        }
    };

    const completeFlow = async (forceNameStep = false) => {
        setError('');
        const token = onboardingToken.trim();
        const normalizedPhone = normalizePhoneForApi(phone);

        if (!token || !normalizedPhone) {
            setError(t('googleSignInFailed'));
            setStep('phone');
            return;
        }

        if (!otp.trim()) {
            setError(t('enterOtp'));
            return;
        }

        if (forceNameStep || !firstName.trim() || !lastName.trim()) {
            setStep('name');
            await persistOnboardingState({
                onboardingToken: token,
                phone: normalizedPhone,
                step: 'name',
            });
            return;
        }

        try {
            setLoading(true);
            const completeResult = await api.googleComplete({
                onboardingToken: token,
                phone: normalizedPhone,
                otp: otp.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });

            await api.setTokens(completeResult.accessToken, completeResult.refreshToken);
            await api.setUser(completeResult.user);
            await clearPersistedOnboardingState();
            onSuccess();
        } catch (err: any) {
            setError(err?.message || t('completeRegistrationFailed'));
        } finally {
            setLoading(false);
        }
    };

    const includeNameStep = !firstName.trim() || !lastName.trim();
    const totalSteps = includeNameStep ? 4 : 3;
    const currentStep = (() => {
        if (step === 'google') return 1;
        if (step === 'phone') return 2;
        if (step === 'otp') return 3;
        return totalSteps;
    })();

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
                    {t('stepOf').replace('{{current}}', String(currentStep)).replace('{{total}}', String(totalSteps))}
                </Text>

                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {step === 'google' ? (
                    <View style={styles.card}>
                        <Text style={styles.infoText}>{t('signInWithGoogleFirst')}</Text>
                        <TouchableOpacity
                            style={[styles.primaryButton, (loading || !request || !canStartGoogle) && styles.disabledButton]}
                            disabled={loading || !request || !canStartGoogle}
                            onPress={() => beginGoogleFlow()}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('continueWithGoogle')}</Text>}
                        </TouchableOpacity>
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
