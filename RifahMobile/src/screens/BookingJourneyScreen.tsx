import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { addDays, format, startOfToday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, getServicePrice, Service, ServiceVariant, SlotItem, Staff, Tenant } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';

type BookingStep = 'date' | 'time' | 'review';

interface BookingJourneyProps {
    route: any;
    navigation: any;
}

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
const DEFAULT_BOOKING_PAYMENT_SETTINGS = {
    allowServicePayAtCenter: true,
    allowServiceFullOnline: true,
    allowServiceDeposit: true,
    serviceDepositMode: 'fixed' as const,
    serviceDepositFixedAmount: 50,
    serviceDepositPercentage: 50,
};

const toDateKey = (value: Date) => format(value, 'yyyy-MM-dd');

const isSameDate = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

export function BookingJourneyScreen({ route, navigation }: BookingJourneyProps) {
    const { service, tenant } = route.params || {};
    const initialVariant = route.params?.selectedVariant || null;
    const selectedStaff = route.params?.selectedStaff || null;
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [step, setStep] = useState<BookingStep>('date');
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [selectedTime, setSelectedTime] = useState<SlotItem | null>(null);
    const [selectedTimeLoaded, setSelectedTimeLoaded] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [dateAvailability, setDateAvailability] = useState<Record<string, DateAvailability>>({});
    const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
    const [serviceImageError, setServiceImageError] = useState(false);

    const tenantId = tenant?.id || route.params?.tenantId || null;

    const serviceName = isRTL ? service?.name_ar : service?.name_en;
    const serviceDescription = (isRTL ? service?.description_ar : service?.description_en)
        || service?.description_en
        || service?.description_ar
        || '';
    const servicePrice = getServicePrice(service, initialVariant || undefined);
    const serviceDuration = initialVariant?.duration || service?.duration || 0;
    const bookingPaymentSettings = useMemo(() => ({
        ...DEFAULT_BOOKING_PAYMENT_SETTINGS,
        ...(tenant?.paymentSettings || {}),
    }), [tenant?.paymentSettings]);
    const bookingDepositAmount = useMemo(() => {
        if (!bookingPaymentSettings.allowServiceDeposit) {
            return null;
        }

        const calculated = bookingPaymentSettings.serviceDepositMode === 'percentage'
            ? servicePrice * (bookingPaymentSettings.serviceDepositPercentage / 100)
            : bookingPaymentSettings.serviceDepositFixedAmount;

        return Number(Math.max(0, Math.min(servicePrice, calculated)).toFixed(2));
    }, [
        bookingPaymentSettings.allowServiceDeposit,
        bookingPaymentSettings.serviceDepositFixedAmount,
        bookingPaymentSettings.serviceDepositMode,
        bookingPaymentSettings.serviceDepositPercentage,
        servicePrice,
    ]);
    const bookingRemainingAmount = useMemo(() => {
        if (bookingDepositAmount === null) {
            return null;
        }

        return Number(Math.max(0, servicePrice - bookingDepositAmount).toFixed(2));
    }, [bookingDepositAmount, servicePrice]);
    const bookingTotalAmount = servicePrice;
    const locationLabel = useMemo(() => {
        const parts = [
            tenant?.location,
            tenant?.address,
            [tenant?.district, tenant?.city].filter(Boolean).join(', '),
        ]
            .map((value) => `${value || ''}`.trim())
            .filter(Boolean);

        return parts.length > 0 ? parts[0] : (isRTL ? 'الموقع غير محدد' : 'Location not specified');
    }, [isRTL, tenant?.address, tenant?.city, tenant?.district, tenant?.location]);
    const serviceImage = useMemo(() => {
        const candidates = [
            service?.image,
            service?.imageUrl,
            service?.thumbnail,
            service?.coverImage,
            ...(Array.isArray(service?.images) ? service.images : []),
            ...(Array.isArray(service?.media) ? service.media : []),
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
            const resolved = getImageUrl(candidate) || candidate;
            if (resolved && `${resolved}`.trim()) {
                return resolved;
            }
        }

        return null;
    }, [service]);

    const selectedTimeLabel = useMemo(() => {
        if (!selectedTime?.startTime || Number.isNaN(new Date(selectedTime.startTime).getTime())) {
            return null;
        }

        return format(new Date(selectedTime.startTime), 'p', { locale: isRTL ? ar : enUS });
    }, [isRTL, selectedTime?.startTime]);

    const selectedDateLabel = useMemo(() => {
        if (Number.isNaN(selectedDate.getTime())) {
            return null;
        }

        return format(selectedDate, 'PPP', { locale: isRTL ? ar : enUS });
    }, [isRTL, selectedDate]);

    const selectedEmployeeLabel = useMemo(() => {
        if (selectedTime?.staffName) return selectedTime.staffName;
        if (selectedStaff?.name) return selectedStaff.name;
        return isRTL ? 'أي متخصص' : 'Any specialist';
    }, [isRTL, selectedStaff?.name, selectedTime?.staffName]);

    useEffect(() => {
        if (!tenantId || !service?.id) {
            return;
        }

        const prefillStart = route.params?.startTime ? new Date(route.params.startTime) : null;
        if (prefillStart && !Number.isNaN(prefillStart.getTime())) {
            setSelectedDate(new Date(prefillStart.getFullYear(), prefillStart.getMonth(), prefillStart.getDate()));
            setSelectedTime({
                startTime: prefillStart.toISOString(),
                endTime: route.params?.endTime || prefillStart.toISOString(),
                available: true,
                staffId: route.params?.selectedStaff?.id || route.params?.staffId || undefined,
                staffName: route.params?.selectedStaff?.name || undefined,
            });
            setSelectedTimeLoaded(true);
            setStep('time');
        }
    }, [route.params, service?.id, tenantId]);

    useEffect(() => {
        let cancelled = false;

        const loadAvailability = async () => {
            if (!tenantId || !service?.id) {
                return;
            }

            try {
                setAvailabilityLoading(true);
                const days = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => addDays(startOfToday(), index));
                const entries: Array<readonly [string, DateAvailability]> = await Promise.all(days.map(async (day: Date) => {
                    const dateKey = toDateKey(day);
                    try {
                        const response = await api.post<BookingSearchResponse>(
                            '/bookings/search',
                            {
                                tenantId,
                                serviceId: service.id,
                                date: dateKey,
                                staffId: selectedStaff?.id || undefined,
                                variantId: initialVariant?.id || undefined,
                            }
                        );
                        const now = new Date();
                        const slots = (response.slots || []).filter((slot: SlotItem) => {
                            if (!slot?.available) {
                                return false;
                            }

                            const slotStart = new Date(slot.startTime);
                            if (Number.isNaN(slotStart.getTime())) {
                                return false;
                            }

                            if (!isSameDate(day, startOfToday())) {
                                return true;
                            }

                            const earliestAllowed = new Date(now.getTime() + (SLOT_LEAD_MINUTES * 60 * 1000));
                            return slotStart.getTime() >= earliestAllowed.getTime();
                        });

                        return [dateKey, { available: slots.length > 0, slotCount: slots.length }] as const;
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
    }, [initialVariant?.id, selectedDate, selectedStaff?.id, selectedTimeLoaded, service?.id, tenantId]);

    useEffect(() => {
        if (!tenantId || !service?.id) {
            return;
        }

        let cancelled = false;

        const loadSlots = async () => {
            try {
                setSlotsLoading(true);
                setAvailableSlots([]);
                setSelectedTime(null);

                const response = await api.post<BookingSearchResponse>(
                    '/bookings/search',
                    {
                        tenantId,
                        serviceId: service.id,
                        date: toDateKey(selectedDate),
                        staffId: selectedStaff?.id || undefined,
                        variantId: initialVariant?.id || undefined,
                    }
                );

                const now = new Date();
                const filtered = (response.slots || []).filter((slot: SlotItem) => {
                    if (!slot?.available) {
                        return false;
                    }

                    const slotStart = new Date(slot.startTime);
                    if (Number.isNaN(slotStart.getTime())) {
                        return false;
                    }

                    if (!isSameDate(selectedDate, startOfToday())) {
                        return true;
                    }

                    const earliestAllowed = new Date(now.getTime() + (SLOT_LEAD_MINUTES * 60 * 1000));
                    return slotStart.getTime() >= earliestAllowed.getTime();
                });

                if (!cancelled) {
                    setAvailableSlots(filtered);
                }
            } catch (error) {
                console.error('Failed to load slots:', error);
                if (!cancelled) {
                    setAvailableSlots([]);
                }
            } finally {
                if (!cancelled) {
                    setSlotsLoading(false);
                }
            }
        };

        if (step === 'time' || step === 'review') {
            void loadSlots();
        }

        return () => {
            cancelled = true;
        };
    }, [initialVariant?.id, selectedDate, selectedStaff?.id, service?.id, step, tenantId]);

    const stepTitles = [
        isRTL ? 'متى؟' : 'When?',
        isRTL ? 'ما الوقت؟' : 'What time?',
        isRTL ? 'مراجعة الزيارة' : 'Review your visit',
    ];
    const stepIndex = step === 'date' ? 0 : step === 'time' ? 1 : 2;

    const dateCards: DateCard[] = useMemo(() => {
        return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => {
            const day = addDays(startOfToday(), index);
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
        setSelectedTime(null);
        setStep('time');
    };

    const handleSelectSlot = (slot: SlotItem) => {
        setSelectedTime(slot);
    };

    const handleNext = () => {
        if (step === 'date') {
            const key = toDateKey(selectedDate);
            if (!dateAvailability[key]?.available) {
                Alert.alert(
                    isRTL ? 'اخترِ يوماً متاحاً' : 'Choose an available day',
                    isRTL
                        ? 'يبدو أن هذا اليوم غير متاح حالياً. اختاري يوماً آخر من التقويم.'
                        : 'This day is not available yet. Please choose another day from the calendar.'
                );
                return;
            }
            setStep('time');
            return;
        }

        if (step === 'time') {
            if (!selectedTime) {
                Alert.alert(
                    isRTL ? 'اختاري الوقت' : 'Select a time',
                    isRTL
                        ? 'اختاري موعداً متاحاً للمتابعة.'
                        : 'Please choose an available time slot to continue.'
                );
                return;
            }
            setStep('review');
        }
    };

    const handleBack = () => {
        if (step === 'review') {
            setStep('time');
            return;
        }

        if (step === 'time') {
            setStep('date');
            return;
        }

        navigation.goBack();
    };

    const handleContinue = () => {
        Alert.alert(
            isRTL ? 'قريباً' : 'Coming soon',
            isRTL
                ? 'ستكتمل خطوة المراجعة والدفع في المرحلة التالية.'
                : 'The review and payment step will be completed in the next phase.'
        );
    };

    const renderPriceRow = (label: string, value: string, emphasized?: boolean) => (
        <View style={styles.priceRow}>
            <Text style={[styles.priceRowLabel, emphasized ? styles.priceRowLabelEmphasized : null]}>{label}</Text>
            <Text style={[styles.priceRowValue, emphasized ? styles.priceRowValueEmphasized : null]}>{value}</Text>
        </View>
    );

    const renderSummaryChip = (
        iconName: React.ComponentProps<typeof AppIcon>['name'],
        label: string,
        value: string
    ) => (
        <View style={styles.summaryChip}>
            <AppIcon name={iconName} size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
                <Text style={styles.summaryChipLabel}>{label}</Text>
                <Text style={styles.summaryChipValue} numberOfLines={1}>{value}</Text>
            </View>
        </View>
    );

    const serviceVariantLabel = initialVariant?.description?.trim() || (isRTL ? 'الخيار الأساسي' : 'Standard service');
    const serviceTimeDisplay = selectedTimeLabel || (isRTL ? 'غير محدد' : 'Unavailable');

    const renderServiceContext = () => (
        <View style={styles.contextCard}>
            <View style={styles.contextMedia}>
                {serviceImage && !serviceImageError ? (
                    <Image
                        source={{ uri: serviceImage }}
                        style={styles.contextImage}
                        onError={() => setServiceImageError(true)}
                    />
                ) : (
                    <LinearGradient colors={['#8B5CF6', '#A78BFA']} style={styles.contextFallback}>
                        <Text style={styles.contextFallbackText}>
                            {(serviceName || 'S').charAt(0).toUpperCase()}
                        </Text>
                    </LinearGradient>
                )}
            </View>
            <View style={styles.contextBody}>
                <View style={styles.contextTopRow}>
                    <Text style={styles.contextLabel}>{isRTL ? 'تفاصيل الخدمة' : 'Service details'}</Text>
                    <View style={styles.contextPill}>
                        <AppIcon name="sparkles" size={12} color={colors.primary} />
                        <Text style={styles.contextPillText}>
                            {service?.category || (isRTL ? 'عام' : 'General')}
                        </Text>
                    </View>
                </View>
                <Text style={styles.contextTitle} numberOfLines={2}>{serviceName}</Text>
                {serviceDescription ? (
                    <Text style={styles.contextSubtitle} numberOfLines={2}>{serviceDescription}</Text>
                ) : null}
                <View style={styles.contextMetaRow}>
                    <View style={styles.contextMetaPill}>
                        <AppIcon name="clock" size={12} color={colors.primary} />
                        <Text style={styles.contextMetaText}>
                            {serviceDuration} {isRTL ? 'دقيقة' : 'min'}
                        </Text>
                    </View>
                    <Text style={styles.contextPrice}>{formatRiyal(servicePrice, isRTL ? 'ar' : 'en')}</Text>
                </View>
            </View>
        </View>
    );

    const renderDateStep = () => (
        <View style={styles.stepStack}>
            <View style={styles.sectionHeader}>
                <Text style={styles.stepTitle}>{isRTL ? 'متى؟' : 'When?'}</Text>
                <Text style={styles.stepSubtitle}>
                    {isRTL
                        ? 'اختاري يوماً واحداً فقط من الأيام المتاحة.'
                        : 'Pick one available day to continue.'}
                </Text>
            </View>

            <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                    <Text style={styles.calendarHeaderTitle}>{isRTL ? 'التقويم' : 'Calendar'}</Text>
                    <View style={styles.calendarHeaderPill}>
                        <AppIcon name="event" size={12} color={colors.primary} />
                        <Text style={styles.calendarHeaderPillText}>
                            {availabilityLoading
                                ? (isRTL ? 'جارٍ التحميل...' : 'Loading...')
                                : `${dateCards.filter((item) => item.available).length} ${isRTL ? 'أيام متاحة' : 'days available'}`}
                        </Text>
                    </View>
                </View>

                {availabilityLoading ? (
                    <View style={styles.loadingBlock}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                        {dateCards.map((item) => {
                            const isSelected = isSameDate(item.date, selectedDate);
                            const weekday = format(item.date, 'EEE', { locale: isRTL ? ar : enUS });
                            const dayNumber = format(item.date, 'd');
                            const monthLabel = format(item.date, 'MMM', { locale: isRTL ? ar : enUS });

                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[
                                        styles.dateCard,
                                        isSelected ? styles.dateCardSelected : null,
                                        !item.available ? styles.dateCardDisabled : null,
                                    ]}
                                    onPress={() => handleSelectDate(item.date)}
                                    disabled={!item.available}
                                    activeOpacity={0.9}
                                >
                                    <Text style={[styles.dateWeekday, isSelected ? styles.dateWeekdaySelected : null]}>
                                        {weekday}
                                    </Text>
                                    <Text style={[styles.dateNumber, isSelected ? styles.dateNumberSelected : null]}>
                                        {dayNumber}
                                    </Text>
                                    <Text style={[styles.dateMonth, isSelected ? styles.dateMonthSelected : null]}>
                                        {monthLabel}
                                    </Text>
                                    <View style={[styles.dateAvailabilityPill, item.available ? null : styles.dateAvailabilityPillOff]}>
                                        <Text style={[styles.dateAvailabilityText, item.available ? null : styles.dateAvailabilityTextOff]}>
                                            {item.available
                                                ? `${item.slotCount} ${isRTL ? 'متاح' : 'slots'}`
                                                : (isRTL ? 'غير متاح' : 'Unavailable')}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            <View style={styles.helperCard}>
                <AppIcon name="event" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.helperTitle}>{isRTL ? 'اختيار اليوم فقط' : 'Choose the day only'}</Text>
                    <Text style={styles.helperSubtitle}>
                        {isRTL
                            ? 'سنظهر الأوقات المتاحة بعد اختيار التاريخ.'
                            : 'Available times will appear after you select a date.'}
                    </Text>
                </View>
            </View>
        </View>
    );

    const renderTimeStep = () => (
        <View style={styles.stepStack}>
            <View style={styles.sectionHeader}>
                <Text style={styles.stepTitle}>{isRTL ? 'ما الوقت؟' : 'What time?'}</Text>
                <Text style={styles.stepSubtitle}>
                    {isRTL
                        ? 'اختاري وقتاً واحداً فقط. سيظهر الموظف داخل الموعد نفسه.'
                        : 'Choose one available time slot. The employee will appear inside the slot.'}
                </Text>
            </View>

            <View style={styles.timeDateChip}>
                <AppIcon name="event" size={14} color={colors.primary} />
                <Text style={styles.timeDateChipText}>{selectedDateLabel}</Text>
            </View>

            {slotsLoading ? (
                <View style={styles.loadingBlock}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : availableSlots.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>
                        {isRTL ? 'لا توجد أوقات متاحة' : 'No times available'}
                    </Text>
                    <Text style={styles.emptyStateSubtitle}>
                        {isRTL
                            ? 'جرّبي يوماً آخر من التقويم.'
                            : 'Please choose another day from the calendar.'}
                    </Text>
                </View>
            ) : (
                <View style={styles.timeGrid}>
                    {availableSlots.map((slot: SlotItem) => {
                        const slotStart = new Date(slot.startTime);
                        const slotEnd = new Date(slot.endTime);
                        const isSelected = selectedTime?.startTime === slot.startTime && selectedTime?.staffId === slot.staffId;
                        const staffLabel = slot.staffName || selectedStaff?.name || (isRTL ? 'أي متخصص' : 'Any specialist');

                        return (
                            <TouchableOpacity
                                key={`${slot.startTime}-${slot.staffId || 'any'}`}
                                style={[styles.timeCard, isSelected ? styles.timeCardSelected : null]}
                                onPress={() => handleSelectSlot(slot)}
                                activeOpacity={0.9}
                            >
                                <Text style={[styles.timeCardTime, isSelected ? styles.timeCardTimeSelected : null]}>
                                    {format(slotStart, 'p', { locale: isRTL ? ar : enUS })}
                                </Text>
                                <Text style={[styles.timeCardRange, isSelected ? styles.timeCardRangeSelected : null]}>
                                    {format(slotStart, 'p', { locale: isRTL ? ar : enUS })} - {format(slotEnd, 'p', { locale: isRTL ? ar : enUS })}
                                </Text>
                                <View style={[styles.timeCardPill, isSelected ? styles.timeCardPillSelected : null]}>
                                    <AppIcon name="user" size={12} color={isSelected ? '#FFFFFF' : colors.primary} />
                                    <Text style={[styles.timeCardPillText, isSelected ? styles.timeCardPillTextSelected : null]} numberOfLines={1}>
                                        {staffLabel}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );

    const renderReviewStep = () => (
        <View style={styles.stepStack}>
            <View style={styles.sectionHeader}>
                <Text style={styles.stepTitle}>{isRTL ? 'مراجعة الزيارة' : 'Review your visit'}</Text>
                <Text style={styles.stepSubtitle}>
                    {isRTL
                        ? 'راجعي تفاصيل زيارتك بهدوء قبل المتابعة.'
                        : 'Review the visit details calmly before continuing.'}
                </Text>
            </View>

            <View style={styles.reviewSummaryCard}>
                <View style={styles.reviewSummaryHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.reviewSummaryLabel}>{isRTL ? 'الخدمة المختارة' : 'Selected service'}</Text>
                        <Text style={styles.reviewSummaryServiceName}>{serviceName}</Text>
                        <Text style={styles.reviewSummaryVariant}>{serviceVariantLabel}</Text>
                    </View>
                    <View style={styles.reviewSummaryPriceWrap}>
                        <Text style={styles.reviewSummaryPrice}>{formatRiyal(servicePrice, isRTL ? 'ar' : 'en')}</Text>
                        <Text style={styles.reviewSummaryPriceCaption}>{isRTL ? 'إجمالي الخدمة' : 'Service total'}</Text>
                    </View>
                </View>
                <View style={styles.summaryChipGrid}>
                    {renderSummaryChip('event', isRTL ? 'التاريخ' : 'Date', selectedDateLabel || (isRTL ? 'غير محدد' : 'Unavailable'))}
                    {renderSummaryChip('clock', isRTL ? 'الوقت' : 'Time', serviceTimeDisplay)}
                    {renderSummaryChip('user', isRTL ? 'الموظف' : 'Employee', selectedEmployeeLabel)}
                    {renderSummaryChip('location', isRTL ? 'الموقع' : 'Location', locationLabel)}
                    {renderSummaryChip('clock', isRTL ? 'المدة' : 'Duration', `${serviceDuration} ${isRTL ? 'دقيقة' : 'min'}`)}
                </View>
            </View>

            <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionCardLabel}>{isRTL ? 'المشاركون' : 'Participants'}</Text>
                </View>
                <View style={styles.participantsRow}>
                    <View style={styles.participantBadge}>
                        <AppIcon name="verified_user" size={12} color={colors.primary} />
                        <Text style={styles.participantBadgeText}>{isRTL ? 'أنتِ' : 'You'}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addParticipantButton}
                        onPress={() => {
                            Alert.alert(
                                isRTL ? 'قريباً' : 'Coming soon',
                                isRTL
                                    ? 'سيتم تفعيل إضافة الضيوف في مرحلة لاحقة.'
                                    : 'Guest navigation will be enabled in a later phase.'
                            );
                        }}
                        activeOpacity={0.9}
                    >
                        <AppIcon name="plus" size={14} color={colors.primary} />
                        <Text style={styles.addParticipantText}>{isRTL ? 'إضافة شخص' : 'Bring Someone'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionCardLabel}>{isRTL ? 'ملخص الدفع' : 'Payment summary'}</Text>
                </View>
                {renderPriceRow(isRTL ? 'المجموع الفرعي' : 'Subtotal', formatRiyal(servicePrice, isRTL ? 'ar' : 'en'))}
                {renderPriceRow(isRTL ? 'الضريبة' : 'Tax', isRTL ? 'غير متاح' : 'Unavailable')}
                {renderPriceRow(isRTL ? 'الإجمالي' : 'Total', formatRiyal(bookingTotalAmount, isRTL ? 'ar' : 'en'), true)}
                {bookingDepositAmount !== null ? renderPriceRow(
                    isRTL ? 'العربون' : 'Deposit',
                    formatRiyal(bookingDepositAmount, isRTL ? 'ar' : 'en')
                ) : null}
                {bookingRemainingAmount !== null ? renderPriceRow(
                    isRTL ? 'المتبقي' : 'Remaining',
                    formatRiyal(bookingRemainingAmount, isRTL ? 'ar' : 'en')
                ) : null}
                {bookingDepositAmount === null ? (
                    <View style={styles.paymentHint}>
                        <AppIcon name="info" size={14} color={colors.textSecondary} />
                        <Text style={styles.paymentHintText}>
                            {isRTL
                                ? 'لا يوجد عربون مفعّل لهذه الخدمة حالياً.'
                                : 'No deposit is active for this service right now.'}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.placeholderNote}>
                <AppIcon name="warning" size={16} color={colors.primary} />
                <Text style={styles.placeholderNoteText}>
                    {isRTL
                        ? 'سيتم ربط زر المتابعة بالتدفق النهائي في المرحلة التالية.'
                        : 'The Continue action will connect to the final booking step in the next phase.'}
                </Text>
            </View>
        </View>
    );

    if (!service || !tenant) {
        return (
            <View style={styles.container}>
                <View style={styles.headerWrap}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{isRTL ? 'الحجز' : 'Booking'}</Text>
                </View>
                <View style={styles.emptyFallback}>
                    <Text style={styles.emptyStateTitle}>{isRTL ? 'تعذر تحميل الحجز' : 'Booking data is missing'}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#F5EEFF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.headerWrap, { paddingTop: spacing.lg + topInset }]}
            >
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerTitle}>{isRTL ? 'الحجز' : 'Booking'}</Text>
                    <Text style={styles.headerSubtitle}>{serviceName}</Text>
                </View>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <View style={styles.progressRail}>
                <View style={[styles.progressBar, { width: step === 'date' ? '33%' : step === 'time' ? '66%' : '100%' }]} />
            </View>
            <View style={styles.stepsRail}>
                {stepTitles.map((title, index) => {
                    const isActive = index === stepIndex;
                    const isCompleted = index < stepIndex;
                    return (
                        <View key={title} style={[styles.stepChip, (isActive || isCompleted) ? styles.stepChipActive : null]}>
                            <Text style={[styles.stepChipText, (isActive || isCompleted) ? styles.stepChipTextActive : null]}>
                                {title}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding + 100 }]}>
                {renderServiceContext()}
                {step === 'date' && renderDateStep()}
                {step === 'time' && renderTimeStep()}
                {step === 'review' && renderReviewStep()}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                {step === 'review' ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
                        <Text style={styles.primaryButtonText}>{isRTL ? 'متابعة' : 'Continue'}</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                        <Text style={styles.primaryButtonText}>{isRTL ? 'التالي' : 'Next'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F6FB',
    },
    headerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: '#FFFFFF',
    },
    headerTextWrap: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
    },
    progressRail: {
        height: 6,
        backgroundColor: '#E7E2F7',
        width: '100%',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 999,
    },
    stepsRail: {
        flexDirection: 'row',
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: '#FFFFFF',
    },
    stepChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E8E1FA',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    stepChipActive: {
        borderColor: '#BDA1F8',
        backgroundColor: '#F4EEFF',
    },
    stepChipText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    stepChipTextActive: {
        color: colors.primary,
    },
    content: {
        padding: spacing.lg,
        gap: spacing.lg,
    },
    contextCard: {
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EDE4FB',
        padding: spacing.md,
        flexDirection: 'row',
        gap: spacing.md,
        shadowColor: '#28174B',
        shadowOpacity: 0.05,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 2,
    },
    contextMedia: {
        width: 104,
        height: 104,
        borderRadius: 24,
        overflow: 'hidden',
    },
    contextImage: {
        width: '100%',
        height: '100%',
    },
    contextFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contextFallbackText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '900',
    },
    contextBody: {
        flex: 1,
        gap: 8,
    },
    contextTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    contextLabel: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '900',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    contextPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F7F1FF',
    },
    contextPillText: {
        color: colors.primary,
        fontSize: fontSize.xs,
        fontWeight: '800',
    },
    contextTitle: {
        fontSize: fontSize.xl,
        fontWeight: '900',
        color: colors.text,
        lineHeight: 28,
    },
    contextSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    contextMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    contextMetaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F8F5FF',
    },
    contextMetaText: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '800',
    },
    contextPrice: {
        fontSize: fontSize.lg,
        fontWeight: '900',
        color: colors.text,
    },
    stepStack: {
        gap: spacing.lg,
    },
    sectionHeader: {
        gap: 6,
    },
    stepTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
    },
    stepSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    calendarCard: {
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE5F8',
        padding: spacing.md,
        gap: spacing.md,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    calendarHeaderTitle: {
        fontSize: fontSize.md,
        fontWeight: '900',
        color: colors.text,
    },
    calendarHeaderPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F7F1FF',
    },
    calendarHeaderPillText: {
        color: colors.primary,
        fontSize: fontSize.xs,
        fontWeight: '800',
    },
    loadingBlock: {
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateRow: {
        gap: 12,
        paddingVertical: 4,
    },
    dateCard: {
        width: 88,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#E8E1FA',
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
        gap: 6,
    },
    dateCardSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dateCardDisabled: {
        opacity: 0.45,
    },
    dateWeekday: {
        fontSize: fontSize.xs,
        fontWeight: '800',
        color: colors.textSecondary,
    },
    dateWeekdaySelected: {
        color: '#FFFFFF',
    },
    dateNumber: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
    },
    dateNumberSelected: {
        color: '#FFFFFF',
    },
    dateMonth: {
        fontSize: fontSize.xs,
        fontWeight: '800',
        color: colors.textSecondary,
    },
    dateMonthSelected: {
        color: '#FFFFFF',
    },
    dateAvailabilityPill: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: '#F4EEFF',
    },
    dateAvailabilityPillOff: {
        backgroundColor: '#F0F0F6',
    },
    dateAvailabilityText: {
        fontSize: 11,
        fontWeight: '800',
        color: colors.primary,
    },
    dateAvailabilityTextOff: {
        color: colors.textSecondary,
    },
    helperCard: {
        flexDirection: 'row',
        gap: spacing.md,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE5F8',
        padding: spacing.md,
        alignItems: 'flex-start',
    },
    helperTitle: {
        fontSize: fontSize.md,
        fontWeight: '900',
        color: colors.text,
    },
    helperSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginTop: 3,
    },
    timeDateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F7F1FF',
    },
    timeDateChipText: {
        fontSize: fontSize.sm,
        fontWeight: '800',
        color: colors.primary,
    },
    emptyState: {
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE5F8',
        padding: spacing.lg,
        alignItems: 'center',
        gap: 8,
    },
    emptyStateTitle: {
        fontSize: fontSize.lg,
        fontWeight: '900',
        color: colors.text,
        textAlign: 'center',
    },
    emptyStateSubtitle: {
        fontSize: fontSize.sm,
        lineHeight: 20,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    timeCard: {
        width: '48%',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#E8E1FA',
        backgroundColor: '#FFFFFF',
        padding: spacing.md,
        gap: 10,
    },
    timeCardSelected: {
        backgroundColor: '#F6F0FF',
        borderColor: colors.primary,
    },
    timeCardTime: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text,
    },
    timeCardTimeSelected: {
        color: colors.primary,
    },
    timeCardRange: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    timeCardRangeSelected: {
        color: colors.primary,
    },
    timeCardPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F7F1FF',
    },
    timeCardPillSelected: {
        backgroundColor: colors.primary,
    },
    timeCardPillText: {
        fontSize: fontSize.xs,
        fontWeight: '800',
        color: colors.primary,
        maxWidth: 92,
    },
    timeCardPillTextSelected: {
        color: '#FFFFFF',
    },
    reviewSummaryCard: {
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE5F8',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    reviewSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    reviewSummaryLabel: {
        fontSize: fontSize.xs,
        fontWeight: '900',
        letterSpacing: 0.6,
        color: colors.primary,
        textTransform: 'uppercase',
    },
    reviewSummaryPrice: {
        fontSize: fontSize.lg,
        fontWeight: '900',
        color: colors.text,
    },
    reviewSummaryPriceWrap: {
        alignItems: 'flex-end',
    },
    reviewSummaryPriceCaption: {
        marginTop: 2,
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    reviewSummaryServiceName: {
        fontSize: fontSize.xl,
        fontWeight: '900',
        color: colors.text,
        marginTop: 2,
    },
    reviewSummaryVariant: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: -2,
    },
    summaryChipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    summaryChip: {
        width: '48%',
        minWidth: 140,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: 18,
        backgroundColor: '#F8F5FF',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    summaryChipLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    summaryChipValue: {
        marginTop: 2,
        fontSize: fontSize.sm,
        fontWeight: '900',
        color: colors.text,
    },
    sectionCard: {
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE5F8',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    sectionCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionCardLabel: {
        fontSize: fontSize.xs,
        fontWeight: '900',
        letterSpacing: 0.6,
        color: colors.primary,
        textTransform: 'uppercase',
    },
    participantsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    participantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: spacing.sm,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#F8F5FF',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    participantBadgeText: {
        fontSize: fontSize.sm,
        fontWeight: '800',
        color: colors.text,
    },
    addParticipantButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    addParticipantText: {
        fontSize: fontSize.sm,
        fontWeight: '900',
        color: colors.primary,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 4,
    },
    priceRowLabel: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    priceRowLabelEmphasized: {
        color: colors.text,
        fontWeight: '900',
    },
    priceRowValue: {
        flex: 1,
        fontSize: fontSize.sm,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'right',
    },
    priceRowValueEmphasized: {
        fontSize: fontSize.md,
        fontWeight: '900',
        color: colors.text,
    },
    paymentHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: spacing.xs,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: '#F0EBFA',
    },
    paymentHintText: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    placeholderNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 20,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#F7F1FF',
        alignSelf: 'flex-start',
    },
    placeholderNoteText: {
        fontSize: fontSize.sm,
        color: colors.primary,
        fontWeight: '800',
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#1A1340',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
    primaryButton: {
        minHeight: 52,
        backgroundColor: colors.primary,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.md,
        fontWeight: '900',
    },
    emptyFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
});
