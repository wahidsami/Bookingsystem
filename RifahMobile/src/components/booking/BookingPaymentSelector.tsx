import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';

export interface PaymentOption {
    id: string;
    label: string;
    desc?: string;
}

export interface BookingPaymentSelectorProps {
    availableOptions: PaymentOption[];
    selectedMethod: string;
    onSelectMethod: (method: string) => void;
}

export function BookingPaymentSelector({
    availableOptions,
    selectedMethod,
    onSelectMethod,
}: BookingPaymentSelectorProps) {
    const { isRTL } = useLanguage();

    const getPaymentIcon = (id: string): any => {
        switch (id) {
            case 'at-center':
                return 'storefront';
            case 'online-full':
                return 'card';
            case 'booking-fee':
                return 'receipt_long';
            case 'wallet':
                return 'wallet';
            default:
                return 'card';
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
                <View style={styles.headerIconCircle}>
                    <AppIcon name="card" size={18} color="#6537C0" />
                </View>
                <Text style={styles.heading}>
                    {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                </Text>
            </View>

            <View style={styles.optionsList}>
                {availableOptions.map((option) => {
                    const isSelected = selectedMethod === option.id;
                    const iconName = getPaymentIcon(option.id);

                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.optionCard,
                                isSelected && styles.optionCardSelected,
                                isRTL && styles.rowReverse,
                            ]}
                            onPress={() => onSelectMethod(option.id)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.radioContainer, isRTL && styles.radioContainerRTL]}>
                                <View
                                    style={[
                                        styles.radioOuter,
                                        isSelected && styles.radioOuterSelected,
                                    ]}
                                >
                                    {isSelected && (
                                        <View style={styles.radioInner} />
                                    )}
                                </View>
                            </View>

                            <View style={[styles.iconCircle, isRTL && styles.iconCircleRTL]}>
                                <AppIcon
                                    name={iconName}
                                    size={18}
                                    color={isSelected ? '#6537C0' : '#716B88'}
                                />
                            </View>

                            <View style={styles.textContainer}>
                                <Text
                                    style={[
                                        styles.optionLabel,
                                        isSelected &&
                                            styles.optionLabelSelected,
                                        isRTL && styles.textRTL,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                                {option.desc ? (
                                    <Text style={[styles.optionDesc, isRTL && styles.textRTL]}>
                                        {option.desc}
                                    </Text>
                                ) : null}
                            </View>

                            {isSelected && (
                                <AppIcon
                                    name="check"
                                    size={18}
                                    color="#6537C0"
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    headerIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heading: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    optionsList: {
        gap: 8,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    optionCardSelected: {
        borderColor: '#6537C0',
        backgroundColor: '#FAF9FC',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 2,
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    radioContainer: {
        marginRight: 10,
    },
    radioContainerRTL: {
        marginRight: 0,
        marginLeft: 10,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: '#6537C0',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#6537C0',
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    iconCircleRTL: {
        marginRight: 0,
        marginLeft: 10,
    },
    textContainer: {
        flex: 1,
    },
    textRTL: {
        textAlign: 'right',
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D035F',
    },
    optionLabelSelected: {
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    optionDesc: {
        fontSize: 11,
        color: '#716B88',
        marginTop: 2,
    },
});
