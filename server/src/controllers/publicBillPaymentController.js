const db = require('../models');

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

exports.getBillByToken = async (req, res) => {
    try {
        const { token } = req.params;

        const bill = await db.Bill.findOne({
            where: { paymentToken: token },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'email']
                },
                {
                    model: db.TenantSubscription,
                    as: 'subscription',
                    include: [{ model: db.SubscriptionPackage, as: 'package', attributes: ['id', 'name', 'name_ar'] }]
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
                bill: {
                    billNumber: bill.billNumber,
                    amount: parseFloat(bill.amount || 0),
                    currency: bill.currency,
                    paidAt: bill.paidAt,
                    type: bill.type,
                    planSnapshot: bill.planSnapshot || {}
                }
            });
        }

        if (bill.status === 'EXPIRED' || isBillExpired(bill)) {
            if (bill.status !== 'EXPIRED') {
                await bill.update({ status: 'EXPIRED' });
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
                id: bill.id,
                billNumber: bill.billNumber,
                amount: parseFloat(bill.amount || 0),
                currency: bill.currency,
                dueDate: bill.dueDate,
                type: bill.type,
                planSnapshot: bill.planSnapshot || {},
                tenantName: bill.tenant?.name_ar || bill.tenant?.name_en || bill.tenant?.name || '',
                subscriptionId: bill.tenantSubscriptionId
            }
        });
    } catch (error) {
        console.error('getBillByToken error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load invoice'
        });
    }
};

exports.payBillByToken = async (req, res) => {
    try {
        const { token } = req.params;

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
                bill: {
                    billNumber: bill.billNumber,
                    paidAt: bill.paidAt
                }
            });
        }

        if (bill.status === 'EXPIRED' || isBillExpired(bill)) {
            if (bill.status !== 'EXPIRED') {
                await bill.update({ status: 'EXPIRED' });
            }

            return res.status(400).json({
                success: false,
                message: 'This payment link has expired',
                expired: true
            });
        }

        const now = new Date();
        const subscription = bill.subscription;

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

        await db.sequelize.transaction(async (transaction) => {
            await bill.update({
                status: 'PAID',
                paidAt: now
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

        res.json({
            success: true,
            message: 'Payment successful. Subscription updated successfully.',
            bill: {
                billNumber: bill.billNumber,
                amount: parseFloat(bill.amount || 0),
                currency: bill.currency,
                paidAt: now
            },
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
