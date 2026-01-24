/**
 * Split Payment Service
 * Extends existing paymentService to handle deposit + remainder workflows
 */

const db = require('../models');
const paymentService = require('./paymentService');

/**
 * Calculate deposit and remainder amounts based on tenant settings
 * @param {string} tenantId - Tenant UUID
 * @param {number} totalPrice - Total price
 * @returns {Promise<Object>} { depositAmount, remainderAmount, depositPercentage }
 */
const calculateSplitPayment = async (tenantId, totalPrice) => {
    // TODO: Get deposit percentage from tenant settings
    // For now, use default 25%
    const depositPercentage = 25;

    const price = parseFloat(totalPrice);
    const depositAmount = parseFloat((price * (depositPercentage / 100)).toFixed(2));
    const remainderAmount = parseFloat((price - depositAmount).toFixed(2));

    return {
        depositAmount,
        remainderAmount,
        depositPercentage
    };
};

/**
 * Record remainder payment (at salon)
 * @param {string} appointmentId - Appointment UUID
 * @param {Object} paymentData - { amount, paymentMethod, processedBy, notes }
 * @returns {Promise<Object>} Updated appointment
 */
const recordRemainderPayment = async (appointmentId, paymentData) => {
    const { amount, paymentMethod, processedBy, notes } = paymentData;

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
    await db.PaymentTransaction.create({
        appointmentId,
        type: 'remainder',
        amount,
        paymentMethod,
        status: 'completed',
        processedBy,
        processedAt: new Date(),
        notes
    });

    // Update appointment
    const newTotalPaid = parseFloat(appointment.totalPaid) + parseFloat(amount);

    await appointment.update({
        remainderPaid: true,
        totalPaid: newTotalPaid,
        paymentStatus: 'fully_paid'
    });

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
    const { amount, reason, processedBy } = refundData;

    const appointment = await db.Appointment.findByPk(appointmentId);
    if (!appointment) {
        throw new Error('Appointment not found');
    }

    if (appointment.totalPaid === 0) {
        throw new Error('No payments to refund');
    }

    // Record refund transaction
    const transaction = await db.PaymentTransaction.create({
        appointmentId,
        type: 'refund',
        amount,
        paymentMethod: 'online',
        status: 'completed',
        processedBy,
        processedAt: new Date(),
        notes: reason
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

    return transaction;
};

module.exports = {
    calculateSplitPayment,
    recordRemainderPayment,
    getPaymentSummary,
    refundPayment
};
