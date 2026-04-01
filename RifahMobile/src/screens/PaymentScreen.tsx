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

export function PaymentScreen({ route, navigation }: any) {
    const { t, isRTL } = useLanguage();
    const { appointmentId, orderId, amount, tenantId } = route.params || {};

    const [cardNumber, setCardNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePay = async () => {
        if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
            Alert.alert(t('error'), t('fillAllFields'));
            return;
        }

        try {
            setLoading(true);
            const response = await api.processPayment({
                appointmentId,
                orderId,
                amount: Number(amount),
                cardNumber: cardNumber.replace(/\s/g, ''),
                expiryDate,
                cvv,
                cardholderName,
                tenantId,
            });

            if (response.success) {
                Alert.alert(t('success'), t('paymentSuccessful'), [
                    {
                        text: t('ok'),
                        onPress: () => {
                            navigation.popToTop(); // Go back to root (likely Home)
                            // Or navigate to success screen
                        },
                    },
                ]);
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('payment')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>{t('totalAmount')}</Text>
                    <Text style={styles.amountValue}>{amount} SAR</Text>
                </View>

                {/* Virtual Card Tip */}
                <TouchableOpacity style={styles.testCardButton} onPress={fillTestCard}>
                    <Text style={styles.testCardText}>✨ {t('useTestCard')}</Text>
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

                    <TouchableOpacity
                        style={[styles.payButton, loading && styles.disabledButton]}
                        onPress={handlePay}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.payButtonText}>{t('payNow')}</Text>
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
        paddingTop: spacing.xl + 20,
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
    testCardText: {
        color: colors.primary,
        fontWeight: '600',
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
