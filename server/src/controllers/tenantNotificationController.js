const { Op } = require('sequelize');
const db = require('../models');
const customerNotificationService = require('../services/customerNotificationService');
const path = require('path');
const fs = require('fs');

function parsePage(query) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

exports.getPushUsage = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        if (!tenantId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const usage = await customerNotificationService.getTenantPushUsage(tenantId);
        return res.json({ success: true, data: usage });
    } catch (error) {
        console.error('Get push usage error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendMarketingPush = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        if (!tenantId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { platformUserIds, audience, title, body, linkType, serviceId, imageUrl } = req.body;
        if (!title || typeof title !== 'string' || !body || typeof body !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'title and body are required'
            });
        }

        const pushData = {
            linkType: linkType || 'tenant',
            audienceType: audience === 'all_booked' ? 'all_booked' : 'selected',
            imageUrl: imageUrl || ''
        };

        if (serviceId && (linkType === 'service' || !linkType)) {
            const service = await db.Service.findOne({
                where: { id: serviceId, tenantId, isActive: true },
                attributes: ['id', 'hasGift', 'giftDetails']
            });

            if (!service) {
                return res.status(400).json({
                    success: false,
                    message: 'Service not found or does not belong to your tenant'
                });
            }

            pushData.linkType = 'service';
            pushData.serviceId = String(service.id);
            pushData.hasGift = service.hasGift ? 'true' : 'false';
            pushData.giftSummary = service.hasGift && service.giftDetails
                ? String(service.giftDetails).slice(0, 200)
                : '';
        }

        let userIds = Array.isArray(platformUserIds) ? platformUserIds : [];
        if (userIds.length > 0) {
            const normalizedInputIds = [...new Set(userIds.map((id) => `${id || ''}`.trim()).filter(Boolean))];

            const existingPlatformUsers = await db.PlatformUser.findAll({
                where: { id: { [Op.in]: normalizedInputIds } },
                attributes: ['id'],
                raw: true
            });

            const platformUserIdSet = new Set(existingPlatformUsers.map((row) => row.id).filter(Boolean));
            const unresolvedIds = normalizedInputIds.filter((id) => !platformUserIdSet.has(id));

            if (unresolvedIds.length > 0) {
                const matchedCustomers = await db.Customer.findAll({
                    where: { id: { [Op.in]: unresolvedIds } },
                    attributes: ['id', 'platformUserId'],
                    raw: true
                });

                matchedCustomers
                    .map((row) => row.platformUserId)
                    .filter(Boolean)
                    .forEach((id) => platformUserIdSet.add(id));
            }

            userIds = [...platformUserIdSet];
        }
        if (userIds.length === 0 && audience === 'all_booked') {
            const appointmentUserIds = await db.Appointment.findAll({
                where: { tenantId, platformUserId: { [Op.ne]: null } },
                attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('platformUserId')), 'platformUserId']],
                raw: true
            });

            const orderUserIds = await db.Order.findAll({
                where: { tenantId },
                attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('platformUserId')), 'platformUserId']],
                raw: true
            });

            const userIdSet = new Set([
                ...appointmentUserIds.map((row) => row.platformUserId).filter(Boolean),
                ...orderUserIds.map((row) => row.platformUserId).filter(Boolean)
            ]);
            userIds = [...userIdSet];
        }

        if (userIds.length === 0) {
            return res.json({
                success: true,
                message: 'No customers to send to',
                data: { sent: 0 },
                debug: {
                    requestedRecipients: 0,
                    attemptedRecipients: 0,
                    sentRecipients: 0,
                    skippedRecipients: 0,
                    failedRecipients: 0,
                    skippedReasons: {},
                    recipientResults: []
                }
            });
        }

        const result = await customerNotificationService.sendTenantMarketingPush(
            tenantId,
            userIds,
            title.trim(),
            body.trim(),
            pushData
        );

        if (result.limitReached) {
            return res.status(403).json({
                success: false,
                message: 'Monthly push limit reached. Upgrade your plan for more.',
                debug: result.debug || null
            });
        }

        return res.json({
            success: true,
            message: `Push sent to ${result.sent} customer(s)`,
            data: { sent: result.sent },
            debug: result.debug || null
        });
    } catch (error) {
        console.error('Send marketing push error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.uploadMarketingImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image uploaded'
            });
        }

        const relativePath = `uploads/tenants/notifications/${path.basename(req.file.path)}`;

        return res.json({
            success: true,
            message: 'Notification image uploaded successfully',
            data: {
                imageUrl: relativePath
            }
        });
    } catch (error) {
        console.error('Upload marketing image error:', error);

        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to upload notification image',
            error: error.message
        });
    }
};

exports.getPushHistory = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        if (!tenantId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { page, limit, offset } = parsePage(req.query);
        const { count, rows } = await db.TenantPushCampaign.findAndCountAll({
            where: { tenantId },
            order: [['sentAt', 'DESC']],
            limit,
            offset,
            attributes: ['id', 'title', 'body', 'data', 'audienceType', 'recipientCount', 'sentAt']
        });

        const campaigns = rows.map((campaign) => {
            const item = campaign.toJSON();
            item.bodyTruncated = item.body
                ? (item.body.length > 120 ? `${item.body.slice(0, 120)}...` : item.body)
                : '';
            return item;
        });

        return res.json({
            success: true,
            campaigns,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Get push history error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPushHistoryDetail = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const { id } = req.params;

        if (!tenantId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const campaign = await db.TenantPushCampaign.findOne({
            where: { id, tenantId },
            attributes: ['id', 'title', 'body', 'data', 'audienceType', 'recipientCount', 'sentAt']
        });

        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        return res.json({ success: true, campaign: campaign.toJSON() });
    } catch (error) {
        console.error('Get push history detail error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPushHistoryRecipients = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const { id } = req.params;

        if (!tenantId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const campaign = await db.TenantPushCampaign.findOne({
            where: { id, tenantId },
            attributes: ['id']
        });

        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        const recipients = await db.TenantPushCampaignRecipient.findAll({
            where: { campaignId: campaign.id },
            include: [{
                model: db.PlatformUser,
                as: 'platformUser',
                attributes: ['id', 'email', 'firstName', 'lastName'],
                required: false
            }],
            order: [['createdAt', 'ASC']]
        });

        return res.json({
            success: true,
            recipients: recipients.map((recipient) => ({
                platformUserId: recipient.platformUserId,
                email: recipient.platformUser?.email || null,
                firstName: recipient.platformUser?.firstName || null,
                lastName: recipient.platformUser?.lastName || null
            }))
        });
    } catch (error) {
        console.error('Get push history recipients error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDeliveryLogs = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        if (!tenantId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { page, limit, offset } = parsePage(req.query);
        const {
            recipientType,
            channel,
            status,
            eventType,
            recipientId,
            from,
            to
        } = req.query || {};

        const where = { tenantId };

        if (recipientType && ['customer', 'staff'].includes(String(recipientType))) {
            where.recipientType = String(recipientType);
        }
        if (channel && ['push', 'inbox', 'staff_message'].includes(String(channel))) {
            where.channel = String(channel);
        }
        if (status && ['queued', 'sent', 'failed', 'skipped'].includes(String(status))) {
            where.status = String(status);
        }
        if (eventType && typeof eventType === 'string') {
            where.eventType = { [Op.iLike]: `%${eventType.trim()}%` };
        }
        if (recipientId && typeof recipientId === 'string') {
            where.recipientId = recipientId.trim();
        }

        if (from || to) {
            where.createdAt = {};
            if (from) {
                const parsedFrom = new Date(from);
                if (!Number.isNaN(parsedFrom.getTime())) {
                    where.createdAt[Op.gte] = parsedFrom;
                }
            }
            if (to) {
                const parsedTo = new Date(to);
                if (!Number.isNaN(parsedTo.getTime())) {
                    where.createdAt[Op.lte] = parsedTo;
                }
            }
        }

        const { count, rows } = await db.NotificationDeliveryLog.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        const logs = rows.map((row) => row.toJSON());

        const statusGroups = await db.NotificationDeliveryLog.findAll({
            where,
            attributes: [
                'status',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        const channelGroups = await db.NotificationDeliveryLog.findAll({
            where,
            attributes: [
                'channel',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['channel'],
            raw: true
        });

        const summary = {
            total: count,
            byStatus: statusGroups.reduce((acc, item) => {
                acc[item.status] = Number(item.count || 0);
                return acc;
            }, {}),
            byChannel: channelGroups.reduce((acc, item) => {
                acc[item.channel] = Number(item.count || 0);
                return acc;
            }, {})
        };

        return res.json({
            success: true,
            logs,
            summary,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Get notification delivery logs error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
