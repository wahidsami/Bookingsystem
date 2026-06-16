const db = require('../models');

const DIRECT_PAYMENT_METHODS = new Set([
    'online',
    'cash',
    'card_pos',
    'wallet',
    'bank_transfer',
    'gift_card_code'
]);

const resolveLedgerPaymentMethod = (paymentMethod, fallbackSource = 'cash') => {
    if (DIRECT_PAYMENT_METHODS.has(paymentMethod)) {
        return paymentMethod;
    }

    if (['online-full', 'booking-fee', 'mock_online', 'mock_booking_fee', 'online'].includes(paymentMethod)
        || fallbackSource === 'online') {
        return 'online';
    }

    if (['pay_on_visit', 'cash_on_delivery', 'at-center', 'at_center', 'cash'].includes(paymentMethod)
        || ['pay_on_visit', 'cash_on_delivery', 'at-center', 'cash'].includes(fallbackSource)) {
        return 'cash';
    }

    return DIRECT_PAYMENT_METHODS.has(fallbackSource) ? fallbackSource : 'cash';
};

const buildTransactionPayload = ({
    appointmentId = null,
    orderId = null,
    type,
    amount,
    paymentMethod,
    fallbackSource,
    status = 'completed',
    processedBy = null,
    processedAt = new Date(),
    transactionRef = null,
    gatewayResponse = {},
    notes = null,
    metadata = {}
}) => {
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        return null;
    }

    return {
        appointmentId,
        orderId,
        type,
        amount: parseFloat(safeAmount.toFixed(2)),
        currency: 'SAR',
        paymentMethod: resolveLedgerPaymentMethod(paymentMethod, fallbackSource),
        status,
        transactionRef,
        gatewayResponse: gatewayResponse || {},
        processedBy,
        processedAt,
        metadata: metadata || {},
        notes
    };
};

const createAppointmentTransaction = async (paymentData, options = {}) => {
    const payload = buildTransactionPayload({
        ...paymentData,
        orderId: null
    });

    if (!payload) {
        return null;
    }

    return db.PaymentTransaction.create(payload, {
        transaction: options.transaction
    });
};

const createOrderTransaction = async (paymentData, options = {}) => {
    const payload = buildTransactionPayload({
        ...paymentData,
        appointmentId: null
    });

    if (!payload) {
        return null;
    }

    return db.PaymentTransaction.create(payload, {
        transaction: options.transaction
    });
};

module.exports = {
    resolveLedgerPaymentMethod,
    createAppointmentTransaction,
    createOrderTransaction
};
