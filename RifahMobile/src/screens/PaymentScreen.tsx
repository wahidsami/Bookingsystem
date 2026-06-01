import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { api } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import type { EligiblePaymentSource } from '../api/client';

export function PaymentScreen({ route, navigation }: any) {
    const { t, isRTL } = useLanguage();
    const { appointmentId, orderId, bookingSessionId, amount, tenantId, paymentChoice } = route.params || {};
    const { topInset, scrollBottomPadding } = useScreenSafeArea();

    const [cardNumber, setCardNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [sourcesLoading, setSourcesLoading] = useState(true);
    const [sourceOptions, setSourceOptions] = useState<EligiblePaymentSource[]>([]);
    const amountValue = Number(amount || 0);
    const paymentIdempotencyKeyRef = React.useRef<string>(
        `pay:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
    );

    React.useEffect(() => {
        let mounted = true;
        api.getWalletBalance()
            .then((balance) => {
                if (mounted) setWalletBalance(balance);
            })
            .catch(() => undefined);
        return () => { mounted = false; };
    }, []);

    React.useEffect(() => {
        let mounted = true;

        const loadSources = async () => {
            try {
                setSourcesLoading(true);
                const response = await api.getEligiblePaymentSources({
                    tenantId: tenantId ? String(tenantId) : undefined,
                    amount: amountValue,
                });

                if (!mounted) return;
                const eligible = (response.sources || []).filter((source) => source.eligible);
                setSourceOptions(eligible);

                const hasOnline = eligible.some((source) => source.source === 'online_payment');
                const hasWallet = eligible.some((source) => source.source === 'wallet');

                if (paymentMethod === 'wallet' && !hasWallet) {
                    setPaymentMethod(hasOnline ? 'card' : 'wallet');
                }
                if (paymentMethod === 'card' && !hasOnline && hasWallet) {
                    setPaymentMethod('wallet');
                }
            } catch {
                if (!mounted) return;
                // Fallback to legacy behavior if endpoint is unavailable.
                setSourceOptions([]);
            } finally {
                if (mounted) setSourcesLoading(false);
            }
        };

        loadSources();
        return () => { mounted = false; };
    }, [tenantId, amountValue]);

    const canUseCard = React.useMemo(() => {
        if (sourceOptions.length === 0) return true;
        return sourceOptions.some((source) => source.source === 'online_payment');
    }, [sourceOptions]);

    const canUseWallet = React.useMemo(() => {
        if (sourceOptions.length === 0) return true;
        return sourceOptions.some((source) => source.source === 'wallet');
    }, [sourceOptions]);

    const hasAnyEligibleSource = canUseCard || canUseWallet;

    const handlePay = async () => {
        if (!hasAnyEligibleSource) {
            Alert.alert(
                t('error'),
                isRTL ? 'لا توجد وسيلة دفع متاحة حالياً لهذه العملية.' : 'No payment method is currently available for this checkout.'
            );
            return;
        }

        if (paymentMethod === 'wallet' && walletBalance < amountValue) {
            Alert.alert(t('error'), isRTL ? 'رصيد المحفظة غير كافٍ' : 'Insufficient wallet balance');
            return;
        }

        if (paymentMethod === 'card' && (!cardNumber || !expiryDate || !cvv || !cardholderName)) {
            Alert.alert(t('error'), t('fillAllFields'));
            return;
        }

        try {
            setLoading(true);
            const response = await api.processPayment({
                appointmentId,
                orderId,
                bookingSessionId,
                amount: amountValue,
                paymentMethod,
                cardNumber: paymentMethod === 'card' ? cardNumber.replace(/\s/g, '') : undefined,
                expiryDate: paymentMethod === 'card' ? expiryDate : undefined,
                cvv: paymentMethod === 'card' ? cvv : undefined,
                cardholderName: paymentMethod === 'card' ? cardholderName : undefined,
                tenantId,
                paymentChoice,
                idempotencyKey: paymentIdempotencyKeyRef.current,
            });

            if (response.success) {
                Alert.alert(t('success'), t('paymentSuccessful'), [
                    {
                        text: t('ok'),
                        onPress: () => {
                            navigation.navigate('Tabs', {
                                screen: orderId ? 'Purchases' : 'Appointments',
                            });
                        },
                    },
                ]);
                if (paymentMethod === 'wallet') {
                    const latest = await api.getWalletBalance().catch(() => walletBalance);
                    setWalletBalance(latest);
                }
            }
        } catch (error: any) {
            Alert.alert(t('error'), error.message || t('paymentFailed'));
        } finally {
            setLoading(false);
        }
    };

    const fillTestCard = () => {
        setCardNumber('4242 4242 4242 4242');
        setExpiryDate('12/30');
        setCvv('123');
        setCardholderName('Test User');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('payment')}</Text>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}>
                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>
                        {paymentChoice === 'booking-fee'
                            ? (isRTL ? 'المبلغ المطلوب الآن' : 'Due Now')
                            : t('totalAmount')}
                    </Text>
                    <Text style={styles.amountValue}>{formatRiyal(amountValue, isRTL ? 'ar' : 'en')}</Text>
                    {paymentChoice === 'booking-fee' ? (
                        <Text style={styles.amountHint}>
                            {isRTL ? 'هذا هو عربون الحجز المطلوب لتأكيد الموعد.' : 'This is the booking fee required to confirm your appointment.'}
                        </Text>
                    ) : null}
                    <Text style={styles.amountHint}>
                        {isRTL ? `رصيد المحفظة: ${formatRiyal(walletBalance, 'ar')}` : `Wallet balance: ${formatRiyal(walletBalance, 'en')}`}
                    </Text>
                </View>

                <View style={styles.methodOptions}>
                    <TouchableOpacity
                        style={[styles.methodOption, paymentMethod === 'card' && styles.methodOptionActive, !canUseCard && styles.methodOptionDisabled]}
                        onPress={() => canUseCard && setPaymentMethod('card')}
                        disabled={!canUseCard}
                    >
                        <AppIcon name="card" size={20} color={paymentMethod === 'card' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.methodOptionText, paymentMethod === 'card' && styles.methodOptionTextActive]}>
                            {isRTL ? 'بطاقة' : 'Card'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.methodOption, paymentMethod === 'wallet' && styles.methodOptionActive, !canUseWallet && styles.methodOptionDisabled]}
                        onPress={() => canUseWallet && setPaymentMethod('wallet')}
                        disabled={!canUseWallet}
                    >
                        <AppIcon name="cash" size={20} color={paymentMethod === 'wallet' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.methodOptionText, paymentMethod === 'wallet' && styles.methodOptionTextActive]}>
                            {isRTL ? 'المحفظة' : 'Wallet'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {sourcesLoading ? (
                    <Text style={styles.amountHint}>
                        {isRTL ? 'جار تحميل مصادر الدفع...' : 'Loading payment sources...'}
                    </Text>
                ) : null}
                {!sourcesLoading && !canUseWallet ? (
                    <Text style={styles.amountHint}>
                        {isRTL ? 'المحفظة غير متاحة لهذه العملية حالياً.' : 'Wallet is not available for this checkout right now.'}
                    </Text>
                ) : null}

                {paymentMethod === 'card' ? (
                    <>
                        {/* Virtual Card Tip */}
                        <TouchableOpacity style={styles.testCardButton} onPress={fillTestCard}>
                            <View style={styles.testCardRow}>
                                <AppIcon name="sparkles" size={16} color={colors.primary} />
                                <Text style={styles.testCardText}>{t('useTestCard')}</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{t('cardNumber')}</Text>
                                <TextInput
                                    style={[styles.input, isRTL && styles.rtlText]}
                                    placeholder="0000 0000 0000 0000"
                                    value={cardNumber}
                                    onChangeText={setCardNumber}
                                    keyboardType="numeric"
                                    maxLength={19}
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.md }]}>
                                    <Text style={styles.label}>{t('expiryDate')}</Text>
                                    <TextInput
                                        style={[styles.input, isRTL && styles.rtlText]}
                                        placeholder="MM/YY"
                                        value={expiryDate}
                                        onChangeText={setExpiryDate}
                                        maxLength={5}
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>{t('cvv')}</Text>
                                    <TextInput
                                        style={[styles.input, isRTL && styles.rtlText]}
                                        placeholder="123"
                                        value={cvv}
                                        onChangeText={setCvv}
                                        keyboardType="numeric"
                                        maxLength={4}
                                        secureTextEntry
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{t('cardholderName')}</Text>
                                <TextInput
                                    style={[styles.input, isRTL && styles.rtlText]}
                                    placeholder="John Doe"
                                    value={cardholderName}
                                    onChangeText={setCardholderName}
                                />
                            </View>
                        </View>
                    </>
                ) : null}

                <View style={styles.form}>
                    <TouchableOpacity
                        style={[styles.payButton, (loading || !hasAnyEligibleSource) && styles.disabledButton]}
                        onPress={handlePay}
                        disabled={loading || !hasAnyEligibleSource}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <Text style={styles.payButtonText}>{paymentMethod === 'wallet' ? (isRTL ? 'الدفع بالمحفظة' : 'Pay with Wallet') : t('payNow')}</Text>
                        )}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 0,
        gap: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E8FF',
    },
    backButtonText: {
        fontSize: fontSize.xl,
        fontWeight: 'bold',
        color: colors.text,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    content: {
        padding: spacing.xl,
    },
    amountContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: spacing.xl,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 2,
    },
    amountLabel: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    amountValue: {
        fontSize: 32,
        fontWeight: '700',
        color: '#7C3AED',
    },
    amountHint: {
        marginTop: spacing.sm,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    testCardButton: {
        backgroundColor: '#F5F3FF',
        padding: spacing.md,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: '#C4B5FD',
        borderStyle: 'dashed',
    },
    testCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    testCardText: {
        color: colors.primary,
        fontWeight: '600',
    },
    methodOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    methodOption: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DDD6FE',
        borderRadius: 14,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    methodOptionActive: {
        borderColor: colors.primary,
        backgroundColor: '#F3E8FF',
    },
    methodOptionDisabled: {
        opacity: 0.45,
    },
    methodOptionText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    methodOptionTextActive: {
        color: colors.primary,
    },
    form: {
        gap: spacing.lg,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 1,
    },
    inputGroup: {
        gap: spacing.xs,
    },
    label: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
    },
    input: {
        backgroundColor: '#FAFAFF',
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 14,
        padding: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
    },
    rtlText: {
        textAlign: 'right',
    },
    row: {
        flexDirection: 'row',
    },
    payButton: {
        backgroundColor: '#7C3AED',
        padding: spacing.lg,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    payButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.lg,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.7,
    },
});
