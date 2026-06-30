'use strict';

const db = require('../models');
const { sendEmail } = require('../utils/emailService');

function normalizeDeliveryChannels(scheduleConfig = {}) {
    const channels = Array.isArray(scheduleConfig.deliveryChannels) ? scheduleConfig.deliveryChannels : [];
    const normalized = channels.map((value) => `${value}`.trim().toLowerCase()).filter(Boolean);
    return normalized.length > 0 ? normalized : ['email', 'dashboard_inbox'];
}

function normalizeExportFormats(scheduleConfig = {}) {
    const formats = Array.isArray(scheduleConfig.exportFormats) ? scheduleConfig.exportFormats : [];
    const normalized = formats.map((value) => `${value}`.trim().toLowerCase()).filter(Boolean);
    return normalized.length > 0 ? normalized : ['pdf', 'xlsx'];
}

function buildSummaryLine(preview) {
    return Object.entries(preview?.summary || {})
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${Number(value || 0).toLocaleString('en-US')}`)
        .join(' | ');
}

async function resolveRecipientEmails(recipients = []) {
    const normalized = Array.isArray(recipients)
        ? recipients.map((value) => `${value}`.trim()).filter(Boolean)
        : [];

    if (normalized.length === 0) return [];

    const emailRecipients = normalized.filter((value) => value.includes('@'));
    const userIds = normalized.filter((value) => !value.includes('@'));

    if (userIds.length === 0) return emailRecipients;

    const users = await db.PlatformUser.findAll({
        where: { id: userIds },
        attributes: ['id', 'email'],
        raw: true
    });

    const resolved = users.map((user) => user.email).filter(Boolean);
    return [...new Set([...emailRecipients, ...resolved])];
}

async function createDashboardInboxLog(savedReport, preview, recipientId, deliverySummary = {}) {
    if (!recipientId) {
        return { success: false, skipped: true, reason: 'missing_recipient' };
    }

    await db.NotificationDeliveryLog.create({
        eventType: 'scheduled_report_ready',
        recipientType: 'staff',
        recipientId,
        tenantId: savedReport.tenantId,
        channel: 'inbox',
        status: 'sent',
        payload: {
            reportId: savedReport.id,
            reportTitle: savedReport.title,
            deliverySummary,
            summary: preview?.summary || {},
            totals: preview?.totals || {}
        },
        response: {
            success: true
        }
    });

    return { success: true };
}

async function deliverTenantSavedReport(savedReport, preview, options = {}) {
    const scheduleConfig = savedReport.scheduleConfig || {};
    const deliveryChannels = normalizeDeliveryChannels(scheduleConfig);
    const exportFormats = normalizeExportFormats(scheduleConfig);
    const recipients = Array.isArray(scheduleConfig.recipients) ? scheduleConfig.recipients.filter(Boolean) : [];
    const deliverySummary = {
        channels: deliveryChannels,
        formats: exportFormats,
        recipients
    };

    const emailChannel = deliveryChannels.includes('email');
    const inboxChannel = deliveryChannels.includes('dashboard_inbox');

    let emailResult = { success: false, skipped: true, reason: 'not_requested' };
    let inboxResult = { success: false, skipped: true, reason: 'not_requested' };

    if (emailChannel) {
        const recipientEmails = await resolveRecipientEmails(recipients);
        if (recipientEmails.length > 0) {
            emailResult = await sendEmail({
                to: recipientEmails,
                subject: `Rifah scheduled report: ${savedReport.title}`,
                template: 'admin_report_delivery',
                data: {
                    reportTitle: savedReport.title,
                    generatedAt: new Date().toLocaleString('en-GB'),
                    summaryLine: buildSummaryLine(preview) || 'No summary data available.',
                    dashboardUrl: `${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000'}/dashboard/reports`,
                    rowCount: preview?.totals?.rows || 0,
                    recordCount: preview?.totals?.recordCount || 0
                }
            });
        } else {
            emailResult = { success: false, skipped: true, reason: 'no_email_recipients' };
        }
    }

    if (inboxChannel) {
        inboxResult = await createDashboardInboxLog(
            savedReport,
            preview,
            options.recipientId || savedReport.createdByUserId || null,
            deliverySummary
        );
    }

    return {
        success: Boolean(emailResult?.success || inboxResult?.success),
        email: emailResult,
        inbox: inboxResult,
        deliverySummary
    };
}

module.exports = {
    deliverTenantSavedReport,
    normalizeDeliveryChannels,
    normalizeExportFormats,
    resolveRecipientEmails
};
