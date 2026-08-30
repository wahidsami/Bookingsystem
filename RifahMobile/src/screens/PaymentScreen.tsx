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

type PaymentParticipant = {
    name: string;
    services: string[];
};

type PaymentSummary = {
    primaryCustomer?: string;
    participants?: PaymentParticipant[];
    services?: string[];
    date?: string;
    time?: string;
    employee?: string;
    salon?: string;
    subtotal?: number;
    tax?: number;
    deposit?: number | null;
    remaining?: number | null;
    total?: number;
};

export function PaymentScreen({ route, navigation }: any) {
    const { t, isRTL } = useLanguage();
    const { appointmentId, orderId, bookingSessionId, amount, tenantId, paymentChoice } = route.params || {};
    const paymentSummary: PaymentSummary = route.params?.paymentSummary || route.params?.summary || {};
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
        api.getWalletBalance(tenantId)
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
                const eligible = ((response.sources || []) as EligiblePaymentSource[]).filter((source: EligiblePaymentSource) => source.eligible);
                setSourceOptions(eligible);

                const hasOnline = eligible.some((source: EligiblePaymentSource) => source.source === 'online_payment');
                const hasWallet = eligible.some((source: EligiblePaymentSource) => source.source === 'wallet');

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
    const summaryParticipants = Array.isArray(paymentSummary.participants) && paymentSummary.participants.length > 0
        ? paymentSummary.participants
        : [{
            name: paymentSummary.primaryCustomer || (isRTL ? 'أنتِ' : 'You'),
            services: paymentSummary.services || [],
        }];

    const renderSummaryRow = (label: string, value: string, emphasized?: boolean) => (
        <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, emphasized ? styles.summaryLabelEmphasized : null]}>{label}</Text>
            <Text style={[styles.summaryValue, emphasized ? styles.summaryValueEmphasized : null]}>{value}</Text>
        </View>
    );

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
                if (paymentMethod === 'wallet') {
                    const latest = await api.getWalletBalance(tenantId).catch(() => walletBalance);
                    setWalletBalance(latest);
                }

                navigation.reset({
                    index: 0,
                    routes: [
                        {
                            name: 'PaymentSuccess',
                            params: {
                                appointmentId,
                                orderId,
                                bookingSessionId,
                                paymentSummary: {
                                    ...paymentSummary,
                                    total: paymentSummary.total ?? amountValue,
                                    primaryCustomer: paymentSummary.primaryCustomer,
                                },
                            },
                        },
                    ],
                });
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
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryHeader}>
                        <Text style={styles.summaryTitle}>{isRTL ? 'مراجعة الزيارة' : 'Review your visit'}</Text>
                        <Text style={styles.summarySubtitle}>
                            {isRTL
                                ? 'تأكدي من التفاصيل قبل إتمام الدفع.'
                                : 'Review the details before completing payment.'}
                        </Text>
                    </View>

                    <View style={styles.summaryCard}>
                        {renderSummaryRow(isRTL ? 'العميلة الأساسية' : 'Primary Customer', paymentSummary.primaryCustomer || (isRTL ? 'غير متوفر' : 'Unavailable'))}
                        {summaryParticipants.map((participant, index) => (
                            <View key={`${participant.name}-${index}`} style={styles.participantCard}>
                                <View style={styles.participantBadge}>
                                    <AppIcon name={index === 0 ? 'verified_user' : 'user'} size={12} color={colors.primary} />
                                    <Text style={styles.participantBadgeText}>{participant.name}</Text>
                                </View>
                                <Text style={styles.participantServices}>
                                    {participant.services.length > 0
                                        ? participant.services.join(' · ')
                                        : (isRTL ? 'خدمات أساسية' : 'Primary service')}
                                </Text>
                            </View>
                        ))}
                        {paymentSummary.date ? renderSummaryRow(isRTL ? 'التاريخ' : 'Date', paymentSummary.date) : null}
                        {paymentSummary.time ? renderSummaryRow(isRTL ? 'الوقت' : 'Time', paymentSummary.time) : null}
                        {paymentSummary.employee ? renderSummaryRow(isRTL ? 'الموظف' : 'Employee', paymentSummary.employee) : null}
                        {paymentSummary.salon ? renderSummaryRow(isRTL ? 'الصالون' : 'Salon', paymentSummary.salon) : null}
                    </View>
                </View>

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

                <View style={styles.breakdownCard}>
                    <Text style={styles.breakdownTitle}>{isRTL ? 'الملخص المالي' : 'Payment summary'}</Text>
                    {renderSummaryRow(isRTL ? 'المجموع الفرعي' : 'Subtotal', formatRiyal(Number(paymentSummary.subtotal ?? amountValue), isRTL ? 'ar' : 'en'))}
                    {renderSummaryRow(
                        isRTL ? 'الضريبة' : 'Tax',
                        Number(paymentSummary.tax ?? 0) > 0
                            ? formatRiyal(Number(paymentSummary.tax || 0), isRTL ? 'ar' : 'en')
                            : (isRTL ? 'غير متوفر' : 'Unavailable')
                    )}
                    {paymentSummary.deposit !== undefined ? renderSummaryRow(
                        isRTL ? 'العربون' : 'Deposit',
                        paymentSummary.deposit === null
                            ? (isRTL ? 'غير متوفر' : 'Unavailable')
                            : formatRiyal(Number(paymentSummary.deposit || 0), isRTL ? 'ar' : 'en')
                    ) : null}
                    {paymentSummary.remaining !== undefined ? renderSummaryRow(
                        isRTL ? 'المتبقي' : 'Remaining',
                        paymentSummary.remaining === null
                            ? (isRTL ? 'غير متوفر' : 'Unavailable')
                            : formatRiyal(Number(paymentSummary.remaining || 0), isRTL ? 'ar' : 'en')
                    ) : null}
                    {renderSummaryRow(isRTL ? 'الإجمالي' : 'Total', formatRiyal(Number(paymentSummary.total ?? amountValue), isRTL ? 'ar' : 'en'), true)}
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
    summaryContainer: {
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    summaryHeader: {
        gap: 4,
    },
    summaryTitle: {
        fontSize: fontSize.lg,
        fontWeight: '900',
        color: colors.text,
    },
    summarySubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: spacing.lg,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: '#EAE1FA',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 1,
    },
    participantCard: {
        gap: 4,
        paddingVertical: 6,
    },
    participantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F8F5FF',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    participantBadgeText: {
        fontSize: fontSize.sm,
        fontWeight: '900',
        color: colors.text,
    },
    participantServices: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    breakdownCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: spacing.lg,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: '#EAE1FA',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 1,
        marginBottom: spacing.xl,
    },
    breakdownTitle: {
        fontSize: fontSize.md,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 4,
    },
    summaryLabel: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    summaryLabelEmphasized: {
        color: colors.text,
        fontWeight: '900',
    },
    summaryValue: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '800',
        textAlign: 'right',
    },
    summaryValueEmphasized: {
        fontSize: fontSize.md,
        color: colors.primary,
        fontWeight: '900',
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
