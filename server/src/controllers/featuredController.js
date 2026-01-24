/**
 * Featured Controller
 * Handles featured tenant carousel and promotional placements
 */

const db = require('../models');
const promotionService = require('../services/promotionService');

/**
 * Get featured tenants for mobile app carousel
 * GET /api/v1/featured-tenants
 */
const getFeaturedTenants = async (req, res) => {
    try {
        // Get all active subscriptions with featured carousel enabled
        const subscriptions = await db.TenantSubscription.findAll({
            where: { status: 'active' },
            include: [
                {
                    model: db.SubscriptionPackage,
                    as: 'package',
                    where: { isActive: true }
                },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    where: { status: 'approved' },
                    attributes: [
                        'id',
                        'businessNameEn',
                        'businessNameAr',
                        'slug',
                        'logo',
                        'bannerImage',
                        'description',
                        'description_ar',
                        'address',
                        'phone',
                        'rating'
                    ]
                }
            ]
        });

        // Filter tenants with featured carousel enabled and sort by priority
        const featuredTenants = subscriptions
            .filter(sub => {
                const limits = sub.package.limits || {};
                return limits.featuredCarousel === true;
            })
            .map(sub => {
                const limits = sub.package.limits || {};
                return {
                    tenant: sub.tenant,
                    priority: limits.carouselPriority || 'low',
                    packageName: sub.package.name
                };
            })
            .sort((a, b) => {
                // Sort by priority (high > medium > low)
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
            });

        res.json({
            success: true,
            tenants: featuredTenants.map(ft => ft.tenant),
            count: featuredTenants.length
        });
    } catch (error) {
        console.error('Get featured tenants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get featured tenants'
        });
    }
};

/**
 * Check if a specific tenant can be featured
 * GET /api/v1/tenant/featured-status
 */
const getTenantFeaturedStatus = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const featuredStatus = await promotionService.canBeFeatured(tenantId);
        const features = await promotionService.getTenantFeatures(tenantId);

        res.json({
            success: true,
            canBeFeatured: featuredStatus.allowed,
            priority: featuredStatus.priority,
            currentPackage: features.packageName,
            allFeatures: features
        });
    } catch (error) {
        console.error('Get tenant featured status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get featured status'
        });
    }
};

module.exports = {
    getFeaturedTenants,
    getTenantFeaturedStatus
};
