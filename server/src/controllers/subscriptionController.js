const db = require('../models');
const { Op } = require('sequelize');
const { getTenantDashboardBaseUrl } = require('../utils/url');
const { generateBillNumber, generatePaymentToken } = require('../utils/billUtils');
const {
    getActiveSubscriptionForTenant,
    ACTIVE_SUBSCRIPTION_STATUSES
} = require('../services/tenantSubscriptionService');

const BILLING_CYCLES = ['monthly', 'sixMonth', 'annual'];

function getTenantId(req) {
    return req.tenantId || req.tenant?.id;
}

function getAmountForBillingCycle(pkg, billingCycle) {
    switch (billingCycle) {
        case 'monthly':
            return parseFloat(pkg.monthlyPrice || 0);
        case 'sixMonth':
            return parseFloat(pkg.sixMonthPrice || 0);
        case 'annual':
            return parseFloat(pkg.annualPrice || 0);
        default:
            return 0;
    }
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
        
        res.json({
            success: true,
            subscription: result.subscription
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
        const { packageId, billingCycle } = req.body;
        
        if (!packageId || !billingCycle) {
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
        const newPackage = await db.SubscriptionPackage.findByPk(packageId);
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
        const type = currentSubscription.packageId === packageId ? 'renewal' : 'upgrade';

        const bill = await db.Bill.create({
            tenantId,
            tenantSubscriptionId: currentSubscription.id,
            billNumber,
            amount,
            currency: currentSubscription.currency || 'SAR',
            dueDate,
            status: 'UNPAID',
            paymentToken,
            paymentTokenExpiresAt: expiresAt,
            planSnapshot: {
                packageId: newPackage.id,
                packageName: newPackage.name,
                packageNameAr: newPackage.name_ar,
                billingCycle
            },
            type,
            metadata: {
                currentPackageId: currentSubscription.packageId,
                currentBillingCycle: currentSubscription.billingCycle,
                requestedPackageId: newPackage.id,
                requestedBillingCycle: billingCycle,
                requestedAmount: amount
            }
        });
        
        await db.ActivityLog.create({
            actorType: 'tenant',
            actorId: tenantId,
            action: type === 'renewal' ? 'subscription_renewal_requested' : 'subscription_change_requested',
            resourceType: 'bill',
            resourceId: bill.id,
            details: {
                billId: bill.id,
                billNumber,
                currentPackageId: currentSubscription.packageId,
                requestedPackageId: packageId,
                requestedBillingCycle: billingCycle,
                amount,
                type
            }
        });
        
        res.json({
            success: true,
            message: type === 'renewal'
                ? 'Renewal invoice created. Complete payment to renew your subscription.'
                : 'Upgrade invoice created. Complete payment to activate your new package.',
            estimatedAmount: amount,
            billId: bill.id,
            billNumber,
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

exports.requestUpgrade = exports.requestSubscriptionChange;

