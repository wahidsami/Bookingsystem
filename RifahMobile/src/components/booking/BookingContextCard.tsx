import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';

export interface BookingContextCardProps {
    salonName: string;
    durationMinutes: number;
    serviceCount: number;
    totalPrice: number;
}

export function BookingContextCard({
    salonName,
    durationMinutes,
    serviceCount,
    totalPrice,
}: BookingContextCardProps) {
    const { isRTL, language } = useLanguage();

    const formatDuration = (mins: number) => {
        if (mins < 60) {
            return isRTL ? `${mins} دقيقة` : `${mins} min`;
        }
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (m === 0) {
            return isRTL ? `${h} ساعة` : `${h}h`;
        }
        return isRTL ? `${h} س ${m} د` : `${h}h ${m}m`;
    };

    return (
        <View style={styles.card}>
            <View style={[styles.topRow, isRTL && styles.rowRTL]}>
                <View style={[styles.salonIdentity, isRTL && styles.rowRTL]}>
                    <View style={styles.iconContainer}>
                        <AppIcon name="storefront" size={18} color="#6537C0" />
                    </View>
                    <View style={[styles.salonTextContainer, isRTL ? styles.salonTextContainerRTL : styles.salonTextContainerLTR]}>
                        <Text style={[styles.caption, isRTL && { textAlign: 'right' }]}>
                            {isRTL ? 'الحجز في' : 'Booking for'}
                        </Text>
                        <Text style={[styles.salonName, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                            {salonName || (isRTL ? 'الصالون' : 'Salon')}
                        </Text>
                    </View>
                </View>

                <View style={[styles.durationPill, isRTL && styles.rowRTL]}>
                    <AppIcon name="clock" size={14} color="#6537C0" />
                    <Text style={styles.durationText}>
                        {formatDuration(durationMinutes)}
                    </Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={[styles.bottomRow, isRTL && styles.rowRTL]}>
                <Text style={[styles.serviceCountText, isRTL && { textAlign: 'right' }]}>
                    {serviceCount}{' '}
                    {isRTL
                        ? serviceCount === 1
                            ? 'خدمة مختارة'
                            : 'خدمات مختارة'
                        : serviceCount === 1
                        ? 'Service selected'
                        : 'Services selected'}
                </Text>
                <Text style={styles.priceText}>
                    {isRTL ? 'المجموع: ' : 'Total: '}
                    <Text style={styles.priceAmount}>
                        {formatRiyal(totalPrice, language)}
                    </Text>
                </Text>
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
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        marginBottom: 16,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    salonIdentity: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    salonTextContainer: {
        flex: 1,
    },
    salonTextContainerLTR: {
        marginLeft: 10,
        marginRight: 8,
    },
    salonTextContainerRTL: {
        marginRight: 10,
        marginLeft: 8,
        alignItems: 'flex-end',
    },
    caption: {
        fontSize: 11,
        color: '#716B88',
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    salonName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    durationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    durationText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6537C0',
    },
    divider: {
        height: 1,
        backgroundColor: '#FAF9FC',
        marginVertical: 12,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    serviceCountText: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    priceText: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    priceAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
});
