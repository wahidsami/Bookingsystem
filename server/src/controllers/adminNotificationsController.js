const db = require('../models');

const listNotifications = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            unreadOnly,
            type,
            severity
        } = req.query;

        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const where = {};

        if (unreadOnly === 'true') {
            where.isRead = false;
        }

        if (type) {
            where.type = type;
        }

        if (severity) {
            where.severity = severity;
        }

        const [result, unreadCount] = await Promise.all([
            db.AdminNotification.findAndCountAll({
                where,
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset: (pageNumber - 1) * pageSize
            }),
            db.AdminNotification.count({
                where: { isRead: false }
            })
        ]);

        res.json({
            success: true,
            notifications: result.rows,
            unreadCount,
            pagination: {
                page: pageNumber,
                limit: pageSize,
                total: result.count,
                totalPages: Math.ceil(result.count / pageSize)
            }
        });
    } catch (error) {
        console.error('List admin notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await db.AdminNotification.count({
            where: { isRead: false }
        });

        res.json({
            success: true,
            unreadCount
        });
    } catch (error) {
        console.error('Get unread notification count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unread notification count'
        });
    }
};

const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await db.AdminNotification.findByPk(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (!notification.isRead) {
            await notification.update({
                isRead: true,
                readAt: new Date()
            });
        }

        res.json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Mark admin notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification'
        });
    }
};

const markAllNotificationsAsRead = async (req, res) => {
    try {
        await db.AdminNotification.update(
            {
                isRead: true,
                readAt: new Date()
            },
            {
                where: {
                    isRead: false
                }
            }
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Mark all admin notifications read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notifications'
        });
    }
};

module.exports = {
    listNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
};
