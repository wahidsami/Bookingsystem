import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { AppIcon } from '../components/AppIcon';
import { api } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';

const { width } = Dimensions.get('window');

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

    const handlePayment = async () => {
        if (!cardNumber || !expiry || !cvv || !cardHolder) {
            Alert.alert('Details Required', 'Please enter your card details. (Any values will work for this simulation)');
            return;
        }

        setIsProcessing(true);

        // Simulate network delay for payment processing
        setTimeout(async () => {
            try {
                // Payment assumed successful, now create the formal order
                const res = await api.post<{ success: boolean; data: any; message?: string }>(`/public/tenant/${tenantId}/orders`, payload);
                if (res.success) {
                    setIsSuccess(true);
                    clearCart();
                    setTimeout(() => {
                        navigation.popToTop(); // Go back to Home
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
                    <AppIcon name="star" size={60} color="white" />
                </View>
                <Text style={styles.successTitle}>Payment Successful!</Text>
                <Text style={styles.successSubtitle}>Your order has been placed.</Text>
                <Text style={styles.redirectText}>Redirecting to Home...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} disabled={isProcessing}>
                        <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>RefahPay Checkout</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>Total to pay</Text>
                        <Text style={styles.amountValue}>{total.toFixed(2)} SAR</Text>
                    </View>

                    <Text style={styles.simulatorWarning}>
                        This is a simulated payment gateway. No real charges will be made. Enter any dummy card details.
                    </Text>

                    <View style={styles.cardForm}>
                        <Text style={styles.label}>Card Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0000 0000 0000 0000"
                            keyboardType="numeric"
                            maxLength={19}
                            value={cardNumber}
                            onChangeText={setCardNumber}
                            editable={!isProcessing}
                        />

                        <Text style={styles.label}>Card Holder Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="John Doe"
                            autoCapitalize="words"
                            value={cardHolder}
                            onChangeText={setCardHolder}
                            editable={!isProcessing}
                        />

                        <View style={styles.row}>
                            <View style={[styles.column, { marginRight: spacing.md }]}>
                                <Text style={styles.label}>Expiry Date</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="MM/YY"
                                    keyboardType="numeric"
                                    maxLength={5}
                                    value={expiry}
                                    onChangeText={setExpiry}
                                    editable={!isProcessing}
                                />
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>CVV</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="123"
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
                            <Text style={styles.payButtonText}>Pay {total.toFixed(2)} SAR</Text>
                        )}
                    </TouchableOpacity>
                    <View style={styles.secureBadge}>
                        <AppIcon name="lock" size={12} color={colors.textSecondary} />
                        <Text style={styles.secureText}>Secure Payment via RefahPay Simulator</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerAll: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    successCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        elevation: 4,
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    successTitle: {
        fontSize: fontSize.xxl,
        fontWeight: 'bold',
        color: colors.success,
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
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    amountContainer: {
        alignItems: 'center',
        marginVertical: spacing.xl,
    },
    amountLabel: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    amountValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
    },
    simulatorWarning: {
        backgroundColor: '#FEF3C7',
        color: '#D97706',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        fontSize: fontSize.sm,
        textAlign: 'center',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: '#FDE68A',
        overflow: 'hidden',
    },
    cardForm: {
        backgroundColor: 'white',
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    label: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: borderRadius.md,
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
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    payButton: {
        backgroundColor: '#10B981', // green for pay
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    payButtonDisabled: {
        opacity: 0.7,
    },
    payButtonText: {
        color: 'white',
        fontSize: fontSize.lg,
        fontWeight: 'bold',
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
