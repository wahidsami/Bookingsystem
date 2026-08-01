const { Op } = require('sequelize');
const db = require('../models');
const { normalizePackageEntitlements } = require('../utils/packageEntitlements');

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trial', 'past_due'];
const LEGAL_SUBSCRIPTION_STATUSES = new Set(ACTIVE_SUBSCRIPTION_STATUSES);

function sanitizeSubscriptionStatuses(statuses = ACTIVE_SUBSCRIPTION_STATUSES) {
    const values = Array.isArray(statuses) ? statuses : [statuses];
    const sanitized = values
        .map((status) => (status == null ? null : String(status).trim()))
        .filter((status) => status && LEGAL_SUBSCRIPTION_STATUSES.has(status));

    return sanitized.length > 0 ? [...new Set(sanitized)] : ACTIVE_SUBSCRIPTION_STATUSES;
}

async function getPlanFallbackPackage(tenant) {
    const tenantPlan = tenant?.plan ? String(tenant.plan).trim() : '';
    if (!tenantPlan) return null;

    const planBase = tenantPlan.split('_')[0].trim();
    if (!planBase) return null;

    return db.SubscriptionPackage.findOne({
        where: {
            [Op.or]: [
                { slug: { [Op.iLike]: `%${planBase}%` } },
                { name: { [Op.iLike]: `%${planBase}%` } }
            ],
            isActive: true
        }
    });
}

async function buildCanonicalSubscriptionResult(subscription, tenant) {
    if (!subscription) {
        return null;
    }

    const tenantSettings = tenant?.id
        ? await db.TenantSettings.findOne({
            where: { tenantId: tenant.id },
            attributes: ['features']
        })
        : null;

    const planPackage = tenant ? await getPlanFallbackPackage(tenant) : null;
    const packageLimits = normalizePackageEntitlements(subscription.package?.limits || {});
    const tenantFeatures = normalizePackageEntitlements(tenantSettings?.features || {});
    const planFallbackLimits = normalizePackageEntitlements(planPackage?.limits || {});
    const resolvedLimits = normalizePackageEntitlements(
        planFallbackLimits,
        tenantFeatures,
        packageLimits
    );

    if (subscription.package) {
        subscription.package.limits = resolvedLimits;
    } else if (planPackage) {
        planPackage.limits = resolvedLimits;
        subscription.package = planPackage;
    }

    return {
        subscription,
        package: subscription.package || planPackage || null,
        limits: resolvedLimits,
        tenantFeatures,
        planPackage
    };
}

async function getActiveSubscriptionForTenant(tenantId, options = {}) {
    if (!tenantId) return null;

    const statuses = sanitizeSubscriptionStatuses(options.statuses || ACTIVE_SUBSCRIPTION_STATUSES);

    try {
        let subscription = await db.TenantSubscription.findOne({
            where: {
                tenantId,
                status: { [Op.in]: statuses }
            },
            include: [{ model: db.SubscriptionPackage, as: 'package' }],
            order: [['currentPeriodEnd', 'DESC']]
        });

        if (!subscription) {
            const tenant = await db.Tenant.findByPk(tenantId, {
                include: [{
                    model: db.TenantSubscription,
                    as: 'subscription',
                    required: false,
                    where: {
                        status: { [Op.in]: statuses }
                    },
                    include: [{ model: db.SubscriptionPackage, as: 'package' }]
                }]
            });
            subscription = tenant?.subscription || null;
        }

        if (!subscription) {
            return null;
        }

        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['id', 'plan']
        });

        return buildCanonicalSubscriptionResult(subscription, tenant);
    } catch (error) {
        console.error('[TenantSubscriptionService] getActiveSubscriptionForTenant error:', error.message);
        return null;
    }
}

async function getPackageLimitsForTenant(tenantId) {
    const result = await getActiveSubscriptionForTenant(tenantId);
    return result?.package?.limits || {};
}

module.exports = {
    ACTIVE_SUBSCRIPTION_STATUSES,
    sanitizeSubscriptionStatuses,
    getActiveSubscriptionForTenant,
    getPackageLimitsForTenant
};
