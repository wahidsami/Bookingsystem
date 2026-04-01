const { getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');

const checkResourceLimit = async (tenantId, resourceName, getCurrentCountFn) => {
    const result = await getActiveSubscriptionForTenant(tenantId, {
        statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE']
    });

    if (!result) {
        return {
            allowed: false,
            limit: 0,
            current: 0,
            packageName: 'None'
        };
    }

    const packageLimits = result.package?.limits || {};
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
