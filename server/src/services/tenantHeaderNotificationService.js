'use strict';

const db = require('../models');
const { Op, QueryTypes } = db.Sequelize;

const ALLOWED_MESSAGE_SENDER_TYPES = ['admin', 'system'];

function toText(value, fallback = '') {
    const candidate = `${value ?? ''}`.trim();
    return candidate || fallback;
}

function toTimestamp(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : new Date();
}

function humanize(value) {
    return toText(value, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\w/, (char) => char.toUpperCase());
}

function inferNotificationType(subject = '', body = '') {
    const text = `${subject} ${body}`.toLowerCase();

    if (/(appointment|booking|schedule|reschedule|check[-\s]?in|no[-\s]?show|cancel)/.test(text)) {
        return 'appointment';
    }

    if (/(stock|inventory|product|item|out of stock|low stock)/.test(text)) {
        return 'inventory';
    }

    if (/(review|rating|star)/.test(text)) {
        return 'review';
    }

    return 'system';
}

function formatRelativeTime(value, lang = 'en') {
    const timestamp = toTimestamp(value).getTime();
    const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

    if (diffMinutes < 1) {
        return lang === 'ar' ? 'الآن' : 'Just now';
    }

    if (diffMinutes < 60) {
        if (lang === 'ar') {
            return `قبل ${diffMinutes} دقيقة`;
        }

        return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
        if (lang === 'ar') {
            return `قبل ${diffHours} ساعة`;
        }

        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) {
        if (lang === 'ar') {
            return `قبل ${diffDays} يوم`;
        }

        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date(timestamp));
}

function normalizeReaderId(value) {
    return toText(value, '');
}

function normalizeNotificationRecord(message, readerId) {
    const subject = toText(message.subject, 'Notification');
    const body = toText(message.body, '');
    const readBy = Array.isArray(message.readBy) ? message.readBy.map((entry) => `${entry}`) : [];
    const unread = readerId ? !readBy.includes(readerId) : true;
    const type = inferNotificationType(subject, body);

    return {
        id: message.id,
        titleAr: subject,
        titleEn: subject,
        bodyAr: body,
        bodyEn: body,
        timeAr: formatRelativeTime(message.createdAt, 'ar'),
        timeEn: formatRelativeTime(message.createdAt, 'en'),
        type,
        unread,
        sourceType: 'staff_message',
        sourceId: message.id,
        createdAt: message.createdAt,
        isPinned: Boolean(message.isPinned),
        subject,
        body,
        metadata: {
            tenantId: message.tenantId,
            senderType: message.senderType,
            senderId: message.senderId,
            recipientType: message.recipientType,
            recipientId: message.recipientId
        }
    };
}

async function getTenantHeaderNotifications(tenantId, { readerId, page = 1, limit = 20 } = {}) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const normalizedReaderId = normalizeReaderId(readerId);
    const offset = (safePage - 1) * safeLimit;

    const where = {
        tenantId,
        senderType: { [Op.in]: ALLOWED_MESSAGE_SENDER_TYPES }
    };

    const [messages, totalRowsResult, unreadRowsResult, usageAlerts] = await Promise.all([
        db.StaffMessage.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: safeLimit,
            offset
        }),
        db.StaffMessage.count({ where }),
        normalizedReaderId
            ? db.sequelize.query(`
                SELECT COUNT(*)::int AS total
                FROM public.staff_messages
                WHERE tenant_id = :tenantId
                  AND sender_type IN (:senderTypes)
                  AND NOT (COALESCE(read_by, '[]'::jsonb) ? :readerId)
            `, {
                replacements: {
                    tenantId,
                    readerId: normalizedReaderId,
                    senderTypes: ALLOWED_MESSAGE_SENDER_TYPES
                },
                type: QueryTypes.SELECT
            })
            : Promise.resolve([{ total: 0 }]),
        db.UsageAlert.findAll({
            where: { tenantId, acknowledged: false },
            order: [['sentAt', 'DESC']],
            limit: safeLimit
        })
    ]);

    const formattedAlerts = usageAlerts.map(alert => ({
        id: alert.id,
        titleAr: alert.title_ar || alert.title,
        titleEn: alert.title,
        bodyAr: alert.message_ar || alert.message,
        bodyEn: alert.message,
        timeAr: formatRelativeTime(alert.sentAt, 'ar'),
        timeEn: formatRelativeTime(alert.sentAt, 'en'),
        type: 'system',
        unread: !alert.acknowledged,
        sourceType: 'alert',
        isPinned: false
    }));

    const notifications = [
        ...formattedAlerts,
        ...messages.map((message) => normalizeNotificationRecord(message, normalizedReaderId))
    ];

    // Sort combined by unread first, then by time DESC
    notifications.sort((a, b) => {
        if (a.unread && !b.unread) return -1;
        if (!a.unread && b.unread) return 1;
        return 0; // The original SQL sorting already handles time DESC relatively well within their groups
    });

    // Take only limit
    const finalNotifications = notifications.slice(0, safeLimit);

    const unreadCount = Number(unreadRowsResult?.[0]?.total || 0) + usageAlerts.length;
    const totalRows = Number(totalRowsResult || 0) + usageAlerts.length;

    return {
        notifications: finalNotifications,
        unreadCount,
        pagination: {
            page: safePage,
            limit: safeLimit,
            total: totalRows,
            totalPages: totalRows > 0 ? Math.ceil(totalRows / safeLimit) : 0
        }
    };
}

async function markTenantHeaderNotificationRead(tenantId, notificationId, readerId) {
    const normalizedReaderId = normalizeReaderId(readerId);

    // Check if it's an alert
    const alert = await db.UsageAlert.findOne({
        where: { id: notificationId, tenantId }
    });

    if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        await alert.save();
        return {
            id: alert.id,
            unread: false
        };
    }

    const message = await db.StaffMessage.findOne({
        where: {
            id: notificationId,
            tenantId,
            senderType: { [Op.in]: ALLOWED_MESSAGE_SENDER_TYPES }
        }
    });

    if (!message) {
        return null;
    }

    const readBy = Array.isArray(message.readBy) ? message.readBy.map((entry) => `${entry}`) : [];
    if (normalizedReaderId && !readBy.includes(normalizedReaderId)) {
        readBy.push(normalizedReaderId);
        await message.update({ readBy });
    }

    return normalizeNotificationRecord(message, normalizedReaderId);
}

async function markAllTenantHeaderNotificationsRead(tenantId, readerId) {
    const normalizedReaderId = normalizeReaderId(readerId);

    if (!normalizedReaderId) {
        return { updated: 0 };
    }

    await db.UsageAlert.update(
        { acknowledged: true, acknowledgedAt: new Date() },
        { where: { tenantId, acknowledged: false } }
    );

    const messages = await db.StaffMessage.findAll({
        where: {
            tenantId,
            senderType: { [Op.in]: ALLOWED_MESSAGE_SENDER_TYPES }
        }
    });

    const updatable = messages.filter((message) => {
        const readBy = Array.isArray(message.readBy) ? message.readBy.map((entry) => `${entry}`) : [];
        return !readBy.includes(normalizedReaderId);
    });

    await Promise.all(updatable.map(async (message) => {
        const readBy = Array.isArray(message.readBy) ? message.readBy.map((entry) => `${entry}`) : [];
        readBy.push(normalizedReaderId);
        await message.update({ readBy });
    }));

    return {
        updated: updatable.length
    };
}

module.exports = {
    getTenantHeaderNotifications,
    markTenantHeaderNotificationRead,
    markAllTenantHeaderNotificationsRead
};
