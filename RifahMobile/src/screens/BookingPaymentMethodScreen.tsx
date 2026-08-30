import React, { useMemo, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api } from '../api/client';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { useServiceBookingCart, ServiceBookingPaymentMethod } from '../contexts/ServiceBookingCartContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { processBookingCheckout } from '../utils/bookingOrchestration';

const DEFAULT_BOOKING_PAYMENT_SETTINGS = {
    allowServicePayAtCenter: true,
    allowServiceFullOnline: true,
    allowServiceDeposit: true,
    serviceDepositMode: 'fixed' as const,
    serviceDepositFixedAmount: 50,
    serviceDepositPercentage: 50,
};

export function BookingPaymentMethodScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();
    const { tenantId } = route.params || {};
    const { items, totalPrice, cartTenant, clearCart } = useServiceBookingCart();
    
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<ServiceBookingPaymentMethod | null>(null);
    const [loading, setLoading] = useState(false);
    
    const isSubmittingRef = useRef(false);

    const bookingPaymentSettings = useMemo(() => ({
        ...DEFAULT_BOOKING_PAYMENT_SETTINGS,
        ...((cartTenant as any)?.paymentSettings || {}),
    }), [cartTenant]);

    const bookingDepositAmount = useMemo(() => {
        if (!bookingPaymentSettings.allowServiceDeposit) {
            return null;
        }

        const calculated = bookingPaymentSettings.serviceDepositMode === 'percentage'
            ? totalPrice * (bookingPaymentSettings.serviceDepositPercentage / 100)
            : bookingPaymentSettings.serviceDepositFixedAmount;

        return Number(Math.max(0, Math.min(totalPrice, calculated)).toFixed(2));
    }, [
        bookingPaymentSettings.allowServiceDeposit,
        bookingPaymentSettings.serviceDepositFixedAmount,
        bookingPaymentSettings.serviceDepositMode,
        bookingPaymentSettings.serviceDepositPercentage,
        totalPrice,
    ]);

    const availablePaymentOptions = useMemo(() => {
        const options: Array<{ id: ServiceBookingPaymentMethod; label: string; desc?: string }> = [];
        const tenantAtCenter = bookingPaymentSettings.allowServicePayAtCenter !== false;
        const tenantOnlineFull = bookingPaymentSettings.allowServiceFullOnline !== false;
        const tenantDeposit = bookingPaymentSettings.allowServiceDeposit !== false;

        // Service intersection logic
        const allServicesAllowAtCenter = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('at-center'));
        const allServicesAllowOnlineFull = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('online-full'));
        const allServicesAllowDeposit = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('booking-fee'));

        if (tenantAtCenter && allServicesAllowAtCenter) {
            options.push({ id: 'at-center', label: isRTL ? 'الدفع عند المركز' : 'Pay at Center', desc: isRTL ? 'لن تدفع شيئاً الآن' : 'Pay nothing now' });
        }
        if (tenantOnlineFull && allServicesAllowOnlineFull) {
            options.push({ id: 'online-full', label: isRTL ? 'الدفع الكامل أونلاين' : 'Pay Full Online' });
        }
        if (tenantDeposit && allServicesAllowDeposit && bookingDepositAmount !== null && bookingDepositAmount > 0) {
            options.push({ id: 'booking-fee', label: isRTL ? 'عربون الحجز' : 'Booking Deposit' });
        }

        return options;
    }, [
        bookingPaymentSettings.allowServicePayAtCenter,
        bookingPaymentSettings.allowServiceFullOnline,
        bookingPaymentSettings.allowServiceDeposit,
        bookingDepositAmount,
        items,
        isRTL
    ]);

    // Auto-select first available
    if (availablePaymentOptions.length > 0 && !selectedPaymentMethod) {
        setSelectedPaymentMethod(availablePaymentOptions[0].id);
    } else if (availablePaymentOptions.length > 0 && selectedPaymentMethod) {
        if (!availablePaymentOptions.some(opt => opt.id === selectedPaymentMethod)) {
            setSelectedPaymentMethod(availablePaymentOptions[0].id);
        }
    }

    const payableNowAmount = useMemo(() => {
        if (selectedPaymentMethod === 'at-center') return 0;
        if (selectedPaymentMethod === 'online-full') return totalPrice;
        if (selectedPaymentMethod === 'booking-fee' && bookingDepositAmount !== null) return bookingDepositAmount;
        return 0;
    }, [selectedPaymentMethod, totalPrice, bookingDepositAmount]);

    const handleContinue = async () => {
        if (isSubmittingRef.current) return;
        
        if (items.length === 0 || !cartTenant) {
            Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'بيانات الحجز غير مكتملة' : 'Booking data is incomplete');
            return;
        }

        if (!selectedPaymentMethod) {
            Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'يرجى اختيار طريقة الدفع' : 'Please select a payment method');
            return;
        }

        isSubmittingRef.current = true;
        setLoading(true);

        try {
            await processBookingCheckout({
                tenant: cartTenant,
                items,
                totalPrice,
                payableNowAmount,
                bookingDepositAmount,
                selectedPaymentMethod,
                isRTL,
                navigation,
                clearCart,
            });
        } catch (error) {
            // Error is handled inside processBookingCheckout
        } finally {
            isSubmittingRef.current = false;
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} disabled={loading}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isRTL ? 'طريقة الدفع' : 'Payment method'}
                </Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView contentContainerStyle={[styles.contentScroll, { paddingBottom: scrollBottomPadding + 100 }]}>
                {/* Final Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{isRTL ? 'الإجمالي' : 'Total'}</Text>
                        <Text style={styles.summaryTotalValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{isRTL ? 'المطلوب دفعه الآن' : 'Amount due now'}</Text>
                        <Text style={styles.summaryDueValue}>{formatRiyal(payableNowAmount, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryDescLabel}>{items.length} {isRTL ? 'خدمة' : 'service(s)'}</Text>
                        <Text style={styles.summaryDescValue}>
                            {items[0]?.startTime ? format(new Date(items[0].startTime), 'MMM d, p', { locale: isRTL ? ar : enUS }) : ''}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>{isRTL ? 'طريقة الدفع' : 'PAYMENT METHOD'}</Text>
                
                {/* Payment Options */}
                <View style={styles.paymentMethodsContainer}>
                    {availablePaymentOptions.map((option) => {
                        const isSelected = selectedPaymentMethod === option.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.paymentMethodCard, isSelected && styles.paymentMethodCardSelected]}
                                onPress={() => setSelectedPaymentMethod(option.id)}
                                disabled={loading}
                            >
                                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                                    {isSelected && <View style={styles.radioInner} />}
                                </View>
                                <View style={styles.paymentMethodInfo}>
                                    <Text style={styles.paymentMethodTitle}>{option.label}</Text>
                                    {option.desc && (
                                        <Text style={styles.paymentMethodDesc}>{option.desc}</Text>
                                    )}
                                    {option.id === 'booking-fee' && (
                                        <Text style={styles.paymentMethodDesc}>
                                            {isRTL ? 'مبلغ العربون المطلوب:' : 'Deposit required:'} {formatRiyal(bookingDepositAmount || 0, isRTL ? 'ar' : 'en')}
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Payment Summary */}
                <View style={styles.priceSummary}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</Text>
                        <Text style={styles.priceValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    {/* Tax row omitted unless explicitly passed from backend; using total as subtotal to prevent inventing numbers */}
                    <View style={[styles.priceRow, styles.priceRowTotal]}>
                        <Text style={styles.priceTotalLabel}>{isRTL ? 'الإجمالي' : 'Total'}</Text>
                        <Text style={styles.priceTotalValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={styles.priceRowDue}>
                        <Text style={styles.priceDueLabel}>{isRTL ? 'المطلوب دفعه الآن' : 'Amount due now'}</Text>
                        <Text style={styles.priceDueValue}>{formatRiyal(payableNowAmount, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Fixed Action */}
            <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
                <TouchableOpacity 
                    style={[styles.bottomBasketButton, loading && styles.bottomBasketButtonDisabled]} 
                    onPress={handleContinue}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.bottomBasketButtonText}>
                            {selectedPaymentMethod === 'at-center' 
                                ? (isRTL ? 'تأكيد الحجز' : 'Confirm booking')
                                : (isRTL ? 'الدفع والمتابعة' : 'Pay and continue')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundGray || '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRight: {
        width: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    contentScroll: {
        padding: spacing.md,
        gap: spacing.md,
    },
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.sm,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    summaryLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    summaryTotalValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        textDecorationLine: 'line-through',
    },
    summaryDueValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.sm,
    },
    summaryDescLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    summaryDescValue: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    paymentMethodsContainer: {
        gap: spacing.sm,
    },
    paymentMethodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    paymentMethodCardSelected: {
        borderColor: colors.primary,
        backgroundColor: '#F8F2FF',
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    paymentMethodInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    paymentMethodTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    paymentMethodDesc: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    priceSummary: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: spacing.md,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    priceLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    priceRowTotal: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginBottom: spacing.sm,
    },
    priceTotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    priceTotalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    priceRowDue: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    priceDueLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
    },
    priceDueValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    bottomBasketContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    bottomBasketButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        width: '100%',
    },
    bottomBasketButtonDisabled: {
        opacity: 0.7,
    },
    bottomBasketButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
