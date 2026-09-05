const db = require('../models');
const { Op } = require('sequelize');
const { ACTIVE_SUBSCRIPTION_STATUSES, getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');
const {
    getFeatureKeys,
    isFeatureEnabled,
    normalizePackageEntitlements
} = require('../utils/packageEntitlements');

const loadSubscriptionContext = async (req) => {
    if (req.subscription && req.packageLimits) {
        return {
            subscription: req.subscription,
            packageLimits: req.packageLimits
        };
    }

    const result = await getActiveSubscriptionForTenant(req.tenantId, {
        statuses: ACTIVE_SUBSCRIPTION_STATUSES
    });

    if (!result?.subscription || !result?.package) {
        return null;
    }

    req.subscription = result.subscription;
    req.packageLimits = normalizePackageEntitlements(result.package.limits || {});

    return {
        subscription: req.subscription,
        packageLimits: req.packageLimits
    };
};

/**
 * Middleware to check if tenant has active subscription
 */
exports.requireActiveSubscription = async (req, res, next) => {
    try {
        const { tenantId } = req;
        
        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        const context = await loadSubscriptionContext(req);

        if (!context) {
            return res.status(403).json({
                success: false,
                message: 'No active subscription found. Please subscribe to continue.',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }

        const { subscription } = context;
        
        // Check if subscription has expired based on canonical resolver
        const effectiveStatus = subscription.getDataValue('effectiveStatus') || 'expired';

        if (effectiveStatus === 'expired') {
            return res.status(403).json({
                success: false,
                message: 'Your subscription has expired. Please renew to continue.',
                code: 'SUBSCRIPTION_EXPIRED'
            });
        }
        
        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify subscription'
        });
    }
};

/**
 * Middleware to check specific feature access
 */
exports.requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const context = await loadSubscriptionContext(req);

            if (!context?.packageLimits) {
                return res.status(403).json({
                    success: false,
                    message: 'Subscription information not found',
                    code: 'SUBSCRIPTION_REQUIRED'
                });
            }

            const normalizedPackageLimits = normalizePackageEntitlements(context.packageLimits || {});
            const featureKeys = getFeatureKeys(featureName);

            if (!featureKeys.some((featureKey) => isFeatureEnabled(normalizedPackageLimits[featureKey]))) {
                return res.status(403).json({
                    success: false,
                    message: `This feature (${featureName}) is not included in your current plan. Please upgrade to access it.`,
                    code: 'FEATURE_NOT_AVAILABLE',
                    feature: featureName,
                    upgradeRequired: true
                });
            }
            
            next();
        } catch (error) {
            console.error('Feature check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify feature access'
            });
        }
    };
};

/**
 * Middleware to check resource limit before creation
 */
exports.checkResourceLimit = (resourceType) => {
    return async (req, res, next) => {
        try {
            const { tenantId } = req;
            const context = await loadSubscriptionContext(req);

            if (!context?.packageLimits) {
                return res.status(403).json({
                    success: false,
                    message: 'Subscription information not found',
                    code: 'SUBSCRIPTION_REQUIRED'
                });
            }

            const { packageLimits } = context;

            // Define limit mapping
            const limitMap = {
                'booking': {
                    limitField: 'maxBookingsPerMonth',
                    displayName: 'Bookings',
                    getCurrentUsage: () => db.Appointment.count({
                        where: {
                            tenantId,
                            createdAt: {
                                [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                            }
                        }
                    })
                },
                'staff': {
                    limitField: 'maxStaff',
                    displayName: 'Staff Members',
                    getCurrentUsage: () => db.Staff.count({ where: { tenantId } })
                },
                'service': {
                    limitField: 'maxServices',
                    displayName: 'Services',
                    getCurrentUsage: () => db.Service.count({ where: { tenantId } })
                },
                'product': {
                    limitField: 'maxProducts',
                    displayName: 'Products',
                    getCurrentUsage: () => db.Product.count({ where: { tenantId } })
                }
            };
            
            const config = limitMap[resourceType];
            if (!config) {
                return next(); // Unknown resource type, skip check
            }
            
            const limit = packageLimits[config.limitField];

            // -1 means unlimited
            if (limit === -1) {
                return next();
            }

            if (limit === undefined || limit === null) {
                return res.status(403).json({
                    success: false,
                    message: `${config.displayName} limit is not configured for your current plan. Please contact support or upgrade your plan.`,
                    code: 'LIMIT_NOT_CONFIGURED',
                    resource: resourceType,
                    upgradeRequired: true
                });
            }
            
            // Check if limit reached
            const currentUsage = await config.getCurrentUsage();
            if (currentUsage >= limit) {
                // Send alert if not already sent
                await sendLimitAlert(tenantId, resourceType, currentUsage, limit);
                
                return res.status(403).json({
                    success: false,
                    message: `You have reached your ${config.displayName.toLowerCase()} limit (${limit}). Please upgrade your plan to add more.`,
                    code: 'LIMIT_REACHED',
                    resource: resourceType,
                    current: currentUsage,
                    limit: limit
                });
            }
            
            // Check for warning thresholds (80%, 95%)
            const percentage = (currentUsage / limit) * 100;
            if (percentage >= 80) {
                await sendWarningAlert(tenantId, resourceType, currentUsage, limit, percentage);
            }
            
            next();
        } catch (error) {
            console.error('Resource limit check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify resource limit'
            });
        }
    };
};

/**
 * Helper: Send limit reached alert
 */
async function sendLimitAlert(tenantId, resourceType, current, limit) {
    try {
        // Check if alert already sent recently (within 24 hours)
        const recentAlert = await db.UsageAlert.findOne({
            where: {
                tenantId,
                resourceType,
                alertType: 'limit_reached',
                sentAt: {
                    [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });
        
        if (recentAlert) return; // Don't spam alerts
        
        await db.UsageAlert.create({
            tenantId,
            alertType: 'limit_reached',
            resourceType,
            title: `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Limit Reached`,
            message: `You have reached your ${resourceType} limit of ${limit}. Please upgrade your plan to continue.`,
            title_ar: `تم الوصول إلى حد ${resourceType}`,
            message_ar: `لقد وصلت إلى حد ${resourceType} البالغ ${limit}. يرجى ترقية خطتك للمتابعة.`,
            currentValue: current,
            limitValue: limit,
            percentage: 100,
            priority: 'high',
            sentVia: ['in-app']
        });
    } catch (error) {
        console.error('Send limit alert error:', error);
    }
}

/**
 * Helper: Send warning alert
 */
async function sendWarningAlert(tenantId, resourceType, current, limit, percentage) {
    try {
        const alertType = percentage >= 95 ? 'warning_95' : 'warning_80';
        
        // Check if this level of alert already sent recently
        const recentAlert = await db.UsageAlert.findOne({
            where: {
                tenantId,
                resourceType,
                alertType,
                sentAt: {
                    [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });
        
        if (recentAlert) return;
        
        await db.UsageAlert.create({
            tenantId,
            alertType,
            resourceType,
            title: `${Math.round(percentage)}% of ${resourceType} limit used`,
            message: `You have used ${current} out of ${limit} ${resourceType}. Consider upgrading your plan soon.`,
            title_ar: `تم استخدام ${Math.round(percentage)}% من حد ${resourceType}`,
            message_ar: `لقد استخدمت ${current} من أصل ${limit} ${resourceType}. فكر في ترقية خطتك قريبًا.`,
            currentValue: current,
            limitValue: limit,
            percentage,
            priority: percentage >= 95 ? 'medium' : 'low',
            sentVia: ['in-app']
        });
    } catch (error) {
        console.error('Send warning alert error:', error);
    }
}

/**
 * Update usage after resource creation/deletion
 */
exports.updateUsage = async (tenantId, resourceType, increment = true) => {
    try {
        const currentPeriod = new Date().toISOString().substring(0, 7);
        
        let usage = await db.TenantUsage.findOne({ where: { tenantId } });
        
        if (!usage) {
            usage = await db.TenantUsage.create({
                tenantId,
                currentPeriod
            });
        }
        
        // Update appropriate counter
        const updates = {};
        switch (resourceType) {
            case 'booking':
                updates.bookingsThisMonth = increment ? 
                    usage.bookingsThisMonth + 1 : 
                    Math.max(0, usage.bookingsThisMonth - 1);
                updates.bookingsTotal = increment ? 
                    usage.bookingsTotal + 1 : 
                    usage.bookingsTotal;
                break;
            case 'staff':
                updates.activeStaff = increment ? 
                    usage.activeStaff + 1 : 
                    Math.max(0, usage.activeStaff - 1);
                break;
            case 'service':
                updates.activeServices = increment ? 
                    usage.activeServices + 1 : 
                    Math.max(0, usage.activeServices - 1);
                break;
            case 'product':
                updates.activeProducts = increment ? 
                    usage.activeProducts + 1 : 
                    Math.max(0, usage.activeProducts - 1);
                break;
        }
        
        await usage.update(updates);
        return usage;
    } catch (error) {
        console.error('Update usage error:', error);
        throw error;
    }
};

