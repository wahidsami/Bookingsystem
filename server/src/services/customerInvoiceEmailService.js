const fs = require('fs');
const db = require('../models');
const { sendEmail } = require('../utils/emailService');
const { getTenantDashboardLoginUrl } = require('../utils/url');
const {
    ensureCustomerInvoicePdf,
    ensureCustomerReceiptPdf
} = require('./customerInvoiceDocumentService');

function formatMoney(amount, currency = 'SAR', locale = 'en') {
    const numeric = Number(amount || 0);
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: currency || 'SAR',
        maximumFractionDigits: 2
    }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value, locale = 'en') {
    if (!value) return '-';
    return new Date(value).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function statusToTemplate(status) {
    if (status === 'PAID') return 'customer_invoice_paid';
    if (status === 'PARTIALLY_PAID') return 'customer_invoice_partial';
    if (status === 'REFUNDED') return 'customer_invoice_refund';
    return 'customer_invoice_unpaid';
}

function normalizeValue(value) {
    return `${value || ''}`.trim().toLowerCase();
}

function formatPaymentOption(value, locale = 'en') {
    const normalized = normalizeValue(value);
    if (!normalized) return locale === 'ar' ? 'غير محدد' : 'Not specified';

    const ar = {
        'at-center': 'الدفع عند الوصول',
        'at_center': 'الدفع عند الوصول',
        'pay_on_visit': 'الدفع عند الوصول',
        'cash_on_delivery': 'الدفع عند الوصول',
        'cash': 'الدفع عند الوصول',
        'online-full': 'الدفع الكامل أونلاين',
        'online_full': 'الدفع الكامل أونلاين',
        'booking-fee': 'دفع رسوم الحجز',
        'booking_fee': 'دفع رسوم الحجز'
    };

    const en = {
        'at-center': 'Pay on arrival',
        'at_center': 'Pay on arrival',
        'pay_on_visit': 'Pay on arrival',
        'cash_on_delivery': 'Pay on arrival',
        'cash': 'Pay on arrival',
        'online-full': 'Pay in full online',
        'online_full': 'Pay in full online',
        'booking-fee': 'Pay booking fee',
        'booking_fee': 'Pay booking fee'
    };

    return (locale === 'ar' ? ar[normalized] : en[normalized]) || value;
}

function formatPaymentMethod(value, locale = 'en') {
    const normalized = normalizeValue(value);
    if (!normalized) return locale === 'ar' ? 'غير محدد' : 'Not specified';

    const ar = {
        wallet: 'المحفظة',
        online: 'بطاقة إلكترونية',
        card: 'بطاقة',
        visa: 'فيزا',
        mastercard: 'ماستركارد',
        mada: 'مدى',
        cash: 'نقداً عند المركز',
        'at-center': 'الدفع عند الوصول',
        'at_center': 'الدفع عند الوصول'
    };

    const en = {
        wallet: 'Wallet',
        online: 'Online card',
        card: 'Card',
        visa: 'Visa',
        mastercard: 'Mastercard',
        mada: 'Mada',
        cash: 'Cash at center',
        'at-center': 'Pay on arrival',
        'at_center': 'Pay on arrival'
    };

    return (locale === 'ar' ? ar[normalized] : en[normalized]) || value;
}

async function sendCustomerInvoiceLifecycleEmail(invoiceId, options = {}) {
    try {
        const invoice = await db.CustomerInvoice.findByPk(invoiceId, {
            include: [
                {
                    model: db.PlatformUser,
                    as: 'platformUser',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'preferredLanguage'],
                    required: false
                },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'settings'],
                    required: false
                }
            ]
        });

        if (!invoice) return { success: false, reason: 'invoice_not_found' };

        const user = invoice.platformUser;
        if (!user?.email) return { success: false, reason: 'customer_email_missing' };

        const locale = user.preferredLanguage === 'ar' ? 'ar' : 'en';
        const template = options.template || statusToTemplate(invoice.status);
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || (locale === 'ar' ? 'عميلنا الكريم' : 'Valued Customer');
        const tenantName = invoice.tenant?.name_ar || invoice.tenant?.name_en || invoice.tenant?.name || 'Refah';
        const paymentMethodSnapshot = invoice.paymentMethodSnapshot || {};
        const paymentStatusSnapshot = invoice.paymentStatusSnapshot || {};
        const paymentOptionRaw =
            paymentMethodSnapshot.paymentOption
            || paymentMethodSnapshot.selectedPaymentOption
            || paymentStatusSnapshot.paymentOption
            || paymentStatusSnapshot.selectedPaymentOption
            || paymentMethodSnapshot.paymentMethod
            || null;
        const paymentMethodRaw =
            paymentMethodSnapshot.paymentMethodUsed
            || paymentMethodSnapshot.methodUsed
            || paymentMethodSnapshot.paymentMethod
            || paymentStatusSnapshot.paymentMethod
            || null;
        const paymentOptionText = formatPaymentOption(paymentOptionRaw, locale);
        const paymentMethodUsedText = formatPaymentMethod(paymentMethodRaw, locale);

        const subject = locale === 'ar'
            ? `رفاه - ${invoice.status === 'PAID' ? 'إيصال سداد' : 'فاتورة'} ${invoice.invoiceNumber}`
            : `Refah - ${invoice.status === 'PAID' ? 'Payment receipt' : 'Invoice'} ${invoice.invoiceNumber}`;

        const portalUrl = getTenantDashboardLoginUrl(locale);
        const generatedInvoicePdf = await ensureCustomerInvoicePdf(invoice);
        const generatedReceiptPdf = await ensureCustomerReceiptPdf(invoice);
        const emailAttachments = [];
        if (generatedInvoicePdf?.absolutePath) {
            emailAttachments.push({
                filename: `invoice-${invoice.invoiceNumber}.pdf`,
                content: fs.readFileSync(generatedInvoicePdf.absolutePath).toString('base64')
            });
        }
        if (generatedReceiptPdf?.absolutePath && invoice.status !== 'UNPAID') {
            emailAttachments.push({
                filename: `receipt-${invoice.invoiceNumber}.pdf`,
                content: fs.readFileSync(generatedReceiptPdf.absolutePath).toString('base64')
            });
        }

        const result = await sendEmail({
            to: user.email,
            subject,
            template,
            attachments: emailAttachments,
            data: {
                customerName: fullName,
                tenantName,
                invoiceNumber: invoice.invoiceNumber,
                invoiceStatus: invoice.status,
                issuedAtText: formatDate(invoice.issuedAt, locale),
                paidAtText: formatDate(invoice.paidAt, locale),
                subtotalAmountText: formatMoney(invoice.subtotalAmount, invoice.currency, locale),
                vatAmountText: formatMoney(invoice.vatAmount, invoice.currency, locale),
                totalAmountText: formatMoney(invoice.totalAmount, invoice.currency, locale),
                paidAmountText: formatMoney(invoice.paidAmount, invoice.currency, locale),
                dueAmountText: formatMoney(invoice.dueAmount, invoice.currency, locale),
                paymentOptionText,
                paymentMethodUsedText,
                portalUrl
            }
        });

        if (result?.success) {
            await invoice.update({ lastEmailedAt: new Date() });
        }

        return result;
    } catch (error) {
        console.error('sendCustomerInvoiceLifecycleEmail error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendCustomerInvoiceLifecycleEmail
};
