'use strict';

const db = require('../models');
const pushNotificationService = require('./pushNotificationService');
const { getActiveSubscriptionForTenant } = require('./tenantSubscriptionService');

function getCurrentMonthKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function resolvePushLimit(limits) {
    if (!limits || typeof limits !== 'object') {
        return 0;
    }

    const quota = limits.inAppMarketingNotifications;
    const parsed = typeof quota === 'number' ? quota : (typeof quota === 'string' ? parseInt(quota, 10) : NaN);
    if (!Number.isNaN(parsed)) {
        return parsed;
    }

    if (limits.pushNotifications === true) {
        return -1;
    }

    return 0;
}

async function sendToCustomer(platformUserId, title, body, data = {}) {
    if (!platformUserId) {
        return false;
    }

    const response = await pushNotificationService.sendToUser(platformUserId, {
        title,
        body,
        data
    });

    return !!response?.success;
}

async function getTenantPushUsage(tenantId) {
    const monthKey = getCurrentMonthKey();

    try {
        const subscription = await getActiveSubscriptionForTenant(tenantId, {
            statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE']
        });

        const limit = subscription?.package?.limits
            ? resolvePushLimit(subscription.package.limits)
            : 0;

        const usage = await db.TenantPushUsage.findOne({
            where: { tenantId, month: monthKey }
        });

        return {
            count: usage ? Number(usage.count) : 0,
            limit,
            month: monthKey
        };
    } catch (error) {
        console.error('[CustomerNotification] getTenantPushUsage error:', error.message);
        return {
            count: 0,
            limit: 0,
            month: monthKey
        };
    }
}

async function sendTenantMarketingPush(tenantId, platformUserIds, title, body, data = {}) {
    const monthKey = getCurrentMonthKey();
    const subscription = await getActiveSubscriptionForTenant(tenantId, {
        statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE']
    });
    const limit = subscription?.package?.limits
        ? resolvePushLimit(subscription.package.limits)
        : 0;

    const uniqueUserIds = [...new Set((platformUserIds || []).filter(Boolean))];

    if (limit !== -1) {
        const [usage] = await db.TenantPushUsage.findOrCreate({
            where: { tenantId, month: monthKey },
            defaults: { tenantId, month: monthKey, count: 0 }
        });

        if ((usage.count || 0) + uniqueUserIds.length > limit) {
            return { sent: 0, limitReached: true };
        }
    }

    let logoUrl = data.logoUrl || '';
    if (!logoUrl) {
        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['logo']
        });
        if (tenant?.logo) {
            const baseUrl = (process.env.BASE_URL || process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
            const path = tenant.logo.startsWith('/') ? tenant.logo : `/${tenant.logo}`;
            logoUrl = tenant.logo.startsWith('http') ? tenant.logo : `${baseUrl}${path}`;
        }
    }

    const payload = {
        type: 'MARKETING',
        tenantId: String(tenantId),
        screen: data.linkType === 'service' && data.serviceId ? 'ServiceDetail' : 'Tenant',
        linkType: data.linkType || 'tenant',
        ...data
    };

    if (logoUrl) {
        payload.logoUrl = logoUrl;
    }

    if (payload.linkType === 'service' && payload.serviceId) {
        payload.screen = 'ServiceDetail';
    }

    const sentToIds = [];
    for (const platformUserId of uniqueUserIds) {
        const sent = await sendToCustomer(platformUserId, title, body, payload);
        if (sent) {
            sentToIds.push(platformUserId);
        }
    }

    const sent = sentToIds.length;

    if (limit !== -1 && sent > 0) {
        const [usage] = await db.TenantPushUsage.findOrCreate({
            where: { tenantId, month: monthKey },
            defaults: { tenantId, month: monthKey, count: 0 }
        });
        await usage.increment('count', { by: sent });
    }

    if (sent > 0) {
        try {
            const campaign = await db.TenantPushCampaign.create({
                tenantId,
                title,
                body,
                data: payload,
                audienceType: data.audienceType || 'selected',
                recipientCount: sent,
                sentAt: new Date()
            });

            if (sentToIds.length > 0) {
                await db.TenantPushCampaignRecipient.bulkCreate(
                    sentToIds.map((platformUserId) => ({
                        campaignId: campaign.id,
                        platformUserId
                    }))
                );
            }
        } catch (error) {
            console.error('[CustomerNotification] Failed to record push campaign:', error.message);
        }
    }

    return { sent };
}

module.exports = {
    sendToCustomer,
    getTenantPushUsage,
    sendTenantMarketingPush
};
