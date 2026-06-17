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

const SUPPORTED_PAYMENT_METHODS = new Set([
    'online',
    'cash',
    'card_pos',
    'wallet',
    'bank_transfer',
    'gift_card_code'
]);

const normalizePaymentMethod = (method, fallbackSource = 'cash') => {
    const cleaned = `${method || ''}`.trim().toLowerCase();
    if (SUPPORTED_PAYMENT_METHODS.has(cleaned)) {
        return cleaned;
    }

    if (['online-full', 'booking-fee', 'mock_online', 'mock_booking_fee', 'online'].includes(cleaned)) {
        return 'online';
    }

    if (['pay_on_visit', 'cash_on_delivery', 'at-center', 'at_center', 'cash'].includes(cleaned)) {
        return 'cash';
    }

    if (SUPPORTED_PAYMENT_METHODS.has(`${fallbackSource || ''}`.trim().toLowerCase())) {
        return `${fallbackSource || ''}`.trim().toLowerCase();
    }

    return 'cash';
};

const normalizePaymentAllocations = ({ amount, paymentMethod, paymentAllocations, fallbackSource = 'cash' }) => {
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        throw new Error('Payment amount must be greater than zero');
    }

    const sourceAllocations = Array.isArray(paymentAllocations) && paymentAllocations.length > 0
        ? paymentAllocations
        : [{
            paymentMethod,
            amount: safeAmount
        }];

    const normalizedAllocations = sourceAllocations.map((allocation, index) => {
        const allocationAmount = Number(allocation?.amount);
        if (!Number.isFinite(allocationAmount) || allocationAmount <= 0) {
            throw new Error(`Invalid payment allocation amount at position ${index + 1}`);
        }

        const normalizedMethod = normalizePaymentMethod(
            allocation?.paymentMethod || paymentMethod || fallbackSource,
            fallbackSource
        );

        return {
            paymentMethod: normalizedMethod,
            amount: parseFloat(allocationAmount.toFixed(2)),
            giftCardCode: `${allocation?.giftCardCode || allocation?.giftCardCodeNumber || ''}`.trim() || null,
            notes: `${allocation?.notes || ''}`.trim() || null
        };
    });

    const totalAllocations = normalizedAllocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
    if (Math.abs(totalAllocations - safeAmount) > 0.01) {
        throw new Error('Payment allocations must add up to the payment amount');
    }

    return normalizedAllocations;
};

const decrementCustomerWalletBalance = async (appointment, amount, transaction) => {
    if (!appointment?.platformUserId) {
        throw new Error('Customer wallet account not found');
    }

    const walletUser = await db.PlatformUser.findByPk(appointment.platformUserId, {
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    if (!walletUser) {
        throw new Error('Customer wallet account not found');
    }

    const walletBalanceBefore = parseFloat(walletUser.walletBalance || 0);
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Invalid wallet amount');
    }

    if (walletBalanceBefore + 0.01 < numericAmount) {
        throw new Error('Insufficient wallet balance');
    }

    await walletUser.decrement('walletBalance', {
        by: numericAmount,
        transaction
    });
};

const createAppointmentPaymentTransactions = async ({
    appointment,
    type,
    amount,
    paymentMethod,
    paymentAllocations,
    processedBy = null,
    transactionRef = null,
    notes = null,
    source = 'tenant_dashboard_payment_collection',
    transaction = null
}) => {
    const allocations = normalizePaymentAllocations({
        amount,
        paymentMethod,
        paymentAllocations,
        fallbackSource: paymentMethod || appointment?.paymentMethod || 'cash'
    });

    const baseReference = `${transactionRef || `APT-PAY-${appointment?.bookingNumber || appointment?.id?.slice(0, 8)?.toUpperCase() || 'TX'}`}`.trim();

    for (let index = 0; index < allocations.length; index += 1) {
        const allocation = allocations[index];
        if (allocation.paymentMethod === 'wallet') {
            await decrementCustomerWalletBalance(appointment, allocation.amount, transaction);
        }
        await createAppointmentTransaction({
            appointmentId: appointment.id,
            type,
            amount: allocation.amount,
            paymentMethod: allocation.paymentMethod,
            status: 'completed',
            transactionRef: allocations.length > 1 ? `${baseReference}-${index + 1}` : baseReference,
            processedBy,
            processedAt: new Date(),
            notes: allocation.notes || notes,
            metadata: {
                source,
                paymentAllocation: allocation,
                paymentAllocations: allocations,
                paymentSummaryMethod: allocations.length > 1 ? 'split' : allocation.paymentMethod
            }
        }, { transaction });
    }

    return {
        allocations,
        paymentMethod: allocations.length > 1 ? 'split' : allocations[0]?.paymentMethod || paymentMethod || 'cash',
        totalAmount: allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
    };
};

/**
 * Record remainder payment (at salon)
 * @param {string} appointmentId - Appointment UUID
 * @param {Object} paymentData - { amount, paymentMethod, processedBy, notes, transactionRef }
 * @returns {Promise<Object>} Updated appointment
 */
const recordRemainderPayment = async (appointmentId, paymentData) => {
    const { amount, paymentMethod, paymentAllocations, processedBy, notes, transactionRef } = paymentData;

    return await db.sequelize.transaction(async (transaction) => {
        const appointment = await db.Appointment.findByPk(appointmentId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!appointment) {
            throw new Error('Appointment not found');
        }

        if (!appointment.depositPaid) {
            throw new Error('Deposit must be paid before recording remainder');
        }

        if (appointment.remainderPaid) {
            throw new Error('Remainder already paid');
        }

        const normalizedAllocations = normalizePaymentAllocations({
            amount,
            paymentMethod,
            paymentAllocations,
            fallbackSource: paymentMethod || appointment.paymentMethod || 'cash'
        });

        await createAppointmentPaymentTransactions({
            appointment,
            type: 'remainder',
            amount,
            paymentMethod: paymentMethod || appointment.paymentMethod || 'cash',
            paymentAllocations: normalizedAllocations,
            processedBy,
            transactionRef: transactionRef || `APT-REMAINDER-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`,
            notes,
            source: 'tenant_remainder_collection',
            transaction
        });

        const resolvedPaymentMethod = normalizedAllocations.length > 1
            ? 'split'
            : normalizedAllocations[0]?.paymentMethod || paymentMethod || appointment.paymentMethod || 'cash';
        const numericAmount = parseFloat(amount);
        const platformFee = parseFloat((numericAmount * 0.025).toFixed(2));
        const tenantRevenue = parseFloat((numericAmount - platformFee).toFixed(2));
        const paymentTransactionRef = transactionRef || `APT-REMAINDER-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`;

        await db.Transaction.create({
            platformUserId: appointment.platformUserId,
            tenantId: appointment.tenantId,
            appointmentId: appointment.id,
            amount: numericAmount,
            currency: 'SAR',
            type: 'booking',
            status: 'completed',
            platformFee,
            tenantRevenue,
            metadata: {
                source: 'tenant_remainder_collection',
                paymentMethod: resolvedPaymentMethod,
                paymentAllocations: normalizedAllocations,
                paymentTransactionRef,
                notes: notes || null
            }
        }, { transaction });

        const newTotalPaid = parseFloat(appointment.totalPaid) + numericAmount;
        await appointment.update({
            paymentMethod: resolvedPaymentMethod,
            remainderPaid: true,
            remainderAmount: 0,
            totalPaid: newTotalPaid,
            paymentStatus: 'fully_paid',
            paidAt: appointment.paidAt || new Date()
        }, { transaction });

        const invoice = await ensureAppointmentInvoice(appointment.id, {
            transaction,
            triggerSource: 'tenant_remainder_collection'
        });

        return {
            appointment,
            invoice,
            paymentTransactionRef
        };
    }).then(({ appointment: updatedAppointment, invoice }) => {
        if (invoice?.id) {
            sendCustomerInvoiceLifecycleEmail(invoice.id).catch((error) => {
                console.warn('Remainder payment invoice email warning:', error.message);
            });
        }

        return updatedAppointment;
    });
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
    const { amount, reason, processedBy, transactionRef, paymentMethod } = refundData;
    const normalizedMethod = `${paymentMethod || ''}`.trim().toLowerCase();

    return await db.sequelize.transaction(async (transaction) => {
        const appointment = await db.Appointment.findByPk(appointmentId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!appointment) {
            throw new Error('Appointment not found');
        }

        const numericAmount = parseFloat(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            throw new Error('Refund amount must be greater than zero');
        }
        if (numericAmount - parseFloat(appointment.totalPaid || 0) > 0.01) {
            throw new Error('Refund amount cannot exceed the amount already paid');
        }

        const resolvedPaymentMethod = resolveLedgerPaymentMethod(normalizedMethod || appointment.paymentMethod, 'online');
        const refundLedgerTransaction = await createAppointmentTransaction({
            appointmentId,
            type: 'refund',
            amount: numericAmount,
            paymentMethod: resolvedPaymentMethod,
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
        }, { transaction });

        if (resolvedPaymentMethod === 'wallet') {
            const walletUser = await db.PlatformUser.findByPk(appointment.platformUserId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!walletUser) {
                throw new Error('Customer wallet account not found');
            }

            await walletUser.increment('walletBalance', {
                by: numericAmount,
                transaction
            });
        }

        const platformFee = parseFloat((numericAmount * 0.025).toFixed(2));
        const tenantRevenue = parseFloat((numericAmount - platformFee).toFixed(2));
        const refundTransactionRef = transactionRef || `APT-REFUND-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`;

        await db.Transaction.create({
            platformUserId: appointment.platformUserId,
            tenantId: appointment.tenantId,
            appointmentId: appointment.id,
            amount: numericAmount,
            currency: 'SAR',
            type: 'refund',
            status: 'refunded',
            platformFee,
            tenantRevenue,
            metadata: {
                source: 'appointment_refund',
                paymentMethod: resolvedPaymentMethod,
                paymentTransactionRef: refundTransactionRef,
                refundAmount: numericAmount,
                notes: reason || null
            }
        }, { transaction });

        const newTotalPaid = parseFloat(appointment.totalPaid) - numericAmount;
        const isFullRefund = newTotalPaid === 0;

        await appointment.update({
            totalPaid: newTotalPaid,
            paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
            depositPaid: newTotalPaid >= appointment.depositAmount,
            remainderPaid: newTotalPaid >= parseFloat(appointment.price)
        }, { transaction });

        const invoice = await ensureAppointmentInvoice(appointment.id, {
            transaction,
            triggerSource: 'appointment_refund'
        });
        if (invoice?.id) {
            sendCustomerInvoiceLifecycleEmail(invoice.id).catch((error) => {
                console.warn('Refund invoice email warning:', error.message);
            });
        }

        return refundLedgerTransaction;
    });
};

module.exports = {
    calculateSplitPayment,
    createAppointmentPaymentTransactions,
    normalizePaymentAllocations,
    recordRemainderPayment,
    getPaymentSummary,
    refundPayment
};