const fs = require('fs');
const path = require('path');
const db = require('../models');
const {
    ensureInvoicePdf,
    ensureReceiptPdf
} = require('../services/billDocumentService');
const { serializeBill } = require('../utils/invoiceSnapshotBuilder');
const {
    loadBillForRead,
    settleBillPayment,
    isBillExpired
} = require('../services/billPaymentReconciliationService');
const {
    BILL_STATUS,
    getBlockedPaymentStatusMessage
} = require('../utils/billStatus');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

function resolveBillDocumentPath(relativePath) {
    if (!relativePath) return null;

    const sanitizedRelativePath = relativePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^uploads\//, '');
    const absolutePath = path.resolve(UPLOADS_ROOT, sanitizedRelativePath);

    if (!absolutePath.startsWith(UPLOADS_ROOT)) {
        return null;
    }

    return absolutePath;
}

async function serveBillDocumentByToken(req, res, documentField) {
    try {
        const { token } = req.params;
        const bill = await db.Bill.findOne({
            where: { paymentToken: token },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'email', 'settings']
                },
                {
                    model: db.TenantSubscription,
                    as: 'subscription',
                    include: [{ model: db.SubscriptionPackage, as: 'package' }]
                }
            ]
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired payment link'
            });
        }

        if (documentField === 'receiptPdfPath' && bill.status !== 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Receipt is only available after payment'
            });
        }

        const absolutePath = resolveBillDocumentPath(bill[documentField]);
        if (absolutePath && fs.existsSync(absolutePath)) {
            return res.sendFile(absolutePath);
        }

        const generatedDocument = documentField === 'receiptPdfPath'
            ? await ensureReceiptPdf(bill)
            : await ensureInvoicePdf(bill);

        if (!generatedDocument?.absolutePath || !fs.existsSync(generatedDocument.absolutePath)) {
            return res.status(404).json({
                success: false,
                message: 'Document not generated yet'
            });
        }

        return res.sendFile(generatedDocument.absolutePath);
    } catch (error) {
        console.error(`serveBillDocumentByToken ${documentField} error:`, error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load bill document'
        });
    }
}

exports.getBillByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const bill = await loadBillForRead({ paymentToken: token });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired payment link'
            });
        }

        if (bill.status === BILL_STATUS.PAID) {
            ensureReceiptPdf(bill).catch(err => {
                console.error('[BillPayment] Failed to generate receipt PDF:', err.message);
            });
            return res.json({
                success: true,
                alreadyPaid: true,
                bill: serializeBill(bill)
            });
        }

        if ([BILL_STATUS.DRAFT, BILL_STATUS.VOID].includes(bill.status)) {
            return res.status(400).json({
                success: false,
                message: getBlockedPaymentStatusMessage(bill.status),
                bill: serializeBill(bill)
            });
        }

        if (bill.status === BILL_STATUS.EXPIRED || isBillExpired(bill)) {
            await settleBillPayment({
                paymentToken: token,
                source: 'public_payment_link',
                paymentStatus: 'failed',
                paymentProvider: bill.paymentProvider || 'refah_payment_link',
                paymentMethod: bill.paymentMethod || 'payment_link',
                paymentReference: bill.paymentReference || bill.billNumber,
                gatewayStatus: 'expired',
                failureReason: 'Payment link expired before completion',
                idempotencyKey: `public_payment_link:${bill.id}:expired`,
                actor: {
                    type: 'system',
                    id: null,
                    name: 'billing-system'
                }
            });

            return res.status(400).json({
                success: false,
                message: 'This payment link has expired',
                expired: true
            });
        }

        res.json({
            success: true,
            alreadyPaid: false,
            bill: {
                ...serializeBill(bill, { includePaymentToken: true }),
                tenantName: bill.tenant?.name_ar || bill.tenant?.name_en || bill.tenant?.name || '',
                subscriptionId: bill.tenantSubscriptionId
            }
        });

        ensureInvoicePdf(bill).catch(err => {
            console.error('[BillPayment] Failed to generate invoice PDF:', err.message);
        });
    } catch (error) {
        console.error('getBillByToken error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load invoice'
        });
    }
};

exports.getInvoicePdfByToken = async (req, res) => serveBillDocumentByToken(req, res, 'invoicePdfPath');

exports.getReceiptPdfByToken = async (req, res) => serveBillDocumentByToken(req, res, 'receiptPdfPath');

exports.payBillByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const {
            paymentStatus = 'succeeded',
            paymentProvider,
            paymentReference,
            paymentMethod,
            checkoutSessionId,
            gatewayStatus,
            gatewaySummary,
            paymentFailureReason,
            idempotencyKey
        } = req.body || {};

        const reconciliation = await settleBillPayment({
            paymentToken: token,
            source: 'public_payment_link',
            paymentStatus,
            paymentProvider,
            paymentReference,
            paymentMethod,
            checkoutSessionId,
            gatewayStatus,
            gatewaySummary,
            failureReason: paymentFailureReason,
            idempotencyKey,
            actor: {
                type: 'system',
                id: null,
                name: 'billing-system'
            }
        });

        if (reconciliation.expired) {
            return res.status(400).json({
                success: false,
                message: 'This payment link has expired',
                expired: true,
                bill: reconciliation.bill,
                attempt: reconciliation.attempt
            });
        }

        if (reconciliation.status === 'failed') {
            return res.status(400).json({
                success: false,
                message: reconciliation.attempt?.failureReason || 'Payment failed. Please try again.',
                bill: reconciliation.bill,
                attempt: reconciliation.attempt
            });
        }

        if (!reconciliation.success) {
            return res.status(400).json({
                success: false,
                message: reconciliation.attempt?.failureReason || 'Payment failed. Please try again.',
                duplicate: Boolean(reconciliation.duplicate),
                bill: reconciliation.bill,
                attempt: reconciliation.attempt
            });
        }

        res.json({
            success: true,
            message: reconciliation.alreadyPaid
                ? 'Invoice was already paid.'
                : reconciliation.duplicate
                    ? 'This payment confirmation was already processed.'
                : 'Payment successful. Subscription updated successfully.',
            alreadyPaid: Boolean(reconciliation.alreadyPaid),
            duplicate: Boolean(reconciliation.duplicate),
            bill: reconciliation.bill,
            subscription: reconciliation.subscription,
            attempt: reconciliation.attempt
        });
    } catch (error) {
        console.error('payBillByToken error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Payment failed. Please try again.'
        });
    }
};
