'use strict';

const tenantHeaderNotificationService = require('../services/tenantHeaderNotificationService');

const getReaderId = (req) => req.tenantAccountId || req.userId || null;

const listNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const payload = await tenantHeaderNotificationService.getTenantHeaderNotifications(req.tenantId, {
            readerId: getReaderId(req),
            page,
            limit
        });

        res.json({
            success: true,
            notifications: payload.notifications,
            unreadCount: payload.unreadCount,
            pagination: payload.pagination
        });
    } catch (error) {
        console.error('List tenant header notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const notification = await tenantHeaderNotificationService.markTenantHeaderNotificationRead(
            req.tenantId,
            req.params.id,
            getReaderId(req)
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Mark tenant header notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification'
        });
    }
};

const markAllNotificationsRead = async (req, res) => {
    try {
        const result = await tenantHeaderNotificationService.markAllTenantHeaderNotificationsRead(
            req.tenantId,
            getReaderId(req)
        );

        res.json({
            success: true,
            updated: result.updated
        });
    } catch (error) {
        console.error('Mark all tenant header notifications read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notifications'
        });
    }
};

module.exports = {
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead
};
