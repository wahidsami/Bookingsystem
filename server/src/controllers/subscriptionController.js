const db = require('../models');
const { Op } = require('sequelize');

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
        const { tenantId } = req;
        
        const subscription = await db.TenantSubscription.findOne({
            where: {
                tenantId,
                status: { [Op.in]: ['trial', 'active', 'past_due'] }
            },
            include: [
                {
                    model: db.SubscriptionPackage,
                    as: 'package'
                }
            ],
            order: [['currentPeriodEnd', 'DESC']]
        });
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
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
        const { tenantId } = req;
        
        // Get usage
        const usage = await db.TenantUsage.findOne({ where: { tenantId } });
        
        // Get subscription
        const subscription = await db.TenantSubscription.findOne({
            where: {
                tenantId,
                status: { [Op.in]: ['trial', 'active', 'past_due'] }
            },
            include: [
                {
                    model: db.SubscriptionPackage,
                    as: 'package'
                }
            ]
        });
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }
        
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
        const { tenantId } = req;
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
        const { tenantId } = req;
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
        const { tenantId } = req;
        const { packageId, billingCycle } = req.body;
        
        if (!packageId || !billingCycle) {
            return res.status(400).json({
                success: false,
                message: 'Package ID and billing cycle are required'
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
        
        // Get current subscription
        const currentSubscription = await db.TenantSubscription.findOne({
            where: {
                tenantId,
                status: { [Op.in]: ['trial', 'active'] }
            }
        });
        
        // Calculate price based on billing cycle
        let amount = 0;
        switch (billingCycle) {
            case 'monthly':
                amount = newPackage.monthlyPrice;
                break;
            case 'sixMonth':
                amount = newPackage.sixMonthPrice;
                break;
            case 'annual':
                amount = newPackage.annualPrice;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid billing cycle'
                });
        }
        
        // Log activity for admin review
        await db.ActivityLog.create({
            actorType: 'tenant',
            actorId: tenantId,
            action: 'subscription_change_requested',
            resourceType: 'subscription',
            resourceId: currentSubscription?.id || null,
            details: {
                currentPackageId: currentSubscription?.packageId || null,
                requestedPackageId: packageId,
                requestedBillingCycle: billingCycle,
                amount
            }
        });
        
        res.json({
            success: true,
            message: 'Subscription change request received. Our team will contact you shortly.',
            estimatedAmount: amount
        });
    } catch (error) {
        console.error('Subscription change request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process subscription change request'
        });
    }
};

