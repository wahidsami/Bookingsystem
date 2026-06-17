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

function escapeHtml(value) {
    return `${value || ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
        'gift_card_code': 'بطاقة هدية',
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
        'gift_card_code': 'Gift card code',
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
        split: 'دفع مقسم',
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
        split: 'Split payment',
        'at-center': 'Pay on arrival',
        'at_center': 'Pay on arrival'
    };

    return (locale === 'ar' ? ar[normalized] : en[normalized]) || value;
}

function formatPaymentBreakdown(invoice, locale = 'en') {
    const metadata = invoice.metadata || {};
    const paymentBreakdown = Array.isArray(metadata.paymentBreakdown)
        ? metadata.paymentBreakdown
        : (invoice.paymentMethodSnapshot?.paymentBreakdown || []);

    if (!Array.isArray(paymentBreakdown) || paymentBreakdown.length === 0) {
        return {
            rows: [],
            html: '',
            summary: null
        };
    }

    const rows = paymentBreakdown.map((item) => {
        const amount = Number(item.amount || 0);
        const absoluteAmount = Math.abs(amount);
        const isRefund = amount < 0 || `${item.status || ''}`.toLowerCase() === 'refunded';
        const methodLabel = formatPaymentMethod(item.paymentMethod, locale);
        const typeLabel = locale === 'ar'
            ? (item.type === 'refund' ? 'استرداد' : item.type === 'deposit' ? 'دفعة مقدمة' : item.type === 'remainder' ? 'الرصيد المتبقي' : 'دفعة')
            : (item.type === 'refund' ? 'Refund' : item.type === 'deposit' ? 'Deposit' : item.type === 'remainder' ? 'Remainder' : 'Payment');

        return {
            typeLabel,
            methodLabel,
            amountText: formatMoney(absoluteAmount, invoice.currency, locale),
            signText: isRefund ? (locale === 'ar' ? 'تم الاسترداد' : 'Refunded') : (locale === 'ar' ? 'تم السداد' : 'Paid'),
            transactionRef: item.transactionRef || ''
        };
    });

    const summary = paymentBreakdown.length > 1
        ? (locale === 'ar' ? 'دفع مقسم' : 'Split payment')
        : rows[0]?.methodLabel || null;

    const html = rows.map((row) => (
        `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #eef2f7;">${escapeHtml(row.typeLabel)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #eef2f7;">${escapeHtml(row.methodLabel)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #eef2f7;text-align:right;">${escapeHtml(row.amountText)}</td>
        </tr>`
    )).join('');

    return { rows, html, summary };
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
        const paymentBreakdown = formatPaymentBreakdown(invoice, locale);
        const paymentBreakdownHtml = paymentBreakdown.html;
        const paymentBreakdownSummaryText = paymentBreakdown.summary || '';
        const paymentBreakdownSection = paymentBreakdownHtml
            ? `
                <div style="margin-top:18px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;">
                    <p style="margin:0 0 12px;font-weight:700;color:#374151;">${locale === 'ar' ? 'تفاصيل السداد' : 'Payment breakdown'}</p>
                    ${paymentBreakdownSummaryText ? `<p style="margin:0 0 12px;color:#6b7280;"><strong>${locale === 'ar' ? 'الطريقة:' : 'Method:'}</strong> ${escapeHtml(paymentBreakdownSummaryText)}</p>` : ''}
                    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
                        <thead>
                            <tr>
                                <th style="text-align:left;padding:0 0 8px;font-weight:700;color:#6b7280;">${locale === 'ar' ? 'النوع' : 'Type'}</th>
                                <th style="text-align:left;padding:0 0 8px;font-weight:700;color:#6b7280;">${locale === 'ar' ? 'الطريقة' : 'Method'}</th>
                                <th style="text-align:right;padding:0 0 8px;font-weight:700;color:#6b7280;">${locale === 'ar' ? 'المبلغ' : 'Amount'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentBreakdownHtml}
                        </tbody>
                    </table>
                </div>`
            : '';

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
                paymentBreakdownHtml,
                paymentBreakdownSummaryText,
                paymentBreakdownSection,
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
