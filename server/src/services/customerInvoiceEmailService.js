const db = require('../models');
const { sendEmail } = require('../utils/emailService');
const { getTenantDashboardLoginUrl } = require('../utils/url');

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

        const subject = locale === 'ar'
            ? `رفاه - ${invoice.status === 'PAID' ? 'إيصال سداد' : 'فاتورة'} ${invoice.invoiceNumber}`
            : `Refah - ${invoice.status === 'PAID' ? 'Payment receipt' : 'Invoice'} ${invoice.invoiceNumber}`;

        const portalUrl = getTenantDashboardLoginUrl(locale);
        const result = await sendEmail({
            to: user.email,
            subject,
            template,
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
