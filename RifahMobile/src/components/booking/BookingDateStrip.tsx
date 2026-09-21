import React from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export interface DateItem {
    key: string;
    date: Date;
    available: boolean;
    slotCount: number;
}

export interface BookingDateStripProps {
    dates: DateItem[];
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    loading?: boolean;
}

export function BookingDateStrip({
    dates,
    selectedDate,
    onSelectDate,
    loading = false,
}: BookingDateStripProps) {
    const { isRTL } = useLanguage();
    const locale = isRTL ? ar : enUS;

    const formattedMonth = format(selectedDate, 'MMMM yyyy', { locale });

    const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    return (
        <View style={styles.container}>
            {/* Section Header with Month Pill */}
            <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
                <Text style={styles.heading}>
                    {isRTL ? 'اختر التاريخ' : 'Select a date'}
                </Text>

                <View style={[styles.monthPill, isRTL && styles.rowReverse]}>
                    <AppIcon name="calendar_today" size={16} color="#6537C0" />
                    <Text style={styles.monthText}>{formattedMonth}</Text>
                </View>
            </View>

            {/* Horizontal Scrollable Date Strip */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6537C0" />
                </View>
            ) : (
                <FlatList
                    horizontal
                    inverted={isRTL}
                    data={dates}
                    keyExtractor={(item) => item.key}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    renderItem={({ item }) => {
                        const isSelected = isSameDay(item.date, selectedDate);
                        const dayName = format(item.date, 'EEE', { locale });
                        const dayNumber = format(item.date, 'd');
                        const isAvailable = item.available;

                        return (
                            <TouchableOpacity
                                key={item.key}
                                style={[
                                    styles.dateCard,
                                    isSelected && styles.dateCardSelected,
                                    !isAvailable && styles.dateCardDisabled,
                                ]}
                                onPress={() => {
                                    if (isAvailable) {
                                        onSelectDate(item.date);
                                    }
                                }}
                                disabled={!isAvailable}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.dayName,
                                        isSelected && styles.dayNameSelected,
                                        !isAvailable && styles.textDisabled,
                                    ]}
                                >
                                    {dayName}
                                </Text>
                                <Text
                                    style={[
                                        styles.dayNumber,
                                        isSelected && styles.dayNumberSelected,
                                        !isAvailable && styles.textDisabled,
                                    ]}
                                >
                                    {dayNumber}
                                </Text>

                                {isAvailable ? (
                                    <View
                                        style={[
                                            styles.dot,
                                            isSelected
                                                ? styles.dotSelected
                                                : styles.dotAvailable,
                                        ]}
                                    />
                                ) : (
                                    <Text style={styles.fullTag}>
                                        {isRTL ? 'ممتلئ' : 'Full'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
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
    monthPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    monthText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6537C0',
    },
    scrollContent: {
        gap: 8,
        paddingVertical: 2,
    },
    dateCard: {
        minWidth: 54,
        height: 78,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    dateCardSelected: {
        backgroundColor: '#6537C0',
        borderColor: '#6537C0',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    dateCardDisabled: {
        backgroundColor: '#F4F3F6',
        borderColor: '#E7DDFC',
        opacity: 0.6,
    },
    dayName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#716B88',
    },
    dayNameSelected: {
        color: '#FFFFFF',
        opacity: 0.9,
    },
    dayNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        marginTop: 2,
        fontFamily: 'Cairo-Bold',
    },
    dayNumberSelected: {
        color: '#FFFFFF',
    },
    textDisabled: {
        color: '#A09BB1',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 4,
    },
    dotAvailable: {
        backgroundColor: '#6537C0',
        opacity: 0.5,
    },
    dotSelected: {
        backgroundColor: '#FFFFFF',
    },
    fullTag: {
        fontSize: 9,
        fontWeight: '700',
        color: '#DC2626',
        marginTop: 3,
    },
    loadingContainer: {
        height: 78,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
