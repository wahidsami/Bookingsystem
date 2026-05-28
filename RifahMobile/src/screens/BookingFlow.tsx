import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, Service, Staff, SlotItem, getServicePrice, normalizeStaff } from '../api/client';
import { AppIcon } from '../components/AppIcon';
import { format, addDays, startOfToday, isSameDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { ServiceBookingCartItem, useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { LinearGradient } from 'expo-linear-gradient';

interface BookingProps {
    route: any;
    navigation: any;
}

type BookingStep = 'staff' | 'datetime' | 'review';
type ServicePaymentChoice = 'at-center' | 'online-full' | 'booking-fee';

const SERVICE_PAYMENT_CHOICES: ServicePaymentChoice[] = ['at-center', 'online-full', 'booking-fee'];

const normalizeServicePaymentOptions = (paymentOptions?: Array<string | null | undefined> | null) => {
    const normalized = (paymentOptions || [])
        .map((value) => `${value ?? ''}`.trim().toLowerCase())
        .filter((value): value is ServicePaymentChoice => SERVICE_PAYMENT_CHOICES.includes(value as ServicePaymentChoice));

    return normalized.length > 0 ? Array.from(new Set(normalized)) : [...SERVICE_PAYMENT_CHOICES];
};

const DEFAULT_BOOKING_PAYMENT_SETTINGS = {
    allowServicePayAtCenter: true,
    allowServiceFullOnline: true,
    allowServiceDeposit: true,
    serviceDepositMode: 'fixed' as const,
    serviceDepositFixedAmount: 50,
    serviceDepositPercentage: 50,
};

const MIN_SLOT_LEAD_MINUTES = 0;
const MIN_CART_LEAD_MINUTES = 60;

export function BookingFlow({ route, navigation }: BookingProps) {
    const { service, tenant } = route.params;
    const { t, isRTL, language } = useLanguage();
    const { ensureAuthenticated } = useAppSession();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();
    const { addItem, updateItem } = useServiceBookingCart();
    const [step, setStep] = useState<BookingStep>('staff');
    const [loading, setLoading] = useState(false);

    // Selection State
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(
        route.params?.selectedStaff ? normalizeStaff(route.params.selectedStaff) : null
    ); // null = Any
    const selectedVariant = route.params?.selectedVariant || null;
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [selectedTime, setSelectedTime] = useState<SlotItem | null>(null);
    const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
    const [bookingNote, setBookingNote] = useState('');
    const [includeGuest, setIncludeGuest] = useState(false);
    const [guestFirstName, setGuestFirstName] = useState('');
    const [guestLastName, setGuestLastName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [paymentSettings, setPaymentSettings] = useState(tenant?.paymentSettings || DEFAULT_BOOKING_PAYMENT_SETTINGS);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<ServicePaymentChoice>('at-center');
    const editingCartItemId: string | null = route.params?.cartItemId || null;
    const allowedServicePaymentMethods = new Set(normalizeServicePaymentOptions(service?.paymentOptions));

    useEffect(() => {
        loadStaff();
    }, []);

    useEffect(() => {
        loadPaymentSettings();
    }, []);

    useEffect(() => {
        if (step === 'datetime') {
            loadTimeSlots();
        }
    }, [selectedDate, step]);

    useEffect(() => {
        const prefillStartTime = route.params?.startTime;
        if (!prefillStartTime) {
            return;
        }

        const parsed = new Date(prefillStartTime);
        if (!Number.isNaN(parsed.getTime())) {
            setSelectedDate(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
            setSelectedTime({
                startTime: parsed.toISOString(),
                endTime: route.params?.endTime || parsed.toISOString(),
                available: true,
                staffId: route.params?.selectedStaff?.id || route.params?.staffId || undefined,
                staffName: route.params?.selectedStaff?.name || undefined,
            });
        }

        const prefillPayment = route.params?.paymentMethod as ServicePaymentChoice | undefined;
        if (prefillPayment && SERVICE_PAYMENT_CHOICES.includes(prefillPayment)) {
            setSelectedPaymentMethod(prefillPayment);
        }

        if (route.params?.notes) {
            setBookingNote(String(route.params.notes));
        }
    }, []);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const response = await api.get<{ success: boolean; staff: Staff[] }>(
                `/public/tenant/${tenant.id}/services/${service.id}/staff`
            );
            if (response.success) {
                setStaffList((response.staff || []).map((item) => normalizeStaff(item)));
            }
        } catch (error) {
            console.error('Failed to load staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPaymentSettings = async () => {
        if (tenant?.paymentSettings) {
            setPaymentSettings({
                ...DEFAULT_BOOKING_PAYMENT_SETTINGS,
                ...tenant.paymentSettings,
            });
            return;
        }

        if (!tenant?.slug) {
            setPaymentSettings(DEFAULT_BOOKING_PAYMENT_SETTINGS);
            return;
        }

        try {
            const response = await api.get<{ success: boolean; data: any }>(`/public/tenant/${tenant.slug}`);
            if (response.success && response.data?.paymentSettings) {
                setPaymentSettings({
                    ...DEFAULT_BOOKING_PAYMENT_SETTINGS,
                    ...response.data.paymentSettings,
                });
            }
        } catch (error) {
            console.error('Failed to load payment settings:', error);
            setPaymentSettings(DEFAULT_BOOKING_PAYMENT_SETTINGS);
        }
    };

    useEffect(() => {
        const availableMethods = [
            paymentSettings.allowServicePayAtCenter && allowedServicePaymentMethods.has('at-center') ? 'at-center' : null,
            paymentSettings.allowServiceFullOnline && allowedServicePaymentMethods.has('online-full') ? 'online-full' : null,
            paymentSettings.allowServiceDeposit && allowedServicePaymentMethods.has('booking-fee') ? 'booking-fee' : null,
        ].filter(Boolean) as ServicePaymentChoice[];

        if (availableMethods.length === 0) {
            return;
        }

        setSelectedPaymentMethod((current) => availableMethods.includes(current) ? current : availableMethods[0]);
    }, [
        paymentSettings.allowServiceDeposit,
        paymentSettings.allowServiceFullOnline,
        paymentSettings.allowServicePayAtCenter,
        service?.paymentOptions,
    ]);

    const servicePrice = getServicePrice(service, selectedVariant);
    const selectedVariantLabel = selectedVariant?.description || null;
    const selectedVariantDuration = selectedVariant?.duration || service.duration;
    const bookingFeeAmount = paymentSettings.serviceDepositMode === 'percentage'
        ? Math.min(servicePrice, parseFloat((servicePrice * (paymentSettings.serviceDepositPercentage / 100)).toFixed(2)))
        : Math.min(servicePrice, paymentSettings.serviceDepositFixedAmount);
    const payableNowAmount = selectedPaymentMethod === 'booking-fee' ? bookingFeeAmount : servicePrice;

    const paymentOptions = [
        paymentSettings.allowServicePayAtCenter && allowedServicePaymentMethods.has('at-center') ? {
            id: 'at-center' as ServicePaymentChoice,
            title: language === 'ar' ? 'الدفع عند الوصول' : 'Pay When You Arrive',
            subtitle: language === 'ar'
                ? 'احجز الآن وادفع في المركز عند حضور الموعد.'
                : 'Book now and settle the amount at the center when you arrive.',
            amountLabel: language === 'ar' ? 'يدفع لاحقاً' : 'Pay later',
            icon: 'browse' as const,
        } : null,
        paymentSettings.allowServiceFullOnline && allowedServicePaymentMethods.has('online-full') ? {
            id: 'online-full' as ServicePaymentChoice,
            title: language === 'ar' ? 'الدفع الكامل الآن' : 'Pay In Full Now',
            subtitle: language === 'ar'
                ? 'ادفع كامل قيمة الخدمة الآن لتأكيد الحجز.'
                : 'Pay the full service amount now to lock in your booking.',
            amountLabel: `${servicePrice.toFixed(2)} SAR`,
            icon: 'card' as const,
        } : null,
        paymentSettings.allowServiceDeposit && allowedServicePaymentMethods.has('booking-fee') ? {
            id: 'booking-fee' as ServicePaymentChoice,
            title: language === 'ar' ? 'دفع عربون الحجز' : 'Pay Booking Fee',
            subtitle: language === 'ar'
                ? 'ادفع جزءاً من المبلغ الآن وأكمل الباقي عند المركز.'
                : 'Pay a deposit now and settle the rest at the center.',
            amountLabel: `${bookingFeeAmount.toFixed(2)} SAR`,
            icon: 'cash' as const,
        } : null,
    ].filter(Boolean) as Array<{
        id: ServicePaymentChoice;
        title: string;
        subtitle: string;
        amountLabel: string;
        icon: 'browse' | 'card' | 'cash';
    }>;
    const stepIndex = step === 'staff' ? 0 : step === 'datetime' ? 1 : 2;
    const stepTitles = [
        language === 'ar' ? 'المتخصص' : 'Specialist',
        language === 'ar' ? 'الوقت' : 'Date & Time',
        language === 'ar' ? 'المراجعة' : 'Review',
    ];

    const loadTimeSlots = async () => {
        setLoading(true);
        setAvailableSlots([]);
        setSelectedTime(null);
        try {
            const response = await api.post<{ slots: SlotItem[]; metadata: any }>(
                '/bookings/search',
                {
                    tenantId: tenant.id,
                    serviceId: service.id,
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    staffId: selectedStaff?.id || undefined,
                    variantId: selectedVariant?.id || undefined,
                }
            );
            const now = new Date();
            const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
            const todayKey = format(now, 'yyyy-MM-dd');
            const available = (response.slots || []).filter((slot) => {
                if (!slot?.available) {
                    return false;
                }

                if (selectedDateKey !== todayKey) {
                    return true;
                }

                const slotStart = new Date(slot.startTime);
                if (Number.isNaN(slotStart.getTime())) {
                    return false;
                }

                const earliestAllowed = new Date(now.getTime() + (MIN_SLOT_LEAD_MINUTES * 60 * 1000));
                return slotStart.getTime() >= earliestAllowed.getTime();
            });
            setAvailableSlots(available);
        } catch (error: any) {
            console.error('Failed to load time slots:', error);
            Alert.alert('Error', error.message || 'Could not load available time slots');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (step === 'staff') setStep('datetime');
        else if (step === 'datetime') {
            if (!selectedTime) {
                Alert.alert('Select a Time', 'Please select an available time slot');
                return;
            }
            setStep('review');
        }
    };

    const handleBack = () => {
        if (step === 'review') setStep('datetime');
        else if (step === 'datetime') setStep('staff');
        else navigation.goBack();
    };

    const handleBooking = async () => {
        if (!selectedTime) return;

        if (!ensureAuthenticated()) {
            Alert.alert(t('guestTitle'), t('loginToOrderBookings'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('loginNow') },
            ]);
            return;
        }
        const user = await api.getUser();
        if (!user) return;

        if (includeGuest && (!guestFirstName.trim() || !guestLastName.trim())) {
            Alert.alert('Guest Details', 'Please provide guest first and last name.');
            return;
        }

        try {
            setLoading(true);
            const response = await api.post<{ success: boolean; appointment: { id: string; bookingNumber?: string | null; price: number } }>('/bookings/create', {
                serviceId: service.id,
                tenantId: tenant.id,
                staffId: selectedTime.staffId || selectedStaff?.id || undefined,
                requestedStaffId: selectedStaff?.id || undefined,
                startTime: selectedTime.startTime,
                notes: bookingNote.trim() || undefined,
                paymentMethod: selectedPaymentMethod,
                variantId: selectedVariant?.id || undefined,
                groupGuest: includeGuest ? {
                    firstName: guestFirstName.trim(),
                    lastName: guestLastName.trim(),
                    phone: guestPhone.trim() || undefined
                } : undefined
            });

            const appointmentId = response.appointment?.id;
            const bookingNumber = response.appointment?.bookingNumber || appointmentId?.slice(0, 8)?.toUpperCase();
            const bookingAmount = Number(response.appointment?.price ?? getServicePrice(service));
            const selectedVariantLabel = selectedVariant?.description?.trim() || '';
            const successTitle = language === 'ar' ? 'تم تأكيد الحجز' : 'Booking Confirmed';
            const successMessage = selectedPaymentMethod === 'at-center'
                ? (language === 'ar'
                    ? `تم حجز موعدك بنجاح. رقم الحجز: ${bookingNumber || '-'}.${selectedVariantLabel ? `\nالنوع المختار: ${selectedVariantLabel}` : ''}\nسيكون الدفع عند الوصول للمركز.`
                    : `Your appointment has been scheduled successfully. Booking No.: ${bookingNumber || '-'}.${selectedVariantLabel ? `\nSelected variant: ${selectedVariantLabel}` : ''}\nPayment will be collected when you arrive at the center.`)
                : (language === 'ar'
                    ? `تم حجز موعدك بنجاح. رقم الحجز: ${bookingNumber || '-'}.${selectedVariantLabel ? `\nالنوع المختار: ${selectedVariantLabel}` : ''}\nالمطلوب الآن: ${payableNowAmount.toFixed(2)} ريال.`
                    : `Your appointment has been scheduled successfully. Booking No.: ${bookingNumber || '-'}.${selectedVariantLabel ? `\nSelected variant: ${selectedVariantLabel}` : ''}\nDue now: ${payableNowAmount.toFixed(2)} SAR.`);
            const payLaterLabel = language === 'ar' ? 'الدفع لاحقاً' : 'Pay Later';
            const payNowLabel = selectedPaymentMethod === 'booking-fee'
                ? (language === 'ar' ? 'دفع العربون الآن' : 'Pay Deposit Now')
                : (language === 'ar' ? 'الدفع الآن' : 'Pay Now');
            const viewBookingsLabel = language === 'ar' ? 'عرض حجوزاتي' : 'View My Bookings';

            const successActions: Array<{ text: string; onPress: () => void }> = [
                {
                    text: selectedPaymentMethod === 'at-center' ? viewBookingsLabel : payLaterLabel,
                    onPress: () => navigation.navigate('Tabs', { screen: 'Appointments' }),
                },
            ];

            if (appointmentId && selectedPaymentMethod !== 'at-center') {
                successActions.push({
                    text: payNowLabel,
                    onPress: () => navigation.navigate('Payment', {
                        appointmentId,
                        amount: selectedPaymentMethod === 'booking-fee' ? bookingFeeAmount : bookingAmount,
                        tenantId: tenant.id,
                        paymentChoice: selectedPaymentMethod === 'booking-fee' ? 'booking-fee' : 'online-full',
                    }),
                });
            }

            Alert.alert(successTitle, successMessage, successActions);
        } catch (error: any) {
            const msg = error.message || 'Failed to create booking';
            // Surface meaningful server errors to the user
            Alert.alert('Booking Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = () => {
        if (!selectedTime) {
            Alert.alert('Select a Time', 'Please select an available time slot');
            return;
        }

        const slotStart = new Date(selectedTime.startTime);
        const minutesUntilSlot = (slotStart.getTime() - Date.now()) / (1000 * 60);
        if (!Number.isFinite(minutesUntilSlot) || minutesUntilSlot < MIN_CART_LEAD_MINUTES) {
            Alert.alert(
                language === 'ar' ? 'الوقت غير متاح' : 'Time not allowed',
                language === 'ar'
                    ? 'يجب أن يكون موعد الخدمة بعد ساعة واحدة على الأقل قبل إضافته إلى السلة.'
                    : 'Service time must be at least one hour from now before adding to cart.'
            );
            return;
        }

        const bookingCartItem: ServiceBookingCartItem = {
            id: `${service.id}-${selectedTime.startTime}-${Date.now()}`,
            tenantId: tenant.id,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                name_en: tenant.name_en,
                name_ar: tenant.name_ar,
                slug: tenant.slug,
                logo: tenant.logo,
            },
            service,
            variant: selectedVariant || null,
            staff: selectedStaff || null,
            requestedStaffId: selectedStaff?.id || null,
            staffId: selectedTime.staffId || selectedStaff?.id || null,
            startTime: selectedTime.startTime,
            notes: bookingNote.trim() || undefined,
            paymentMethod: selectedPaymentMethod,
            totalPrice: servicePrice,
            payableNowAmount: selectedPaymentMethod === 'booking-fee' ? bookingFeeAmount : selectedPaymentMethod === 'online-full' ? servicePrice : 0,
        };

        if (editingCartItemId) {
            updateItem(editingCartItemId, bookingCartItem);
        } else {
            const result = addItem(bookingCartItem);
            if (!result.success) {
                Alert.alert(
                    language === 'ar' ? 'تنبيه' : 'Notice',
                    language === 'ar'
                        ? 'السلة الحالية تخص مركزاً آخر. أفرغ السلة أو أكمل الحجز الحالي أولاً.'
                        : 'Your current booking cart belongs to another tenant. Please clear it or finish that booking first.'
                );
                return;
            }
        }

        Alert.alert(
            language === 'ar' ? 'تمت الإضافة' : 'Added to cart',
            language === 'ar'
                ? (editingCartItemId ? 'تم تحديث الخدمة في سلة الحجز.' : 'تم حفظ الخدمة في سلة الحجز.')
                : (editingCartItemId ? 'This service was updated in your booking cart.' : 'This service was saved to your booking cart.'),
            [
                {
                    text: language === 'ar' ? 'عرض السلة' : 'View Cart',
                    onPress: () => navigation.navigate('ServiceBookingCart'),
                },
                {
                    text: language === 'ar' ? 'متابعة' : 'Continue',
                    style: 'cancel',
                    onPress: () => navigation.goBack(),
                },
            ]
        );
    };

    const renderStaffSelection = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'اختيار المتخصص' : 'Select Specialist'}</Text>
            <TouchableOpacity
                style={[styles.staffCard, selectedStaff === null && styles.selectedCard]}
                onPress={() => setSelectedStaff(null)}
            >
                <View style={styles.avatarPlaceholder}>
                    <AppIcon name="user" size={24} color={colors.primary} />
                </View>
                <View>
                    <Text style={styles.staffName}>{language === 'ar' ? 'أي متخصص' : 'Any Professional'}</Text>
                    <Text style={styles.staffRole}>{language === 'ar' ? 'أفضل توفر للمواعيد' : 'Maximum Availability'}</Text>
                </View>
                {selectedStaff === null && <AppIcon name="star" size={24} color={colors.primary} />}
            </TouchableOpacity>

            {staffList.map(staff => (
                <TouchableOpacity
                    key={staff.id}
                    style={[styles.staffCard, selectedStaff?.id === staff.id && styles.selectedCard]}
                    onPress={() => setSelectedStaff(staff)}
                >
                    {staff.avatar || staff.image ? (
                        <Image
                            source={{ uri: (staff.avatar || staff.image)! }}
                            style={styles.staffAvatar}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={{ fontSize: 18 }}>{staff.name.charAt(0)}</Text>
                        </View>
                    )}
                    <View>
                        <Text style={styles.staffName}>{staff.name}</Text>
                        <Text style={styles.staffRole}>{staff.role || 'Specialist'}</Text>
                    </View>
                    {selectedStaff?.id === staff.id && <AppIcon name="star" size={24} color={colors.primary} />}
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderDateTimeSelection = () => {
        const dates = Array.from({ length: 14 }).map((_, i) => addDays(startOfToday(), i)); // Next 2 weeks

        return (
            <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>{language === 'ar' ? 'اختيار التاريخ والوقت' : 'Select Date & Time'}</Text>

                {/* Horizontal Date Picker */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
                    {dates.map(date => {
                        const isSelected = isSameDay(date, selectedDate);
                        return (
                            <TouchableOpacity
                                key={date.toString()}
                                style={[styles.dateCard, isSelected && styles.selectedDateCard]}
                                onPress={() => {
                                    setSelectedDate(date);
                                    setSelectedTime(null);
                                }}
                            >
                                <Text style={[styles.dayName, isSelected && styles.selectedDateText]}>
                                    {format(date, 'EEE', { locale: isRTL ? ar : enUS })}
                                </Text>
                                <Text style={[styles.dayNumber, isSelected && styles.selectedDateText]}>
                                    {format(date, 'd')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <Text style={styles.subTitle}>Available Slots</Text>
                <View style={styles.slotsGrid}>
                    {availableSlots.length === 0 && !loading && (
                        <Text style={styles.summaryLabel}>{language === 'ar' ? 'لا توجد مواعيد متاحة لهذا اليوم.' : 'No available slots for this date.'}</Text>
                    )}
                    {availableSlots.map(slot => {
                        const label = format(new Date(slot.startTime), 'hh:mm a');
                        const isSelected = selectedTime?.startTime === slot.startTime;
                        return (
                            <TouchableOpacity
                                key={slot.startTime}
                                style={[styles.slot, isSelected && styles.selectedSlot]}
                                onPress={() => setSelectedTime(slot)}
                            >
                                <Text style={[styles.slotText, isSelected && styles.selectedSlotText]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderReview = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'مراجعة الحجز' : 'Review Booking'}</Text>

            <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Service</Text>
                    <Text style={styles.summaryValue}>{isRTL ? service.name_ar : service.name_en}</Text>
                </View>
                {selectedVariantLabel ? (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{language === 'ar' ? 'النسخة' : 'Variant'}</Text>
                        <Text style={styles.summaryValue}>{selectedVariantLabel}</Text>
                    </View>
                ) : null}
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Specialist</Text>
                    <Text style={styles.summaryValue}>{selectedStaff ? selectedStaff.name : (selectedTime?.staffName || (language === 'ar' ? 'أي متخصص' : 'Any Professional'))}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Date</Text>
                    <Text style={styles.summaryValue}>{format(selectedDate, 'PPP', { locale: isRTL ? ar : enUS })}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Time</Text>
                    <Text style={styles.summaryValue}>
                        {selectedTime ? format(new Date(selectedTime.startTime), 'hh:mm a') : ''}
                    </Text>
                </View>
                {selectedVariantDuration ? (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{language === 'ar' ? 'المدة' : 'Duration'}</Text>
                        <Text style={styles.summaryValue}>{selectedVariantDuration} min</Text>
                    </View>
                ) : null}
                <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{servicePrice.toFixed(2)} SAR</Text>
                </View>
            </View>

            <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>
                    {language === 'ar' ? 'ملاحظة للحجز' : 'Booking Note'}
                </Text>
                <Text style={styles.noteDescription}>
                    {language === 'ar'
                        ? 'يمكنك إضافة أي تعليمات أو ملاحظات تريد أن يراها مقدم الخدمة.'
                        : 'Add any instructions or preferences you want the provider to see.'}
                </Text>
                <TextInput
                    style={styles.noteInput}
                    value={bookingNote}
                    onChangeText={(value: string) => setBookingNote(value.slice(0, 1000))}
                    multiline
                    textAlignVertical="top"
                    placeholder={language === 'ar' ? 'مثال: أفضّل خدمة هادئة أو لدي حساسية من منتج معيّن.' : 'Example: I prefer a quiet session or I have a sensitivity to a product.'}
                    placeholderTextColor={colors.textSecondary}
                    maxLength={1000}
                />
                <Text style={styles.noteCounter}>
                    {bookingNote.length}/1000
                </Text>
            </View>

            <View style={styles.noteCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.noteTitle}>{language === 'ar' ? 'حجز جماعي' : 'Group Booking'}</Text>
                    <TouchableOpacity
                        style={[styles.cartToggle, includeGuest && styles.cartToggleActive]}
                        onPress={() => setIncludeGuest((prev) => !prev)}
                    >
                        <Text style={styles.cartToggleText}>{includeGuest ? (language === 'ar' ? 'مفعل' : 'On') : (language === 'ar' ? 'غير مفعل' : 'Off')}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.noteDescription}>
                    {language === 'ar'
                        ? 'أضف ضيفًا واحدًا ليتم حجز نفس الموعد لك وله.'
                        : 'Add one guest person to this same appointment booking.'}
                </Text>
                {includeGuest ? (
                    <View style={{ gap: spacing.sm }}>
                        <TextInput
                            style={styles.noteInput}
                            value={guestFirstName}
                            onChangeText={setGuestFirstName}
                            placeholder={language === 'ar' ? 'الاسم الأول للضيف' : 'Guest first name'}
                            placeholderTextColor={colors.textSecondary}
                        />
                        <TextInput
                            style={styles.noteInput}
                            value={guestLastName}
                            onChangeText={setGuestLastName}
                            placeholder={language === 'ar' ? 'اسم العائلة للضيف' : 'Guest last name'}
                            placeholderTextColor={colors.textSecondary}
                        />
                        <TextInput
                            style={styles.noteInput}
                            value={guestPhone}
                            onChangeText={setGuestPhone}
                            placeholder={language === 'ar' ? 'جوال الضيف (اختياري)' : 'Guest phone (optional)'}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                        />
                    </View>
                ) : null}
            </View>

            <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>
                    {language === 'ar' ? 'طريقة الدفع' : 'Payment Option'}
                </Text>
                <Text style={styles.noteDescription}>
                    {language === 'ar'
                        ? 'اختر كيف تريد تأكيد هذا الحجز والدفع له.'
                        : 'Choose how you want to confirm and pay for this booking.'}
                </Text>
                {paymentOptions.map((option) => {
                    const isSelected = selectedPaymentMethod === option.id;
                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={[styles.paymentOptionCard, isSelected && styles.selectedPaymentOptionCard]}
                            onPress={() => setSelectedPaymentMethod(option.id)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.paymentOptionIcon}>
                                <AppIcon name={option.icon} size={20} color={colors.primary} />
                            </View>
                            <View style={styles.paymentOptionContent}>
                                <View style={styles.paymentOptionHeader}>
                                    <Text style={styles.paymentOptionTitle}>{option.title}</Text>
                                    <Text style={styles.paymentOptionAmount}>{option.amountLabel}</Text>
                                </View>
                                <Text style={styles.paymentOptionSubtitle}>{option.subtitle}</Text>
                            </View>
                            <AppIcon name={isSelected ? 'star' : 'clock'} size={20} color={isSelected ? colors.primary : colors.textSecondary} />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#F5F0FF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: spacing.lg + topInset }]}
            >
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>{language === 'ar' ? 'حجز موعد' : 'Booking'}</Text>
                    <Text style={styles.headerSubtitle}>{isRTL ? service.name_ar : service.name_en}</Text>
                </View>
                <View style={{ width: 40 }} />
            </LinearGradient>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: step === 'staff' ? '25%' : step === 'datetime' ? '50%' : '100%' }]} />
            </View>
            <View style={styles.stepsRail}>
                {stepTitles.map((title, index) => {
                    const isActive = index === stepIndex;
                    const isCompleted = index < stepIndex;
                    return (
                        <View key={title} style={[styles.stepChip, (isActive || isCompleted) && styles.stepChipActive]}>
                            <Text style={[styles.stepChipText, (isActive || isCompleted) && styles.stepChipTextActive]}>
                                {title}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}>
                {step === 'staff' && renderStaffSelection()}
                {step === 'datetime' && renderDateTimeSelection()}
                {step === 'review' && renderReview()}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                {step === 'review' ? (
                    <>
                        <TouchableOpacity style={styles.secondaryButton} onPress={handleAddToCart} disabled={loading}>
                            <Text style={styles.secondaryButtonText}>
                                {language === 'ar' ? 'إضافة للسلة' : 'Add to Cart'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryButton} onPress={handleBooking} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>{language === 'ar' ? 'تأكيد الحجز' : 'Confirm Booking'}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                        <Text style={styles.buttonText}>{t('next')}</Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        backgroundColor: colors.surface,
    },
    headerTitle: {
        fontSize: 30,
        fontWeight: '800',
        color: '#14153C',
    },
    headerTitleWrap: {
        flex: 1,
        alignItems: 'center',
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: '#656C8C',
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
    progressContainer: {
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
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
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
        fontWeight: '600',
    },
    stepChipTextActive: {
        color: colors.primary,
    },
    content: {
        padding: spacing.lg,
    },
    stepContainer: {
        gap: spacing.md,
    },
    stepTitle: {
        fontSize: 30,
        fontWeight: '800',
        color: '#171840',
        marginBottom: spacing.md,
    },
    staffCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#ECE7FA',
        marginBottom: spacing.sm,
        gap: spacing.md,
        shadowColor: '#1A1440',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
        elevation: 2,
    },
    selectedCard: {
        borderColor: '#C6AEFB',
        backgroundColor: '#F8F3FF',
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F0EBFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    staffAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.backgroundGray,
    },
    staffName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1A1A44',
    },
    staffRole: {
        fontSize: 13,
        color: '#71789A',
    },
    datePicker: {
        marginBottom: spacing.lg,
    },
    dateCard: {
        width: 70,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E9E2FA',
        marginRight: spacing.md,
        backgroundColor: '#FFFFFF',
    },
    selectedDateCard: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayName: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    dayNumber: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
    },
    selectedDateText: {
        color: colors.textInverse,
    },
    subTitle: {
        fontSize: fontSize.lg,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    slot: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E9E2FA',
        backgroundColor: '#FFFFFF',
        minWidth: '30%',
        alignItems: 'center',
    },
    selectedSlot: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    slotText: {
        color: colors.text,
    },
    selectedSlotText: {
        color: colors.textInverse,
        fontWeight: '600',
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        padding: spacing.lg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ECE7FA',
        shadowColor: '#1A1440',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
        elevation: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    summaryLabel: {
        color: '#6D7395',
        fontSize: 15,
    },
    summaryValue: {
        color: '#1D1E49',
        fontSize: 15,
        fontWeight: '700',
    },
    totalRow: {
        marginTop: spacing.sm,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    totalLabel: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
    },
    totalValue: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.primary,
    },
    noteCard: {
        backgroundColor: '#FFFFFF',
        padding: spacing.lg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ECE7FA',
        gap: spacing.sm,
        shadowColor: '#1A1440',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
        elevation: 2,
    },
    noteTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    noteDescription: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    noteInput: {
        minHeight: 120,
        borderWidth: 1,
        borderColor: '#E8E1FA',
        borderRadius: 14,
        padding: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: '#FBFAFE',
    },
    noteCounter: {
        alignSelf: 'flex-end',
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    cartToggle: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    cartToggleActive: {
        borderColor: colors.primary,
        backgroundColor: '#F3E8FF',
    },
    cartToggleText: {
        color: colors.text,
        fontSize: fontSize.xs,
        fontWeight: '700',
    },
    paymentOptionCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E8E1FA',
        backgroundColor: '#FFFFFF',
    },
    selectedPaymentOptionCard: {
        borderColor: colors.primary,
        backgroundColor: '#F8F2FF',
    },
    paymentOptionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    paymentOptionContent: {
        flex: 1,
        gap: 4,
    },
    paymentOptionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    paymentOptionTitle: {
        flex: 1,
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    paymentOptionAmount: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.primary,
    },
    paymentOptionSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    footer: {
        padding: spacing.lg,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        flexDirection: 'row',
        gap: spacing.sm,
        shadowColor: '#1A1340',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#C5AEFB',
    },
    secondaryButtonText: {
        color: colors.primary,
        fontSize: fontSize.md,
        fontWeight: 'bold',
    },
    buttonText: {
        color: colors.textInverse,
        fontSize: fontSize.md,
        fontWeight: 'bold',
    },
});

