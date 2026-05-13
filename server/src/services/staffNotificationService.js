const db = require('../models');

const buildStaffAppointmentMessage = ({ customerName, serviceName, appointmentDate, action = 'assigned' }) => {
    if (action === 'reassigned') {
        return {
            subject: 'Appointment reassigned',
            body: `${customerName} was reassigned to ${serviceName} for ${appointmentDate}.`
        };
    }
    if (action === 'checked_in') {
        return {
            subject: 'Customer arrived',
            body: `${customerName} arrived for ${serviceName} (${appointmentDate}).`
        };
    }
    if (action === 'cancelled') {
        return {
            subject: 'Appointment cancelled',
            body: `${customerName} cancelled ${serviceName} (${appointmentDate}).`
        };
    }
    if (action === 'no_show') {
        return {
            subject: 'Customer marked as no-show',
            body: `${customerName} was marked as no-show for ${serviceName} (${appointmentDate}).`
        };
    }

    return {
        subject: 'New appointment assigned',
        body: `${customerName} booked ${serviceName} for ${appointmentDate}.`
    };
};

const createStaffAppointmentMessage = async ({
    tenantId,
    staffId,
    customerName,
    serviceName,
    appointmentDate,
    action = 'assigned'
}) => {
    if (!tenantId || !staffId) {
        return null;
    }

    const { subject, body } = buildStaffAppointmentMessage({
        customerName: customerName || 'A customer',
        serviceName: serviceName || 'service',
        appointmentDate: appointmentDate || '',
        action
    });

    return db.StaffMessage.create({
        tenantId,
        senderType: 'admin',
        senderId: tenantId,
        recipientType: 'staff',
        recipientId: staffId,
        subject,
        body,
        isPinned: false,
        readBy: []
    });
};

module.exports = {
    createStaffAppointmentMessage
};
