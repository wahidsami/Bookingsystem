const { Op } = require('sequelize');
const db = require('../models');

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trial', 'past_due'];

async function getActiveSubscriptionForTenant(tenantId, options = {}) {
    if (!tenantId) return null;

    const statuses = options.statuses || ACTIVE_SUBSCRIPTION_STATUSES;

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

        if (!subscription || !subscription.package) {
            return null;
        }

        return {
            subscription,
            package: subscription.package
        };
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
    getActiveSubscriptionForTenant,
    getPackageLimitsForTenant
};
