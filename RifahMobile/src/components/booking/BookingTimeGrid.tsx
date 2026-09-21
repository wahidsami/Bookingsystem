import React from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { SlotItem } from '../../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export interface BookingTimeGridProps {
    slots: SlotItem[];
    selectedSlot: SlotItem | null;
    onSelectSlot: (slot: SlotItem) => void;
    loading?: boolean;
}

export function BookingTimeGrid({
    slots,
    selectedSlot,
    onSelectSlot,
    loading = false,
}: BookingTimeGridProps) {
    const { isRTL } = useLanguage();
    const locale = isRTL ? ar : enUS;

    const formatSlotTime = (isoString: string) => {
        try {
            const d = new Date(isoString);
            return format(d, 'p', { locale });
        } catch {
            return isoString;
        }
    };

    return (
        <View style={styles.container}>
            {/* Section Header */}
            <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
                <Text style={styles.heading}>
                    {isRTL ? 'اختر الوقت' : 'Pick a time'}
                </Text>
                <View style={styles.periodPill}>
                    <Text style={styles.periodText}>
                        {isRTL ? 'المواعيد المتاحة' : 'Available Times'}
                    </Text>
                </View>
            </View>

            {/* Content: Loading / Empty / 2-Column Grid */}
            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#6537C0" />
                    <Text style={styles.loadingText}>
                        {isRTL
                            ? 'جاري فحص المواعيد المتاحة...'
                            : 'Checking available times...'}
                    </Text>
                </View>
            ) : slots.length === 0 ? (
                <View style={styles.emptyBox}>
                    <AppIcon name="clock" size={32} color="#716B88" />
                    <Text style={styles.emptyTitle}>
                        {isRTL
                            ? 'لا توجد مواعيد متاحة في هذا اليوم'
                            : 'No slots available on this date'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        {isRTL
                            ? 'يرجى اختيار تاريخ آخر من الشريط أعلاه'
                            : 'Please pick another date from the strip above'}
                    </Text>
                </View>
            ) : (
                <View style={[styles.grid, isRTL && styles.gridRTL]}>
                    {slots.map((slot, index) => {
                        const isSelected =
                            selectedSlot?.startTime === slot.startTime;
                        const timeString = formatSlotTime(slot.startTime);

                        return (
                            <TouchableOpacity
                                key={`${slot.startTime}-${index}`}
                                style={[
                                    styles.slotCard,
                                    isSelected && styles.slotCardSelected,
                                    isRTL && styles.rowReverse,
                                ]}
                                onPress={() => onSelectSlot(slot)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.slotTimeGroup, isRTL && styles.rowReverse]}>
                                    <AppIcon
                                        name="clock"
                                        size={16}
                                        color={
                                            isSelected ? '#FFFFFF' : '#716B88'
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.slotTimeText,
                                            isSelected &&
                                                styles.slotTimeTextSelected,
                                        ]}
                                    >
                                        {timeString}
                                    </Text>
                                </View>

                                {isSelected ? (
                                    <View style={styles.selectedBadge}>
                                        <AppIcon
                                            name="check"
                                            size={12}
                                            color="#6537C0"
                                        />
                                    </View>
                                ) : (
                                    <Text style={styles.availableBadge}>
                                        {isRTL ? 'متاح' : 'Available'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    heading: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    periodPill: {
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    periodText: {
        fontSize: 11,
        color: '#716B88',
        fontWeight: '600',
    },
    loadingBox: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: '#716B88',
    },
    emptyBox: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF9FC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        paddingHorizontal: 20,
        gap: 6,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        marginTop: 4,
        textAlign: 'center',
        fontFamily: 'Cairo-Bold',
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#716B88',
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    gridRTL: {
        flexDirection: 'row-reverse',
    },
    slotCard: {
        width: '48.5%',
        height: 54,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    slotCardSelected: {
        backgroundColor: '#6537C0',
        borderColor: '#6537C0',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3,
    },
    slotTimeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    slotTimeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
    },
    slotTimeTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    availableBadge: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6537C0',
    },
    selectedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
