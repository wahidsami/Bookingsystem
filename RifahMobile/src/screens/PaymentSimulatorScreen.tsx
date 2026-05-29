import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useCart } from '../contexts/CartContext';
import { AppIcon } from '../components/AppIcon';
import { api } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';

interface PaymentSimulatorProps {
    route: any;
    navigation: any;
}

export function PaymentSimulatorScreen({ route, navigation }: PaymentSimulatorProps) {
    const { isRTL } = useLanguage();
    const { clearCart } = useCart();
    const { payload, tenantId, total } = route.params;
    const { bottomInset } = useScreenSafeArea();

    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardHolder, setCardHolder] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const labels = {
        checkout: isRTL ? 'الدفع الآمن' : 'RefahPay Checkout',
        totalToPay: isRTL ? 'المبلغ المطلوب' : 'Total to pay',
        warning: isRTL
            ? 'هذه بوابة دفع تجريبية. لن يتم خصم أي مبلغ فعلي. يمكنك إدخال أي بيانات اختبار.'
            : 'This is a simulated payment gateway. No real charges will be made. Enter any dummy card details.',
        cardNumber: isRTL ? 'رقم البطاقة' : 'Card Number',
        cardHolder: isRTL ? 'اسم حامل البطاقة' : 'Card Holder Name',
        expiryDate: isRTL ? 'تاريخ الانتهاء' : 'Expiry Date',
        cvv: 'CVV',
        payNow: isRTL ? 'ادفع' : 'Pay',
        successTitle: isRTL ? 'تم الدفع بنجاح!' : 'Payment Successful!',
        successSubtitle: isRTL ? 'تم إنشاء طلبك بنجاح.' : 'Your order has been placed.',
        redirecting: isRTL ? 'جاري تحويلك إلى الرئيسية...' : 'Redirecting to Home...',
        secureHint: isRTL ? 'دفع آمن عبر بوابة RefahPay التجريبية' : 'Secure Payment via RefahPay Simulator',
    };

    const handlePayment = async () => {
        if (!cardNumber || !expiry || !cvv || !cardHolder) {
            Alert.alert('Details Required', 'Please enter your card details. (Any values will work for this simulation)');
            return;
        }

        setIsProcessing(true);

        setTimeout(async () => {
            try {
                const res = await api.post<{ success: boolean; data: any; message?: string }>(`/public/tenant/${tenantId}/orders`, payload);
                if (res.success) {
                    setIsSuccess(true);
                    clearCart();
                    setTimeout(() => {
                        navigation.popToTop();
                    }, 2500);
                } else {
                    Alert.alert('Order Failed', res.message || 'Payment succeeded but order creation failed.');
                    setIsProcessing(false);
                }
            } catch (error: any) {
                Alert.alert('Error', error.message || 'An error occurred during payment.');
                setIsProcessing(false);
            }
        }, 2000);
    };

    if (isSuccess) {
        return (
            <SafeAreaView style={[styles.container, styles.centerAll]} edges={['top', 'bottom']}>
                <View style={styles.successCircle}>
                    <AppIcon name="star" size={56} color={colors.textInverse} />
                </View>
                <Text style={styles.successTitle}>{labels.successTitle}</Text>
                <Text style={styles.successSubtitle}>{labels.successSubtitle}</Text>
                <Text style={styles.redirectText}>{labels.redirecting}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} disabled={isProcessing}>
                        <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={22} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{labels.checkout}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>{labels.totalToPay}</Text>
                        <Text style={styles.amountValue}>{formatRiyal(Number(total), isRTL ? 'ar' : 'en')}</Text>
                    </View>

                    <Text style={styles.simulatorWarning}>{labels.warning}</Text>

                    <View style={styles.cardForm}>
                        <Text style={styles.label}>{labels.cardNumber}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0000 0000 0000 0000"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                            maxLength={19}
                            value={cardNumber}
                            onChangeText={setCardNumber}
                            editable={!isProcessing}
                        />

                        <Text style={styles.label}>{labels.cardHolder}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="John Doe"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="words"
                            value={cardHolder}
                            onChangeText={setCardHolder}
                            editable={!isProcessing}
                        />

                        <View style={styles.row}>
                            <View style={[styles.column, { marginRight: spacing.md }]}>
                                <Text style={styles.label}>{labels.expiryDate}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="MM/YY"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                    maxLength={5}
                                    value={expiry}
                                    onChangeText={setExpiry}
                                    editable={!isProcessing}
                                />
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>{labels.cvv}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="123"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                    maxLength={4}
                                    secureTextEntry
                                    value={cvv}
                                    onChangeText={setCvv}
                                    editable={!isProcessing}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                    <TouchableOpacity
                        style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
                        onPress={handlePayment}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.payButtonText}>{labels.payNow} {formatRiyal(Number(total), isRTL ? 'ar' : 'en')}</Text>
                        )}
                    </TouchableOpacity>
                    <View style={styles.secureBadge}>
                        <AppIcon name="lock" size={12} color={colors.textSecondary} />
                        <Text style={styles.secureText}>{labels.secureHint}</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F4FF',
    },
    centerAll: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    successCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        elevation: 3,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.24,
        shadowRadius: 10,
    },
    successTitle: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: '#6D28D9',
        marginBottom: spacing.sm,
    },
    successSubtitle: {
        fontSize: fontSize.lg,
        color: colors.textSecondary,
        marginBottom: spacing.xxl,
    },
    redirectText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E8FF',
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    amountContainer: {
        alignItems: 'center',
        marginVertical: spacing.lg,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: spacing.lg,
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
    simulatorWarning: {
        backgroundColor: '#F5F3FF',
        color: '#6D28D9',
        padding: spacing.md,
        borderRadius: 14,
        fontSize: fontSize.sm,
        textAlign: 'center',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    cardForm: {
        backgroundColor: '#FFFFFF',
        padding: spacing.lg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E9DDFD',
    },
    label: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#FAFAFF',
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 14,
        padding: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        marginBottom: spacing.lg,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    row: {
        flexDirection: 'row',
    },
    column: {
        flex: 1,
    },
    footer: {
        padding: spacing.lg,
        backgroundColor: '#FFFFFF',
    },
    payButton: {
        backgroundColor: '#7C3AED',
        paddingVertical: spacing.md,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    payButtonDisabled: {
        opacity: 0.7,
    },
    payButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.lg,
        fontWeight: '700',
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
        gap: 6,
    },
    secureText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
});
