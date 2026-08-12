import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Image,
    Platform,
} from 'react-native';
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

type DateAvailability = {
    available: boolean;
    slotCount: number;
};

type BookingSearchResponse = {
    slots?: SlotItem[];
};

type DateCard = {
    key: string;
    date: Date;
    available: boolean;
    slotCount: number;
};

const BOOKING_WINDOW_DAYS = 14;
const SLOT_LEAD_MINUTES = 0;

const toDateKey = (value: Date) => format(value, 'yyyy-MM-dd');

const isSameDate = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

export function BookingDateTimeSelectionScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();
    const { tenantId } = route.params || {};
    const { items, updateItem, totalPrice } = useServiceBookingCart();
    
    const { isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();

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

    // Total duration of all services
    const totalDuration = useMemo(() => {
        return items.reduce((acc, item) => acc + (item.service.duration || 0), 0);
    }, [items]);

    const formatDuration = (minutes: number) => {
        if (minutes < 60) {
            return isRTL ? `${minutes} دقيقة` : `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) {
            return isRTL ? `${hours} ساعة` : `${hours} h`;
        }
        return isRTL ? `${hours} س ${mins} د` : `${hours}h ${mins}m`;
    };

    // Determine professional selection mode
    const professionalSelectionMode = useMemo(() => {
        if (items.length === 0) return 'any';
        
        const allAny = items.every(item => !item.staff && !item.requestedStaffId);
        if (allAny) return 'any';

        const firstStaffId = items[0].staff?.id || items[0].requestedStaffId;
        const allSame = firstStaffId && items.every(item => (item.staff?.id === firstStaffId) || (item.requestedStaffId === firstStaffId));
        
        if (allSame && items[0].staff) {
            return 'single';
        }

        return 'multiple';
    }, [items]);

    const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
            setBaseDate(date);
        }
    };

    const cartItemsSignature = useMemo(() => {
        return items.map(i => `${i.id}-${i.service.id}-${i.requestedStaffId || ''}-${i.staff?.id || ''}`).join('|');
    }, [items]);

    useEffect(() => {
        if (!tenantId || items.length === 0) {
            navigation.goBack();
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
                                tenantId,
                                serviceId: item.service.id,
                                date: dateKey,
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

                        // Find contiguous chains
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
                                    if (gap >= -5 * 60000 && gap <= 45 * 60000) {
                                        nextChains.push([...chain, nextSlot]);
                                    }
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
                    if (firstAvailable && !nextAvailability[toDateKey(selectedDate)]?.available) {
                        setSelectedDate(firstAvailable);
                    }
                }
            } finally {
                if (!cancelled) {
                    setAvailabilityLoading(false);
                }
            }
        };

        void loadAvailability();

        return () => {
            cancelled = true;
        };
    }, [tenantId, cartItemsSignature, baseDate]);

    useEffect(() => {
        if (!tenantId || items.length === 0) {
            return;
        }

        let cancelled = false;

        const loadSlots = async () => {
            try {
                setSlotsLoading(true);
                setAvailableSlots([]);
                setSlotChains({});
                // Do NOT wipe selectedTime here to prevent regression when navigating back
                // setSelectedTime(null); 

                const itemsSlotsResponses = await Promise.all(items.map(item => 
                    api.post<BookingSearchResponse>('/bookings/search', {
                        tenantId,
                        serviceId: item.service.id,
                        date: toDateKey(selectedDate),
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
                    if (!cancelled) {
                        setAvailableSlots([]);
                        setSlotChains({});
                    }
                    return;
                }

                // Find contiguous chains
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
                            // Allow next service to start up to 45 mins after the previous one ends, 
                            // and allow a slight overlap of 5 mins (e.g. for buffer overlaps)
                            if (gap >= -5 * 60000 && gap <= 45 * 60000) {
                                nextChains.push([...chain, nextSlot]);
                            }
                        }
                    }
                    chains = nextChains;
                }

                if (!cancelled) {
                    const finalSlots = chains.map(chain => chain[0]);
                    const chainMap: Record<string, SlotItem[]> = {};
                    chains.forEach(chain => {
                        chainMap[chain[0].startTime] = chain;
                    });
                    
                    const uniqueSlots = Array.from(new Map(finalSlots.map(s => [s.startTime, s])).values());
                    
                    setAvailableSlots(uniqueSlots);
                    setSlotChains(chainMap);
                    
                    // If the previously selected time is no longer available in the new slots, clear it
                    if (selectedTime && !uniqueSlots.find(s => s.startTime === selectedTime.startTime)) {
                        setSelectedTime(null);
                    }
                }
            } catch (error) {
                console.error('Failed to load slots:', error);
                if (!cancelled) {
                    setAvailableSlots([]);
                    setSlotChains({});
                }
            } finally {
                if (!cancelled) {
                    setSlotsLoading(false);
                }
            }
        };

        void loadSlots();

        return () => {
            cancelled = true;
        };
    }, [selectedDate, tenantId, cartItemsSignature]);

    const dateCards: DateCard[] = useMemo(() => {
        return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => {
            const day = addDays(baseDate, index);
            const key = toDateKey(day);
            const availability = dateAvailability[key];
            return {
                key,
                date: day,
                available: Boolean(availability?.available),
                slotCount: availability?.slotCount || 0,
            };
        });
    }, [dateAvailability]);

    const handleSelectDate = (day: Date) => {
        const key = toDateKey(day);
        if (!dateAvailability[key]?.available) {
            return;
        }
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

        // Persist the complete scheduling result into the booking state
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

    const renderStaffAvatar = (imageUrl?: string) => {
        if (imageUrl) {
            return <Image source={{ uri: getImageUrl(imageUrl) }} style={styles.globalStaffAvatar} />;
        }
        return (
            <View style={styles.globalStaffAvatarPlaceholder}>
                <AppIcon name="user" size={16} color={colors.primary} />
            </View>
        );
    };

    const renderProfessionalIndicator = () => {
        if (professionalSelectionMode === 'any') {
            return (
                <View style={styles.globalStaffContainer}>
                    <View style={styles.globalStaffContent}>
                        <View style={styles.globalStaffAvatarPlaceholder}>
                            <AppIcon name="user" size={16} color={colors.primary} />
                        </View>
                        <View style={styles.globalStaffInfo}>
                            <Text style={styles.globalStaffLabel}>{isRTL ? 'مع' : 'With'}</Text>
                            <Text style={styles.globalStaffName}>
                                {isRTL ? 'أي مختص متاح' : 'Any available professional'}
                            </Text>
                        </View>
                    </View>
                </View>
            );
        }

        if (professionalSelectionMode === 'single') {
            const staff = items[0].staff;
            return (
                <View style={styles.globalStaffContainer}>
                    <View style={styles.globalStaffContent}>
                        {renderStaffAvatar(staff?.avatar || staff?.image)}
                        <View style={styles.globalStaffInfo}>
                            <Text style={styles.globalStaffLabel}>{isRTL ? 'مع' : 'With'}</Text>
                            <Text style={styles.globalStaffName}>
                                {isRTL ? (staff?.name_ar || staff?.name_en || staff?.name) : (staff?.name_en || staff?.name_ar || staff?.name)}
                            </Text>
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.globalStaffContainer}>
                <View style={styles.globalStaffContent}>
                    <View style={styles.globalStaffAvatarPlaceholder}>
                        <AppIcon name="user" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.globalStaffInfo}>
                        <Text style={styles.globalStaffLabel}>{isRTL ? 'المهنيون' : 'Professionals'}</Text>
                        <Text style={styles.globalStaffName}>
                            {isRTL ? 'مختصون متعددون' : 'Multiple professionals'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isRTL ? 'حدد التاريخ والوقت' : 'Select date and time'}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.navigate('TenantScreen', { tenantId })}>
                    <AppIcon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.contentScroll, { paddingBottom: scrollBottomPadding + 100 }]}>
                {/* Global Professional Selector */}
                {renderProfessionalIndicator()}

                {/* Date Header with Calendar Icon */}
                <View style={styles.dateHeaderContainer}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'حدد يوماً' : 'Select a date'}</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.calendarIconBtn}>
                        <AppIcon name="event" size={24} color={colors.primary} />
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

                {/* Date Row */}
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
                                        <Text style={[styles.dateCardMonth, isSelected && styles.dateCardTextSelected, !card.available && styles.dateCardTextDisabled]}>
                                            {format(card.date, 'MMM', { locale: isRTL ? ar : enUS })}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                {/* Time Selection */}
                <View style={styles.timeSection}>
                    <Text style={styles.timeSectionTitle}>{isRTL ? 'اختر وقتاً' : 'Pick a time'}</Text>
                    
                    {slotsLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color={colors.primary} size="large" />
                        </View>
                    ) : availableSlots.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>{isRTL ? 'لا توجد أوقات متاحة' : 'No available times'}</Text>
                            <Text style={styles.emptySubtitle}>
                                {isRTL ? 'يرجى اختيار يوم آخر أو مقدم خدمة آخر.' : 'Please choose another day or professional.'}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.slotsList}>
                            {availableSlots.map(slot => {
                                const isSelected = selectedTime?.startTime === slot.startTime;
                                return (
                                    <TouchableOpacity
                                        key={slot.startTime}
                                        style={[styles.slotItem, isSelected && styles.slotItemSelected]}
                                        onPress={() => handleSelectSlot(slot)}
                                    >
                                        <Text style={[styles.slotItemText, isSelected && styles.slotItemTextSelected]}>
                                            {format(new Date(slot.startTime), 'p', { locale: isRTL ? ar : enUS })}
                                        </Text>
                                        {isSelected && (
                                            <View style={styles.checkDot} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Fixed Basket */}
            <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(scrollBottomPadding, spacing.md) }]}>
                <View style={styles.bottomBasketLeft}>
                    <Text style={styles.bottomBasketPrice}>
                        {formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}
                    </Text>
                    <View style={[styles.bottomBasketRow, isRTL ? { flexDirection: 'row-reverse' } : null]}>
                        <AppIcon name="cart" size={14} color={colors.textSecondary} />
                        <Text style={[styles.bottomBasketDetails, isRTL ? { marginRight: 4 } : { marginLeft: 4 }]}>
                            {items.length} {isRTL ? 'خدمة' : 'item(s)'} • {formatDuration(totalDuration)}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.bottomBasketButton, !selectedTime && styles.bottomBasketButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedTime}
                >
                    <Text style={styles.bottomBasketButtonText}>{isRTL ? 'متابعة' : 'Continue'}</Text>
                    <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
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
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    contentScroll: {
        paddingBottom: spacing.xxl,
    },
    globalStaffContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    globalStaffContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    globalStaffAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    globalStaffAvatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    globalStaffInfo: {
        marginLeft: spacing.sm,
    },
    globalStaffLabel: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    globalStaffName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.text,
    },
    globalStaffChangeBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    globalStaffChangeText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    dateHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    calendarIconBtn: {
        padding: spacing.xs,
        backgroundColor: '#F9F5FF',
        borderRadius: 8,
    },
    dateSection: {
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    dateScrollContent: {
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    dateCard: {
        width: 65,
        height: 80,
        borderRadius: 12,
        backgroundColor: colors.backgroundGray || '#F9FAFB',
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    dateCardSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dateCardDisabled: {
        opacity: 0.5,
        backgroundColor: '#F3F4F6',
    },
    dateCardWeekday: {
        fontSize: 12,
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    dateCardDay: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginVertical: 2,
    },
    dateCardMonth: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    dateCardTextSelected: {
        color: '#FFFFFF',
    },
    dateCardTextDisabled: {
        color: '#9CA3AF',
    },
    timeSection: {
        padding: spacing.md,
    },
    timeSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.md,
    },
    slotsList: {
        gap: spacing.sm,
    },
    slotItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        marginBottom: spacing.sm,
    },
    slotItemSelected: {
        borderColor: colors.primary,
        backgroundColor: '#F8F2FF', // Light purple for selected Refah state
    },
    slotItemText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    slotItemTextSelected: {
        color: colors.primary,
    },
    checkDot: {
        position: 'absolute',
        right: spacing.md,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    loadingContainer: {
        padding: spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    emptySubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    bottomBasketContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    bottomBasketLeft: {
        flex: 1,
    },
    bottomBasketPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 2,
    },
    bottomBasketRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bottomBasketDetails: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    bottomBasketButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: 12,
        borderRadius: 8,
    },
    bottomBasketButtonDisabled: {
        backgroundColor: colors.border,
    },
    bottomBasketButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginRight: spacing.sm,
    },
});
