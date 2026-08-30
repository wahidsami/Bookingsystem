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
        ? (tenant.name_ar || tenant.name || tenant.name_en || 'رفاه')
        : (tenant.name_en || tenant.name || tenant.name_ar || 'Refah');

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
        subject: normalizeText(title, locale === 'ar' ? 'إشعار من رفاه' : 'A new update from Refah'),
        template: 'customer_notification',
        data: {
            customerName,
            tenantName,
            title: normalizeText(title, locale === 'ar' ? 'إشعار من رفاه' : 'A new update from Refah'),
            body: normalizeText(body, locale === 'ar' ? 'لديك تحديث جديد في حسابك.' : 'You have a new update in your account.'),
            actionHtml
        }
    });
};

module.exports = {
    sendCustomerNotificationEmail
};
