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
import { api } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';

export function PaymentScreen({ route, navigation }: any) {
    const { t, isRTL } = useLanguage();
    const { appointmentId, orderId, amount, tenantId, paymentChoice } = route.params || {};
    const { topInset, scrollBottomPadding } = useScreenSafeArea();

    const [cardNumber, setCardNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
    const [walletBalance, setWalletBalance] = useState<number>(0);

    React.useEffect(() => {
        let mounted = true;
        api.getWalletBalance()
            .then((balance) => {
                if (mounted) setWalletBalance(balance);
            })
            .catch(() => undefined);
        return () => { mounted = false; };
    }, []);

    const handlePay = async () => {
        const amountValue = Number(amount);
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
                amount: amountValue,
                paymentMethod,
                cardNumber: paymentMethod === 'card' ? cardNumber.replace(/\s/g, '') : undefined,
                expiryDate: paymentMethod === 'card' ? expiryDate : undefined,
                cvv: paymentMethod === 'card' ? cvv : undefined,
                cardholderName: paymentMethod === 'card' ? cardholderName : undefined,
                tenantId,
                paymentChoice,
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
                    <Text style={styles.amountValue}>{amount} SAR</Text>
                    {paymentChoice === 'booking-fee' ? (
                        <Text style={styles.amountHint}>
                            {isRTL ? 'هذا هو عربون الحجز المطلوب لتأكيد الموعد.' : 'This is the booking fee required to confirm your appointment.'}
                        </Text>
                    ) : null}
                    <Text style={styles.amountHint}>
                        {isRTL ? `رصيد المحفظة: ${walletBalance.toFixed(2)} ريال` : `Wallet balance: ${walletBalance.toFixed(2)} SAR`}
                    </Text>
                </View>

                <View style={styles.methodOptions}>
                    <TouchableOpacity
                        style={[styles.methodOption, paymentMethod === 'card' && styles.methodOptionActive]}
                        onPress={() => setPaymentMethod('card')}
                    >
                        <AppIcon name="card" size={20} color={paymentMethod === 'card' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.methodOptionText, paymentMethod === 'card' && styles.methodOptionTextActive]}>
                            {isRTL ? 'بطاقة' : 'Card'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.methodOption, paymentMethod === 'wallet' && styles.methodOptionActive]}
                        onPress={() => setPaymentMethod('wallet')}
                    >
                        <AppIcon name="cash" size={20} color={paymentMethod === 'wallet' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.methodOptionText, paymentMethod === 'wallet' && styles.methodOptionTextActive]}>
                            {isRTL ? 'المحفظة' : 'Wallet'}
                        </Text>
                    </TouchableOpacity>
                </View>

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
                        style={[styles.payButton, loading && styles.disabledButton]}
                        onPress={handlePay}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
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
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
    },
    backButton: {
        padding: spacing.xs,
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
    },
    amountLabel: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    amountValue: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.primary,
    },
    amountHint: {
        marginTop: spacing.sm,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    testCardButton: {
        backgroundColor: '#F3E8FF',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.primary,
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
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    methodOptionActive: {
        borderColor: colors.primary,
        backgroundColor: '#F3E8FF',
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
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: fontSize.md,
    },
    rtlText: {
        textAlign: 'right',
    },
    row: {
        flexDirection: 'row',
    },
    payButton: {
        backgroundColor: colors.primary,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    payButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.lg,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.7,
    },
});
