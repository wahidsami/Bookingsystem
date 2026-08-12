import { Alert } from 'react-native';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { api } from '../api/client';

export async function processBookingCheckout({
    tenant,
    items,
    totalPrice,
    payableNowAmount,
    bookingDepositAmount,
    selectedPaymentMethod,
    isRTL,
    navigation,
    clearCart,
}: {
    tenant: any;
    items: any[];
    totalPrice: number;
    payableNowAmount: number;
    bookingDepositAmount: number | null;
    selectedPaymentMethod: string;
    isRTL: boolean;
    navigation: any;
    clearCart: () => void;
}) {
    if (items.length === 0 || !tenant) {
        Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'بيانات الحجز غير مكتملة' : 'Booking data is incomplete');
        return;
    }

    if (!selectedPaymentMethod) {
        Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'يرجى اختيار طريقة الدفع' : 'Please select a payment method');
        return;
    }

    try {
        const response = await api.post<any>('/bookings/create', {
            tenantId: tenant.id,
            items: items.map((item) => ({
                serviceId: item.service.id,
                variantId: item.variant?.id || null,
                staffId: item.staffId || null,
                requestedStaffId: item.requestedStaffId || null,
                startTime: item.startTime,
                endTime: item.endTime,
                notes: item.notes || undefined,
                paymentMethod: selectedPaymentMethod,
            })),
        });

        const newBookingReference = response.bookingSession?.bookingReference || response.bookingSession?.id || '';
        const newBookingSessionId = response.bookingSession?.id;

        let employeeNames = items.map((i, idx) => {
            const appt = response.appointments?.[idx];
            if (appt?.staff) return isRTL ? (appt.staff.name_ar || appt.staff.name_en || appt.staff.name) : (appt.staff.name_en || appt.staff.name_ar || appt.staff.name);
            if (i.staff) return isRTL ? (i.staff.name_ar || i.staff.name_en || i.staff.name) : (i.staff.name_en || i.staff.name_ar || i.staff.name);
            return isRTL ? 'أي مقدم خدمة' : 'Any professional';
        });
        employeeNames = Array.from(new Set(employeeNames));

        const paymentSummary = {
            salon: isRTL ? (tenant.name_ar || tenant.name_en || tenant.name) : (tenant.name_en || tenant.name_ar || tenant.name),
            date: items[0]?.startTime ? format(new Date(items[0].startTime), 'MMMM d, yyyy', { locale: isRTL ? ar : enUS }) : '',
            time: items[0]?.startTime ? format(new Date(items[0].startTime), 'p', { locale: isRTL ? ar : enUS }) : '',
            services: items.map(i => isRTL ? (i.service.name_ar || i.service.name_en) : (i.service.name_en || i.service.name_ar)),
            employee: employeeNames.join(' · '),
            subtotal: totalPrice,
            deposit: selectedPaymentMethod === 'booking-fee' ? bookingDepositAmount : null,
            remaining: selectedPaymentMethod === 'booking-fee' ? totalPrice - (bookingDepositAmount || 0) : null,
            total: totalPrice,
        };

        if (payableNowAmount > 0 && newBookingSessionId) {
            navigation.navigate('Payment', {
                bookingSessionId: newBookingSessionId,
                bookingReference: newBookingReference,
                amount: payableNowAmount,
                tenantId: tenant.id,
                paymentChoice: selectedPaymentMethod,
                paymentSummary: paymentSummary
            });
        } else {
            navigation.navigate('PaymentSuccess', {
                bookingSessionId: newBookingSessionId,
                bookingReference: newBookingReference,
                paymentSummary: paymentSummary
            });
        }
    } catch (error: any) {
        console.error('Checkout error:', error);
        Alert.alert(
            isRTL ? 'حدث خطأ' : 'Error',
            error?.response?.data?.message || (isRTL ? 'تعذر إتمام الحجز.' : 'Could not complete booking.')
        );
        throw error;
    }
}
