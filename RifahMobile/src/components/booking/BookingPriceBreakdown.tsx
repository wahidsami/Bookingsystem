import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';

export interface BookingPriceBreakdownProps {
    subtotal: number;
    total: number;
    depositAmount: number | null;
    paymentMethod: string;
}

export function BookingPriceBreakdown({
    subtotal,
    total,
    depositAmount,
    paymentMethod,
}: BookingPriceBreakdownProps) {
    const { isRTL, language } = useLanguage();

    const isDepositMode =
        paymentMethod === 'booking-fee' &&
        depositAmount !== null &&
        depositAmount > 0;
    const remainingAmount = isDepositMode ? total - depositAmount : 0;

    return (
        <View style={styles.card}>
            <View style={[styles.cardHeader, isRTL && styles.rowReverse]}>
                <View style={styles.headerIconCircle}>
                    <AppIcon name="receipt_long" size={18} color="#6537C0" />
                </View>
                <Text style={styles.cardTitle}>
                    {isRTL ? 'تفاصيل السعر' : 'Price Breakdown'}
                </Text>
            </View>

            <View style={styles.rowsContainer}>
                {/* Subtotal */}
                <View style={[styles.row, isRTL && styles.rowReverse]}>
                    <Text style={styles.label}>
                        {isRTL ? 'المجموع الفرعي' : 'Subtotal'}
                    </Text>
                    <Text style={styles.value}>
                        {formatRiyal(subtotal, language)}
                    </Text>
                </View>

                {/* VAT Notice */}
                <View style={[styles.row, isRTL && styles.rowReverse]}>
                    <View style={[styles.vatLabelGroup, isRTL && styles.rowReverse]}>
                        <Text style={styles.label}>
                            {isRTL ? 'ضريبة القيمة المضافة' : 'VAT'}
                        </Text>
                        <Text style={styles.vatBadge}>15%</Text>
                    </View>
                    <Text style={styles.vatNote}>
                        {isRTL ? 'مشمولة في السعر' : 'Included'}
                    </Text>
                </View>

                {/* Deposit Details (if deposit payment is selected) */}
                {isDepositMode && (
                    <>
                        <View style={styles.divider} />
                        <View style={[styles.row, isRTL && styles.rowReverse]}>
                            <Text style={styles.depositLabel}>
                                {isRTL
                                    ? 'العربون المستحق الآن'
                                    : 'Deposit Due Now'}
                            </Text>
                            <Text style={styles.depositValue}>
                                {formatRiyal(depositAmount, language)}
                            </Text>
                        </View>
                        <View style={[styles.row, isRTL && styles.rowReverse]}>
                            <Text style={styles.remainingLabel}>
                                {isRTL
                                    ? 'المتبقي عند الوصول للمركز'
                                    : 'Remaining at Salon'}
                            </Text>
                            <Text style={styles.remainingValue}>
                                {formatRiyal(remainingAmount, language)}
                            </Text>
                        </View>
                    </>
                )}

                <View style={styles.divider} />

                {/* Total */}
                <View style={[styles.totalRow, isRTL && styles.rowReverse]}>
                    <Text style={styles.totalLabel}>
                        {isRTL ? 'الإجمالي' : 'Total'}
                    </Text>
                    <Text style={styles.totalValue}>
                        {formatRiyal(total, language)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 16,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    headerIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    rowsContainer: {
        gap: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    value: {
        fontSize: 13,
        color: '#1D035F',
        fontWeight: '600',
    },
    vatLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    vatBadge: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6537C0',
        backgroundColor: '#F1ECFD',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    vatNote: {
        fontSize: 12,
        color: '#716B88',
        fontWeight: '500',
    },
    depositLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6537C0',
    },
    depositValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    remainingLabel: {
        fontSize: 12,
        color: '#716B88',
    },
    remainingValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#716B88',
    },
    divider: {
        height: 1,
        backgroundColor: '#FAF9FC',
        marginVertical: 4,
    },
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
});
