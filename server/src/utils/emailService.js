const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const {
    getServerPublicUrl,
    getTenantDashboardLoginUrl,
    getStaffAppLoginUrl,
    getCustomerAppResetUrl
} = require('./url');

/**
 * Email Service Utility - Resend
 * Handles sending emails using Resend API
 */

let resendClient = null;

const getResendClient = () => {
    if (resendClient) return resendClient;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('[Email] RESEND_API_KEY not found in environment variables');
        return null;
    }
    resendClient = new Resend(apiKey);
    return resendClient;
};

/**
 * Send email using template
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string|string[]} [options.cc] - CC recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (welcome, approved, rejected)
 * @param {Object} options.data - Data to populate template
 * @returns {Promise} - Resolves when email is sent
 */
const sendEmail = async (options) => {
    try {
        const { to, cc, subject, template, data, attachments: extraAttachments } = options;

        const client = getResendClient();
        if (!client) {
            throw new Error('Resend not initialized - missing RESEND_API_KEY');
        }

        const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL;
        if (!fromEmail) {
            throw new Error('Resend from address not set - set RESEND_FROM_EMAIL or FROM_EMAIL (e.g. Rifah <onboarding@yourdomain.com>)');
        }

        // Load template
        const templatePath = path.join(__dirname, '../templates/emails', `${template}.html`);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Email template '${template}' not found at ${templatePath}`);
        }

        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Replace placeholders with actual data
        Object.keys(data).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            const value = data[key] === null || data[key] === undefined ? '' : String(data[key]);
            htmlContent = htmlContent.replace(placeholder, value);
        });

        // Resend supports inline images via contentId; keep cid:logo in HTML
        htmlContent = htmlContent.replace(/src="RifahNewLogoWhite\.png"/g, 'src="cid:logo"');

        const logoPath = path.join(__dirname, '../templates/emails', 'RifahNewLogoWhite.png');
        const attachments = [];

        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            attachments.push({
                filename: 'logo.png',
                content: logoBuffer.toString('base64'),
                inlineContentId: 'logo'
            });
        }

        if (Array.isArray(extraAttachments) && extraAttachments.length > 0) {
            attachments.push(...extraAttachments);
        }

        const payload = {
            from: fromEmail.includes('<') ? fromEmail : `Rifah Platform <${fromEmail}>`,
            to: Array.isArray(to) ? to : [to],
            subject,
            html: htmlContent
        };

        if (cc) {
            payload.cc = Array.isArray(cc) ? cc : [cc];
        }

        if (attachments.length > 0) {
            payload.attachments = attachments;
        }

        const { data: result, error } = await client.emails.send(payload);

        if (error) {
            console.error('[Email] Resend API error:', error);
            return {
                success: false,
                error: error.message || JSON.stringify(error)
            };
        }

        console.log(`[Email] Sent successfully to ${to}`, result?.id ? `(id: ${result.id})` : '');
        return {
            success: true,
            messageId: result?.id
        };

    } catch (error) {
        console.error('[Email] Failed to send email:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send welcome email after registration
 */
const sendWelcomeEmail = async (tenantData) => {
    const locale = getTenantPreferredLocale(tenantData);

    return sendEmail({
        to: tenantData.email,
        subject: locale === 'en'
            ? 'Welcome to Rifah - Registration Received'
            : 'مرحباً بك في رفاه - تم استلام طلب التسجيل',
        template: 'welcome',
        data: {
            tenantName: tenantData.name_en || tenantData.name,
            tenantNameAr: tenantData.name_ar || tenantData.nameAr,
            email: tenantData.email
        }
    });
};

/**
 * Send approval email with payment link (48h window)
 * @param {Object} tenantData - Tenant record
 * @param {Object} [options] - { paymentUrl, paymentDueAt }
 */
const sendApprovalEmail = async (tenantData, options = {}) => {
    const locale = getTenantPreferredLocale(tenantData);
    const fallbackLoginUrl = getTenantDashboardLoginUrl(locale);
    const paymentUrl = options.paymentUrl || process.env.TENANT_PAYMENT_LINK_URL || fallbackLoginUrl;
    const data = buildBillingEmailData(tenantData, {
        ...options,
        paymentUrl
    });

    return sendEmail({
        to: tenantData.email,
        cc: options.cc,
        subject: locale === 'en'
            ? `Rifah account approved - invoice ${data.invoiceNumber}`
            : `تم قبول حساب رفاه - فاتورة ${data.invoiceNumber}`,
        template: 'approved',
        data
    });
};

/**
 * Send rejection email
 */
const sendRejectionEmail = async (tenantData, reason) => {
    const locale = getTenantPreferredLocale(tenantData);

    return sendEmail({
        to: tenantData.email,
        subject: locale === 'en'
            ? 'Rifah Account Application Update'
            : 'تحديث طلب انضمامك إلى رفاه',
        template: 'rejected',
        data: {
            tenantName: tenantData.name_en || tenantData.name,
            tenantNameAr: tenantData.name_ar || tenantData.nameAr,
            reason: reason || 'Please contact support for more information'
        }
    });
};

/**
 * Send payment window expired email
 */
const sendPaymentExpiredEmail = async (tenantData, options = {}) => {
    const locale = getTenantPreferredLocale(tenantData);

    return sendEmail({
        to: tenantData.email,
        subject: locale === 'en'
            ? 'Rifah - Payment window expired'
            : 'رفاه - انتهت مهلة الدفع',
        template: 'payment_expired',
        data: buildBillingEmailData(tenantData, options)
    });
};

/**
 * Send payment reminder email for unpaid invoices close to expiry
 */
const sendPaymentReminderEmail = async (tenantData, options = {}) => {
    const locale = getTenantPreferredLocale(tenantData);

    return sendEmail({
        to: tenantData.email,
        subject: locale === 'en'
            ? `Rifah - Payment reminder for invoice ${options?.bill?.billNumber || ''}`.trim()
            : `رفاه - تذكير بسداد الفاتورة ${options?.bill?.billNumber || ''}`.trim(),
        template: 'payment_reminder',
        data: buildBillingEmailData(tenantData, options)
    });
};

/**
 * Send payment success email (account active)
 */
const sendPaymentSuccessEmail = async (tenantData, options = {}) => {
    const locale = getTenantPreferredLocale(tenantData);
    const data = buildBillingEmailData(tenantData, options);
    const hasInvoiceNumber = data.invoiceNumber && data.invoiceNumber !== '-';

    return sendEmail({
        to: tenantData.email,
        subject: locale === 'en'
            ? (hasInvoiceNumber
                ? `Rifah - Payment successful for ${data.invoiceNumber}`
                : 'Rifah - Your account is active')
            : (hasInvoiceNumber
                ? `رفاه - تم السداد بنجاح للفاتورة ${data.invoiceNumber}`
                : 'رفاه - تم تفعيل حسابك بنجاح'),
        template: 'payment_success',
        data
    });
};

/**
 * Send payment failed email (can retry within 48h)
 */
const sendPaymentFailedEmail = async (tenantData) => {
    const locale = getTenantPreferredLocale(tenantData);

    return sendEmail({
        to: tenantData.email,
        subject: locale === 'en'
            ? 'Rifah - Payment could not be completed'
            : 'رفاه - تعذر إتمام الدفع',
        template: 'payment_failed',
        data: buildBillingEmailData(tenantData)
    });
};

const getTenantPreferredLocale = (tenantData = {}) =>
    tenantData?.settings?.language === 'en' ? 'en' : 'ar';

const formatBillingCycle = (cycle, locale = 'ar') => {
    const labels = locale === 'en'
        ? { monthly: 'Monthly', sixMonth: '6 Months', annual: 'Annual' }
        : { monthly: 'شهري', sixMonth: 'كل 6 أشهر', annual: 'سنوي' };

    return labels[cycle] || cycle || '-';
};

const formatMoney = (amount, currency = 'SAR', locale = 'ar') => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
        return '-';
    }

    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ar-SA', {
        style: 'currency',
        currency: currency || 'SAR',
        maximumFractionDigits: 2
    }).format(numericAmount);
};

const formatDateTime = (value, locale = 'ar') => {
    if (!value) return '-';

    return new Date(value).toLocaleString(locale === 'en' ? 'en-GB' : 'ar-SA', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
};

const formatDateOnly = (value, locale = 'ar') => {
    if (!value) return '-';

    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

const getBillPlanName = (bill = {}, locale = 'ar') => {
    if (locale === 'en') {
        return bill?.planSnapshot?.packageName || bill?.planSnapshot?.packageNameAr || '-';
    }

    return bill?.planSnapshot?.packageNameAr || bill?.planSnapshot?.packageName || '-';
};

const getBillPdfUrl = (bill = {}, documentType = 'invoice') => {
    if (!bill?.paymentToken) return '';

    const publicUrl = getServerPublicUrl();
    const pathName = `/api/v1/public/bills/by-token/${encodeURIComponent(bill.paymentToken)}/${documentType}-pdf`;

    return publicUrl ? `${publicUrl}${pathName}` : pathName;
};

const buildBillingEmailData = (tenantData = {}, options = {}) => {
    const locale = getTenantPreferredLocale(tenantData);
    const loginUrl = getTenantDashboardLoginUrl(locale);
    const bill = options.bill || {};
    const billingCycle = options.billingCycle || bill?.planSnapshot?.billingCycle || '';
    const subtotalAmount = bill?.subtotalAmount ?? bill?.amount ?? options.amount ?? 0;
    const vatAmount = bill?.vatAmount ?? 0;
    const totalAmount = bill?.totalAmount ?? bill?.amount ?? options.amount ?? 0;

    return {
        tenantName: tenantData.name_en || tenantData.name || '',
        tenantNameAr: tenantData.name_ar || tenantData.nameAr || tenantData.name || '',
        email: tenantData.email || '',
        loginUrl,
        paymentUrl: options.paymentUrl || '',
        paymentDueText: formatDateTime(options.paymentDueAt, locale),
        packageName: options.packageName || getBillPlanName(bill, locale),
        billingCycle: formatBillingCycle(billingCycle, locale),
        invoiceNumber: bill?.billNumber || '-',
        subtotalAmountText: formatMoney(subtotalAmount, bill?.currency || options.currency || 'SAR', locale),
        vatAmountText: formatMoney(vatAmount, bill?.currency || options.currency || 'SAR', locale),
        totalAmountText: formatMoney(totalAmount, bill?.currency || options.currency || 'SAR', locale),
        invoicePdfUrl: options.invoicePdfUrl || getBillPdfUrl(bill, 'invoice') || options.paymentUrl || loginUrl,
        receiptPdfUrl: options.receiptPdfUrl || getBillPdfUrl(bill, 'receipt') || loginUrl,
        paidDateText: formatDateTime(bill?.paidAt || options.paidAt, locale),
        periodStartText: formatDateOnly(options.periodStart || bill?.invoiceIssuedAt, locale),
        periodEndText: formatDateOnly(options.periodEnd || bill?.subscription?.currentPeriodEnd, locale),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@rifah.sa'
    };
};

const sendStaffInviteEmail = async ({ email, staffName, tenantName, temporaryPassword }) => {
    const loginUrl = getStaffAppLoginUrl();
    return sendEmail({
        to: email,
        subject: 'Rifah staff app invitation',
        template: 'staff_invite',
        data: {
            staffName,
            tenantName,
            email,
            temporaryPassword,
            loginUrl
        }
    });
};

const sendDashboardAccountInviteEmail = async ({ email, displayName, tenantName, temporaryPassword, loginUrl }) => {
    const dashboardLoginUrl = loginUrl || getTenantDashboardLoginUrl();
    return sendEmail({
        to: email,
        subject: 'Rifah dashboard access invitation',
        template: 'dashboard_invite',
        data: {
            displayName,
            tenantName,
            email,
            temporaryPassword,
            loginUrl: dashboardLoginUrl
        }
    });
};

const sendStaffPasswordResetEmail = async ({ email, staffName, tenantName, temporaryPassword }) => {
    const loginUrl = getStaffAppLoginUrl();
    return sendEmail({
        to: email,
        subject: 'Rifah staff app password reset',
        template: 'staff_password_reset',
        data: {
            staffName,
            tenantName,
            email,
            temporaryPassword,
            loginUrl
        }
    });
};

const sendCustomerPasswordResetEmail = async ({ email, firstName, resetUrl, expiresInMinutes = 60 }) => {
    const passwordResetUrl = resetUrl || getCustomerAppResetUrl('');
    return sendEmail({
        to: email,
        subject: 'Rifah customer app password reset',
        template: 'customer_password_reset',
        data: {
            firstName: firstName || 'Customer',
            resetUrl: passwordResetUrl,
            expiresInMinutes: String(expiresInMinutes)
        }
    });
};

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendApprovalEmail,
    sendRejectionEmail,
    sendPaymentExpiredEmail,
    sendPaymentReminderEmail,
    sendPaymentSuccessEmail,
    sendPaymentFailedEmail,
    sendStaffInviteEmail,
    sendDashboardAccountInviteEmail,
    sendStaffPasswordResetEmail,
    sendCustomerPasswordResetEmail
};
