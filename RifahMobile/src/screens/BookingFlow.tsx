import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, Service, Staff, SlotItem, getServicePrice } from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfToday, isSameDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';

interface BookingProps {
    route: any;
    navigation: any;
}

type BookingStep = 'staff' | 'datetime' | 'review';

export function BookingFlow({ route, navigation }: BookingProps) {
    const { service, tenant } = route.params;
    const { t, isRTL, language } = useLanguage();
    const { showLogin } = useAppSession();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();
    const [step, setStep] = useState<BookingStep>('staff');
    const [loading, setLoading] = useState(false);

    // Selection State
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null); // null = Any
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [selectedTime, setSelectedTime] = useState<SlotItem | null>(null);
    const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);

    useEffect(() => {
        loadStaff();
    }, []);

    useEffect(() => {
        if (step === 'datetime') {
            loadTimeSlots();
        }
    }, [selectedDate, step]);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const response = await api.get<{ success: boolean; staff: Staff[] }>(
                `/public/tenant/${tenant.id}/services/${service.id}/staff`
            );
            if (response.success) {
                setStaffList(response.staff || []);
            }
        } catch (error) {
            console.error('Failed to load staff:', error);
        } finally {
            setLoading(false);
        }
    };

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
                }
            );
            const available = (response.slots || []).filter(s => s.available);
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

        const user = await api.getUser();
        if (!user) {
            Alert.alert(t('guestTitle'), t('loginToOrderBookings'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('loginNow'), onPress: showLogin },
            ]);
            return;
        }

        try {
            setLoading(true);
            const response = await api.post<{ success: boolean; appointment: { id: string; bookingNumber?: string | null; price: number } }>('/bookings/create', {
                serviceId: service.id,
                tenantId: tenant.id,
                staffId: selectedTime.staffId || selectedStaff?.id || undefined,
                startTime: selectedTime.startTime,
            });

            const appointmentId = response.appointment?.id;
            const bookingNumber = response.appointment?.bookingNumber || appointmentId?.slice(0, 8)?.toUpperCase();
            const bookingAmount = Number(response.appointment?.price ?? getServicePrice(service));
            const successTitle = language === 'ar' ? 'تم تأكيد الحجز' : 'Booking Confirmed';
            const successMessage = language === 'ar'
                ? `تم حجز موعدك بنجاح. رقم الحجز: ${bookingNumber || '-'}.\nيمكنك الدفع الآن أو لاحقاً من حجوزاتي.`
                : `Your appointment has been scheduled successfully. Booking No.: ${bookingNumber || '-'}.\nYou can pay now or later from My Appointments.`;
            const payLaterLabel = language === 'ar' ? 'الدفع لاحقاً' : 'Pay Later';
            const payNowLabel = language === 'ar' ? 'الدفع الآن' : 'Pay Now';
            const viewBookingsLabel = language === 'ar' ? 'عرض حجوزاتي' : 'View My Bookings';

            Alert.alert(
                successTitle,
                successMessage,
                [
                    {
                        text: payLaterLabel,
                        onPress: () => navigation.navigate('Tabs', { screen: 'Appointments' }),
                    },
                    appointmentId ? {
                        text: payNowLabel,
                        onPress: () => navigation.navigate('Payment', {
                            appointmentId,
                            amount: bookingAmount,
                            tenantId: tenant.id,
                        }),
                    } : {
                        text: viewBookingsLabel,
                        onPress: () => navigation.navigate('Tabs', { screen: 'Appointments' }),
                    },
                ]
            );
        } catch (error: any) {
            const msg = error.message || 'Failed to create booking';
            // Surface meaningful server errors to the user
            Alert.alert('Booking Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const renderStaffSelection = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Specialist</Text>
            <TouchableOpacity
                style={[styles.staffCard, selectedStaff === null && styles.selectedCard]}
                onPress={() => setSelectedStaff(null)}
            >
                <View style={styles.avatarPlaceholder}>
                    <Ionicons name="people" size={24} color={colors.primary} />
                </View>
                <View>
                    <Text style={styles.staffName}>Any Professional</Text>
                    <Text style={styles.staffRole}>Maximum Availability</Text>
                </View>
                {selectedStaff === null && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
            </TouchableOpacity>

            {staffList.map(staff => (
                <TouchableOpacity
                    key={staff.id}
                    style={[styles.staffCard, selectedStaff?.id === staff.id && styles.selectedCard]}
                    onPress={() => setSelectedStaff(staff)}
                >
                    <View style={styles.avatarPlaceholder}>
                        <Text style={{ fontSize: 18 }}>{staff.name.charAt(0)}</Text>
                    </View>
                    <View>
                        <Text style={styles.staffName}>{staff.name}</Text>
                        <Text style={styles.staffRole}>{staff.role || 'Specialist'}</Text>
                    </View>
                    {selectedStaff?.id === staff.id && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderDateTimeSelection = () => {
        const dates = Array.from({ length: 14 }).map((_, i) => addDays(startOfToday(), i)); // Next 2 weeks

        return (
            <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Select Date & Time</Text>

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
                        <Text style={styles.summaryLabel}>No available slots for this date.</Text>
                    )}
                    {availableSlots.map(slot => {
                        const label = format(new Date(slot.startTime), 'HH:mm');
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
            <Text style={styles.stepTitle}>Review Booking</Text>

            <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Service</Text>
                    <Text style={styles.summaryValue}>{isRTL ? service.name_ar : service.name_en}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Specialist</Text>
                    <Text style={styles.summaryValue}>{selectedStaff ? selectedStaff.name : (selectedTime?.staffName || 'Any Professional')}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Date</Text>
                    <Text style={styles.summaryValue}>{format(selectedDate, 'PPP', { locale: isRTL ? ar : enUS })}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Time</Text>
                    <Text style={styles.summaryValue}>
                        {selectedTime ? format(new Date(selectedTime.startTime), 'HH:mm') : ''}
                    </Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{getServicePrice(service).toFixed(2)} SAR</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: spacing.lg + topInset }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Booking</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: step === 'staff' ? '25%' : step === 'datetime' ? '50%' : '100%' }]} />
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}>
                {step === 'staff' && renderStaffSelection()}
                {step === 'datetime' && renderDateTimeSelection()}
                {step === 'review' && renderReview()}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                <TouchableOpacity style={styles.primaryButton} onPress={step === 'review' ? handleBooking : handleNext}>
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.buttonText}>
                            {step === 'review' ? 'Confirm Booking' : t('next')}
                        </Text>
                    )}
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
        padding: spacing.lg,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
    },
    backButton: {
        padding: spacing.sm,
    },
    progressContainer: {
        height: 4,
        backgroundColor: '#E5E7EB',
        width: '100%',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    content: {
        padding: spacing.lg,
    },
    stepContainer: {
        gap: spacing.md,
    },
    stepTitle: {
        fontSize: fontSize.xl,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.md,
    },
    staffCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: 'white',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.sm,
        gap: spacing.md,
    },
    selectedCard: {
        borderColor: colors.primary,
        backgroundColor: '#F3E8FF',
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    staffName: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
    },
    staffRole: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    datePicker: {
        marginBottom: spacing.lg,
    },
    dateCard: {
        width: 70,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: spacing.md,
        backgroundColor: 'white',
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
        color: 'white',
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
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: 'white',
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
        color: 'white',
        fontWeight: '600',
    },
    summaryCard: {
        backgroundColor: 'white',
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    summaryLabel: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
    },
    summaryValue: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: '500',
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
    footer: {
        padding: spacing.lg,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: fontSize.md,
        fontWeight: 'bold',
    },
});
