const db = require('../models');
const { ensureReceiptPdf } = require('./billDocumentService');
const {
    notifyTenantBillExpired,
    notifyTenantBillPaid
} = require('./adminNotificationService');
const { sendPaymentExpiredEmail, sendPaymentSuccessEmail } = require('../utils/emailService');
const {
    serializeBill,
    serializePaymentAttempt,
    toNumber
} = require('../utils/invoiceSnapshotBuilder');
const {
    BILL_STATUS,
    RETIRABLE_BILL_STATUSES,
    getBlockedPaymentStatusMessage
} = require('../utils/billStatus');

const BILL_PAYMENT_INCLUDE = [
    {
        model: db.Tenant,
        as: 'tenant'
    },
    {
        model: db.TenantSubscription,
        as: 'subscription',
        include: [{ model: db.SubscriptionPackage, as: 'package' }]
    },
    {
        model: db.BillPaymentAttempt,
        as: 'paymentAttempts',
        separate: true,
        order: [
            ['processedAt', 'DESC'],
            ['createdAt', 'DESC']
        ]
    }
];

function getEffectiveExpiry(bill) {
    if (bill.paymentTokenExpiresAt) {
        return new Date(bill.paymentTokenExpiresAt);
    }

    const due = new Date(bill.dueDate);
    due.setHours(23, 59, 59, 999);
    return due;
}

function isBillExpired(bill, now = new Date()) {
    return getEffectiveExpiry(bill) < now;
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

function normalizeGatewaySummary(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
        return {};
    }

    return summary;
}

function buildIdempotencyKey({
    bill,
    source,
    paymentStatus,
    paymentReference,
    checkoutSessionId,
    idempotencyKey
}) {
    if (idempotencyKey) {
        return idempotencyKey.toString().trim().slice(0, 191);
    }

    const referenceKey = (paymentReference || checkoutSessionId || bill.paymentToken || bill.id || 'manual')
        .toString()
        .trim();
    return `${source || 'public_payment_link'}:${bill.id}:${paymentStatus || 'succeeded'}:${referenceKey}`.slice(0, 191);
}

function sanitizeOptionalText(value) {
    if (value === null || value === undefined) return null;
    const trimmed = value.toString().trim();
    return trimmed || null;
}

async function loadBill(where, transaction = null, lock = false) {
    if (lock && transaction) {
        const lockedBill = await db.Bill.findOne({
            where,
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!lockedBill) {
            return null;
        }

        return db.Bill.findOne({
            where: { id: lockedBill.id },
            include: BILL_PAYMENT_INCLUDE,
            transaction
        });
    }

    return db.Bill.findOne({
        where,
        include: BILL_PAYMENT_INCLUDE,
        transaction
    });
}

async function createPaymentAttempt({
    bill,
    transaction,
    source,
    status,
    paymentProvider,
    paymentMethod,
    paymentReference,
    checkoutSessionId,
    gatewayStatus,
    requestedAmount,
    capturedAmount,
    failureReason,
    notes,
    gatewaySummary,
    idempotencyKey,
    actor
}) {
    const finalIdempotencyKey = buildIdempotencyKey({
        bill,
        source,
        paymentStatus: status,
        paymentReference,
        checkoutSessionId,
        idempotencyKey
    });

    const existingAttempt = await db.BillPaymentAttempt.findOne({
        where: { idempotencyKey: finalIdempotencyKey },
        transaction
    });

    if (existingAttempt) {
        return {
            attempt: existingAttempt,
            duplicate: true
        };
    }

    const attempt = await db.BillPaymentAttempt.create({
        billId: bill.id,
        source,
        status,
        paymentProvider: sanitizeOptionalText(paymentProvider),
        paymentMethod: sanitizeOptionalText(paymentMethod),
        paymentReference: sanitizeOptionalText(paymentReference),
        checkoutSessionId: sanitizeOptionalText(checkoutSessionId),
        gatewayStatus: sanitizeOptionalText(gatewayStatus),
        requestedAmount: toNumber(requestedAmount, 0),
        capturedAmount: toNumber(capturedAmount, toNumber(requestedAmount, 0)),
        failureReason: sanitizeOptionalText(failureReason),
        idempotencyKey: finalIdempotencyKey,
        processedAt: new Date(),
        performedByType: actor?.type || 'system',
        performedById: actor?.id || null,
        performedByName: actor?.name || null,
        notes: sanitizeOptionalText(notes),
        gatewaySummary: normalizeGatewaySummary(gatewaySummary)
    }, { transaction });

    return {
        attempt,
        duplicate: false
    };
}

async function markBillExpired({ bill, transaction, source, actor, now, notes = null }) {
    const {
        attempt,
        duplicate
    } = await createPaymentAttempt({
        bill,
        transaction,
        source,
        status: 'expired',
        paymentProvider: bill.paymentProvider || 'refah_billing',
        paymentMethod: bill.paymentMethod || null,
        paymentReference: bill.paymentReference || bill.billNumber,
        checkoutSessionId: null,
        gatewayStatus: 'expired',
        requestedAmount: bill.totalAmount ?? bill.amount,
        capturedAmount: 0,
        failureReason: 'Payment link expired before completion',
        notes,
        gatewaySummary: {
            billStatus: bill.status,
            paymentTokenExpiresAt: bill.paymentTokenExpiresAt,
            dueDate: bill.dueDate
        },
        idempotencyKey: `${source || 'public_payment_link'}:${bill.id}:expired`.slice(0, 191),
        actor
    });

    if (duplicate) {
        return {
            status: 'expired',
            bill,
            attempt,
            duplicate: true
        };
    }

    if (bill.status !== BILL_STATUS.EXPIRED) {
        await bill.update({
            status: BILL_STATUS.EXPIRED,
            paymentFailureReason: 'Payment link expired before completion',
            metadata: {
                ...(bill.metadata || {}),
                lastPaymentAttemptStatus: 'expired',
                lastPaymentAttemptSource: source,
                lastGatewayStatus: 'expired',
                lastPaymentAttemptAt: now.toISOString()
            }
        }, { transaction });

        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: bill.tenantId,
            action: 'updated',
            performedByType: actor?.type || 'system',
            performedById: actor?.id || null,
            performedByName: actor?.name || 'billing-system',
            details: {
                event: 'invoice_expired',
                billId: bill.id,
                billNumber: bill.billNumber,
                paymentTokenExpiresAt: bill.paymentTokenExpiresAt,
                dueDate: bill.dueDate,
                attemptId: attempt.id,
                source
            }
        }, { transaction });

        await notifyTenantBillExpired({
            tenant: bill.tenant,
            bill
        }, transaction);
    }

    return {
        status: 'expired',
        bill,
        attempt,
        duplicate: false
    };
}

async function settleBillPayment({
    billId = null,
    paymentToken = null,
    source = 'public_payment_link',
    paymentStatus = 'succeeded',
    paymentProvider = null,
    paymentReference = null,
    paymentMethod = null,
    checkoutSessionId = null,
    gatewayStatus = null,
    gatewaySummary = null,
    capturedAmount = null,
    failureReason = null,
    notes = null,
    idempotencyKey = null,
    actor = { type: 'system', id: null, name: 'billing-system' }
}) {
    const where = billId ? { id: billId } : { paymentToken };

    if (!billId && !paymentToken) {
        const error = new Error('Bill ID or payment token is required');
        error.statusCode = 400;
        throw error;
    }

    let emailJob = null;
    let pdfBillPayload = null;
    let resultPayload = null;

    await db.sequelize.transaction(async (transaction) => {
        const bill = await loadBill(where, transaction, true);

        if (!bill) {
            const error = new Error('Invalid or expired payment link');
            error.statusCode = 404;
            throw error;
        }

        const now = new Date();
        const requestedAmount = toNumber(
            capturedAmount ?? bill.metadata?.requestedAmount ?? bill.totalAmount ?? bill.amount,
            toNumber(bill.totalAmount ?? bill.amount, 0)
        );
        const resolvedPaymentProvider = sanitizeOptionalText(paymentProvider || bill.paymentProvider || 'refah_manual_payment');
        const resolvedPaymentReference = sanitizeOptionalText(
            paymentReference ||
            bill.paymentReference ||
            `${bill.billNumber}-${source}-${now.getTime()}`
        );
        const resolvedPaymentMethod = sanitizeOptionalText(paymentMethod || bill.paymentMethod || 'online');
        const resolvedGatewayStatus = sanitizeOptionalText(
            gatewayStatus ||
            (paymentStatus === 'succeeded' ? 'succeeded' : paymentStatus === 'failed' ? 'failed' : 'pending')
        );
        const shouldActivateTenant = bill.tenant?.status === 'payment_pending';
        const duplicateLookupKey = buildIdempotencyKey({
            bill,
            source,
            paymentStatus,
            paymentReference: resolvedPaymentReference,
            checkoutSessionId,
            idempotencyKey
        });

        if (bill.status === 'PAID') {
            const { attempt } = await createPaymentAttempt({
                bill,
                transaction,
                source,
                status: 'already_paid',
                paymentProvider: resolvedPaymentProvider,
                paymentMethod: resolvedPaymentMethod,
                paymentReference: resolvedPaymentReference,
                checkoutSessionId,
                gatewayStatus: resolvedGatewayStatus,
                requestedAmount,
                capturedAmount: bill.paymentCapturedAmount ?? requestedAmount,
                failureReason: null,
                notes,
                gatewaySummary,
                idempotencyKey,
                actor
            });

            resultPayload = {
                success: true,
                status: 'already_paid',
                alreadyPaid: true,
                bill,
                attempt
            };
            return;
        }

        const allowExpiredAdminReconciliation =
            source === 'admin_manual_reconciliation' && paymentStatus === 'succeeded';

        if ([BILL_STATUS.VOID, BILL_STATUS.DRAFT].includes(bill.status)) {
            const { attempt } = await createPaymentAttempt({
                bill,
                transaction,
                source,
                status: 'failed',
                paymentProvider: resolvedPaymentProvider,
                paymentMethod: resolvedPaymentMethod,
                paymentReference: resolvedPaymentReference,
                checkoutSessionId,
                gatewayStatus: resolvedGatewayStatus,
                requestedAmount,
                capturedAmount: 0,
                failureReason: getBlockedPaymentStatusMessage(bill.status),
                notes,
                gatewaySummary,
                idempotencyKey: duplicateLookupKey,
                actor
            });

            resultPayload = {
                success: false,
                status: bill.status.toLowerCase(),
                bill,
                attempt
            };
            return;
        }

        if (!allowExpiredAdminReconciliation && (bill.status === BILL_STATUS.EXPIRED || isBillExpired(bill, now))) {
            const expiredResult = await markBillExpired({
                bill,
                transaction,
                source,
                actor,
                now,
                notes
            });

            resultPayload = {
                success: false,
                status: 'expired',
                expired: true,
                bill: expiredResult.bill,
                attempt: expiredResult.attempt,
                duplicate: expiredResult.duplicate
            };

            if (!expiredResult.duplicate && bill.tenant?.email) {
                emailJob = {
                    type: 'expired',
                    tenant: bill.tenant,
                    bill: bill.toJSON()
                };
            }

            return;
        }

        const existingAttempt = await db.BillPaymentAttempt.findOne({
            where: { idempotencyKey: duplicateLookupKey },
            transaction
        });

        if (existingAttempt) {
            resultPayload = {
                success: existingAttempt.status === 'succeeded',
                status: 'duplicate_ignored',
                duplicate: true,
                alreadyPaid: bill.status === 'PAID',
                bill,
                attempt: existingAttempt
            };
            return;
        }

        if (paymentStatus !== 'succeeded') {
            const { attempt } = await createPaymentAttempt({
                bill,
                transaction,
                source,
                status: 'failed',
                paymentProvider: resolvedPaymentProvider,
                paymentMethod: resolvedPaymentMethod,
                paymentReference: resolvedPaymentReference,
                checkoutSessionId,
                gatewayStatus: resolvedGatewayStatus,
                requestedAmount,
                capturedAmount: 0,
                failureReason: failureReason || 'Payment attempt failed',
                notes,
                gatewaySummary,
                idempotencyKey: duplicateLookupKey,
                actor
            });

            await bill.update({
                status: BILL_STATUS.FAILED,
                paymentProvider: resolvedPaymentProvider,
                paymentReference: resolvedPaymentReference,
                paymentMethod: resolvedPaymentMethod,
                paymentCapturedAmount: 0,
                paymentFailureReason: failureReason || 'Payment attempt failed',
                metadata: {
                    ...(bill.metadata || {}),
                    lastPaymentAttemptStatus: 'failed',
                    lastPaymentAttemptSource: source,
                    lastGatewayStatus: resolvedGatewayStatus,
                    lastPaymentAttemptAt: now.toISOString(),
                    lastPaymentAttemptId: attempt.id,
                    lastPaymentAttemptReference: resolvedPaymentReference,
                    lastGatewaySummary: normalizeGatewaySummary(gatewaySummary)
                }
            }, { transaction });

            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: bill.tenantId,
                action: 'updated',
                performedByType: actor?.type || 'system',
                performedById: actor?.id || null,
                performedByName: actor?.name || 'billing-system',
                details: {
                    event: 'invoice_payment_failed',
                    billId: bill.id,
                    billNumber: bill.billNumber,
                    attemptId: attempt.id,
                    source,
                    paymentProvider: resolvedPaymentProvider,
                    paymentMethod: resolvedPaymentMethod,
                    paymentReference: resolvedPaymentReference,
                    gatewayStatus: resolvedGatewayStatus,
                    failureReason: failureReason || 'Payment attempt failed'
                }
            }, { transaction });

            resultPayload = {
                success: false,
                status: 'failed',
                bill,
                attempt
            };
            return;
        }

        const subscription = bill.subscription;
        if (!subscription) {
            const error = new Error('Subscription record not found for this bill');
            error.statusCode = 400;
            throw error;
        }

        const { attempt } = await createPaymentAttempt({
            bill,
            transaction,
            source,
            status: 'succeeded',
            paymentProvider: resolvedPaymentProvider,
            paymentMethod: resolvedPaymentMethod,
            paymentReference: resolvedPaymentReference,
            checkoutSessionId,
            gatewayStatus: resolvedGatewayStatus,
            requestedAmount,
            capturedAmount: requestedAmount,
            failureReason: null,
            notes,
            gatewaySummary,
            idempotencyKey: duplicateLookupKey,
            actor
        });

        const metadata = bill.metadata || {};
        const targetPackageId = metadata.requestedPackageId || subscription.packageId;
        const targetBillingCycle = metadata.requestedBillingCycle || subscription.billingCycle || 'monthly';
        const periodEnd = getPeriodEnd(now, targetBillingCycle);

        await bill.update({
            status: BILL_STATUS.PAID,
            paidAt: now,
            paymentProvider: resolvedPaymentProvider,
            paymentReference: resolvedPaymentReference,
            paymentMethod: resolvedPaymentMethod,
            paymentCapturedAmount: requestedAmount,
            paymentFailureReason: null,
            metadata: {
                ...(bill.metadata || {}),
                paidThrough: source,
                paymentRecordedAt: now.toISOString(),
                lastPaymentAttemptStatus: 'succeeded',
                lastPaymentAttemptSource: source,
                lastGatewayStatus: resolvedGatewayStatus,
                lastPaymentAttemptAt: now.toISOString(),
                lastPaymentAttemptId: attempt.id,
                lastPaymentAttemptReference: resolvedPaymentReference,
                lastGatewaySummary: normalizeGatewaySummary(gatewaySummary),
                manualReconciliationNotes: notes || bill.metadata?.manualReconciliationNotes || null
            }
        }, { transaction });

        await subscription.update({
            packageId: targetPackageId,
            billingCycle: targetBillingCycle,
            amount: requestedAmount,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
            gracePeriodEnds: null,
            lastPaymentStatus: 'succeeded',
            lastPaymentDate: now,
            lastPaymentAmount: requestedAmount,
            metadata: {
                ...(subscription.metadata || {}),
                lastBillId: bill.id,
                lastBillType: bill.type,
                lastPaymentAttemptId: attempt.id,
                lastPaymentSource: source,
                lastPaymentProvider: resolvedPaymentProvider,
                lastPaymentReference: resolvedPaymentReference
            }
        }, { transaction });

        const siblingBills = await db.Bill.findAll({
            where: {
                id: { [db.Sequelize.Op.ne]: bill.id },
                tenantId: bill.tenantId,
                tenantSubscriptionId: bill.tenantSubscriptionId,
                status: { [db.Sequelize.Op.in]: RETIRABLE_BILL_STATUSES },
                type: { [db.Sequelize.Op.in]: ['initial', 'renewal', 'upgrade'] }
            },
            transaction
        });

        for (const siblingBill of siblingBills) {
            const siblingMetadata = siblingBill.metadata && typeof siblingBill.metadata === 'object' && !Array.isArray(siblingBill.metadata)
                ? siblingBill.metadata
                : {};

            await siblingBill.update({
                status: BILL_STATUS.VOID,
                paymentFailureReason: 'Superseded by a paid invoice for the same subscription',
                metadata: {
                    ...siblingMetadata,
                    voidedAt: now.toISOString(),
                    voidReason: 'superseded_by_paid_subscription_invoice',
                    voidedByBillId: bill.id,
                    voidedByBillNumber: bill.billNumber
                }
            }, { transaction });
        }

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
            performedByType: actor?.type || 'system',
            performedById: actor?.id || null,
            performedByName: actor?.name || 'billing-system',
            details: {
                event: source === 'admin_manual_reconciliation'
                    ? 'invoice_manually_reconciled'
                    : 'invoice_paid',
                billId: bill.id,
                billNumber: bill.billNumber,
                billType: bill.type,
                amount: toNumber(bill.amount, 0),
                totalAmount: toNumber(bill.totalAmount, toNumber(bill.amount, 0)),
                paymentProvider: resolvedPaymentProvider,
                paymentMethod: resolvedPaymentMethod,
                paymentReference: resolvedPaymentReference,
                gatewayStatus: resolvedGatewayStatus,
                checkoutSessionId: sanitizeOptionalText(checkoutSessionId),
                attemptId: attempt.id,
                source,
                notes: sanitizeOptionalText(notes),
                targetPackageId,
                targetBillingCycle
            }
        }, { transaction });

        await notifyTenantBillPaid({
            tenant: bill.tenant,
            bill: {
                ...bill.toJSON(),
                status: BILL_STATUS.PAID,
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

        pdfBillPayload = {
            ...bill.toJSON(),
            status: BILL_STATUS.PAID,
            paidAt: now,
            paymentProvider: resolvedPaymentProvider,
            paymentReference: resolvedPaymentReference,
            paymentMethod: resolvedPaymentMethod,
            paymentCapturedAmount: requestedAmount
        };

        if (bill.tenant?.email) {
            emailJob = {
                type: 'success',
                tenant: bill.tenant,
                payload: {
                    bill: pdfBillPayload,
                    packageName: bill.subscription?.package?.name,
                    billingCycle: targetBillingCycle,
                    periodStart: now,
                    periodEnd
                }
            };
        }

        resultPayload = {
            success: true,
            status: 'succeeded',
            bill: {
                ...bill.toJSON(),
                status: BILL_STATUS.PAID,
                paidAt: now,
                paymentProvider: resolvedPaymentProvider,
                paymentReference: resolvedPaymentReference,
                paymentMethod: resolvedPaymentMethod,
                paymentCapturedAmount: requestedAmount
            },
            attempt,
            subscription: {
                packageId: targetPackageId,
                billingCycle: targetBillingCycle,
                currentPeriodEnd: periodEnd
            }
        };
    });

    const freshBill = await loadBill(where);
    const serializedBill = serializeBill(resultPayload.bill || freshBill, {
        includePaymentToken: true
    });

    if (resultPayload.status === 'expired' && emailJob?.type === 'expired') {
        sendPaymentExpiredEmail(emailJob.tenant, { bill: emailJob.bill }).catch(err => {
            console.error('[BillPayment] Expired email failed:', err.message);
        });
    }

    if (resultPayload.status === 'succeeded' && emailJob?.type === 'success') {
        sendPaymentSuccessEmail(emailJob.tenant, emailJob.payload).catch(err => {
            console.error('[BillPayment] Success email failed:', err.message);
        });
    }

    if (pdfBillPayload) {
        ensureReceiptPdf(pdfBillPayload).catch(err => {
            console.error('[BillPayment] Failed to generate receipt PDF:', err.message);
        });
    }

    return {
        ...resultPayload,
        bill: serializedBill,
        attempt: serializePaymentAttempt(resultPayload.attempt),
        freshBill
    };
}

async function loadBillForRead(where) {
    return loadBill(where);
}

module.exports = {
    settleBillPayment,
    loadBillForRead,
    isBillExpired,
    getEffectiveExpiry
};
