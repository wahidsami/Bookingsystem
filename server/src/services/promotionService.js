/**
 * Promotion Service
 * Handles package limit validation and promotional feature checks
 */

const db = require('../models');

/**
 * Get tenant's active subscription with package details
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object|null>} Subscription with package or null
 */
const getTenantSubscription = async (tenantId) => {
    const subscription = await db.TenantSubscription.findOne({
        where: {
            tenantId,
            status: 'active'
        },
        include: [{
            model: db.SubscriptionPackage,
            as: 'package',
            where: { isActive: true }
        }]
    });

    return subscription;
};

/**
 * Check if tenant can be featured in carousel
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} { allowed: boolean, priority: string }
 */
const canBeFeatured = async (tenantId) => {
    const subscription = await getTenantSubscription(tenantId);

    if (!subscription) {
        return { allowed: false, priority: null };
    }

    const limits = subscription.package.limits || {};
    const allowed = limits.featuredCarousel === true;
    const priority = limits.carouselPriority || 'low';

    return { allowed, priority };
};

/**
 * Check if tenant can create hot deals and how many
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} { allowed: boolean, maxDeals: number, currentDeals: number, autoApprove: boolean }
 */
const canCreateHotDeal = async (tenantId) => {
    const subscription = await getTenantSubscription(tenantId);

    if (!subscription) {
        return {
            allowed: false,
            reason: 'No active subscription',
            maxDeals: 0,
            currentDeals: 0,
            autoApprove: false
        };
    }

    const limits = subscription.package.limits || {};
    const maxDeals = limits.maxHotDeals || 0;

    if (maxDeals === 0) {
        return {
            allowed: false,
            reason: 'Hot deals not available in your package. Upgrade to create deals.',
            maxDeals: 0,
            currentDeals: 0,
            autoApprove: false
        };
    }

    // Count current active deals
    const currentDeals = await db.HotDeal.count({
        where: {
            tenantId,
            status: ['active', 'approved']
        }
    });

    // Check if limit reached (-1 = unlimited)
    if (maxDeals !== -1 && currentDeals >= maxDeals) {
        return {
            allowed: false,
            reason: `Maximum ${maxDeals} hot deals reached. Upgrade for more deals.`,
            maxDeals,
            currentDeals,
            autoApprove: false
        };
    }

    return {
        allowed: true,
        maxDeals,
        currentDeals,
        autoApprove: limits.hotDealsAutoApprove || false
    };
};

/**
 * Get tenant's search ranking boost level
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<string>} 'standard' | 'boosted' | 'top'
 */
const getSearchRankingBoost = async (tenantId) => {
    const subscription = await getTenantSubscription(tenantId);

    if (!subscription) {
        return 'standard';
    }

    const limits = subscription.package.limits || {};
    return limits.searchRankingBoost || 'standard';
};

/**
 * Check if tenant has access to a specific feature
 * @param {string} tenantId - Tenant UUID
 * @param {string} featureName - Feature key in limits object
 * @returns {Promise<boolean>}
 */
const hasFeature = async (tenantId, featureName) => {
    const subscription = await getTenantSubscription(tenantId);

    if (!subscription) {
        return false;
    }

    const limits = subscription.package.limits || {};
    return limits[featureName] === true;
};

/**
 * Get all promotional features for a tenant
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} All promotional features
 */
const getTenantFeatures = async (tenantId) => {
    const subscription = await getTenantSubscription(tenantId);

    if (!subscription) {
        return {
            packageName: 'None',
            featuredCarousel: false,
            carouselPriority: null,
            maxHotDeals: 0,
            hotDealsAutoApprove: false,
            searchRankingBoost: 'standard',
            homepageBanner: false,
            featuredProducts: 0,
            pushNotifications: false,
            emailMarketing: false,
            advancedAnalytics: false,
            prioritySupport: false
        };
    }

    const limits = subscription.package.limits || {};

    return {
        packageName: subscription.package.name,
        packageSlug: subscription.package.slug,
        featuredCarousel: limits.featuredCarousel || false,
        carouselPriority: limits.carouselPriority || null,
        maxHotDeals: limits.maxHotDeals || 0,
        hotDealsAutoApprove: limits.hotDealsAutoApprove || false,
        searchRankingBoost: limits.searchRankingBoost || 'standard',
        homepageBanner: limits.homepageBanner || false,
        featuredProducts: limits.featuredProducts || 0,
        pushNotifications: limits.pushNotifications || false,
        emailMarketing: limits.emailMarketing || false,
        advancedAnalytics: limits.advancedAnalytics || false,
        prioritySupport: limits.prioritySupport || false
    };
};

module.exports = {
    getTenantSubscription,
    canBeFeatured,
    canCreateHotDeal,
    getSearchRankingBoost,
    hasFeature,
    getTenantFeatures
};
