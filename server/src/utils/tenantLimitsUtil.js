const { ACTIVE_SUBSCRIPTION_STATUSES, getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');
const { normalizePackageEntitlements } = require('../utils/packageEntitlements');

const checkResourceLimit = async (tenantId, resourceName, getCurrentCountFn) => {
    const result = await getActiveSubscriptionForTenant(tenantId, {
        statuses: ACTIVE_SUBSCRIPTION_STATUSES
    });

    if (!result) {
        return {
            allowed: false,
            limit: 0,
            current: 0,
            packageName: 'None'
        };
    }

    const packageLimits = normalizePackageEntitlements(result.package?.limits || {});
    const limit = packageLimits[resourceName];
    const packageName = result.package?.name || 'Unknown';

    if (limit === -1) {
        return {
            allowed: true,
            limit: -1,
            current: await getCurrentCountFn(),
            packageName
        };
    }

    if (limit === undefined || limit === null) {
        return {
            allowed: false,
            limit: 0,
            current: await getCurrentCountFn(),
            packageName
        };
    }

    const current = await getCurrentCountFn();

    return {
        allowed: current < limit,
        limit,
        current,
        packageName
    };
};

module.exports = {
    checkResourceLimit
};
