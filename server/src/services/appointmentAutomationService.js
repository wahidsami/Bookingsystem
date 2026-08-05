'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const { ACTIVE_APPOINTMENT_STATUSES, APPOINTMENT_STATUS } = require('../utils/appointmentStatus');
const customerNotificationService = require('./customerNotificationService');
const { collectAppointmentStatusCharge } = require('./splitPaymentService');

const DEFAULT_APPOINTMENT_NOTIFICATION_SETTINGS = Object.freeze({
    remindRemainderToCollect: true,
    appointmentGracePeriodMinutes: 5,
    autoMarkNoShowAfterGracePeriod: false,
    customerReminderEnabled: true,
    customerReminderMinutesBefore: 30
});

const normalizePositiveInteger = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return fallback;
    }

    if (typeof min === 'number' && parsed < min) {
        return min;
    }

    if (typeof max === 'number' && parsed > max) {
        return max;
    }

    return parsed;
};

const normalizeAppointmentNotificationSettings = (value = {}) => ({
    ...DEFAULT_APPOINTMENT_NOTIFICATION_SETTINGS,
    ...value,
    remindRemainderToCollect: value?.remindRemainderToCollect !== false,
    appointmentGracePeriodMinutes: normalizePositiveInteger(
        value?.appointmentGracePeriodMinutes,
        DEFAULT_APPOINTMENT_NOTIFICATION_SETTINGS.appointmentGracePeriodMinutes,
        1,
        240
    ),
    autoMarkNoShowAfterGracePeriod: value?.autoMarkNoShowAfterGracePeriod !== false,
    customerReminderEnabled: value?.customerReminderEnabled !== false,
    customerReminderMinutesBefore: normalizePositiveInteger(
        value?.customerReminderMinutesBefore,
        DEFAULT_APPOINTMENT_NOTIFICATION_SETTINGS.customerReminderMinutesBefore,
        5,
        1440
    )
});

const loadTenantNotificationSettingsMap = async (tenantIds = []) => {
    const uniqueTenantIds = [...new Set((tenantIds || []).filter(Boolean))];
    if (uniqueTenantIds.length === 0) {
        return new Map();
    }

    const rows = await db.TenantSettings.findAll({
        where: {
            tenantId: {
                [Op.in]: uniqueTenantIds
            }
        },
        attributes: ['tenantId', 'enableVoiceAlerts', 'notificationSettings']
    });

    const map = new Map();
    rows.forEach((row) => {
        map.set(String(row.tenantId), {
            enableVoiceAlerts: row.enableVoiceAlerts !== false,
            notificationSettings: normalizeAppointmentNotificationSettings(row.notificationSettings || {})
        });
    });

    return map;
};

const sendAppointmentReminder = async (appointment, settings, now = new Date()) => {
    if (!appointment.platformUserId || appointment.customerReminderSentAt) {
        return { sent: false, reason: 'not_eligible' };
    }

    if (!settings.customerReminderEnabled) {
        return { sent: false, reason: 'disabled' };
    }

    const startTime = new Date(appointment.startTime);
    const reminderWindowMs = settings.customerReminderMinutesBefore * 60 * 1000;
    const timeUntilStartMs = startTime.getTime() - now.getTime();

    if (timeUntilStartMs <= 0 || timeUntilStartMs > reminderWindowMs) {
        return { sent: false, reason: 'outside_window' };
    }

    const serviceName = appointment.service?.name_en || appointment.service?.name_ar || 'your appointment';
    const appointmentDate = new Date(appointment.startTime).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    const title = 'Appointment reminder';
    const body = `Your ${serviceName} appointment is scheduled for ${appointmentDate}.`;

    await customerNotificationService.sendCustomerInboxNotification(
        appointment.tenantId,
        appointment.platformUserId,
        title,
        body,
        {
            type: 'appointment_reminder',
            appointmentId: appointment.id,
            serviceId: appointment.serviceId,
            scheduledAt: appointment.startTime,
            minutesBefore: settings.customerReminderMinutesBefore,
            linkType: 'tenant'
        }
    );

    await appointment.update({ customerReminderSentAt: now });

    return { sent: true };
};

const autoMarkNoShowForAppointment = async (appointment, settings, now = new Date()) => {
    if (!settings.autoMarkNoShowAfterGracePeriod) {
        return { updated: false, reason: 'disabled' };
    }

    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
        return { updated: false, reason: 'inactive' };
    }

    const startTime = new Date(appointment.startTime);
    const overdueAt = startTime.getTime() + settings.appointmentGracePeriodMinutes * 60 * 1000;
    if (now.getTime() < overdueAt) {
        return { updated: false, reason: 'within_grace' };
    }

    if (appointment.status === APPOINTMENT_STATUS.NO_SHOW) {
        return { updated: false, reason: 'already_no_show' };
    }

    await appointment.update({
        status: APPOINTMENT_STATUS.NO_SHOW,
        noShowMarkedAt: now
    });

    const totalPrice = Number(appointment.price ?? 0);
    const totalPaid = Number(appointment.totalPaid ?? 0);
    const outstandingAmount = Math.max(0, Number((totalPrice - totalPaid).toFixed(2)));
    if (outstandingAmount > 0.01) {
        await collectAppointmentStatusCharge({
            appointmentId: appointment.id,
            amount: outstandingAmount,
            reason: 'No-show charge',
            source: 'tenant_automation_no_show_charge'
        });
    }

    if (appointment.platformUserId) {
        const serviceName = appointment.service?.name_en || appointment.service?.name_ar || 'your appointment';
        const appointmentDate = new Date(appointment.startTime).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        await customerNotificationService.sendCustomerInboxNotification(
            appointment.tenantId,
            appointment.platformUserId,
            'Appointment marked as no-show',
            `Your ${serviceName} appointment for ${appointmentDate} was not checked in within the allowed grace period and was marked as no-show.`,
            {
                type: 'appointment_no_show',
                appointmentId: appointment.id,
                serviceId: appointment.serviceId,
                scheduledAt: appointment.startTime,
                linkType: 'tenant'
            }
        );
    }

    return { updated: true };
};

const processAppointmentAutomation = async ({ now = new Date(), windowHours = 24 } = {}) => {
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

    const appointments = await db.Appointment.findAll({
        where: {
            status: { [Op.in]: ACTIVE_APPOINTMENT_STATUSES },
            startTime: { [Op.between]: [windowStart, windowEnd] }
        },
        attributes: [
            'id',
            'tenantId',
            'platformUserId',
            'serviceId',
            'status',
            'startTime',
            'customerReminderSentAt',
            'noShowMarkedAt'
        ],
        include: [
            {
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar'],
                required: false
            }
        ],
        order: [['startTime', 'ASC']]
    });

    if (appointments.length === 0) {
        return { remindersSent: 0, noShowsMarked: 0 };
    }

    const settingsMap = await loadTenantNotificationSettingsMap(appointments.map((appointment) => appointment.tenantId));
    let remindersSent = 0;
    let noShowsMarked = 0;

    for (const appointment of appointments) {
        const tenantSettings = settingsMap.get(String(appointment.tenantId));
        const settings = tenantSettings?.notificationSettings || normalizeAppointmentNotificationSettings();

        const reminderResult = await sendAppointmentReminder(appointment, settings, now);
        if (reminderResult.sent) {
            remindersSent += 1;
            continue;
        }

        const noShowResult = await autoMarkNoShowForAppointment(appointment, settings, now);
        if (noShowResult.updated) {
            noShowsMarked += 1;
        }
    }

    return { remindersSent, noShowsMarked };
};

module.exports = {
    DEFAULT_APPOINTMENT_NOTIFICATION_SETTINGS,
    normalizeAppointmentNotificationSettings,
    loadTenantNotificationSettingsMap,
    processAppointmentAutomation
};
