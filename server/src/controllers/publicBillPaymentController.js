const fs = require('fs');
const path = require('path');
const db = require('../models');
const {
    ensureInvoicePdf,
    ensureReceiptPdf
} = require('../services/billDocumentService');
const { serializeBill, toNumber } = require('../utils/invoiceSnapshotBuilder');
const {
    notifyTenantBillExpired,
    notifyTenantBillPaid
} = require('../services/adminNotificationService');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

function getEffectiveExpiry(bill) {
    if (bill.paymentTokenExpiresAt) {
        return new Date(bill.paymentTokenExpiresAt);
    }

    const due = new Date(bill.dueDate);
    due.setHours(23, 59, 59, 999);
    return due;
}

function isBillExpired(bill) {
    return getEffectiveExpiry(bill) < new Date();
}

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

function getPeriodEnd(start, billingCycle) {
    const periodEnd = new Date(start);

    if (billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else if (billingCycle === 'sixMonth') {
        periodEnd.setMonth(periodEnd.getMonth() + 6);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    return periodEnd;
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

        if (bill.status === 'PAID') {
            ensureReceiptPdf(bill).catch(err => {
                console.error('[BillPayment] Failed to generate receipt PDF:', err.message);
            });
            return res.json({
                success: true,
                alreadyPaid: true,
                bill: serializeBill(bill)
            });
        }

        if (bill.status === 'EXPIRED' || isBillExpired(bill)) {
            if (bill.status !== 'EXPIRED') {
                await bill.update({ status: 'EXPIRED' });
                await db.ActivityLog.create({
                    entityType: 'tenant',
                    entityId: bill.tenantId,
                    action: 'updated',
                    performedByType: 'system',
                    performedByName: 'billing-system',
                    details: {
                        event: 'invoice_expired',
                        billId: bill.id,
                        billNumber: bill.billNumber,
                        paymentTokenExpiresAt: bill.paymentTokenExpiresAt,
                        dueDate: bill.dueDate
                    }
                });
                await notifyTenantBillExpired({
                    tenant: bill.tenant,
                    bill
                });
                if (bill.tenant?.email) {
                    const { sendPaymentExpiredEmail } = require('../utils/emailService');
                    sendPaymentExpiredEmail(bill.tenant, { bill }).catch(err => {
                        console.error('[BillPayment] Expired email failed:', err.message);
                    });
                }
            }

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
            paymentProvider,
            paymentReference,
            paymentMethod
        } = req.body || {};

        const bill = await db.Bill.findOne({
            where: { paymentToken: token },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant'
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

        if (bill.status === 'PAID') {
            return res.json({
                success: true,
                alreadyPaid: true,
                bill: serializeBill(bill)
            });
        }

        if (bill.status === 'EXPIRED' || isBillExpired(bill)) {
            if (bill.status !== 'EXPIRED') {
                await bill.update({ status: 'EXPIRED' });
                await db.ActivityLog.create({
                    entityType: 'tenant',
                    entityId: bill.tenantId,
                    action: 'updated',
                    performedByType: 'system',
                    performedByName: 'billing-system',
                    details: {
                        event: 'invoice_expired',
                        billId: bill.id,
                        billNumber: bill.billNumber,
                        paymentTokenExpiresAt: bill.paymentTokenExpiresAt,
                        dueDate: bill.dueDate
                    }
                });
                await notifyTenantBillExpired({
                    tenant: bill.tenant,
                    bill
                });
                if (bill.tenant?.email) {
                    const { sendPaymentExpiredEmail } = require('../utils/emailService');
                    sendPaymentExpiredEmail(bill.tenant, { bill }).catch(err => {
                        console.error('[BillPayment] Expired email failed:', err.message);
                    });
                }
            }

            return res.status(400).json({
                success: false,
                message: 'This payment link has expired',
                expired: true
            });
        }

        const now = new Date();
        const subscription = bill.subscription;
        const shouldActivateTenant = bill.tenant?.status === 'payment_pending';

        if (!subscription) {
            return res.status(400).json({
                success: false,
                message: 'Subscription record not found for this bill'
            });
        }

        const metadata = bill.metadata || {};
        const targetPackageId = metadata.requestedPackageId || subscription.packageId;
        const targetBillingCycle = metadata.requestedBillingCycle || subscription.billingCycle || 'monthly';
        const targetAmount = parseFloat(metadata.requestedAmount || bill.amount || 0);
        const periodEnd = getPeriodEnd(now, targetBillingCycle);
        const resolvedPaymentProvider = paymentProvider || bill.paymentProvider || 'refah_manual_payment';
        const resolvedPaymentReference = paymentReference || bill.paymentReference || `${bill.billNumber}-${now.getTime()}`;
        const resolvedPaymentMethod = paymentMethod || bill.paymentMethod || 'online';

        await db.sequelize.transaction(async (transaction) => {
            await bill.update({
                status: 'PAID',
                paidAt: now,
                paymentProvider: resolvedPaymentProvider,
                paymentReference: resolvedPaymentReference,
                paymentMethod: resolvedPaymentMethod,
                paymentCapturedAmount: targetAmount,
                paymentFailureReason: null,
                metadata: {
                    ...(bill.metadata || {}),
                    paidThrough: 'public_payment_link',
                    paymentRecordedAt: now.toISOString()
                }
            }, { transaction });

            await subscription.update({
                packageId: targetPackageId,
                billingCycle: targetBillingCycle,
                amount: targetAmount,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                nextBillingDate: periodEnd,
                gracePeriodEnds: null,
                lastPaymentStatus: 'succeeded',
                lastPaymentDate: now,
                lastPaymentAmount: targetAmount,
                metadata: {
                    ...(subscription.metadata || {}),
                    lastBillId: bill.id,
                    lastBillType: bill.type
                }
            }, { transaction });

            if (shouldActivateTenant) {
                await bill.tenant.update({
                    status: 'active',
                    paymentDueAt: null
                }, { transaction });
            }

            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: bill.tenantId,
                action: 'payment_received',
                performedByType: 'system',
                performedByName: 'billing-system',
                details: {
                    event: 'invoice_paid',
                    billId: bill.id,
                    billNumber: bill.billNumber,
                    billType: bill.type,
                    amount: toNumber(bill.amount, 0),
                    totalAmount: toNumber(bill.totalAmount, toNumber(bill.amount, 0)),
                    paymentProvider: resolvedPaymentProvider,
                    paymentMethod: resolvedPaymentMethod,
                    paymentReference: resolvedPaymentReference,
                    targetPackageId,
                    targetBillingCycle
                }
            }, { transaction });

            await notifyTenantBillPaid({
                tenant: bill.tenant,
                bill: {
                    ...bill.toJSON(),
                    status: 'PAID',
                    paidAt: now,
                    paymentProvider: resolvedPaymentProvider,
                    paymentReference: resolvedPaymentReference,
                    paymentMethod: resolvedPaymentMethod
                },
                packageName: bill.subscription?.package?.name,
                billingCycle: targetBillingCycle
            }, transaction);

            const usage = await db.TenantUsage.findOne({
                where: { tenantId: bill.tenantId },
                transaction
            });

            if (!usage) {
                await db.TenantUsage.create({
                    tenantId: bill.tenantId,
                    currentPeriod: now.toISOString().slice(0, 7),
                    bookingsThisMonth: 0,
                    bookingsTotal: 0,
                    activeStaff: 0,
                    activeServices: 0,
                    activeProducts: 0,
                    storageUsedMB: 0,
                    emailCampaignsThisMonth: 0,
                    smsCampaignsThisMonth: 0,
                    apiCallsThisMonth: 0,
                    lastResetDate: now
                }, { transaction });
            }
        });

        if (shouldActivateTenant) {
            const { sendPaymentSuccessEmail } = require('../utils/emailService');
            sendPaymentSuccessEmail(bill.tenant, {
                bill: {
                    ...bill.toJSON(),
                    status: 'PAID',
                    paidAt: now,
                    paymentProvider: resolvedPaymentProvider,
                    paymentReference: resolvedPaymentReference,
                    paymentMethod: resolvedPaymentMethod,
                    paymentCapturedAmount: targetAmount
                },
                packageName: bill.subscription?.package?.name,
                billingCycle: targetBillingCycle,
                periodStart: now,
                periodEnd
            }).catch(err => {
                console.error('[BillPayment] Success email failed:', err.message);
            });
        }

        ensureReceiptPdf({
            ...bill.toJSON(),
            status: 'PAID',
            paidAt: now,
            paymentProvider: resolvedPaymentProvider,
            paymentReference: resolvedPaymentReference,
            paymentMethod: resolvedPaymentMethod,
            paymentCapturedAmount: targetAmount
        }).catch(err => {
            console.error('[BillPayment] Failed to generate receipt PDF:', err.message);
        });

        res.json({
            success: true,
            message: 'Payment successful. Subscription updated successfully.',
            bill: serializeBill({
                ...bill.toJSON(),
                status: 'PAID',
                paidAt: now,
                paymentProvider: resolvedPaymentProvider,
                paymentReference: resolvedPaymentReference,
                paymentMethod: resolvedPaymentMethod,
                paymentCapturedAmount: targetAmount
            }),
            subscription: {
                packageId: targetPackageId,
                billingCycle: targetBillingCycle,
                currentPeriodEnd: periodEnd
            }
        });
    } catch (error) {
        console.error('payBillByToken error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment failed. Please try again.'
        });
    }
};
