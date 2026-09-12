import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View, Image, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { addDays, format, startOfToday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, SlotItem } from '../api/client';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type DateAvailability = { available: boolean; slotCount: number; };
type BookingSearchResponse = { slots?: SlotItem[]; };
type DateCard = { key: string; date: Date; available: boolean; slotCount: number; };

const BOOKING_WINDOW_DAYS = 14;
const SLOT_LEAD_MINUTES = 0;
const toDateKey = (value: Date) => format(value, 'yyyy-MM-dd');
const isSameDate = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

export function BookingDateTimeSelectionScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();
    const { tenantId } = route.params || {};
    const { items, updateItem, totalPrice } = useServiceBookingCart();
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [baseDate, setBaseDate] = useState<Date>(startOfToday());
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [selectedTime, setSelectedTime] = useState<SlotItem | null>(null);
    const [selectedTimeLoaded, setSelectedTimeLoaded] = useState(false);
    
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(false);
    
    const [dateAvailability, setDateAvailability] = useState<Record<string, DateAvailability>>({});
    const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
    const [slotChains, setSlotChains] = useState<Record<string, SlotItem[]>>({});

    const totalDuration = useMemo(() => {
        return items.reduce((acc, item) => acc + (item.service.duration || 0), 0);
    }, [items]);

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return isRTL ? `${minutes} دقيقة` : `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) return isRTL ? `${hours} ساعة` : `${hours} h`;
        return isRTL ? `${hours} س ${mins} د` : `${hours}h ${mins}m`;
    };

    const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
        setShowDatePicker(false);
        if (date) { setSelectedDate(date); setBaseDate(date); }
    };

    const cartItemsSignature = useMemo(() => {
        return items.map(i => `${i.id}-${i.service.id}-${i.requestedStaffId || ''}-${i.staff?.id || ''}`).join('|');
    }, [items]);

    useEffect(() => {
        if (!tenantId || items.length === 0) {
            if (navigation.isFocused()) navigation.goBack();
            return;
        }

        let cancelled = false;
        const loadAvailability = async () => {
            try {
                setAvailabilityLoading(true);
                const days = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => addDays(baseDate, index));
                const entries = await Promise.all(days.map(async (day) => {
                    const dateKey = toDateKey(day);
                    try {
                        const itemsSlotsResponses = await Promise.all(items.map(item => 
                            api.post<BookingSearchResponse>('/bookings/search', {
                                tenantId, serviceId: item.service.id, date: dateKey,
                                staffId: item.requestedStaffId || item.staff?.id || undefined,
                                variantId: item.variant?.id || undefined,
                            })
                        ));

                        const now = new Date();
                        const earliestAllowed = new Date(now.getTime() + (SLOT_LEAD_MINUTES * 60 * 1000));

                        const validLayers = itemsSlotsResponses.map(res => {
                            return (res.slots || []).filter(slot => {
                                if (!slot?.available) return false;
                                const slotStart = new Date(slot.startTime);
                                if (Number.isNaN(slotStart.getTime())) return false;
                                if (!isSameDate(day, startOfToday())) return true;
                                return slotStart.getTime() >= earliestAllowed.getTime();
                            });
                        });

                        if (validLayers.some(layer => layer.length === 0)) {
                            return [dateKey, { available: false, slotCount: 0 }] as const;
                        }

                        let chains = validLayers[0].map(slot => [slot]);
                        for (let i = 1; i < items.length; i++) {
                            const nextLayer = validLayers[i];
                            const nextChains = [];
                            for (const chain of chains) {
                                const lastSlot = chain[chain.length - 1];
                                const lastSlotEnd = new Date(lastSlot.endTime).getTime();
                                for (const nextSlot of nextLayer) {
                                    const nextSlotStart = new Date(nextSlot.startTime).getTime();
                                    const gap = nextSlotStart - lastSlotEnd;
                                    if (gap >= -5 * 60000 && gap <= 45 * 60000) nextChains.push([...chain, nextSlot]);
                                }
                            }
                            chains = nextChains;
                        }
                        return [dateKey, { available: chains.length > 0, slotCount: chains.length }] as const;
                    } catch {
                        return [dateKey, { available: false, slotCount: 0 }] as const;
                    }
                }));

                if (cancelled) return;

                const nextAvailability: Record<string, DateAvailability> = {};
                entries.forEach(([dateKey, availability]: readonly [string, DateAvailability]) => {
                    nextAvailability[dateKey] = availability;
                });
                setDateAvailability(nextAvailability);

                if (!selectedTimeLoaded) {
                    const firstAvailable = days.find((day) => nextAvailability[toDateKey(day)]?.available);
                    if (firstAvailable && !nextAvailability[toDateKey(selectedDate)]?.available) setSelectedDate(firstAvailable);
                }
            } finally {
                if (!cancelled) setAvailabilityLoading(false);
            }
        };
        void loadAvailability();
        return () => { cancelled = true; };
    }, [tenantId, cartItemsSignature, baseDate]);

    useEffect(() => {
        if (!tenantId || items.length === 0) return;

        let cancelled = false;
        const loadSlots = async () => {
            try {
                setSlotsLoading(true);
                setAvailableSlots([]);
                setSlotChains({});

                const itemsSlotsResponses = await Promise.all(items.map(item => 
                    api.post<BookingSearchResponse>('/bookings/search', {
                        tenantId, serviceId: item.service.id, date: toDateKey(selectedDate),
                        staffId: item.requestedStaffId || item.staff?.id || undefined,
                        variantId: item.variant?.id || undefined,
                    })
                ));

                const now = new Date();
                const earliestAllowed = new Date(now.getTime() + (SLOT_LEAD_MINUTES * 60 * 1000));
                
                const validLayers = itemsSlotsResponses.map(res => {
                    return (res.slots || []).filter(slot => {
                        if (!slot?.available) return false;
                        const slotStart = new Date(slot.startTime);
                        if (Number.isNaN(slotStart.getTime())) return false;
                        if (!isSameDate(selectedDate, startOfToday())) return true;
                        return slotStart.getTime() >= earliestAllowed.getTime();
                    });
                });

                if (validLayers.some(layer => layer.length === 0)) {
                    if (!cancelled) { setAvailableSlots([]); setSlotChains({}); }
                    return;
                }

                let chains = validLayers[0].map(slot => [slot]);
                for (let i = 1; i < items.length; i++) {
                    const nextLayer = validLayers[i];
                    const nextChains = [];
                    for (const chain of chains) {
                        const lastSlot = chain[chain.length - 1];
                        const lastSlotEnd = new Date(lastSlot.endTime).getTime();
                        for (const nextSlot of nextLayer) {
                            const nextSlotStart = new Date(nextSlot.startTime).getTime();
                            const gap = nextSlotStart - lastSlotEnd;
                            if (gap >= -5 * 60000 && gap <= 45 * 60000) nextChains.push([...chain, nextSlot]);
                        }
                    }
                    chains = nextChains;
                }

                if (!cancelled) {
                    const finalSlots = chains.map(chain => chain[0]);
                    const chainMap: Record<string, SlotItem[]> = {};
                    chains.forEach(chain => { chainMap[chain[0].startTime] = chain; });
                    const uniqueSlots = Array.from(new Map(finalSlots.map(s => [s.startTime, s])).values());
                    setAvailableSlots(uniqueSlots);
                    setSlotChains(chainMap);
                    
                    if (selectedTime && !uniqueSlots.find(s => s.startTime === selectedTime.startTime)) setSelectedTime(null);
                }
            } catch (error) {
                console.error('Failed to load slots:', error);
                if (!cancelled) { setAvailableSlots([]); setSlotChains({}); }
            } finally {
                if (!cancelled) setSlotsLoading(false);
            }
        };
        void loadSlots();
        return () => { cancelled = true; };
    }, [selectedDate, tenantId, cartItemsSignature]);

    const dateCards: DateCard[] = useMemo(() => {
        return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => {
            const day = addDays(baseDate, index);
            const key = toDateKey(day);
            const availability = dateAvailability[key];
            return {
                key, date: day, available: Boolean(availability?.available), slotCount: availability?.slotCount || 0,
            };
        });
    }, [dateAvailability, baseDate]);

    const handleSelectDate = (day: Date) => {
        const key = toDateKey(day);
        if (!dateAvailability[key]?.available) return;
        setSelectedDate(day);
    };

    const handleSelectSlot = (slot: SlotItem) => {
        setSelectedTime(slot);
    };

    const handleContinue = () => {
        if (!selectedTime) return;
        const chain = slotChains[selectedTime.startTime];
        if (!chain || chain.length !== items.length) {
             Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل في ترتيب الأوقات المتتالية.' : 'Failed to arrange contiguous times.');
             return;
        }

        items.forEach((item, index) => {
            const slot = chain[index];
            updateItem(item.id, {
                startTime: slot.startTime,
                endTime: slot.endTime,
                staffId: slot.staffId || item.staff?.id || null,
            });
        });
        navigation.navigate('BookingReviewScreen', { tenantId });
    };

    const selectedSlotChain = selectedTime ? slotChains[selectedTime.startTime] : null;
    const contiguousSpan = useMemo(() => {
        if (!selectedSlotChain || selectedSlotChain.length === 0) return null;
        const first = new Date(selectedSlotChain[0].startTime);
        const last = new Date(selectedSlotChain[selectedSlotChain.length - 1].endTime);
        const diffMins = (last.getTime() - first.getTime()) / 60000;
        return {
            startText: format(first, 'p', { locale: isRTL ? ar : enUS }),
            endText: format(last, 'p', { locale: isRTL ? ar : enUS }),
            durationText: formatDuration(diffMins),
            totalMins: diffMins
        };
    }, [selectedSlotChain, isRTL]);

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isRTL ? 'حدد التاريخ والوقت' : 'Select Date & Time'}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.navigate('TenantScreen', { tenantId })}>
                    <AppIcon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.contentScroll, { paddingBottom: scrollBottomPadding + 140 }]}>
                {/* Selected Context Card */}
                <View style={styles.contextPill}>
                    <View style={styles.contextPillRow}>
                        <View style={styles.contextPillIcon}>
                            <AppIcon name="storefront" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.contextPillText}>
                            {isRTL ? 'تفاصيل الحجز' : 'Booking Details'}
                        </Text>
                    </View>
                    <View style={styles.contextPillDuration}>
                        <AppIcon name="clock" size={14} color={colors.textSecondary} />
                        <Text style={styles.contextPillDurationText}>{formatDuration(totalDuration)}</Text>
                    </View>
                </View>

                {/* Select a date */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'حدد يوماً' : 'Select a date'}</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                        <AppIcon name="event" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                        minimumDate={new Date()}
                    />
                )}

                <View style={styles.dateSection}>
                    {availabilityLoading && Object.keys(dateAvailability).length === 0 ? (
                        <ActivityIndicator color={colors.primary} style={{ padding: spacing.xl }} />
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScrollContent}>
                            {dateCards.map((card) => {
                                const isSelected = isSameDate(card.date, selectedDate);
                                return (
                                    <TouchableOpacity
                                        key={card.key}
                                        style={[
                                            styles.dateCard,
                                            isSelected && styles.dateCardSelected,
                                            !card.available && styles.dateCardDisabled,
                                        ]}
                                        disabled={!card.available}
                                        onPress={() => handleSelectDate(card.date)}
                                    >
                                        <Text style={[styles.dateCardWeekday, isSelected && styles.dateCardTextSelected, !card.available && styles.dateCardTextDisabled]}>
                                            {format(card.date, 'EEE', { locale: isRTL ? ar : enUS })}
                                        </Text>
                                        <Text style={[styles.dateCardDay, isSelected && styles.dateCardTextSelected, !card.available && styles.dateCardTextDisabled]}>
                                            {format(card.date, 'dd')}
                                        </Text>
                                        {!card.available && (
                                            <Text style={styles.dateCardFull}>{isRTL ? 'ممتلئ' : 'Full'}</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                {/* Pick a time */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'اختر وقتاً' : 'Pick a time'}</Text>
                </View>
                
                <View style={styles.timeSection}>
                    {slotsLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color={colors.primary} size="large" />
                        </View>
                    ) : availableSlots.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>{isRTL ? 'لا توجد أوقات متاحة' : 'No available times'}</Text>
                        </View>
                    ) : (
                        <View style={styles.slotsGrid}>
                            {availableSlots.map(slot => {
                                const isSelected = selectedTime?.startTime === slot.startTime;
                                return (
                                    <TouchableOpacity
                                        key={slot.startTime}
                                        style={[styles.slotItem, isSelected && styles.slotItemSelected]}
                                        onPress={() => handleSelectSlot(slot)}
                                    >
                                        <AppIcon name="clock" size={16} color={isSelected ? colors.primary : colors.textSecondary} />
                                        <Text style={[styles.slotItemText, isSelected && styles.slotItemTextSelected]}>
                                            {format(new Date(slot.startTime), 'p', { locale: isRTL ? ar : enUS })}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Contiguous Schedule Confirmed Callout */}
                {items.length > 1 && contiguousSpan && selectedTime && (
                    <View style={styles.contiguousCallout}>
                        <AppIcon name="check" size={20} color={colors.primary} />
                        <View style={styles.contiguousCalloutText}>
                            <Text style={styles.contiguousTitle}>{isRTL ? 'تم تأكيد الجدول المتتالي' : 'Contiguous Schedule Confirmed'}</Text>
                            <Text style={styles.contiguousDesc}>
                                {contiguousSpan.startText} – {contiguousSpan.endText} ({contiguousSpan.durationText} {isRTL ? 'متتالي' : 'contiguous'})
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Bottom Fixed Button */}
            <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
                <View style={styles.bottomBasketInfo}>
                    <Text style={styles.bottomBasketItems}>
                        {items.length} {isRTL ? 'عناصر' : 'items'} · {formatDuration(totalDuration)}
                    </Text>
                    <Text style={styles.bottomBasketTotal}>
                        {formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.continueButton, !selectedTime && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedTime}
                >
                    <Text style={styles.continueButtonText}>{isRTL ? 'المتابعة للمراجعة' : 'Continue to Review'}</Text>
                    <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.9)', borderBottomWidth: 1, borderBottomColor: colors.border
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    contentScroll: { paddingTop: spacing.md },
    contextPill: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.md, marginBottom: spacing.lg,
    },
    contextPillRow: { flexDirection: 'row', alignItems: 'center' },
    contextPillIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    contextPillText: { fontSize: 15, fontWeight: 'bold', color: colors.text },
    contextPillDuration: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    contextPillDurationText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.md },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    dateSection: { marginBottom: spacing.xl },
    dateScrollContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
    dateCard: {
        width: 72, height: 96, borderRadius: 16, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
    },
    dateCardSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateCardDisabled: { opacity: 0.5, backgroundColor: '#F3F4F6' },
    dateCardWeekday: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
    dateCardDay: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginVertical: 4 },
    dateCardFull: { fontSize: 11, color: '#DC2626', fontWeight: 'bold' },
    dateCardTextSelected: { color: '#FFFFFF' },
    dateCardTextDisabled: { color: '#9CA3AF' },
    timeSection: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
    slotItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        width: '48%', paddingVertical: 16, borderRadius: 16, borderWidth: 1,
        borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.sm, gap: 8
    },
    slotItemSelected: { borderColor: colors.primary, backgroundColor: '#F8F5FF' },
    slotItemText: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    slotItemTextSelected: { color: colors.primary },
    loadingContainer: { padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textSecondary },
    contiguousCallout: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F5FF', padding: spacing.md,
        borderRadius: 12, marginHorizontal: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: '#EAE1FA'
    },
    contiguousCalloutText: { marginLeft: spacing.md, flex: 1 },
    contiguousTitle: { fontSize: 15, fontWeight: 'bold', color: colors.primary, marginBottom: 2 },
    contiguousDesc: { fontSize: 13, color: colors.textSecondary },
    bottomBasketContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(255,255,255,0.9)', borderTopWidth: 1, borderTopColor: colors.border,
        paddingHorizontal: spacing.md, paddingTop: spacing.md,
    },
    bottomBasketInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    bottomBasketItems: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    bottomBasketTotal: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    continueButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, width: '100%' },
    continueButtonDisabled: { backgroundColor: colors.border },
    continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
});
