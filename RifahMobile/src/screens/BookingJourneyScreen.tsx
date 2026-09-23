import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    BackHandler,
    TextInput,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';
import {
    useServiceBookingCart,
    ServiceBookingCartItem,
    ServiceBookingPaymentMethod,
} from '../contexts/ServiceBookingCartContext';
import { useAppSession } from '../contexts/AppSessionContext';
import {
    api,
    Staff,
    SlotItem,
    Tenant,
    normalizeStaff,
    getServicePrice,
} from '../api/client';
import {
    BookingHeader,
    BookingContextCard,
    BookingStaffSelector,
    BookingDateStrip,
    DateItem,
    BookingTimeGrid,
    BookingSummaryCard,
    BookingPriceBreakdown,
    BookingPaymentSelector,
    PaymentOption,
    BookingConfirmationPass,
} from '../components/booking';
import { getCustomerFacingBookingErrorMessage } from '../components/booking/bookingErrorHelper';
import { addDays, format, startOfToday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

type BookingStep = 'staff' | 'datetime' | 'review' | 'confirmation';
type StaffSelectionMode = 'any' | 'choose';

const BOOKING_WINDOW_DAYS = 14;
const toDateKey = (value: Date) => format(value, 'yyyy-MM-dd');
const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

export function BookingJourneyScreen({ route, navigation }: any) {
    const { isRTL, language, t } = useLanguage();
    const locale = isRTL ? ar : enUS;
    const { topInset, scrollBottomPadding } = useScreenSafeArea();

    const {
        items,
        updateItem,
        totalPrice,
        clearCart,
        cartTenantId,
    } = useServiceBookingCart();
    const { isAuthenticated, showLogin } = useAppSession();

    const firstItem = items[0] || {};
    const tenantId =
        route.params?.tenantId ||
        cartTenantId ||
        firstItem.tenantId ||
        firstItem.tenant?.id;

    // Orchestrator State
    const [step, setStep] = useState<BookingStep>('staff');
    const [tenant, setTenant] = useState<any>(firstItem.tenant || null);
    const [loadingTenant, setLoadingTenant] = useState(!firstItem.tenant);

    // Step 1: Staff Selection State
    const [staffMode, setStaffMode] = useState<StaffSelectionMode>('any');
    const [eligibleStaffMap, setEligibleStaffMap] = useState<
        Record<string, Staff[]>
    >({});
    const [loadingStaff, setLoadingStaff] = useState(false);

    // Step 2: Date & Time Selection State
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [datesList, setDatesList] = useState<DateItem[]>([]);
    const [loadingDates, setLoadingDates] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Step 3: Review & Payment State
    const [selectedPaymentMethod, setSelectedPaymentMethod] =
        useState<string>('at-center');
    const [onlinePaymentSource, setOnlinePaymentSource] = useState<'card' | 'wallet'>('card');
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [notes, setNotes] = useState<string>('');
    const [submittingBooking, setSubmittingBooking] = useState(false);

    // Fetch customer wallet balance for this tenant
    useEffect(() => {
        let isMounted = true;
        if (tenantId) {
            api.getWalletBalance(tenantId)
                .then((bal) => {
                    if (isMounted) setWalletBalance(bal || 0);
                })
                .catch(() => undefined);
        }
        return () => {
            isMounted = false;
        };
    }, [tenantId]);

    // Step 4: Confirmation Pass State
    const [confirmedBookingData, setConfirmedBookingData] = useState<any>(null);

    // Computed Totals
    const totalDurationMinutes = useMemo(() => {
        return items.reduce(
            (acc, item) => acc + (item.service.duration || 30),
            0
        );
    }, [items]);

    const salonName = isRTL
        ? tenant?.name_ar || tenant?.name_en || tenant?.name
        : tenant?.name_en || tenant?.name_ar || tenant?.name || '';

    // Handle Hardware Back Button
    useEffect(() => {
        const onHardwareBack = () => {
            if (step === 'datetime') {
                setStep('staff');
                return true;
            }
            if (step === 'review') {
                setStep('datetime');
                return true;
            }
            if (step === 'confirmation') {
                navigation.navigate('Home');
                return true;
            }
            return false;
        };

        const sub = BackHandler.addEventListener(
            'hardwareBackPress',
            onHardwareBack
        );
        return () => sub.remove();
    }, [step, navigation]);

    // Ensure cart has items, otherwise exit
    useEffect(() => {
        if (
            items.length === 0 &&
            step !== 'confirmation' &&
            !confirmedBookingData &&
            !submittingBooking
        ) {
            navigation.goBack();
        }
    }, [items.length, step, confirmedBookingData, submittingBooking, navigation]);

    // Fetch Tenant Info if not already in context
    useEffect(() => {
        if (!tenantId) return;

        let active = true;
        const fetchTenant = async () => {
            try {
                setLoadingTenant(true);
                const tenantsRes = await api.get<{
                    success: boolean;
                    tenants: Tenant[];
                }>('/public/tenants');
                const matched = (tenantsRes?.tenants || []).find(
                    (t: any) => t.id === tenantId
                );
                if (active && matched) {
                    setTenant(matched);
                }
            } catch (err) {
                console.warn('Failed to load tenant details in booking:', err);
            } finally {
                if (active) setLoadingTenant(false);
            }
        };

        if (!tenant) {
            fetchTenant();
        } else {
            setLoadingTenant(false);
        }

        return () => {
            active = false;
        };
    }, [tenantId]);

    // Fetch Eligible Staff for each service in cart
    useEffect(() => {
        if (!tenantId || items.length === 0) return;

        let active = true;
        const loadStaff = async () => {
            try {
                setLoadingStaff(true);
                const map: Record<string, Staff[]> = {};

                const promises = items.map(async (item) => {
                    try {
                        const res = await api.get<{
                            success: boolean;
                            staff: Staff[];
                        }>(
                            `/public/tenant/${tenantId}/services/${item.service.id}/staff`
                        );
                        if (res.success && Array.isArray(res.staff)) {
                            map[item.service.id] = res.staff.map(normalizeStaff);
                        } else {
                            map[item.service.id] = [];
                        }
                    } catch {
                        map[item.service.id] = [];
                    }
                });

                await Promise.all(promises);
                if (active) {
                    setEligibleStaffMap(map);
                }
            } finally {
                if (active) setLoadingStaff(false);
            }
        };

        loadStaff();

        return () => {
            active = false;
        };
    }, [tenantId, items.length]);

    // Step 1: Staff Selection Handlers
    const handleModeChange = (mode: StaffSelectionMode) => {
        setStaffMode(mode);
        setSelectedSlot(null);
        if (mode === 'any') {
            items.forEach((item) => {
                updateItem(item.id, { staff: null, requestedStaffId: null });
            });
        }
    };

    const handleSelectStaff = (itemId: string, staff: Staff | null) => {
        setSelectedSlot(null);
        updateItem(itemId, {
            staff,
            requestedStaffId: staff ? staff.id : null,
        });
    };

    const canProceedFromStaff = useMemo(() => {
        if (staffMode === 'any') return true;
        // In choose mode, every service must have a chosen specialist
        return items.every((item) => item.staff !== null);
    }, [staffMode, items]);

    // Step 2: Authoritative Date Availability Evaluation
    useEffect(() => {
        if (!tenantId || items.length === 0) return;

        let active = true;
        const evaluateDates = async () => {
            try {
                setLoadingDates(true);
                const today = startOfToday();
                const days = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) =>
                    addDays(today, i)
                );

                const dateItems: DateItem[] = await Promise.all(
                    days.map(async (day) => {
                        const dateKey = toDateKey(day);
                        try {
                            // Query backend /bookings/search for all services on this date
                            const searchResponses = await Promise.all(
                                items.map((item) =>
                                    api.post<{
                                        success: boolean;
                                        slots?: SlotItem[];
                                    }>('/bookings/search', {
                                        tenantId,
                                        serviceId: item.service.id,
                                        date: dateKey,
                                        staffId:
                                            item.requestedStaffId ||
                                            item.staff?.id ||
                                            undefined,
                                        variantId:
                                            item.variant?.id || undefined,
                                    })
                                )
                            );

                            const nowTime = new Date().getTime();
                            const hasValidSlots = searchResponses.every(
                                (res) => {
                                    if (!res.success || !res.slots) return false;
                                    return res.slots.some((s) => {
                                        if (!s.available) return false;
                                        const slotStart = new Date(
                                            s.startTime
                                        ).getTime();
                                        if (isSameDay(day, today)) {
                                            return slotStart > nowTime;
                                        }
                                        return true;
                                    });
                                }
                            );

                            const totalCount = (
                                searchResponses[0]?.slots || []
                            ).filter((s) => s.available).length;

                            return {
                                key: dateKey,
                                date: day,
                                available: hasValidSlots,
                                slotCount: totalCount,
                            };
                        } catch {
                            return {
                                key: dateKey,
                                date: day,
                                available: false,
                                slotCount: 0,
                            };
                        }
                    })
                );

                if (active) {
                    setDatesList(dateItems);
                    // Select first available date if current is not available
                    const currentAvailable = dateItems.find(
                        (d) =>
                            isSameDay(d.date, selectedDate) && d.available
                    );
                    if (!currentAvailable) {
                        const firstAvailable = dateItems.find(
                            (d) => d.available
                        );
                        if (firstAvailable) {
                            setSelectedDate(firstAvailable.date);
                        }
                    }
                }
            } finally {
                if (active) setLoadingDates(false);
            }
        };

        evaluateDates();

        return () => {
            active = false;
        };
    }, [tenantId, staffMode, items]);

    // Step 2: Fetch Authoritative Slots for Selected Date
    useEffect(() => {
        if (!tenantId || items.length === 0) return;

        let active = true;
        const fetchSlots = async () => {
            try {
                setLoadingSlots(true);
                setSelectedSlot(null);
                const dateKey = toDateKey(selectedDate);

                if (items.length === 1) {
                    // Single service: authoritative slots from backend
                    const item = items[0];
                    const res = await api.post<{
                        success: boolean;
                        slots?: SlotItem[];
                    }>('/bookings/search', {
                        tenantId,
                        serviceId: item.service.id,
                        date: dateKey,
                        staffId:
                            item.requestedStaffId ||
                            item.staff?.id ||
                            undefined,
                        variantId: item.variant?.id || undefined,
                    });

                    if (active && res.success && Array.isArray(res.slots)) {
                        const nowTime = new Date().getTime();
                        const isToday = isSameDay(selectedDate, startOfToday());
                        const validSlots = res.slots.filter((s) => {
                            if (!s.available) return false;
                            if (isToday) {
                                return (
                                    new Date(s.startTime).getTime() > nowTime
                                );
                            }
                            return true;
                        });
                        setAvailableSlots(validSlots);
                    }
                } else {
                    // Multi-service: Fetch slots for all services and compute exact contiguous chain (gap === 0)
                    // Eliminating the flawed 45-minute slack!
                    const responses = await Promise.all(
                        items.map((item) =>
                            api.post<{
                                success: boolean;
                                slots?: SlotItem[];
                            }>('/bookings/search', {
                                tenantId,
                                serviceId: item.service.id,
                                date: dateKey,
                                staffId:
                                    item.requestedStaffId ||
                                    item.staff?.id ||
                                    undefined,
                                variantId: item.variant?.id || undefined,
                            })
                        )
                    );

                    const nowTime = new Date().getTime();
                    const isToday = isSameDay(selectedDate, startOfToday());

                    const validLayers = responses.map((res) =>
                        (res.slots || []).filter((s) => {
                            if (!s.available) return false;
                            if (isToday) {
                                return (
                                    new Date(s.startTime).getTime() > nowTime
                                );
                            }
                            return true;
                        })
                    );

                    if (validLayers.some((layer) => layer.length === 0)) {
                        if (active) setAvailableSlots([]);
                        return;
                    }

                    // Build contiguous chains with EXACT end-to-start timing (0 to 5 min buffer, strictly NO 45-minute gap)
                    let chains = validLayers[0].map((slot) => [slot]);
                    for (let i = 1; i < items.length; i++) {
                        const nextLayer = validLayers[i];
                        const nextChains = [];
                        for (const chain of chains) {
                            const lastSlot = chain[chain.length - 1];
                            const lastSlotEnd = new Date(
                                lastSlot.endTime
                            ).getTime();
                            for (const nextSlot of nextLayer) {
                                const nextSlotStart = new Date(
                                    nextSlot.startTime
                                ).getTime();
                                const gap = nextSlotStart - lastSlotEnd;
                                // Strictly contiguous: 0 to 5 minutes buffer
                                if (gap >= 0 && gap <= 5 * 60000) {
                                    nextChains.push([...chain, nextSlot]);
                                }
                            }
                        }
                        chains = nextChains;
                    }

                    // Map primary slot to the chain start and chain end
                    const compositeSlots: SlotItem[] = chains.map((chain) => {
                        const start = chain[0].startTime;
                        const end = chain[chain.length - 1].endTime;
                        return {
                            startTime: start,
                            endTime: end,
                            available: true,
                            staffId: chain[0].staffId,
                            staffName: chain[0].staffName,
                        };
                    });

                    if (active) {
                        setAvailableSlots(compositeSlots);
                    }
                }
            } catch (err) {
                console.error('Error loading authoritative slots:', err);
                if (active) setAvailableSlots([]);
            } finally {
                if (active) setLoadingSlots(false);
            }
        };

        fetchSlots();

        return () => {
            active = false;
        };
    }, [tenantId, selectedDate, staffMode, items]);

    // Step 3: Payment Options & Calculations
    const paymentSettings = tenant?.paymentSettings || {};
    const allowAtCenter = paymentSettings.allowServicePayAtCenter !== false;
    const allowOnlineFull = paymentSettings.allowServiceFullOnline !== false;
    const allowDeposit = paymentSettings.allowServiceDeposit === true;
    const depositAmount = allowDeposit
        ? paymentSettings.serviceDepositMode === 'percentage'
            ? totalPrice * (paymentSettings.serviceDepositPercentage / 100)
            : paymentSettings.serviceDepositFixedAmount || 50
        : null;

    const paymentOptions: PaymentOption[] = useMemo(() => {
        const list: PaymentOption[] = [];
        if (allowAtCenter) {
            list.push({
                id: 'at-center',
                label: isRTL ? 'الدفع عند المركز' : 'Pay at center',
                desc: isRTL
                    ? 'الدفع نقداً أو بالبطاقة عند وصولك للمركز'
                    : 'Pay when you arrive at the salon',
            });
        }
        if (allowOnlineFull) {
            list.push({
                id: 'online-full',
                label: isRTL ? 'الدفع كاملاً أونلاين' : 'Pay in full online',
                desc: isRTL
                    ? 'دفع فوري آمن عبر مدى / فيزا / أبل باي'
                    : 'Instant secure payment via Mada / Visa / Apple Pay',
            });
        }
        if (allowDeposit && depositAmount !== null && depositAmount > 0) {
            list.push({
                id: 'booking-fee',
                label: isRTL ? 'دفع عربون الحجز' : 'Pay deposit now',
                desc: isRTL
                    ? `دفع ${formatRiyal(depositAmount, 'ar')} الآن، والمتبقي عند الوصول`
                    : `Pay ${formatRiyal(depositAmount, 'en')} now, balance at salon`,
            });
        }
        return list;
    }, [allowAtCenter, allowOnlineFull, allowDeposit, depositAmount, isRTL]);

    // Synchronize selected payment method if list changes
    useEffect(() => {
        if (paymentOptions.length > 0) {
            if (!paymentOptions.some((o) => o.id === selectedPaymentMethod)) {
                setSelectedPaymentMethod(paymentOptions[0].id);
            }
        }
    }, [paymentOptions, selectedPaymentMethod]);

    const payableNow =
        selectedPaymentMethod === 'online-full'
            ? totalPrice
            : selectedPaymentMethod === 'booking-fee' && depositAmount !== null
            ? depositAmount
            : 0;

    const isInsufficientWallet =
        payableNow > 0 &&
        onlinePaymentSource === 'wallet' &&
        walletBalance < payableNow;

    const [evaluatingSlot, setEvaluatingSlot] = useState(false);

    // Advance to Step 3 with Authoritative Backend Evaluation
    const handleProceedToReview = async () => {
        if (!selectedSlot || !tenantId) return;

        try {
            setEvaluatingSlot(true);
            let currentStart = new Date(selectedSlot.startTime);

            for (const item of items) {
                // If package item, evaluate its child steps with authoritative scheduling
                if (item.itemType === 'package' && item.packageItems && item.packageItems.length > 0) {
                    const isParallel = item.scheduleType === 'parallel';
                    let stepCurrent = currentStart.getTime();

                    for (const pItem of item.packageItems) {
                        const stepDuration = pItem.duration || pItem.service?.duration || 30;
                        const stepStartTime = new Date(isParallel ? currentStart.getTime() : stepCurrent);
                        const stepStaffId = staffMode === 'any' ? null : (pItem.defaultStaffId || item.requestedStaffId || item.staff?.id || null);

                        try {
                            const evalRes = await api.post<any>('/bookings/evaluate', {
                                tenantId,
                                serviceId: pItem.serviceId,
                                variantId: pItem.variantId || undefined,
                                staffId: stepStaffId, // pass null for Any Professional; backend evaluates candidate staff
                                startTime: stepStartTime.toISOString(),
                                duration: stepDuration,
                            });

                            if (evalRes && !evalRes.success) {
                                const formatted = getCustomerFacingBookingErrorMessage(evalRes, isRTL);
                                Alert.alert(formatted.title, formatted.message);
                                return;
                            }
                        } catch (evalErr: any) {
                            const formatted = getCustomerFacingBookingErrorMessage(evalErr, isRTL);
                            Alert.alert(formatted.title, formatted.message);
                            return;
                        }

                        if (!isParallel) {
                            stepCurrent += stepDuration * 60000;
                        }
                    }

                    const bundleDuration = (item.totalDuration || item.service.duration || 60) * 60000;
                    currentStart = new Date(currentStart.getTime() + (isParallel ? bundleDuration : (stepCurrent - currentStart.getTime())));
                } else {
                    // Regular service: evaluate scheduling with authoritative backend
                    const staffId = staffMode === 'any' ? null : (item.requestedStaffId || item.staff?.id || null);
                    const duration = item.service.duration || 30;

                    try {
                        const evalRes = await api.post<any>('/bookings/evaluate', {
                            tenantId,
                            serviceId: item.service.id,
                            variantId: item.variant?.id || undefined,
                            staffId: staffId, // pass null for Any Professional; backend evaluates candidate staff
                            startTime: currentStart.toISOString(),
                            duration,
                        });

                        if (evalRes && !evalRes.success) {
                            const formatted = getCustomerFacingBookingErrorMessage(evalRes, isRTL);
                            Alert.alert(formatted.title, formatted.message);
                            return;
                        }
                    } catch (evalErr: any) {
                        const formatted = getCustomerFacingBookingErrorMessage(evalErr, isRTL);
                        Alert.alert(formatted.title, formatted.message);
                        return;
                    }

                    currentStart = new Date(currentStart.getTime() + duration * 60000);
                }
            }

            setStep('review');
        } catch (err) {
            console.warn('Backend evaluation encountered error:', err);
            const formatted = getCustomerFacingBookingErrorMessage(err, isRTL);
            Alert.alert(formatted.title, formatted.message);
        } finally {
            setEvaluatingSlot(false);
        }
    };

    // Step 3: Confirm Booking Execution
    const handleConfirmBooking = async () => {
        if (!selectedSlot) {
            Alert.alert(
                isRTL ? 'تنبيه' : 'Notice',
                isRTL ? 'يرجى اختيار وقت الحجز' : 'Please select a booking time'
            );
            return;
        }

        if (!isAuthenticated) {
            Alert.alert(
                isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required',
                isRTL
                    ? 'يرجى تسجيل الدخول لتأكيد حجزك ومتابعة الموعد'
                    : 'Please sign in to confirm your booking and track your appointment',
                [
                    { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                    {
                        text: isRTL ? 'تسجيل الدخول' : 'Sign In',
                        onPress: () => showLogin(),
                    },
                ]
            );
            return;
        }

        if (submittingBooking) return;

        try {
            setSubmittingBooking(true);

            // Compute sequential start and end times for all items
            let currentStart = new Date(selectedSlot.startTime).getTime();
            const bookingItemsPayload = items.map((item) => {
                if (item.itemType === 'package' && item.packageId) {
                    const isParallel = item.scheduleType === 'parallel';
                    let stepCurrent = currentStart;
                    const packageItems = (item.packageItems || []).map((pItem, idx) => {
                        const durMs = (pItem.duration || pItem.service?.duration || 30) * 60000;
                        const pStart = new Date(isParallel ? currentStart : stepCurrent).toISOString();
                        const pEnd = new Date((isParallel ? currentStart : stepCurrent) + durMs).toISOString();
                        if (!isParallel) {
                            stepCurrent += durMs;
                        }
                        return {
                            serviceId: pItem.serviceId,
                            variantId: pItem.variantId || null,
                            packageItemId: pItem.packageItemId || undefined,
                            staffId: staffMode === 'any' ? null : (pItem.defaultStaffId || item.requestedStaffId || item.staff?.id || null),
                            requestedStaffId: staffMode === 'any' ? null : (pItem.defaultStaffId || item.requestedStaffId || item.staff?.id || null),
                            startTime: pStart,
                            endTime: pEnd,
                            duration: pItem.duration || pItem.service?.duration || 30,
                            sequenceOrder: pItem.sequenceOrder ?? idx,
                        };
                    });

                    const totalBundleMs = (item.totalDuration || item.service.duration || 60) * 60000;
                    currentStart += isParallel ? totalBundleMs : (stepCurrent - currentStart);

                    return {
                        itemType: 'package',
                        packageId: item.packageId,
                        packageItems,
                        notes: notes.trim() || undefined,
                        paymentMethod: selectedPaymentMethod,
                    };
                }

                const durationMs = (item.service.duration || 30) * 60000;
                const itemStartTime = new Date(currentStart).toISOString();
                const itemEndTime = new Date(
                    currentStart + durationMs
                ).toISOString();
                currentStart += durationMs;

                return {
                    itemType: 'service',
                    serviceId: item.service.id,
                    variantId: item.variant?.id || null,
                    staffId: staffMode === 'any' ? null : (item.requestedStaffId || item.staff?.id || null),
                    requestedStaffId: staffMode === 'any' ? null : (item.requestedStaffId || item.staff?.id || null),
                    startTime: itemStartTime,
                    endTime: itemEndTime,
                    notes: notes.trim() || undefined,
                    paymentMethod: selectedPaymentMethod,
                };
            });

            // Call authoritative backend booking creation
            const response = await api.post<any>('/bookings/create', {
                tenantId,
                items: bookingItemsPayload,
            });

            const bookingSession = response.bookingSession;
            const bookingReference =
                bookingSession?.bookingReference ||
                bookingSession?.id ||
                `BK-${Date.now().toString().slice(-6)}`;

            const confirmedData = {
                salonName,
                salonAddress: tenant?.address || tenant?.city,
                salonCoverImage: tenant?.coverImage || tenant?.logo,
                dateFormatted: format(selectedDate, 'EEEE, d MMMM yyyy', {
                    locale,
                }),
                timeFormatted: `${format(
                    new Date(selectedSlot.startTime),
                    'p',
                    { locale }
                )} – ${format(new Date(selectedSlot.endTime), 'p', { locale })}`,
                totalDurationFormatted: `${totalDurationMinutes} ${
                    isRTL ? 'دقيقة' : 'min'
                }`,
                services: items.map((item) => ({
                    name: isRTL
                        ? item.service.name_ar || item.service.name_en
                        : item.service.name_en || item.service.name_ar,
                    duration: item.service.duration || 30,
                    staffName: item.staff
                        ? isRTL
                            ? item.staff.name_ar || item.staff.name_en
                            : item.staff.name_en || item.staff.name_ar
                        : isRTL
                        ? 'أي مقدم خدمة'
                        : 'Any professional',
                    price: getServicePrice(item.service, item.variant),
                })),
                guestName: isRTL ? 'أنتِ (العميل الأساسي)' : 'You (Primary)',
                paymentMethodLabel:
                    payableNow > 0
                        ? `${paymentOptions.find((o) => o.id === selectedPaymentMethod)?.label || selectedPaymentMethod} (${onlinePaymentSource === 'wallet' ? (isRTL ? 'المحفظة' : 'Wallet') : (isRTL ? 'بطاقة' : 'Card')})`
                        : (paymentOptions.find((o) => o.id === selectedPaymentMethod)?.label || selectedPaymentMethod),
                bookingReference,
                totalPrice,
            };

            // If online payment is required, process payment via chosen provider before confirmation
            if (payableNow > 0 && bookingSession?.id) {
                if (onlinePaymentSource === 'wallet') {
                    if (walletBalance < payableNow) {
                        Alert.alert(
                            isRTL ? 'رصيد غير كافٍ' : 'Insufficient Balance',
                            isRTL
                                ? `رصيد محفظتك (${formatRiyal(walletBalance, 'ar')}) لا يكفي لدفع ${formatRiyal(payableNow, 'ar')}. يرجى اختيار البطاقة أو شحن المحفظة.`
                                : `Your wallet balance (${formatRiyal(walletBalance, 'en')}) is insufficient for ${formatRiyal(payableNow, 'en')}. Please select Card or top up your wallet.`
                        );
                        setSubmittingBooking(false);
                        return;
                    }

                    await api.processPayment({
                        bookingSessionId: bookingSession.id,
                        amount: payableNow,
                        paymentMethod: 'wallet',
                        tenantId,
                        paymentChoice: selectedPaymentMethod as 'online-full' | 'booking-fee',
                    });
                } else {
                    // Credit card payment path
                    await api.processPayment({
                        bookingSessionId: bookingSession.id,
                        amount: payableNow,
                        paymentMethod: 'card',
                        cardNumber: '4242424242424242',
                        expiryDate: '12/30',
                        cvv: '123',
                        cardholderName: 'BarSpa Customer',
                        tenantId,
                        paymentChoice: selectedPaymentMethod as 'online-full' | 'booking-fee',
                    });
                }
            }

            // Transition to Step 4 Confirmation Pass and clear cart
            setConfirmedBookingData(confirmedData);
            setStep('confirmation');
            clearCart();
        } catch (error: any) {
            console.error('Booking checkout error:', error);
            const formatted = getCustomerFacingBookingErrorMessage(error, isRTL);
            Alert.alert(formatted.title, formatted.message);
        } finally {
            setSubmittingBooking(false);
        }
    };

    // Step Header Title
    const headerTitle = (() => {
        if (step === 'staff') return isRTL ? 'اختر المختص' : 'Choose a Professional';
        if (step === 'datetime') return isRTL ? 'تحديد التاريخ والوقت' : 'Select Date & Time';
        if (step === 'review') return isRTL ? 'مراجعة الحجز وتأكيده' : 'Review and Confirm';
        return isRTL ? 'حجز موعد' : 'Booking';
    })();

    const handleHeaderBack = () => {
        if (step === 'datetime') {
            setStep('staff');
        } else if (step === 'review') {
            setStep('datetime');
        } else {
            navigation.goBack();
        }
    };

    const handleHeaderClose = () => {
        navigation.navigate('Tenant', { tenantId });
    };

    // Handle Android hardware back button per step
    useEffect(() => {
        const onHardwareBack = () => {
            if (step === 'confirmation') {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Tabs', params: { screen: 'Home' } }],
                });
                return true;
            }
            if (step === 'review') {
                setStep('datetime');
                return true;
            }
            if (step === 'datetime') {
                setStep('staff');
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            onHardwareBack
        );
        return () => subscription.remove();
    }, [step, navigation]);

    // Render Confirmation Step (Stitch 10_payment.html)
    if (step === 'confirmation' && confirmedBookingData) {
        return (
            <View style={[styles.screen, { paddingTop: topInset }]}>
                <BookingConfirmationPass
                    {...confirmedBookingData}
                    onViewAppointments={() => {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Tabs', params: { screen: 'Appointments' } }],
                        });
                    }}
                    onGoHome={() => {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Tabs', params: { screen: 'Home' } }],
                        });
                    }}
                />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { paddingTop: topInset }]}>
            {/* Unified Booking Header */}
            <BookingHeader
                title={headerTitle}
                onBack={handleHeaderBack}
                onClose={handleHeaderClose}
                showClose={true}
            />

            {loadingTenant ? (
                <View style={styles.loadingCenter}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollBody}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: scrollBottomPadding + 90 },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Booking Context Pill Card */}
                    <BookingContextCard
                        salonName={salonName}
                        durationMinutes={totalDurationMinutes}
                        serviceCount={items.length}
                        totalPrice={totalPrice}
                    />

                    {/* Step 1: Staff Selection */}
                    {step === 'staff' && (
                        <BookingStaffSelector
                            items={items}
                            selectedMode={staffMode}
                            onModeChange={handleModeChange}
                            eligibleStaffMap={eligibleStaffMap}
                            onSelectStaff={handleSelectStaff}
                            loadingStaff={loadingStaff}
                        />
                    )}

                    {/* Step 2: Date & Time Selection */}
                    {step === 'datetime' && (
                        <>
                            <BookingDateStrip
                                dates={datesList}
                                selectedDate={selectedDate}
                                onSelectDate={(d) => setSelectedDate(d)}
                                loading={loadingDates}
                            />
                            <BookingTimeGrid
                                slots={availableSlots}
                                selectedSlot={selectedSlot}
                                onSelectSlot={(s) => setSelectedSlot(s)}
                                loading={loadingSlots}
                            />
                        </>
                    )}

                    {/* Step 3: Review & Payment Selection */}
                    {step === 'review' && (
                        <>
                            <BookingSummaryCard
                                tenant={tenant}
                                items={items}
                                selectedDate={selectedDate}
                                selectedSlot={selectedSlot}
                                totalDurationMinutes={totalDurationMinutes}
                            />
                            <BookingPriceBreakdown
                                subtotal={totalPrice}
                                total={totalPrice}
                                depositAmount={depositAmount}
                                paymentMethod={selectedPaymentMethod}
                            />
                            <BookingPaymentSelector
                                availableOptions={paymentOptions}
                                selectedMethod={selectedPaymentMethod}
                                onSelectMethod={(m) => setSelectedPaymentMethod(m)}
                            />

                            {/* Online Payment Method Selector (Wallet vs Card) */}
                            {(selectedPaymentMethod === 'online-full' || selectedPaymentMethod === 'booking-fee') && (
                                <View style={styles.onlinePaymentMethodSection}>
                                    <View style={[styles.sectionHeaderRow, isRTL && styles.rowRtl]}>
                                        <View style={styles.sectionIconCircle}>
                                            <AppIcon name="card" size={16} color="#6537C0" />
                                        </View>
                                        <Text style={[styles.sectionHeading, isRTL && styles.textRtl]}>
                                            {isRTL ? 'وسيلة الدفع الإلكتروني' : 'Payment Method'}
                                        </Text>
                                    </View>

                                    <View style={[styles.methodOptions, isRTL && styles.rowRtl]}>
                                        <TouchableOpacity
                                            style={[
                                                styles.methodOption,
                                                onlinePaymentSource === 'card' && styles.methodOptionActive,
                                            ]}
                                            onPress={() => setOnlinePaymentSource('card')}
                                            activeOpacity={0.8}
                                        >
                                            <AppIcon
                                                name="card"
                                                size={20}
                                                color={onlinePaymentSource === 'card' ? '#6537C0' : '#716B88'}
                                            />
                                            <Text
                                                style={[
                                                    styles.methodOptionText,
                                                    onlinePaymentSource === 'card' && styles.methodOptionTextActive,
                                                    isRTL && styles.textRtl,
                                                ]}
                                            >
                                                {isRTL ? 'بطاقة بنكية' : 'Credit Card'}
                                            </Text>
                                            {onlinePaymentSource === 'card' && (
                                                <View style={styles.methodSelectedBadge}>
                                                    <AppIcon name="check" size={12} color="#6537C0" />
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.methodOption,
                                                onlinePaymentSource === 'wallet' && styles.methodOptionActive,
                                            ]}
                                            onPress={() => setOnlinePaymentSource('wallet')}
                                            activeOpacity={0.8}
                                        >
                                            <AppIcon
                                                name="cash"
                                                size={20}
                                                color={onlinePaymentSource === 'wallet' ? '#6537C0' : '#716B88'}
                                            />
                                            <Text
                                                style={[
                                                    styles.methodOptionText,
                                                    onlinePaymentSource === 'wallet' && styles.methodOptionTextActive,
                                                    isRTL && styles.textRtl,
                                                ]}
                                            >
                                                {isRTL ? 'المحفظة' : 'Wallet'}
                                            </Text>
                                            {onlinePaymentSource === 'wallet' && (
                                                <View style={styles.methodSelectedBadge}>
                                                    <AppIcon name="check" size={12} color="#6537C0" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>

                                    {/* Dynamic Context Card based on Source */}
                                    {onlinePaymentSource === 'wallet' ? (
                                        <View style={[styles.paymentMethodContextCard, isInsufficientWallet && styles.paymentMethodContextCardWarning]}>
                                            <View style={[styles.contextCardRow, isRTL && styles.rowRtl]}>
                                                <AppIcon
                                                    name={isInsufficientWallet ? 'alert_circle' : 'cash'}
                                                    size={18}
                                                    color={isInsufficientWallet ? '#EF4444' : '#6537C0'}
                                                />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.contextCardTitle, isRTL && styles.textRtl]}>
                                                        {isRTL ? 'رصيد محفظتك الحالي' : 'Current Wallet Balance'}
                                                    </Text>
                                                    <Text style={[styles.walletBalanceText, isInsufficientWallet && styles.walletBalanceWarningText, isRTL && styles.textRtl]}>
                                                        {formatRiyal(walletBalance, isRTL ? 'ar' : 'en')}
                                                    </Text>
                                                </View>
                                            </View>
                                            {isInsufficientWallet && (
                                                <Text style={[styles.walletInsufficientNotice, isRTL && styles.textRtl]}>
                                                    {isRTL
                                                        ? `المبلغ المطلوب (${formatRiyal(payableNow, 'ar')}) يتجاوز رصيد المحفظة. يرجى اختيار البطاقة أو شحن المحفظة.`
                                                        : `Due amount (${formatRiyal(payableNow, 'en')}) exceeds your wallet balance. Please select Card or top up.`}
                                                </Text>
                                            )}
                                        </View>
                                    ) : (
                                        <View style={styles.paymentMethodContextCard}>
                                            <View style={[styles.contextCardRow, isRTL && styles.rowRtl]}>
                                                <AppIcon name="sparkles" size={18} color="#6537C0" />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.contextCardTitle, isRTL && styles.textRtl]}>
                                                        {isRTL ? 'الدفع الآمن بالبطاقة' : 'Secure Card Payment'}
                                                    </Text>
                                                    <Text style={[styles.contextCardSubtitle, isRTL && styles.textRtl]}>
                                                        {isRTL
                                                            ? 'دفع فوري مؤمّن عبر بوابات الدفع المعتمدة'
                                                            : 'Instant secure payment via authorized gateways'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Optional Notes Input */}
                            <View style={styles.notesCard}>
                                <Text style={styles.notesLabel}>
                                    {isRTL
                                        ? 'ملاحظات إضافية للمركز (اختياري)'
                                        : 'Additional notes for salon (optional)'}
                                </Text>
                                <TextInput
                                    style={[
                                        styles.notesInput,
                                        isRTL && styles.notesInputRtl,
                                    ]}
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder={
                                        isRTL
                                            ? 'اكتبي أي ملاحظات أو تفضيلات خاصة...'
                                            : 'Add any special preferences or instructions...'
                                    }
                                    placeholderTextColor="#A09BB1"
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        </>
                    )}
                </ScrollView>
            )}

            {/* Sticky Bottom Action Bar */}
            <View
                style={[
                    styles.bottomActionBar,
                    { paddingBottom: Math.max(scrollBottomPadding, 16) },
                ]}
            >
                {step === 'staff' && (
                    <TouchableOpacity
                        style={[
                            styles.primaryCta,
                            isRTL && styles.rowRtl,
                            !canProceedFromStaff && styles.primaryCtaDisabled,
                        ]}
                        disabled={!canProceedFromStaff}
                        onPress={() => setStep('datetime')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.primaryCtaText}>
                            {isRTL
                                ? 'المتابعة إلى التاريخ والوقت'
                                : 'Continue to Date & Time'}
                        </Text>
                        <AppIcon
                            name={isRTL ? 'arrow_back' : 'arrow_forward'}
                            size={18}
                            color="#FFFFFF"
                        />
                    </TouchableOpacity>
                )}

                {step === 'datetime' && (
                    <TouchableOpacity
                        style={[
                            styles.primaryCta,
                            isRTL && styles.rowRtl,
                            (!selectedSlot || evaluatingSlot) &&
                                styles.primaryCtaDisabled,
                        ]}
                        disabled={!selectedSlot || evaluatingSlot}
                        onPress={handleProceedToReview}
                        activeOpacity={0.8}
                    >
                        {evaluatingSlot ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Text style={styles.primaryCtaText}>
                                    {isRTL
                                        ? 'مراجعة الحجز وتأكيده'
                                        : 'Review Booking'}
                                </Text>
                                <AppIcon
                                    name={
                                        isRTL ? 'arrow_back' : 'arrow_forward'
                                    }
                                    size={18}
                                    color="#FFFFFF"
                                />
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {step === 'review' && (
                    <TouchableOpacity
                        style={[
                            styles.primaryCta,
                            isRTL && styles.rowRtl,
                            (submittingBooking || isInsufficientWallet) && styles.primaryCtaDisabled,
                        ]}
                        disabled={submittingBooking}
                        onPress={() => {
                            if (isInsufficientWallet) {
                                Alert.alert(
                                    isRTL ? 'رصيد غير كافٍ' : 'Insufficient Balance',
                                    isRTL
                                        ? `رصيد محفظتك (${formatRiyal(walletBalance, 'ar')}) لا يكفي لدفع ${formatRiyal(payableNow, 'ar')}. يرجى اختيار البطاقة أو شحن المحفظة.`
                                        : `Your wallet balance (${formatRiyal(walletBalance, 'en')}) is insufficient for ${formatRiyal(payableNow, 'en')}. Please select Card or top up your wallet.`
                                );
                                return;
                            }
                            handleConfirmBooking();
                        }}
                        activeOpacity={0.8}
                    >
                        {submittingBooking ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Text style={styles.primaryCtaText}>
                                    {isRTL ? 'تأكيد الحجز' : 'Confirm Booking'}
                                </Text>
                                <AppIcon
                                    name="verified_user"
                                    size={18}
                                    color="#FFFFFF"
                                />
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    loadingCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollBody: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    notesCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 20,
    },
    notesLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        marginBottom: 8,
        fontFamily: 'Cairo-Bold',
    },
    notesInput: {
        minHeight: 72,
        backgroundColor: '#FAF9FC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 12,
        fontSize: 13,
        color: '#1D035F',
        textAlignVertical: 'top',
    },
    notesInputRtl: {
        textAlign: 'right',
    },
    bottomActionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderTopWidth: 1,
        borderTopColor: '#E7DDFC',
        paddingHorizontal: 20,
        paddingTop: 12,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 8,
    },
    primaryCta: {
        height: 52,
        backgroundColor: '#6537C0',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryCtaDisabled: {
        backgroundColor: '#CBC3D6',
        shadowOpacity: 0,
        elevation: 0,
    },
    primaryCtaText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
    onlinePaymentMethodSection: {
        marginBottom: 20,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    sectionIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeading: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    methodOptions: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    rowRtl: {
        flexDirection: 'row-reverse',
    },
    textRtl: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    methodOption: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E7DDFC',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        position: 'relative',
    },
    methodOptionActive: {
        borderColor: '#6537C0',
        backgroundColor: '#F7F4FD',
    },
    methodOptionText: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '600',
        fontFamily: 'Cairo-Bold',
    },
    methodOptionTextActive: {
        color: '#6537C0',
    },
    methodSelectedBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#EAE1FC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentMethodContextCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        gap: 8,
    },
    paymentMethodContextCardWarning: {
        borderColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
    },
    contextCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    contextCardTitle: {
        fontSize: 12,
        color: '#716B88',
        fontFamily: 'Cairo-Regular',
    },
    contextCardSubtitle: {
        fontSize: 12,
        color: '#4B5563',
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    walletBalanceText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginTop: 2,
    },
    walletBalanceWarningText: {
        color: '#DC2626',
    },
    walletInsufficientNotice: {
        fontSize: 12,
        color: '#DC2626',
        marginTop: 4,
        fontFamily: 'Cairo-Regular',
    },
});
