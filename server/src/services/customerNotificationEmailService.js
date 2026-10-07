'use strict';

const { sendEmail } = require('../utils/emailService');

const normalizeText = (value, fallback = '') => {
    const candidate = `${value || ''}`.trim();
    return candidate || fallback;
};

const sendCustomerNotificationEmail = async ({
    tenant = {},
    customer = {},
    title,
    body,
    actionUrl,
    actionText,
    locale = 'en'
}) => {
    const email = normalizeText(customer.email);
    if (!email || email.toLowerCase().endsWith('@guest.refah.local')) {
        return { success: false, skipped: true, reason: 'customer_email_missing' };
    }

    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || (locale === 'ar' ? 'عميلنا العزيز' : 'Dear customer');
    const tenantName = locale === 'ar'
        ? (tenant.name_ar || tenant.name || tenant.name_en || 'BARSPA')
        : (tenant.name_en || tenant.name || tenant.name_ar || 'BARSPA');

    const safeActionUrl = normalizeText(actionUrl, '');
    const safeActionText = normalizeText(actionText, '');
    let actionHtml = '';

    if (safeActionUrl && safeActionText) {
        actionHtml = `
              <p style="margin:0 0 20px 0;">
                <a href="${safeActionUrl}" style="display:inline-block;background:#7f50d2;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">${safeActionText}</a>
              </p>`;
    }

    return sendEmail({
        to: email,
        subject: normalizeText(title, locale === 'ar' ? 'إشعار من BARSPA' : 'A new update from BARSPA'),
        template: 'customer_notification',
        data: {
            customerName,
            tenantName,
            title: normalizeText(title, locale === 'ar' ? 'إشعار من BARSPA' : 'A new update from BARSPA'),
            body: normalizeText(body, locale === 'ar' ? 'لديك تحديث جديد في حسابك.' : 'You have a new update in your account.'),
            actionHtml
        }
    });
};

const ORDER_STATUS_MAP = {
    delivery: {
        pending: { ar: 'تم استلام الطلب', en: 'Order Received' },
        confirmed: { ar: 'تم تأكيد الطلب', en: 'Order Confirmed' },
        processing: { ar: 'جاري تجهيز الطلب', en: 'Preparing Order' },
        shipped: { ar: 'الطلب في الطريق', en: 'Order On The Way' },
        delivered: { ar: 'تم التوصيل', en: 'Delivered' },
        completed: { ar: 'اكتمل الطلب', en: 'Order Completed' },
        cancelled: { ar: 'تم إلغاء الطلب', en: 'Order Cancelled' },
        refunded: { ar: 'تم استرداد الطلب', en: 'Order Refunded' }
    },
    pickup: {
        pending: { ar: 'تم استلام الطلب', en: 'Order Received' },
        confirmed: { ar: 'تم تأكيد الطلب', en: 'Order Confirmed' },
        processing: { ar: 'جاري تجهيز الطلب', en: 'Preparing Order' },
        ready_for_pickup: { ar: 'الطلب جاهز للاستلام', en: 'Ready for Pickup' },
        completed: { ar: 'تم الاستلام', en: 'Picked Up' },
        cancelled: { ar: 'تم إلغاء الطلب', en: 'Order Cancelled' },
        refunded: { ar: 'تم استرداد الطلب', en: 'Order Refunded' }
    }
};

const sendCustomerOrderStatusEmail = async ({
    tenant = {},
    customer = {},
    order = {},
    status,
    trackingNumber,
    estimatedDeliveryDate
}) => {
    const email = normalizeText(customer.email);
    if (!email || email.toLowerCase().endsWith('@guest.refah.local')) {
        return { success: false, skipped: true, reason: 'customer_email_missing' };
    }

    // Check communication preference if configured
    if (customer.notificationPreferences && customer.notificationPreferences.email === false) {
        return { success: false, skipped: true, reason: 'customer_email_disabled_by_preference' };
    }

    const locale = customer.preferredLanguage === 'ar' ? 'ar' : 'en';
    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || (locale === 'ar' ? 'عميلنا العزيز' : 'Dear Customer');
    const tenantName = locale === 'ar'
        ? (tenant.name_ar || tenant.name || tenant.name_en || 'المتجر')
        : (tenant.name_en || tenant.name || tenant.name_ar || 'Store');

    const deliveryType = order.deliveryType === 'delivery' ? 'delivery' : 'pickup';
    const statusMap = ORDER_STATUS_MAP[deliveryType] || ORDER_STATUS_MAP.delivery;
    const statusEntry = statusMap[status] || { ar: status, en: status };

    const statusTextAr = statusEntry.ar;
    const statusTextEn = statusEntry.en;
    const statusTextBilingual = `${statusTextAr} | ${statusTextEn}`;

    const deliveryMethodText = deliveryType === 'delivery'
        ? 'توصيل إلى العنوان | Home Delivery'
        : 'استلام من المتجر | Store Pickup';

    const orderNumber = order.orderNumber || order.id || '-';

    // Email Subject
    const subject = locale === 'ar'
        ? `تحديث بخصوص طلبك #${orderNumber} - ${statusTextAr}`
        : `Update on your order #${orderNumber} - ${statusTextEn}`;

    const title = locale === 'ar'
        ? `تحديث حالة الطلب: ${statusTextAr}`
        : `Order Status Update: ${statusTextEn}`;

    // Tracking section for shipped delivery orders
    let trackingSectionHtml = '';
    const activeTrackingNumber = trackingNumber || order.trackingNumber;
    const activeEstimatedDeliveryDate = estimatedDeliveryDate || order.estimatedDeliveryDate;

    if (activeTrackingNumber || activeEstimatedDeliveryDate) {
        let rows = '';
        if (activeTrackingNumber) {
            rows += `<p style="margin:4px 0;font-size:14px;color:#374151;"><strong>Tracking Number | رقم التتبع:</strong> <span style="font-family:monospace;font-weight:700;color:#1e40af;">${activeTrackingNumber}</span></p>`;
        }
        if (activeEstimatedDeliveryDate) {
            const dateStr = new Date(activeEstimatedDeliveryDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            rows += `<p style="margin:4px 0;font-size:14px;color:#374151;"><strong>Estimated Delivery | موعد التوصيل المتوقع:</strong> ${dateStr}</p>`;
        }
        trackingSectionHtml = `
          <div style="margin-top:12px;padding:12px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
            ${rows}
          </div>`;
    }

    // Pickup section
    let pickupSectionHtml = '';
    if (deliveryType === 'pickup' && (order.pickupDate || status === 'ready_for_pickup')) {
        let pickupText = '';
        if (order.pickupDate) {
            const dateStr = new Date(order.pickupDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            pickupText = `<p style="margin:4px 0;font-size:14px;color:#374151;"><strong>Pickup Date | تاريخ الاستلام:</strong> ${dateStr}</p>`;
        }
        if (status === 'ready_for_pickup') {
            pickupText += `<p style="margin:4px 0;font-size:14px;font-weight:700;color:#047857;">الطلب جاهز للاستلام الآن من الفرع | Order is ready for pickup at the store</p>`;
        }
        if (pickupText) {
            pickupSectionHtml = `
              <div style="margin-top:12px;padding:12px;background:#ecfdf5;border-radius:8px;border:1px solid #a7f3d0;">
                ${pickupText}
              </div>`;
        }
    }

    return sendEmail({
        to: email,
        subject,
        template: 'customer_order_status_updated',
        data: {
            title,
            customerName,
            tenantName,
            orderNumber,
            deliveryMethodText,
            statusTextBilingual,
            trackingSectionHtml,
            pickupSectionHtml,
            actionHtml: ''
        }
    });
};

module.exports = {
    sendCustomerNotificationEmail,
    sendCustomerOrderStatusEmail
};
