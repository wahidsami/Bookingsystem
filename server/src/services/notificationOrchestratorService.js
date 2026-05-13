'use strict';

const db = require('../models');
const pushNotificationService = require('./pushNotificationService');

const toSafeText = (value, fallback = '') => {
    const candidate = `${value || ''}`.trim();
    return candidate || fallback;
};

const normalizeEventType = (value, fallback = 'system_notification') =>
    toSafeText(value, fallback).slice(0, 120);

const logDelivery = async ({
    eventType,
    recipientType,
    recipientId,
    tenantId = null,
    channel,
    status,
    reason = null,
    payload = {},
    response = {}
}) => {
    try {
        await db.NotificationDeliveryLog.create({
            eventType: normalizeEventType(eventType),
            recipientType,
            recipientId,
            tenantId,
            channel,
            status,
            reason,
            payload,
            response
        });
    } catch (error) {
        console.warn('[NotificationOrchestrator] failed to write delivery log:', error.message);
    }
};

const createCustomerInboxRecord = async ({
    tenantId,
    platformUserId,
    title,
    body,
    data = {}
}) => {
    if (!tenantId || !platformUserId) {
        return { success: false, skipped: true, reason: 'missing_recipient' };
    }

    const payload = {
        tenantId: String(tenantId),
        linkType: data.linkType || 'tenant',
        screen: data.linkType === 'service' && data.serviceId ? 'ServiceDetail' : 'Tenant',
        audienceType: 'selected',
        ...data
    };

    const campaign = await db.TenantPushCampaign.create({
        tenantId,
        title: toSafeText(title, 'Refah'),
        body: toSafeText(body, ''),
        data: payload,
        audienceType: 'selected',
        recipientCount: 1,
        sentAt: new Date()
    });

    payload.campaignId = String(campaign.id);
    await campaign.update({ data: payload });

    await db.TenantPushCampaignRecipient.create({
        campaignId: campaign.id,
        platformUserId
    });

    return {
        success: true,
        campaignId: campaign.id,
        payload
    };
};

const createStaffMessageRecord = async ({
    tenantId,
    staffId,
    title,
    body
}) => {
    if (!tenantId || !staffId) {
        return { success: false, skipped: true, reason: 'missing_recipient' };
    }

    const message = await db.StaffMessage.create({
        tenantId,
        senderType: 'system',
        senderId: null,
        recipientType: 'staff',
        recipientId: staffId,
        subject: toSafeText(title, 'Notification'),
        body: toSafeText(body, ''),
        isPinned: false,
        readBy: []
    });

    return {
        success: true,
        messageId: message.id
    };
};

const notifyCustomer = async ({
    tenantId,
    platformUserId,
    eventType,
    title,
    body,
    data = {}
}) => {
    const effectiveEventType = normalizeEventType(eventType, 'customer_notification');
    const effectiveTitle = toSafeText(title, 'Refah');
    const effectiveBody = toSafeText(body, '');
    const effectiveData = { ...data, type: data.type || effectiveEventType };

    let inboxResult = { success: false, skipped: true, reason: 'not_attempted' };
    let pushResult = { success: false, skipped: true, reason: 'not_attempted' };

    try {
        inboxResult = await createCustomerInboxRecord({
            tenantId,
            platformUserId,
            title: effectiveTitle,
            body: effectiveBody,
            data: effectiveData
        });
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'customer',
            recipientId: platformUserId,
            tenantId,
            channel: 'inbox',
            status: inboxResult.success ? 'sent' : (inboxResult.skipped ? 'skipped' : 'failed'),
            reason: inboxResult.reason || null,
            payload: effectiveData,
            response: inboxResult
        });
    } catch (error) {
        inboxResult = { success: false, skipped: false, reason: error.message };
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'customer',
            recipientId: platformUserId,
            tenantId,
            channel: 'inbox',
            status: 'failed',
            reason: error.message,
            payload: effectiveData
        });
    }

    try {
        pushResult = await pushNotificationService.sendToUser(platformUserId, {
            title: effectiveTitle,
            body: effectiveBody,
            data: effectiveData
        });
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'customer',
            recipientId: platformUserId,
            tenantId,
            channel: 'push',
            status: pushResult.success ? 'sent' : (pushResult.skipped ? 'skipped' : 'failed'),
            reason: pushResult.reason || null,
            payload: effectiveData,
            response: pushResult
        });
    } catch (error) {
        pushResult = { success: false, skipped: false, reason: error.message };
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'customer',
            recipientId: platformUserId,
            tenantId,
            channel: 'push',
            status: 'failed',
            reason: error.message,
            payload: effectiveData
        });
    }

    return {
        success: Boolean(inboxResult.success || pushResult.success),
        eventType: effectiveEventType,
        inbox: inboxResult,
        push: pushResult
    };
};

const notifyStaff = async ({
    tenantId,
    staffId,
    eventType,
    title,
    body,
    data = {}
}) => {
    const effectiveEventType = normalizeEventType(eventType, 'staff_notification');
    const effectiveTitle = toSafeText(title, 'Refah');
    const effectiveBody = toSafeText(body, '');
    const effectiveData = { ...data, type: data.type || effectiveEventType };

    let messageResult = { success: false, skipped: true, reason: 'not_attempted' };
    let pushResult = { success: false, skipped: true, reason: 'not_attempted' };

    try {
        messageResult = await createStaffMessageRecord({
            tenantId,
            staffId,
            title: effectiveTitle,
            body: effectiveBody
        });
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'staff',
            recipientId: staffId,
            tenantId,
            channel: 'staff_message',
            status: messageResult.success ? 'sent' : (messageResult.skipped ? 'skipped' : 'failed'),
            reason: messageResult.reason || null,
            payload: effectiveData,
            response: messageResult
        });
    } catch (error) {
        messageResult = { success: false, skipped: false, reason: error.message };
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'staff',
            recipientId: staffId,
            tenantId,
            channel: 'staff_message',
            status: 'failed',
            reason: error.message,
            payload: effectiveData
        });
    }

    try {
        pushResult = await pushNotificationService.sendToStaff(staffId, {
            title: effectiveTitle,
            body: effectiveBody,
            data: effectiveData
        });
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'staff',
            recipientId: staffId,
            tenantId,
            channel: 'push',
            status: pushResult.success ? 'sent' : (pushResult.skipped ? 'skipped' : 'failed'),
            reason: pushResult.reason || null,
            payload: effectiveData,
            response: pushResult
        });
    } catch (error) {
        pushResult = { success: false, skipped: false, reason: error.message };
        await logDelivery({
            eventType: effectiveEventType,
            recipientType: 'staff',
            recipientId: staffId,
            tenantId,
            channel: 'push',
            status: 'failed',
            reason: error.message,
            payload: effectiveData
        });
    }

    return {
        success: Boolean(messageResult.success || pushResult.success),
        eventType: effectiveEventType,
        staffMessage: messageResult,
        push: pushResult
    };
};

module.exports = {
    notifyCustomer,
    notifyStaff
};

