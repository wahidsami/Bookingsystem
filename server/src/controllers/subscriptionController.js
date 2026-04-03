const db = require('../models');
const { Op } = require('sequelize');
const { getTenantDashboardBaseUrl } = require('../utils/url');
const { generateBillNumber, generatePaymentToken } = require('../utils/billUtils');
const {
    buildSubscriptionInvoiceSnapshot,
    getAmountForBillingCycle,
    serializeBill,
    toNumber
} = require('../utils/invoiceSnapshotBuilder');
const { normalizePackageEntitlements } = require('../utils/packageEntitlements');
const { ensureInvoicePdf } = require('../services/billDocumentService');
const {
    getActiveSubscriptionForTenant,
    ACTIVE_SUBSCRIPTION_STATUSES
} = require('../services/tenantSubscriptionService');
const {
    notifyTenantSubscriptionChangeRequested
} = require('../services/adminNotificationService');
const {
    buildSubscriptionConsumption
} = require('../services/subscriptionConsumptionService');
const {
    BILL_STATUS,
    RETIRABLE_BILL_STATUSES
} = require('../utils/billStatus');

const BILLING_CYCLES = ['monthly', 'sixMonth', 'annual'];

function getTenantId(req) {
    return req.tenantId || req.tenant?.id;
}

/**
 * Get available packages (public endpoint for registration/browsing)
 */
exports.getAvailablePackages = async (req, res) => {
    try {
        const packages = await db.SubscriptionPackage.findAll({
            where: {
                isActive: true,
                isCustom: false // Only show public packages, not custom tenant-specific ones
            },
            order: [
                ['displayOrder', 'ASC'],
                ['monthlyPrice', 'ASC']
            ],
            attributes: { exclude: ['createdBy'] }
        });
        
        res.json({
            success: true,
            packages
        });
    } catch (error) {
        console.error('Get available packages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch packages'
        });
    }
};

/**
 * Get tenant's current subscription
 */
exports.getCurrentSubscription = async (req, res) => {
    try {
        const result = await getActiveSubscriptionForTenant(getTenantId(req));

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        const subscription = result.subscription.toJSON();
        if (subscription.package) {
            subscription.package.limits = normalizePackageEntitlements(subscription.package.limits || {});
        }
        
        res.json({
            success: true,
            subscription
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
};

/**
 * Get tenant's usage statistics
 */
exports.getUsageStats = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        
        // Get usage
        const usage = await db.TenantUsage.findOne({ where: { tenantId } });
        
        const result = await getActiveSubscriptionForTenant(tenantId);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        const subscription = result.subscription;
        
        const limits = subscription.package.limits;
        
        // Calculate usage percentages
        const usageStats = {
            bookings: {
                current: usage?.bookingsThisMonth || 0,
                limit: limits.maxBookingsPerMonth,
                percentage: limits.maxBookingsPerMonth === -1 ? 0 :
                           ((usage?.bookingsThisMonth || 0) / limits.maxBookingsPerMonth) * 100,
                unlimited: limits.maxBookingsPerMonth === -1
            },
            staff: {
                current: usage?.activeStaff || 0,
                limit: limits.maxStaff,
                percentage: limits.maxStaff === -1 ? 0 :
                           ((usage?.activeStaff || 0) / limits.maxStaff) * 100,
                unlimited: limits.maxStaff === -1
            },
            services: {
                current: usage?.activeServices || 0,
                limit: limits.maxServices,
                percentage: limits.maxServices === -1 ? 0 :
                           ((usage?.activeServices || 0) / limits.maxServices) * 100,
                unlimited: limits.maxServices === -1
            },
            products: {
                current: usage?.activeProducts || 0,
                limit: limits.maxProducts,
                percentage: limits.maxProducts === -1 ? 0 :
                           ((usage?.activeProducts || 0) / limits.maxProducts) * 100,
                unlimited: limits.maxProducts === -1
            },
            storage: {
                current: usage?.storageUsedMB || 0,
                limit: (limits.storageGB || 1) * 1024,
                percentage: ((usage?.storageUsedMB || 0) / ((limits.storageGB || 1) * 1024)) * 100,
                unlimited: false
            }
        };
        
        res.json({
            success: true,
            usage: usageStats,
            subscription: {
                id: subscription.id,
                packageName: subscription.package.name,
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                daysRemaining: subscription.daysUntilRenewal()
            }
        });
    } catch (error) {
        console.error('Get usage stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch usage statistics'
        });
    }
};

/**
 * Get recent usage alerts
 */
exports.getUsageAlerts = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { limit = 10, unacknowledgedOnly } = req.query;
        
        const where = { tenantId };
        if (unacknowledgedOnly === 'true') {
            where.acknowledged = false;
        }
        
        const alerts = await db.UsageAlert.findAll({
            where,
            order: [['sentAt', 'DESC']],
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            alerts
        });
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch alerts'
        });
    }
};

/**
 * Acknowledge an alert
 */
exports.acknowledgeAlert = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { alertId } = req.params;
        
        const alert = await db.UsageAlert.findOne({
            where: { id: alertId, tenantId }
        });
        
        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }
        
        await alert.update({
            acknowledged: true,
            acknowledgedAt: new Date()
        });
        
        res.json({
            success: true,
            message: 'Alert acknowledged'
        });
    } catch (error) {
        console.error('Acknowledge alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to acknowledge alert'
        });
    }
};

/**
 * Request subscription upgrade/downgrade
 */
exports.requestSubscriptionChange = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { packageId, newPackageId, billingCycle } = req.body;
        const requestedPackageId = packageId || newPackageId;
        
        if (!requestedPackageId || !billingCycle) {
            return res.status(400).json({
                success: false,
                message: 'Package ID and billing cycle are required'
            });
        }

        if (!BILLING_CYCLES.includes(billingCycle)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid billing cycle'
            });
        }
        
        // Get new package
        const newPackage = await db.SubscriptionPackage.findByPk(requestedPackageId);
        if (!newPackage || !newPackage.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Package not found or inactive'
            });
        }
        
        const currentResult = await getActiveSubscriptionForTenant(tenantId, {
            statuses: ACTIVE_SUBSCRIPTION_STATUSES
        });

        if (!currentResult) {
            return res.status(400).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        const currentSubscription = currentResult.subscription;
        const amount = getAmountForBillingCycle(newPackage, billingCycle);

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Selected package has no valid price for this billing cycle'
            });
        }

        const tenant = await db.Tenant.findByPk(tenantId);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const dueDate = expiresAt.toISOString().slice(0, 10);
        const billNumber = await generateBillNumber();
        const paymentToken = generatePaymentToken();
        const locale = tenant?.settings?.language === 'en' ? 'en' : 'ar';
        const baseUrl = getTenantDashboardBaseUrl();
        const paymentUrl = baseUrl
            ? `${baseUrl}/${locale}/payment?token=${paymentToken}`
            : `/${locale}/payment?token=${paymentToken}`;
        const type = currentSubscription.packageId === requestedPackageId ? 'renewal' : 'upgrade';
        const invoiceSnapshot = await buildSubscriptionInvoiceSnapshot({
            tenant,
            subscriptionPackage: newPackage,
            subscription: currentSubscription,
            billingCycle,
            billType: type,
            dueDate,
            issueDate: now,
            totalAmount: amount
        });

        const bill = await db.sequelize.transaction(async (transaction) => {
            const createdBill = await db.Bill.create({
                tenantId,
                tenantSubscriptionId: currentSubscription.id,
                billNumber,
                ...invoiceSnapshot,
                amount: invoiceSnapshot.amount,
                currency: currentSubscription.currency || 'SAR',
                dueDate,
                status: BILL_STATUS.UNPAID,
                paymentToken,
                paymentTokenExpiresAt: expiresAt,
                type,
                metadata: {
                    ...(invoiceSnapshot.metadata || {}),
                    currentPackageId: currentSubscription.packageId,
                    currentBillingCycle: currentSubscription.billingCycle,
                    requestedPackageId: newPackage.id,
                    requestedBillingCycle: billingCycle,
                    requestedAmount: amount
                }
            }, { transaction });

            await db.Bill.update(
                {
                    status: BILL_STATUS.VOID,
                    paymentFailureReason: 'Superseded by a newer subscription change invoice',
                    metadata: db.Sequelize.literal(`
                        COALESCE(metadata, '{}'::jsonb) ||
                        jsonb_build_object(
                            'voidedAt', '${now.toISOString()}',
                            'voidReason', 'superseded_by_new_subscription_request',
                            'voidedByBillId', '${createdBill.id}',
                            'voidedByBillNumber', '${createdBill.billNumber}'
                        )
                    `)
                },
                {
                    where: {
                        id: { [Op.ne]: createdBill.id },
                        tenantId,
                        tenantSubscriptionId: currentSubscription.id,
                        status: { [Op.in]: RETIRABLE_BILL_STATUSES },
                        type: { [Op.in]: ['renewal', 'upgrade'] }
                    },
                    transaction
                }
            );

            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: tenantId,
                action: 'created',
                performedByType: 'tenant_user',
                performedById: tenantId,
                performedByName: tenant?.name_en || tenant?.name_ar || tenant?.name || null,
                details: {
                    event: 'invoice_created',
                    billId: createdBill.id,
                    billNumber,
                    requestAction: type === 'renewal' ? 'subscription_renewal_requested' : 'subscription_change_requested',
                    billType: type,
                    status: createdBill.status,
                    amount: toNumber(createdBill.amount, 0),
                    totalAmount: toNumber(createdBill.totalAmount, toNumber(createdBill.amount, 0)),
                    currentPackageId: currentSubscription.packageId,
                    requestedPackageId: newPackage.id,
                    requestedBillingCycle: billingCycle
                }
            }, { transaction });

            await notifyTenantSubscriptionChangeRequested({
                tenant,
                bill: createdBill,
                packageName: newPackage.name,
                billingCycle
            }, transaction);

            return createdBill;
        });

        ensureInvoicePdf(bill).catch(err => {
            console.error('[SubscriptionChange] Failed to generate invoice PDF:', err.message);
        });
        
        res.json({
            success: true,
            message: type === 'renewal'
                ? 'Renewal invoice created. Complete payment to renew your subscription.'
                : 'Upgrade invoice created. Complete payment to activate your new package.',
            estimatedAmount: amount,
            billId: bill.id,
            billNumber,
            bill: serializeBill(bill, { includePaymentToken: true }),
            paymentToken,
            paymentUrl,
            dueDate,
            type
        });
    } catch (error) {
        console.error('Subscription change request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process subscription change request'
        });
    }
};

/**
 * Get package consumption snapshot for the current tenant.
 */
exports.getConsumption = async (req, res) => {
    try {
        const consumption = await buildSubscriptionConsumption(getTenantId(req));

        if (!consumption) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        return res.json({
            success: true,
            data: consumption
        });
    } catch (error) {
        console.error('Get subscription consumption error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch package consumption'
        });
    }
};

exports.requestUpgrade = exports.requestSubscriptionChange;

