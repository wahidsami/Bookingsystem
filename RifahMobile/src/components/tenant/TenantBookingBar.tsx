import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';

export interface TenantBookingBarProps {
    mode: 'service' | 'product';
    itemCount: number;
    totalPrice: number;
    totalDuration?: number;
    onContinue: () => void;
    bottomInset?: number;
}

export function TenantBookingBar({
    mode,
    itemCount,
    totalPrice,
    totalDuration,
    onContinue,
    bottomInset = 0,
}: TenantBookingBarProps) {
    const { isRTL } = useLanguage();

    if (itemCount <= 0) return null;

    const formattedPrice = formatRiyal(totalPrice, isRTL ? 'ar' : 'en');

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(bottomInset, 16) }]}>
            <View style={[styles.container, isRTL && styles.rowRTL]}>
                {/* Price & Summary Info */}
                <View style={[styles.infoColumn, isRTL && styles.infoColumnRTL]}>
                    <Text style={[styles.priceText, isRTL && styles.textRTL]}>
                        {formattedPrice}
                    </Text>
                    <Text style={[styles.subtitleText, isRTL && styles.textRTL]}>
                        {mode === 'service' ? (
                            <>
                                {itemCount} {isRTL ? (itemCount === 1 ? 'خدمة' : 'خدمات') : (itemCount === 1 ? 'service' : 'services')}
                                {totalDuration !== undefined && totalDuration > 0 ? (
                                    <> • {totalDuration} {isRTL ? 'دقيقة' : 'min'}</>
                                ) : null}
                            </>
                        ) : (
                            <>
                                {itemCount} {isRTL ? (itemCount === 1 ? 'منتج' : 'منتجات') : (itemCount === 1 ? 'item' : 'items')}
                            </>
                        )}
                    </Text>
                </View>

                {/* Continue Action Button */}
                <TouchableOpacity
                    style={[styles.continueButton, isRTL && styles.rowRTL]}
                    onPress={onContinue}
                    activeOpacity={0.88}
                >
                    <Text style={[styles.continueButtonText, isRTL && styles.textRTL]}>
                        {isRTL ? 'متابعة' : 'Continue'}
                    </Text>
                    <AppIcon
                        name={isRTL ? 'arrow_back' : 'arrow_forward'}
                        size={18}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderTopWidth: 1,
        borderTopColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    infoColumn: {
        flex: 1,
        gap: 2,
    },
    infoColumnRTL: {
        alignItems: 'flex-end',
    },
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    priceText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
    },
    subtitleText: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#6537C0',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    continueButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
