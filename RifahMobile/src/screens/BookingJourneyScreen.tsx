import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { addDays, format, startOfToday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, getServicePrice, Service, ServiceVariant, SlotItem, Staff, Tenant } from '../api/client';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { buildGroupGuestPayload, GroupGuestPayload } from '../utils/groupGuest';
import { useServiceBookingCart, ServiceBookingPaymentMethod, ServiceBookingCartItem } from '../contexts/ServiceBookingCartContext';

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

type BookingServiceOption = {
    id: string;
    label: string;
};

type ParticipantDraft = {
    name: string;
    phone: string;
    email: string;
    selectedServiceIds: string[];
};

type GuestParticipant = {
    id: string;
    name: string;
    phone: string;
    email: string;
    serviceIds: string[];
    serviceLabels: string[];
    payload: GroupGuestPayload | null;
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
    const user: any = null;
    // Mapped from cart
    const { items, totalPrice: bookingTotalAmount, cartTenantId, clearCart } = useServiceBookingCart();
    const firstItem = items[0] || {};
    const tenantId = cartTenantId || firstItem.tenant?.id || route.params?.tenantId;
    const tenant = firstItem.tenant || route.params?.tenant;
    const service = firstItem.service || route.params?.service;
    const initialVariant = firstItem.variant || route.params?.selectedVariant || null;
    const selectedStaff = firstItem.staff || route.params?.selectedStaff || null;
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [step, setStep] = useState<BookingStep>('date');
    // removed replaceCart
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<ServiceBookingPaymentMethod | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [selectedTime, setSelectedTime] = useState<SlotItem | null>(null);
    const [selectedTimeLoaded, setSelectedTimeLoaded] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [dateAvailability, setDateAvailability] = useState<Record<string, DateAvailability>>({});
    const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
    const [slotChains, setSlotChains] = useState<Record<string, SlotItem[]>>({});
    const [serviceImageError, setServiceImageError] = useState(false);

    // tenantId moved up

    const serviceName = items.length > 1 ? (isRTL ? `${items.length} خدمات` : `${items.length} Services`) : (isRTL ? service?.name_ar : service?.name_en);
    const serviceDescription = (isRTL ? service?.description_ar : service?.description_en)
        || service?.description_en
        || service?.description_ar
        || '';
    const servicePrice = bookingTotalAmount;
    const serviceDuration = initialVariant?.duration || service?.duration || 0;
    const bookingServiceOptions: BookingServiceOption[] = useMemo(() => {
        const rawSelectedServices = Array.isArray(route.params?.selectedServices) ? route.params.selectedServices : [];
        const mappedSelectedServices = rawSelectedServices
            .map((entry: any) => {
                const id = `${entry?.id || entry?.serviceId || ''}`.trim();
                if (!id) {
                    return null;
                }

                const label = `${entry?.name || entry?.name_en || entry?.serviceName || entry?.title || id}`.trim();
                return { id, label };
            })
            .filter(Boolean) as BookingServiceOption[];

        if (mappedSelectedServices.length > 0) {
            return mappedSelectedServices;
        }

        return [{
            id: `${service?.id || ''}`,
            label: `${serviceName || service?.name_en || service?.name_ar || service?.id || ''}`.trim(),
        }].filter((item) => item.id) as BookingServiceOption[];
    }, [route.params?.selectedServices, service?.id, service?.name_ar, service?.name_en, serviceName]);
    const [participants, setParticipants] = useState<GuestParticipant[]>([]);
    const [guestModalVisible, setGuestModalVisible] = useState(false);
    const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
    const [participantDraft, setParticipantDraft] = useState<ParticipantDraft>({
        name: '',
        phone: '',
        email: '',
        selectedServiceIds: [bookingServiceOptions[0]?.id].filter(Boolean) as string[],
    });
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
    // bookingTotalAmount mapped to servicePrice

    const availablePaymentOptions = useMemo(() => {
        const options: Array<{ id: ServiceBookingPaymentMethod; label: string }> = [];
        const tenantAtCenter = bookingPaymentSettings.allowServicePayAtCenter !== false;
        const tenantOnlineFull = bookingPaymentSettings.allowServiceFullOnline !== false;
        const tenantDeposit = bookingPaymentSettings.allowServiceDeposit !== false;

        const serviceOptions = service?.paymentOptions || ['at-center', 'online-full', 'booking-fee'];
        const serviceAtCenter = serviceOptions.includes('at-center');
        const serviceOnlineFull = serviceOptions.includes('online-full');
        const serviceDeposit = serviceOptions.includes('booking-fee');

        if (tenantAtCenter && serviceAtCenter) {
            options.push({ id: 'at-center', label: isRTL ? 'الدفع عند المركز' : 'Pay at Center' });
        }
        if (tenantOnlineFull && serviceOnlineFull) {
            options.push({ id: 'online-full', label: isRTL ? 'الدفع الكامل أونلاين' : 'Pay Full Online' });
        }
        if (tenantDeposit && serviceDeposit && bookingDepositAmount !== null && bookingDepositAmount > 0) {
            options.push({ id: 'booking-fee', label: isRTL ? 'عربون الحجز' : 'Booking Deposit' });
        }

        return options;
    }, [
        bookingPaymentSettings.allowServicePayAtCenter,
        bookingPaymentSettings.allowServiceFullOnline,
        bookingPaymentSettings.allowServiceDeposit,
        service?.paymentOptions,
        bookingDepositAmount,
        isRTL
    ]);

    useEffect(() => {
        if (availablePaymentOptions.length > 0 && !selectedPaymentMethod) {
            setSelectedPaymentMethod(availablePaymentOptions[0].id);
        } else if (availablePaymentOptions.length > 0 && selectedPaymentMethod) {
            if (!availablePaymentOptions.some(opt => opt.id === selectedPaymentMethod)) {
                setSelectedPaymentMethod(availablePaymentOptions[0].id);
            }
        }
    }, [availablePaymentOptions, selectedPaymentMethod]);
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
            if (!tenantId || items.length === 0) {
                return;
            }

            try {
                setAvailabilityLoading(true);
                const days = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => addDays(startOfToday(), index));
                const entries = await Promise.all(days.map(async (day) => {
                    const dateKey = toDateKey(day);
                    try {
                        // For availability, checking the first item's availability is a good fast path.
                        // Ideally we check all, but it's expensive. Let's check just the first item.
                        const response = await api.post<BookingSearchResponse>('/bookings/search', {
                            tenantId,
                            serviceId: items[0].service.id,
                            date: dateKey,
                            staffId: items[0].requestedStaffId || items[0].staff?.id || undefined,
                            variantId: items[0].variant?.id || undefined,
                        });
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
                setSlotChains({});
                setSelectedTime(null);

                if (items.length === 0) return;

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
                
                // Process slots for each item
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
                            if (Math.abs(nextSlotStart - lastSlotEnd) < 5 * 60000) {
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
                    
                    // Deduplicate start times
                    const uniqueSlots = Array.from(new Map(finalSlots.map(s => [s.startTime, s])).values());
                    
                    setAvailableSlots(uniqueSlots);
                    setSlotChains(chainMap);
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

    const handleContinue = async () => {
        if (items.length === 0 || !tenant || !selectedDate || !selectedTime) {
            Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'بيانات الحجز غير مكتملة' : 'Booking data is incomplete');
            return;
        }

        if (!selectedPaymentMethod) {
            Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'يرجى اختيار طريقة الدفع' : 'Please select a payment method');
            return;
        }

        const chain = slotChains[selectedTime.startTime];
        if (!chain || chain.length !== items.length) {
             Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل في ترتيب الأوقات المتتالية.' : 'Failed to arrange contiguous times.');
             return;
        }

        let payableNowAmount = 0;
        if (selectedPaymentMethod === 'online-full') {
            payableNowAmount = bookingTotalAmount;
        } else if (selectedPaymentMethod === 'booking-fee' && bookingDepositAmount !== null) {
            payableNowAmount = bookingDepositAmount;
        }

        try {
            setLoading(true);
            const response = await api.post<any>('/bookings/create', {
                tenantId: tenant.id,
                bookingSessionId: route.params?.bookingSessionId || undefined,
                bookingReference: route.params?.bookingReference || undefined,
                items: items.map((item, index) => ({
                    serviceId: item.service.id,
                    variantId: item.variant?.id || null,
                    staffId: chain[index].staffId || item.staff?.id || null,
                    requestedStaffId: item.requestedStaffId || item.staff?.id || null,
                    startTime: chain[index].startTime,
                    notes: item.notes || undefined,
                    paymentMethod: selectedPaymentMethod,
                })),
            });

            const newBookingReference = response.bookingSession?.bookingReference || response.bookingSession?.id || '';
            const newBookingSessionId = response.bookingSession?.id;
            clearCart();

            const bookingTaxAmount = items.reduce((acc, item) => acc + (item.payableNowAmount || 0), 0); // fallback or correct computation
            const bookingDepositAmount = payableNowAmount;
            const paymentSummary = {
                primaryCustomer: (user?.firstName || user?.lastName) ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : (user?.phone || 'Guest'),
                participants: items.map(item => ({
                    name: (user?.firstName || user?.lastName) ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : (user?.phone || 'Guest'),
                    services: [isRTL ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar)]
                })),
                services: items.map(item => isRTL ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar)),
                date: selectedDateLabel,
                time: selectedTimeLabel,
                employee: selectedEmployeeLabel,
                salon: tenant?.name,
                subtotal: bookingTotalAmount - bookingTaxAmount,
                tax: bookingTaxAmount,
                deposit: bookingDepositAmount,
                total: bookingTotalAmount,
                remaining: bookingDepositAmount !== null ? bookingTotalAmount - bookingDepositAmount : 0,
            };

            if (payableNowAmount > 0 && newBookingSessionId) {
                navigation.navigate('Payment', {
                    bookingSessionId: newBookingSessionId,
                    bookingReference: newBookingReference,
                    payableAmount: payableNowAmount,
                    tenantId: tenant.id,
                    paymentMethod: selectedPaymentMethod,
                    paymentSummary,
                });
            } else {
                navigation.reset({
                    index: 0,
                    routes: [
                        {
                            name: 'PaymentSuccess',
                            params: {
                                bookingSessionId: newBookingSessionId,
                                bookingReference: newBookingReference,
                                summary: paymentSummary,
                            },
                        },
                    ],
                });
            }
        } catch (error: any) {
            console.error('Checkout error:', error);
            Alert.alert(
                isRTL ? 'حدث خطأ' : 'Error',
                error?.response?.data?.message || (isRTL ? 'تعذر إتمام الحجز.' : 'Could not complete booking.')
            );
        } finally {
            setLoading(false);
        }
    };

    const openGuestModal = (participant?: GuestParticipant | null) => {
        if (participant) {
            setEditingParticipantId(participant.id);
            setParticipantDraft({
                name: participant.name,
                phone: participant.phone,
                email: participant.email,
                selectedServiceIds: participant.serviceIds.length > 0
                    ? participant.serviceIds
                    : bookingServiceOptions.map((item: BookingServiceOption) => item.id),
            });
        } else {
            setEditingParticipantId(null);
            setParticipantDraft({
                name: '',
                phone: '',
                email: '',
                selectedServiceIds: bookingServiceOptions.map((item: BookingServiceOption) => item.id),
            });
        }

        setGuestModalVisible(true);
    };

    const closeGuestModal = () => {
        setGuestModalVisible(false);
        setEditingParticipantId(null);
    };

    const toggleGuestService = (serviceId: string) => {
        setParticipantDraft((prev: ParticipantDraft) => {
            const exists = prev.selectedServiceIds.includes(serviceId);
            const nextSelectedServiceIds = exists
                ? prev.selectedServiceIds.filter((entry) => entry !== serviceId)
                : [...prev.selectedServiceIds, serviceId];

            return {
                ...prev,
                selectedServiceIds: nextSelectedServiceIds.length > 0
                    ? nextSelectedServiceIds
                    : prev.selectedServiceIds,
            };
        });
    };

    const handleSaveGuest = () => {
        const name = participantDraft.name.trim();
        if (!name) {
            Alert.alert(
                isRTL ? 'اسم الضيف مطلوب' : 'Guest name is required',
                isRTL
                    ? 'أدخلي اسم الضيف قبل الحفظ.'
                    : 'Please enter the guest name before saving.'
            );
            return;
        }

        const selectedServices = bookingServiceOptions.filter((item: BookingServiceOption) => participantDraft.selectedServiceIds.includes(item.id));
        if (selectedServices.length === 0) {
            Alert.alert(
                isRTL ? 'اختاري خدمة' : 'Select a service',
                isRTL
                    ? 'اختاري خدمة واحدة على الأقل لهذا الضيف.'
                    : 'Please select at least one service for this guest.'
            );
            return;
        }

        const [firstName, ...restNameParts] = name.split(/\s+/).filter(Boolean);
        const lastName = restNameParts.length > 0 ? restNameParts.join(' ') : firstName;
        const serviceIds = selectedServices.map((item: BookingServiceOption) => item.id);
        const serviceLabels = selectedServices.map((item: BookingServiceOption) => item.label);
        const payload = buildGroupGuestPayload({
            firstName,
            lastName,
            email: participantDraft.email.trim(),
            phone: participantDraft.phone.trim(),
            serviceId: serviceIds[0],
            serviceIds,
            serviceName: serviceLabels.join(' · '),
            isFree: false,
        });

        const nextParticipant: GuestParticipant = {
            id: editingParticipantId || `guest-${Date.now()}`,
            name,
            phone: participantDraft.phone.trim(),
            email: participantDraft.email.trim(),
            serviceIds,
            serviceLabels,
            payload,
        };

        setParticipants((prev: GuestParticipant[]) => {
            if (editingParticipantId) {
                return prev.map((item: GuestParticipant) => (item.id === editingParticipantId ? nextParticipant : item));
            }

            return [...prev, nextParticipant];
        });

        closeGuestModal();
    };

    const handleRemoveGuest = (guestId: string) => {
        setParticipants((prev: GuestParticipant[]) => prev.filter((item: GuestParticipant) => item.id !== guestId));
    };

    const guestModalServiceLabels = bookingServiceOptions
        .map((item: BookingServiceOption) => item.label)
        .join(' · ');

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
                <View style={styles.participantsStack}>
                    <View style={styles.primaryParticipantRow}>
                        <View style={styles.participantBadge}>
                            <AppIcon name="verified_user" size={12} color={colors.primary} />
                            <Text style={styles.participantBadgeText}>{isRTL ? 'أنتِ' : 'You'}</Text>
                        </View>
                        <Text style={styles.primaryParticipantHint}>
                            {isRTL ? 'العميلة الأساسية وصاحبة الحجز' : 'Primary customer and booking owner'}
                        </Text>
                    </View>

                    {participants.map((participant: GuestParticipant) => (
                        <View key={participant.id} style={styles.participantCard}>
                            <View style={styles.participantCardTopRow}>
                                <View style={styles.participantCardTitleWrap}>
                                    <Text style={styles.participantCardTitle}>{participant.name}</Text>
                                    <Text style={styles.participantCardSubtitle}>
                                        {participant.serviceLabels.length > 0
                                            ? participant.serviceLabels.join(' · ')
                                            : (isRTL ? 'خدمات مضافة' : 'Added services')}
                                    </Text>
                                </View>
                                <View style={styles.participantBadgeMini}>
                                    <AppIcon name="user" size={12} color={colors.primary} />
                                    <Text style={styles.participantBadgeMiniText}>{isRTL ? 'ضيف' : 'Guest'}</Text>
                                </View>
                            </View>

                            <View style={styles.participantMetaList}>
                                {participant.phone ? (
                                    <Text style={styles.participantMetaItem}>{participant.phone}</Text>
                                ) : null}
                                {participant.email ? (
                                    <Text style={styles.participantMetaItem}>{participant.email}</Text>
                                ) : null}
                            </View>

                            <View style={styles.participantServiceChips}>
                                {participant.serviceLabels.map((serviceLabel: string) => (
                                    <View key={`${participant.id}-${serviceLabel}`} style={styles.participantServiceChip}>
                                        <Text style={styles.participantServiceChipText}>{serviceLabel}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.participantActionsRow}>
                                <TouchableOpacity
                                    style={styles.participantActionButton}
                                    onPress={() => openGuestModal(participant)}
                                    activeOpacity={0.9}
                                >
                                    <AppIcon name="settings" size={12} color={colors.primary} />
                                    <Text style={styles.participantActionText}>{isRTL ? 'تعديل' : 'Edit'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.participantActionButton, styles.participantActionButtonDanger]}
                                    onPress={() => handleRemoveGuest(participant.id)}
                                    activeOpacity={0.9}
                                >
                                    <AppIcon name="delete" size={12} color="#D64545" />
                                    <Text style={[styles.participantActionText, styles.participantActionTextDanger]}>
                                        {isRTL ? 'حذف' : 'Remove'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={styles.addParticipantButton}
                        onPress={() => openGuestModal()}
                        activeOpacity={0.9}
                    >
                        <AppIcon name="plus" size={14} color={colors.primary} />
                        <Text style={styles.addParticipantText}>{isRTL ? 'إضافة ضيف' : 'Bring Someone'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionCardLabel}>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Text>
                </View>
                <View style={styles.paymentOptionsContainer}>
                    {availablePaymentOptions.map((option) => {
                        const isSelected = selectedPaymentMethod === option.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.paymentOptionCard, isSelected && styles.selectedPaymentOptionCard]}
                                onPress={() => setSelectedPaymentMethod(option.id)}
                            >
                                <View style={styles.paymentOptionRadio}>
                                    {isSelected && <View style={styles.paymentOptionRadioInner} />}
                                </View>
                                <Text style={[styles.paymentOptionTitle, isSelected && styles.selectedPaymentOptionText]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                    {availablePaymentOptions.length === 0 && (
                        <Text style={styles.paymentHintText}>
                            {isRTL ? 'لا توجد طرق دفع متاحة' : 'No payment methods available'}
                        </Text>
                    )}
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

            <Modal visible={guestModalVisible} transparent animationType="fade" onRequestClose={closeGuestModal}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.modalKeyboardWrap}
                    >
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>{isRTL ? 'إضافة ضيف' : 'Add Guest'}</Text>
                                    <Text style={styles.modalSubtitle}>
                                        {isRTL
                                            ? 'أضيفي مشاركاً جديداً إلى نفس الزيارة.'
                                            : 'Add another participant to this same visit.'}
                                    </Text>
                                </View>
                                <TouchableOpacity style={styles.modalCloseButton} onPress={closeGuestModal}>
                                    <AppIcon name="close" size={18} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                                <View style={styles.modalField}>
                                    <Text style={styles.modalFieldLabel}>{isRTL ? 'الاسم *' : 'Name *'}</Text>
                                    <TextInput
                                        value={participantDraft.name}
                                        onChangeText={(value: string) => setParticipantDraft((prev: ParticipantDraft) => ({ ...prev, name: value }))}
                                        placeholder={isRTL ? 'اسم الضيف الكامل' : 'Guest full name'}
                                        placeholderTextColor={colors.textSecondary}
                                        style={styles.modalInput}
                                    />
                                </View>

                                <View style={styles.modalField}>
                                    <Text style={styles.modalFieldLabel}>{isRTL ? 'الجوال' : 'Phone'}</Text>
                                    <TextInput
                                        value={participantDraft.phone}
                                        onChangeText={(value: string) => setParticipantDraft((prev: ParticipantDraft) => ({ ...prev, phone: value }))}
                                        placeholder={isRTL ? 'رقم الجوال' : 'Guest phone'}
                                        placeholderTextColor={colors.textSecondary}
                                        style={styles.modalInput}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={styles.modalField}>
                                    <Text style={styles.modalFieldLabel}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Text>
                                    <TextInput
                                        value={participantDraft.email}
                                        onChangeText={(value: string) => setParticipantDraft((prev: ParticipantDraft) => ({ ...prev, email: value }))}
                                        placeholder={isRTL ? 'البريد الإلكتروني' : 'Guest email'}
                                        placeholderTextColor={colors.textSecondary}
                                        style={styles.modalInput}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={styles.modalField}>
                                    <Text style={styles.modalFieldLabel}>{isRTL ? 'الخدمات المختارة' : 'Selected services'}</Text>
                                    <Text style={styles.modalFieldHint}>
                                        {guestModalServiceLabels || (isRTL ? 'الخدمة الحالية' : 'Current service')}
                                    </Text>
                                    <View style={styles.serviceSelectGrid}>
                                        {bookingServiceOptions.map((item: BookingServiceOption) => {
                                            const selected = participantDraft.selectedServiceIds.includes(item.id);
                                            return (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={[styles.serviceSelectChip, selected ? styles.serviceSelectChipActive : null]}
                                                    onPress={() => toggleGuestService(item.id)}
                                                    activeOpacity={0.9}
                                                >
                                                    <Text style={[styles.serviceSelectChipText, selected ? styles.serviceSelectChipTextActive : null]}>
                                                        {item.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeGuestModal}>
                                    <Text style={styles.modalSecondaryButtonText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleSaveGuest}>
                                    <Text style={styles.modalPrimaryButtonText}>{isRTL ? 'حفظ' : 'Save'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
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
        fontSize: fontSize.md,
        color: colors.textSecondary,
        marginTop: 4,
    },
    paymentOptionsContainer: {
        gap: spacing.md,
        paddingTop: spacing.xs,
    },
    paymentOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
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
    paymentOptionRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentOptionRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    paymentOptionTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    selectedPaymentOptionText: {
        color: colors.primary,
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
    participantsStack: {
        gap: spacing.md,
    },
    primaryParticipantRow: {
        gap: 8,
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
    primaryParticipantHint: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    participantCard: {
        borderRadius: 22,
        backgroundColor: '#FAF8FF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
        padding: spacing.md,
        gap: spacing.sm,
    },
    participantCardTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    participantCardTitleWrap: {
        flex: 1,
        gap: 3,
    },
    participantCardTitle: {
        fontSize: fontSize.md,
        fontWeight: '900',
        color: colors.text,
    },
    participantCardSubtitle: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '700',
        lineHeight: 18,
    },
    participantBadgeMini: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F8F5FF',
    },
    participantBadgeMiniText: {
        fontSize: fontSize.xs,
        fontWeight: '900',
        color: colors.primary,
    },
    participantMetaList: {
        gap: 4,
    },
    participantMetaItem: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    participantServiceChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    participantServiceChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
    },
    participantServiceChipText: {
        fontSize: fontSize.xs,
        color: colors.text,
        fontWeight: '800',
    },
    participantActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    participantActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
    },
    participantActionButtonDanger: {
        borderColor: '#F2CDCD',
        backgroundColor: '#FFF9F9',
    },
    participantActionText: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '900',
    },
    participantActionTextDanger: {
        color: '#D64545',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(22, 15, 42, 0.58)',
        padding: spacing.lg,
        justifyContent: 'center',
    },
    modalKeyboardWrap: {
        width: '100%',
    },
    modalCard: {
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EDE4FB',
        overflow: 'hidden',
        maxHeight: '92%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.md,
        padding: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: '#FBF9FF',
        borderBottomWidth: 1,
        borderBottomColor: '#EFE7FB',
    },
    modalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '900',
        color: colors.text,
    },
    modalSubtitle: {
        marginTop: 4,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
    },
    modalScrollContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    modalField: {
        gap: 8,
    },
    modalFieldLabel: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '900',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    modalFieldHint: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    modalInput: {
        minHeight: 52,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
        paddingHorizontal: spacing.md,
        color: colors.text,
        fontSize: fontSize.md,
    },
    serviceSelectGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    serviceSelectChip: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
    },
    serviceSelectChipActive: {
        backgroundColor: '#F4EEFF',
        borderColor: colors.primary,
    },
    serviceSelectChipText: {
        fontSize: fontSize.xs,
        color: colors.text,
        fontWeight: '800',
    },
    serviceSelectChipTextActive: {
        color: colors.primary,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#EFE7FB',
    },
    modalSecondaryButton: {
        flex: 1,
        minHeight: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
    },
    modalSecondaryButtonText: {
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '900',
    },
    modalPrimaryButton: {
        flex: 1,
        minHeight: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    modalPrimaryButtonText: {
        fontSize: fontSize.sm,
        color: '#FFFFFF',
        fontWeight: '900',
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
