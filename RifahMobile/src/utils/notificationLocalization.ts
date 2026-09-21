import { CustomerNotification } from '../api/client';

export interface LocalizedNotificationContent {
    title: string;
    body: string;
}

/**
 * Deterministically localizes a notification for the customer app.
 * If an event type is provided in metadata/data, uses a structured Arabic template.
 * If only raw strings exist (such as marketing broadcast campaigns), preserves them safely.
 */
export function getLocalizedNotification(
    item: CustomerNotification,
    isRTL: boolean
): LocalizedNotificationContent {
    if (!isRTL) {
        return {
            title: item.title,
            body: item.body,
        };
    }

    const data = item.data || {};
    const eventType = data.eventType || data.type || (item as any).eventType;

    const tenantName = item.tenantName || data.tenantName || 'المركز';
    const bookingRef = data.bookingReference || data.bookingRef;
    const orderRef = data.orderReference || data.orderRef || data.orderNumber;
    const date = data.date;
    const time = data.time;

    switch (eventType) {
        case 'booking.confirmed':
        case 'booking_confirmed':
            return {
                title: 'تم تأكيد الحجز',
                body: bookingRef
                    ? `تم تأكيد حجزك رقم \u2066#${bookingRef}\u2069 في ${tenantName} بنجاح.`
                    : `تم تأكيد حجزك في ${tenantName} بنجاح.`,
            };

        case 'order.status_updated':
        case 'order_status_updated':
        case 'order.updated':
            return {
                title: 'تم تحديث حالة الطلب',
                body: orderRef
                    ? `تم تحديث حالة طلبك رقم \u2066#${orderRef}\u2069 من ${tenantName}.`
                    : `تم تحديث حالة طلبك من ${tenantName}.`,
            };

        case 'appointment.reminder':
        case 'appointment_reminder':
            return {
                title: 'تذكير بموعدك',
                body: date && time
                    ? `تذكير بموعدك القادم في ${tenantName} يوم ${date} الساعة ${time}.`
                    : `تذكير بموعدك القادم في ${tenantName}. نتطلع لزيارتك!`,
            };

        case 'booking.cancelled':
        case 'booking_cancelled':
            return {
                title: 'تم إلغاء الحجز',
                body: bookingRef
                    ? `تم إلغاء الحجز رقم \u2066#${bookingRef}\u2069 في ${tenantName}.`
                    : `تم إلغاء حجزك في ${tenantName}.`,
            };

        default:
            // Custom or campaign notification without strict event type
            return {
                title: item.title,
                body: item.body,
            };
    }
}
