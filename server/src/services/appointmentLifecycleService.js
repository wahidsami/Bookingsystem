'use strict';

const db = require('../models');
const notificationOrchestrator = require('./notificationOrchestratorService');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const { sendEmail } = require('../utils/emailService');
const { getServerPublicUrl } = require('../utils/url');

const formatAppointmentDate = (appointment) => {
    const date = new Date(appointment?.startTime || Date.now());
    if (Number.isNaN(date.getTime())) {
        return 'your appointment';
    }

    return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

const getCustomerName = (appointment) => {
    const firstName = appointment?.user?.firstName || '';
    const lastName = appointment?.user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'A customer';
};

const getServiceName = (appointment) => (
    appointment?.service?.name_en
    || appointment?.service?.name_ar
    || 'service'
);

const getDueAmount = (appointment) => {
    if (appointment?.paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID) {
        const remainder = Number.parseFloat(appointment?.remainderAmount ?? 0);
        return Number.isFinite(remainder) && remainder > 0 ? remainder : 0;
    }

    const price = Number.parseFloat(appointment?.price ?? 0);
    const totalPaid = Number.parseFloat(appointment?.totalPaid ?? 0);
    const due = price - totalPaid;

    return Number.isFinite(due) && due > 0 ? Number.parseFloat(due.toFixed(2)) : 0;
};

const sendCustomerUpdate = async (appointment, title, body, data = {}) => {
    if (!appointment?.platformUserId) {
        return { success: false, skipped: true, reason: 'missing_customer' };
    }

    const payload = {
        type: data.type || 'booking_update',
        appointmentId: appointment.id,
        tenantId: appointment.tenantId,
        staffId: appointment.staffId,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        ...data
    };

    return notificationOrchestrator.notifyCustomer({
        tenantId: appointment.tenantId,
        platformUserId: appointment.platformUserId,
        eventType: payload.type || 'booking_update',
        title,
        body,
        data: payload
    });
};

const sendStaffUpdate = async (appointment, title, body, data = {}) => {
    if (!appointment?.staffId) {
        return { success: false, skipped: true, reason: 'missing_staff' };
    }

    return notificationOrchestrator.notifyStaff({
        tenantId: appointment.tenantId,
        staffId: appointment.staffId,
        eventType: data.type || 'staff_update',
        title,
        body,
        data: {
            appointmentId: appointment.id,
            tenantId: appointment.tenantId,
            platformUserId: appointment.platformUserId,
            status: appointment.status,
            paymentStatus: appointment.paymentStatus,
            ...data
        }
    });
};

const notifyServiceStarted = async (appointment) => {
    const serviceName = getServiceName(appointment);
    const customerName = getCustomerName(appointment);
    const appointmentDate = formatAppointmentDate(appointment);

    const title = 'Service started';
    const body = `Your ${serviceName} service for ${appointmentDate} has started.`;

    await sendCustomerUpdate(appointment, title, body, {
        type: 'appointment_service_started',
        customerName,
        serviceName,
        scheduledAt: appointment.startTime
    });
};

const notifyServiceCompleted = async (appointment) => {
    const serviceName = getServiceName(appointment);
    const customerName = getCustomerName(appointment);
    const appointmentDate = formatAppointmentDate(appointment);
    const dueAmount = getDueAmount(appointment);
    const hasPaymentDue = dueAmount > 0;
    let effectiveServiceName = serviceName;
    let effectiveCustomerName = customerName;
    let tenantName = 'Refah';
    let googleReviewUrl = appointment?.tenant?.googleMapLink || appointment?.tenant?.mapUrl || '';
    let reviewLink = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1/bookings/${encodeURIComponent(appointment.id)}/review/open`;
    let userEmail = null;

    try {
        const contextAppointment = await db.Appointment.findByPk(appointment.id, {
            include: [
                { model: db.Service, as: 'service', attributes: ['id', 'name_en', 'name_ar'], required: false },
                { model: db.Staff, as: 'staff', attributes: ['id', 'name'], required: false },
                { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar', 'googleMapLink'], required: false }
            ]
        });

        if (contextAppointment) {
            effectiveServiceName = contextAppointment?.service?.name_en || contextAppointment?.service?.name_ar || serviceName;
            effectiveCustomerName = `${contextAppointment?.user?.firstName || ''} ${contextAppointment?.user?.lastName || ''}`.trim() || customerName;
            tenantName = contextAppointment?.tenant?.name || contextAppointment?.tenant?.name_en || contextAppointment?.tenant?.name_ar || tenantName;
            googleReviewUrl = contextAppointment?.tenant?.googleMapLink || contextAppointment?.tenant?.mapUrl || googleReviewUrl;
            reviewLink = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1/bookings/${encodeURIComponent(contextAppointment.id)}/review/open`;
            userEmail = contextAppointment?.user?.email || null;
        }
    } catch (lookupError) {
        console.warn('Review invite context warning:', lookupError.message);
    }

    const customerTitle = hasPaymentDue ? 'Payment due for completed service' : 'Service completed';
    const customerBody = hasPaymentDue
        ? `Your ${effectiveServiceName} service for ${appointmentDate} is complete. ${dueAmount.toFixed(2)} SAR remains due.`
        : `Your ${effectiveServiceName} service for ${appointmentDate} is complete. Thank you.`;

    try {
        await sendCustomerUpdate(appointment, customerTitle, customerBody, {
            type: hasPaymentDue ? 'appointment_payment_due' : 'appointment_service_completed',
            customerName: effectiveCustomerName,
            serviceName: effectiveServiceName,
            scheduledAt: appointment.startTime,
            dueAmount,
            googleReviewUrl,
            reviewTab: 'reviews'
        });
    } catch (customerNotificationError) {
        console.warn('Service completed customer notification warning:', customerNotificationError.message);
    }

    const staffTitle = hasPaymentDue ? 'Payment due after service completion' : 'Service completed and paid';
    const staffBody = hasPaymentDue
        ? `${effectiveCustomerName}'s ${effectiveServiceName} service is complete and ${dueAmount.toFixed(2)} SAR remains due.`
        : `${effectiveCustomerName}'s ${effectiveServiceName} service is complete and fully paid.`;

    try {
        await sendStaffUpdate(appointment, staffTitle, staffBody, {
            type: hasPaymentDue ? 'appointment_payment_due' : 'appointment_service_completed',
            customerName: effectiveCustomerName,
            serviceName: effectiveServiceName,
            dueAmount
        });
    } catch (staffNotificationError) {
        console.warn('Service completed staff notification warning:', staffNotificationError.message);
    }

    try {
        if (!userEmail) {
            console.warn('[AppointmentLifecycle] Review invite skipped: missing customer email', {
                appointmentId: appointment.id,
                bookingNumber: appointment.bookingNumber || null,
                tenantId: appointment.tenantId || null
            });
            return;
        }

        console.log('[AppointmentLifecycle] Sending review invite email', {
            appointmentId: appointment.id,
            bookingNumber: appointment.bookingNumber || null,
            tenantId: appointment.tenantId || null,
            customerEmail: userEmail,
            hasGoogleReviewUrl: Boolean(googleReviewUrl),
            hasReviewLink: Boolean(reviewLink)
        });

        await sendEmail({
            to: userEmail,
            subject: 'How was your service? Leave a quick review',
            template: 'customer_review_invite',
            data: {
                customerName: effectiveCustomerName,
                tenantName,
                serviceName: effectiveServiceName,
                appointmentDate,
                reviewLink,
                googleReviewUrl
            }
        });

        console.log('[AppointmentLifecycle] Review invite email sent', {
            appointmentId: appointment.id,
            bookingNumber: appointment.bookingNumber || null,
            tenantId: appointment.tenantId || null,
            customerEmail: userEmail
        });
    } catch (reviewInviteError) {
        console.warn('[AppointmentLifecycle] Review invite email warning:', reviewInviteError.message, {
            appointmentId: appointment.id,
            bookingNumber: appointment.bookingNumber || null,
            tenantId: appointment.tenantId || null,
            customerEmail: userEmail
        });
    }
};

const notifyPaymentCollected = async (appointment, {
    paymentStatus,
    paymentDelta = 0,
    paymentMethod = null,
    transactionRef = null
} = {}) => {
    const safeDelta = Number.parseFloat(paymentDelta || 0);
    if (!Number.isFinite(safeDelta) || safeDelta <= 0) {
        return { skipped: true, reason: 'no_payment_delta' };
    }

    const serviceName = getServiceName(appointment);
    const customerName = getCustomerName(appointment);
    const appointmentDate = formatAppointmentDate(appointment);

    const title = paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
        ? 'Payment received'
        : 'Payment updated';

    const body = paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
        ? `We received ${safeDelta.toFixed(2)} SAR for your ${serviceName} service on ${appointmentDate}. Thank you.`
        : `We received ${safeDelta.toFixed(2)} SAR for your ${serviceName} service on ${appointmentDate}.`;

    await sendCustomerUpdate(appointment, title, body, {
        type: 'appointment_payment_collected',
        customerName,
        serviceName,
        appointmentDate,
        paymentStatus,
        paymentMethod,
        transactionRef,
        paymentDelta: safeDelta
    });

    const staffTitle = paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
        ? 'Appointment fully paid'
        : 'Appointment payment updated';
    const staffBody = paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
        ? `${customerName}'s ${serviceName} service is fully paid.`
        : `${customerName}'s ${serviceName} service payment has been updated.`;

    await sendStaffUpdate(appointment, staffTitle, staffBody, {
        type: 'appointment_payment_collected',
        customerName,
        serviceName,
        paymentStatus,
        paymentMethod,
        transactionRef,
        paymentDelta: safeDelta
    });

    return { success: true };
};

module.exports = {
    formatAppointmentDate,
    getCustomerName,
    getServiceName,
    getDueAmount,
    notifyServiceStarted,
    notifyServiceCompleted,
    notifyPaymentCollected
};
