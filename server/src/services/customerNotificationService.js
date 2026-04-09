'use strict';

const db = require('../models');
const pushNotificationService = require('./pushNotificationService');
const { getActiveSubscriptionForTenant } = require('./tenantSubscriptionService');

function getCurrentMonthKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeMediaUrl(value) {
    const candidate = `${value || ''}`.trim();
    if (!candidate) {
        return '';
    }

    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
        return candidate;
    }

    const baseUrl = (process.env.BASE_URL || process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
    const normalizedValue = candidate.replace(/\\/g, '/').replace(/^\/+/, '');
    const normalizedPath = normalizedValue.startsWith('uploads/')
        ? `/${normalizedValue}`
        : normalizedValue.startsWith('/uploads/')
            ? `/${normalizedValue.replace(/^\/+/, '')}`
            : `/uploads/${normalizedValue}`;
    return `${baseUrl}${normalizedPath}`;
}

function normalizeCustomerNotification(recipient) {
    const campaign = recipient?.campaign;
    const tenant = campaign?.tenant;
    const data = campaign?.data || {};

    return {
        id: recipient.id,
        campaignId: recipient.campaignId,
        title: campaign?.title || '',
        body: campaign?.body || '',
        imageUrl: normalizeMediaUrl(data.imageUrl || data.logoUrl || ''),
        linkType: data.linkType || 'tenant',
        tenantId: data.tenantId || tenant?.id || null,
        tenantName: tenant?.name_ar || tenant?.name_en || tenant?.name || null,
        tenantLogo: normalizeMediaUrl(tenant?.logo || ''),
        serviceId: data.serviceId || null,
        audienceType: campaign?.audienceType || 'selected',
        sentAt: campaign?.sentAt || recipient?.createdAt || null,
        createdAt: recipient?.createdAt || null,
        readAt: recipient?.readAt || null,
        data
    };
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
        return { success: false, skipped: true, reason: 'missing_user_id' };
    }

    return pushNotificationService.sendToUser(platformUserId, {
        title,
        body,
        data
    });
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
            return {
                sent: 0,
                limitReached: true,
                debug: {
                    requestedRecipients: uniqueUserIds.length,
                    attemptedRecipients: 0,
                    sentRecipients: 0,
                    skippedRecipients: 0,
                    failedRecipients: 0,
                    skippedReasons: {},
                    usageBeforeSend: usage.count || 0,
                    usageLimit: limit,
                    recipientResults: []
                }
            };
        }
    }

    let logoUrl = normalizeMediaUrl(data.logoUrl || '');
    const imageUrl = normalizeMediaUrl(data.imageUrl || '');
    if (!logoUrl) {
        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['logo']
        });
        if (tenant?.logo) {
            logoUrl = normalizeMediaUrl(tenant.logo);
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

    if (imageUrl) {
        payload.imageUrl = imageUrl;
    }

    if (payload.linkType === 'service' && payload.serviceId) {
        payload.screen = 'ServiceDetail';
    }

    let campaign = null;
    try {
        campaign = await db.TenantPushCampaign.create({
            tenantId,
            title,
            body,
            data: payload,
            audienceType: data.audienceType || 'selected',
            recipientCount: 0,
            sentAt: new Date()
        });
        payload.campaignId = String(campaign.id);
        await campaign.update({ data: payload });
    } catch (error) {
        console.error('[CustomerNotification] Failed to prepare push campaign:', error.message);
        campaign = null;
    }

    const sentToIds = [];
    const recipientResults = [];
    const skippedReasons = {};

    for (const platformUserId of uniqueUserIds) {
        const result = await sendToCustomer(platformUserId, title, body, payload);
        const success = !!result?.success;
        const reason = result?.reason || null;

        if (reason) {
            skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
        }

        recipientResults.push({
            platformUserId,
            success,
            skipped: !!result?.skipped,
            reason,
            error: result?.error || null,
            deviceCount: typeof result?.deviceCount === 'number' ? result.deviceCount : 0,
            tokenCount: typeof result?.tokenCount === 'number' ? result.tokenCount : 0,
            invalidTokenCount: typeof result?.invalidTokenCount === 'number' ? result.invalidTokenCount : 0,
            expoStatuses: Array.isArray(result?.response?.data)
                ? result.response.data.map((item) => item?.status).filter(Boolean)
                : []
        });

        if (success) {
            sentToIds.push(platformUserId);
        }
    }

    const sent = sentToIds.length;
    const skippedRecipients = recipientResults.filter((item) => item.skipped).length;
    const failedRecipients = recipientResults.filter((item) => !item.success && !item.skipped).length;

    if (limit !== -1 && sent > 0) {
        const [usage] = await db.TenantPushUsage.findOrCreate({
            where: { tenantId, month: monthKey },
            defaults: { tenantId, month: monthKey, count: 0 }
        });
        await usage.increment('count', { by: sent });
    }

    if (sent > 0 && campaign) {
        try {
            await campaign.update({
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
    } else if (campaign && sent === 0) {
        try {
            await campaign.destroy();
        } catch (error) {
            console.error('[CustomerNotification] Failed to cleanup empty push campaign:', error.message);
        }
    }

    return {
        sent,
        debug: {
            requestedRecipients: uniqueUserIds.length,
            attemptedRecipients: recipientResults.length,
            sentRecipients: sent,
            skippedRecipients,
            failedRecipients,
            skippedReasons,
            usageLimit: limit,
            recipientResults
        }
    };
}

module.exports = {
    sendToCustomer,
    getTenantPushUsage,
    sendTenantMarketingPush,
    normalizeCustomerNotification,
    async getUserNotifications(platformUserId, { page = 1, limit = 20 } = {}) {
        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const offset = (safePage - 1) * safeLimit;

        const { count, rows } = await db.TenantPushCampaignRecipient.findAndCountAll({
            where: { platformUserId },
            include: [{
                model: db.TenantPushCampaign,
                as: 'campaign',
                attributes: ['id', 'tenantId', 'title', 'body', 'data', 'audienceType', 'sentAt'],
                include: [{
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'logo'],
                    required: false
                }]
            }],
            order: [['createdAt', 'DESC']],
            limit: safeLimit,
            offset
        });

        const unreadCount = await db.TenantPushCampaignRecipient.count({
            where: {
                platformUserId,
                readAt: null
            }
        });

        return {
            notifications: rows.map(normalizeCustomerNotification),
            pagination: {
                total: count,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(count / safeLimit)
            },
            unreadCount
        };
    },
    async getUserNotificationById(platformUserId, recipientId) {
        const recipient = await db.TenantPushCampaignRecipient.findOne({
            where: {
                id: recipientId,
                platformUserId
            },
            include: [{
                model: db.TenantPushCampaign,
                as: 'campaign',
                attributes: ['id', 'tenantId', 'title', 'body', 'data', 'audienceType', 'sentAt'],
                include: [{
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'logo'],
                    required: false
                }]
            }]
        });

        return recipient ? normalizeCustomerNotification(recipient) : null;
    },
    async getUserNotificationByCampaignId(platformUserId, campaignId) {
        const recipient = await db.TenantPushCampaignRecipient.findOne({
            where: {
                platformUserId
            },
            include: [{
                model: db.TenantPushCampaign,
                as: 'campaign',
                where: { id: campaignId },
                attributes: ['id', 'tenantId', 'title', 'body', 'data', 'audienceType', 'sentAt'],
                include: [{
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'logo'],
                    required: false
                }]
            }],
            order: [['createdAt', 'DESC']]
        });

        return recipient ? normalizeCustomerNotification(recipient) : null;
    },
    async markUserNotificationRead(platformUserId, recipientId) {
        const recipient = await db.TenantPushCampaignRecipient.findOne({
            where: {
                id: recipientId,
                platformUserId
            }
        });

        if (!recipient) {
            return null;
        }

        if (!recipient.readAt) {
            await recipient.update({ readAt: new Date() });
        }

        return recipient;
    }
};
