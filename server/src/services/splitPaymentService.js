/**
 * Split Payment Service
 * Extends existing paymentService to handle deposit + remainder workflows
 */

const db = require('../models');
const paymentService = require('./paymentService');
const {
    calculateServiceDeposit,
    getTenantPaymentSettings
} = require('../utils/tenantPaymentSettings');
const {
    createAppointmentTransaction,
    resolveLedgerPaymentMethod
} = require('./paymentTransactionLedgerService');
const { ensureAppointmentInvoice } = require('./customerInvoiceService');
const { sendCustomerInvoiceLifecycleEmail } = require('./customerInvoiceEmailService');

/**
 * Calculate deposit and remainder amounts based on tenant settings
 * @param {string} tenantId - Tenant UUID
 * @param {number} totalPrice - Total price
 * @returns {Promise<Object>} { depositAmount, remainderAmount, depositPercentage }
 */
const calculateSplitPayment = async (tenantId, totalPrice) => {
    const paymentSettings = await getTenantPaymentSettings(tenantId);
    return calculateServiceDeposit(totalPrice, paymentSettings);
};

/**
 * Record remainder payment (at salon)
 * @param {string} appointmentId - Appointment UUID
 * @param {Object} paymentData - { amount, paymentMethod, processedBy, notes, transactionRef }
 * @returns {Promise<Object>} Updated appointment
 */
const recordRemainderPayment = async (appointmentId, paymentData) => {
    const { amount, paymentMethod, processedBy, notes, transactionRef } = paymentData;

    const appointment = await db.Appointment.findByPk(appointmentId);
    if (!appointment) {
        throw new Error('Appointment not found');
    }

    if (!appointment.depositPaid) {
        throw new Error('Deposit must be paid before recording remainder');
    }

    if (appointment.remainderPaid) {
        throw new Error('Remainder already paid');
    }

    // Record transaction
    await createAppointmentTransaction({
        appointmentId,
        type: 'remainder',
        amount,
        paymentMethod,
        status: 'completed',
        transactionRef: transactionRef || `APT-REMAINDER-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`,
        processedBy,
        processedAt: new Date(),
        notes,
        metadata: {
            source: 'tenant_remainder_collection',
            previousPaymentStatus: appointment.paymentStatus,
            previousTotalPaid: parseFloat(appointment.totalPaid || 0),
            remainingBalanceBefore: parseFloat(appointment.remainderAmount || 0)
        }
    });

    // Update appointment
    const newTotalPaid = parseFloat(appointment.totalPaid) + parseFloat(amount);

    await appointment.update({
        remainderPaid: true,
        totalPaid: newTotalPaid,
        paymentStatus: 'fully_paid'
    });

    const invoice = await ensureAppointmentInvoice(appointment.id, {
        triggerSource: 'tenant_remainder_collection'
    });
    if (invoice?.id) {
        sendCustomerInvoiceLifecycleEmail(invoice.id).catch((error) => {
            console.warn('Remainder payment invoice email warning:', error.message);
        });
    }

    return appointment;
};

/**
 * Get payment summary for appointment
 * @param {string} appointmentId - Appointment UUID
 * @returns {Promise<Object>} Payment summary with transactions
 */
const getPaymentSummary = async (appointmentId) => {
    const appointment = await db.Appointment.findByPk(appointmentId, {
        include: [{
            model: db.PaymentTransaction,
            as: 'paymentTransactions',
            include: [{
                model: db.Staff,
                as: 'processor',
                attributes: ['id', 'name'],
                required: false
            }],
            order: [['processedAt', 'ASC']]
        }]
    });

    if (!appointment) {
        throw new Error('Appointment not found');
    }

    return {
        totalPrice: parseFloat(appointment.price),
        depositAmount: parseFloat(appointment.depositAmount),
        remainderAmount: parseFloat(appointment.remainderAmount),
        totalPaid: parseFloat(appointment.totalPaid),
        depositPaid: appointment.depositPaid,
        remainderPaid: appointment.remainderPaid,
        paymentStatus: appointment.paymentStatus,
        remainingBalance: parseFloat(appointment.price) - parseFloat(appointment.totalPaid),
        transactions: appointment.paymentTransactions || []
    };
};

/**
 * Refund appointment payment
 * @param {string} appointmentId - Appointment UUID
 * @param {Object} refundData - { amount, reason, processedBy }
 * @returns {Promise<Object>} Refund transaction
 */
const refundPayment = async (appointmentId, refundData) => {
    const { amount, reason, processedBy, transactionRef } = refundData;

    const appointment = await db.Appointment.findByPk(appointmentId);
    if (!appointment) {
        throw new Error('Appointment not found');
    }

    if (appointment.totalPaid === 0) {
        throw new Error('No payments to refund');
    }

    // Record refund transaction
    const transaction = await createAppointmentTransaction({
        appointmentId,
        type: 'refund',
        amount,
        paymentMethod: resolveLedgerPaymentMethod(appointment.paymentMethod, 'online'),
        status: 'refunded',
        transactionRef: transactionRef || `APT-REFUND-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`,
        processedBy,
        processedAt: new Date(),
        notes: reason,
        metadata: {
            source: 'appointment_refund',
            paymentStatusBefore: appointment.paymentStatus,
            totalPaidBefore: parseFloat(appointment.totalPaid || 0)
        }
    });

    // Update appointment
    const newTotalPaid = parseFloat(appointment.totalPaid) - parseFloat(amount);
    const isFullRefund = newTotalPaid === 0;

    await appointment.update({
        totalPaid: newTotalPaid,
        paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
        depositPaid: newTotalPaid >= appointment.depositAmount,
        remainderPaid: newTotalPaid >= parseFloat(appointment.price)
    });

    const invoice = await ensureAppointmentInvoice(appointment.id, {
        triggerSource: 'appointment_refund'
    });
    if (invoice?.id) {
        sendCustomerInvoiceLifecycleEmail(invoice.id).catch((error) => {
            console.warn('Refund invoice email warning:', error.message);
        });
    }

    return transaction;
};

module.exports = {
    calculateSplitPayment,
    recordRemainderPayment,
    getPaymentSummary,
    refundPayment
};
