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
const walletService = require('./walletService');
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

    const roundMoney = (value) => Number.parseFloat(Number(value || 0).toFixed(2));

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
    const allocationDifference = roundMoney(safeAmount - totalAllocations);

    if (Math.abs(allocationDifference) > 0.5) {
        throw new Error('Payment allocations must add up to the payment amount');
    }

    if (Math.abs(allocationDifference) > 0.0001 && normalizedAllocations.length > 0) {
        const lastIndex = normalizedAllocations.length - 1;
        const adjustedLastAmount = roundMoney(Number(normalizedAllocations[lastIndex].amount || 0) + allocationDifference);
        if (adjustedLastAmount <= 0) {
            throw new Error('Payment allocations must add up to the payment amount');
        }

        normalizedAllocations[lastIndex] = {
            ...normalizedAllocations[lastIndex],
            amount: adjustedLastAmount
        };
    }

    return normalizedAllocations;
};

const roundMoney = (value) => parseFloat(Number(value || 0).toFixed(2));

const resolvePaymentAmount = (requestedAmount, fallbackAmount) => {
    const computedAmount = roundMoney(fallbackAmount);
    const numericRequestedAmount = Number(requestedAmount);

    if (!Number.isFinite(numericRequestedAmount) || numericRequestedAmount <= 0) {
        return computedAmount;
    }

    const normalizedRequestedAmount = roundMoney(numericRequestedAmount);
    if (Math.abs(normalizedRequestedAmount - computedAmount) <= 0.5) {
        return normalizedRequestedAmount;
    }

    return computedAmount;
};

const loadAppointmentPaymentContext = async (appointmentId, { transaction = null, lock = false } = {}) => {
    const appointment = await db.Appointment.findByPk(appointmentId, {
        transaction,
        lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
        include: [
            {
                model: db.Service,
                as: 'service',
                required: false
            },
            {
                model: db.PaymentTransaction,
                as: 'paymentTransactions',
                required: false,
                include: [{
                    model: db.Staff,
                    as: 'processor',
                    attributes: ['id', 'name'],
                    required: false
                }]
            },
            {
                model: db.BookingSession,
                as: 'bookingSession',
                required: false,
                include: [{
                    model: db.Appointment,
                    as: 'appointments',
                    required: false,
                    include: [
                        {
                            model: db.Service,
                            as: 'service',
                            required: false
                        },
                        {
                            model: db.PaymentTransaction,
                            as: 'paymentTransactions',
                            required: false,
                            include: [{
                                model: db.Staff,
                                as: 'processor',
                                attributes: ['id', 'name'],
                                required: false
                            }]
                        }
                    ]
                }]
            }
        ]
    });

    if (!appointment) {
        return null;
    }

    const sessionAppointments = Array.isArray(appointment.bookingSession?.appointments)
        ? appointment.bookingSession.appointments
            .filter((sessionAppointment) => sessionAppointment && `${sessionAppointment.status || ''}`.trim().toLowerCase() !== 'cancelled')
            .slice()
            .sort((left, right) => {
                const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
                const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
                if (leftIndex !== rightIndex) {
                    return leftIndex - rightIndex;
                }
                return new Date(left.startTime || 0) - new Date(right.startTime || 0);
            })
        : [];

    const appointments = sessionAppointments.length > 0 ? sessionAppointments : [appointment];

    return {
        appointment,
        bookingSession: appointment.bookingSession || null,
        appointments
    };
};

const getAppointmentDueAmount = (appointment) => {
    const totalAmount = Number(appointment?.price || 0);
    const totalPaid = Number(appointment?.totalPaid || 0);
    return roundMoney(Math.max(totalAmount - totalPaid, 0));
};

const buildPaymentSummaryFromAppointments = (appointments = [], fallbackAppointment = null) => {
    const sortedAppointments = Array.isArray(appointments)
        ? appointments.slice().sort((left, right) => {
            const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
            const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
            if (leftIndex !== rightIndex) {
                return leftIndex - rightIndex;
            }
            return new Date(left.startTime || 0) - new Date(right.startTime || 0);
        })
        : [];

    const sourceAppointments = sortedAppointments.length > 0 && sortedAppointments.some(Boolean)
        ? sortedAppointments
        : (fallbackAppointment ? [fallbackAppointment] : []);

    const transactions = sourceAppointments
        .flatMap((appointment) => Array.isArray(appointment?.paymentTransactions) ? appointment.paymentTransactions : [])
        .filter(Boolean)
        .slice()
        .sort((left, right) => new Date(left.processedAt || left.createdAt || 0) - new Date(right.processedAt || right.createdAt || 0));

    const totalPrice = roundMoney(sourceAppointments.reduce((sum, appointment) => sum + Number(appointment?.price || 0), 0));
    const depositAmount = roundMoney(sourceAppointments.reduce((sum, appointment) => sum + Number(appointment?.depositAmount || 0), 0));
    const remainderAmount = roundMoney(sourceAppointments.reduce((sum, appointment) => sum + Number(appointment?.remainderAmount || 0), 0));
    const totalPaid = roundMoney(sourceAppointments.reduce((sum, appointment) => sum + Number(appointment?.totalPaid || 0), 0));
    const remainingBalance = roundMoney(Math.max(totalPrice - totalPaid, 0));
    const allPaid = sourceAppointments.length > 0 && sourceAppointments.every((appointment) => Number(appointment?.totalPaid || 0) + 0.01 >= Number(appointment?.price || 0));
    const anyDepositPaid = sourceAppointments.some((appointment) => Boolean(appointment?.depositPaid));
    const allDepositPaid = sourceAppointments.length > 0 && sourceAppointments.every((appointment) => Boolean(appointment?.depositPaid));
    const allRemainderPaid = sourceAppointments.length > 0 && sourceAppointments.every((appointment) => Boolean(appointment?.remainderPaid));
    const paymentStatus = allPaid
        ? 'fully_paid'
        : (allDepositPaid || anyDepositPaid ? 'deposit_paid' : (fallbackAppointment?.paymentStatus || sourceAppointments[0]?.paymentStatus || 'pending'));

    return {
        totalPrice,
        depositAmount,
        remainderAmount,
        totalPaid,
        depositPaid: allDepositPaid || anyDepositPaid,
        remainderPaid: allRemainderPaid,
        paymentStatus,
        remainingBalance,
        transactions
    };
};

const decrementCustomerWalletBalance = async (appointment, amount, transaction) => {
    if (!appointment?.platformUserId) {
        throw new Error('Customer wallet account not found');
    }
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Invalid wallet amount');
    }

    await walletService.debitWallet({
        platformUserId: appointment.platformUserId,
        amount: numericAmount,
        type: 'service_payment_debit',
        referenceType: 'appointment',
        referenceId: appointment.id,
        metadata: {
            source: 'tenant_dashboard_payment_collection',
            appointmentId: appointment.id
        },
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
        const context = await loadAppointmentPaymentContext(appointmentId, {
            transaction,
            lock: true
        });
        if (!context?.appointment) {
            throw new Error('Appointment not found');
        }

        const { appointment, bookingSession, appointments: sessionAppointments } = context;

        if (!appointment.depositPaid) {
            throw new Error('Deposit must be paid before recording remainder');
        }

        const paymentSource = paymentMethod || bookingSession?.paymentMethod || appointment.paymentMethod || 'cash';
        const payableSessionAppointments = sessionAppointments
            .map((sessionAppointment) => ({
                appointment: sessionAppointment,
                dueAmount: getAppointmentDueAmount(sessionAppointment)
            }))
            .filter((entry) => entry.dueAmount > 0.009);
        const hasSessionCheckout = Boolean(bookingSession?.id && payableSessionAppointments.length > 1);

        if (hasSessionCheckout) {
            const sessionDueAmount = roundMoney(
                payableSessionAppointments.reduce((sum, entry) => sum + entry.dueAmount, 0)
            );
            const paymentAmount = resolvePaymentAmount(amount, sessionDueAmount);
            const normalizedSessionPaymentAllocations = normalizePaymentAllocations({
                amount: paymentAmount,
                paymentMethod,
                paymentAllocations,
                fallbackSource: paymentSource
            });
            const allocationBuckets = normalizedSessionPaymentAllocations.map((allocation) => ({
                ...allocation,
                remaining: roundMoney(allocation.amount)
            }));

            const allocateForAppointment = (targetAmount) => {
                let remainingTarget = roundMoney(targetAmount);
                const assignedAllocations = [];

                for (const bucket of allocationBuckets) {
                    if (remainingTarget <= 0) {
                        break;
                    }

                    const allocationAmount = Math.min(bucket.remaining, remainingTarget);
                    if (allocationAmount <= 0) {
                        continue;
                    }

                    assignedAllocations.push({
                        ...bucket,
                        amount: roundMoney(allocationAmount)
                    });
                    bucket.remaining = roundMoney(bucket.remaining - allocationAmount);
                    remainingTarget = roundMoney(remainingTarget - allocationAmount);
                }

                if (remainingTarget > 0.01) {
                    throw new Error('Payment allocations must add up to the payment amount');
                }

                return assignedAllocations.filter((allocation) => allocation.amount > 0);
            };

            const sessionTransactionRefBase = transactionRef || `APT-REMAINDER-${bookingSession.bookingReference || appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`;

            for (let index = 0; index < payableSessionAppointments.length; index += 1) {
                const target = payableSessionAppointments[index];
                const targetAppointment = target.appointment;
                const targetAllocations = allocateForAppointment(target.dueAmount);
                const resolvedPaymentMethod = targetAllocations.length > 1
                    ? 'split'
                    : targetAllocations[0]?.paymentMethod || paymentSource;

                await createAppointmentPaymentTransactions({
                    appointment: targetAppointment,
                    type: 'remainder',
                    amount: target.dueAmount,
                    paymentMethod: resolvedPaymentMethod,
                    paymentAllocations: targetAllocations,
                    processedBy,
                    transactionRef: payableSessionAppointments.length > 1
                        ? `${sessionTransactionRefBase}-${index + 1}`
                        : sessionTransactionRefBase,
                    notes,
                    source: 'tenant_remainder_collection',
                    transaction
                });

                const numericAmount = roundMoney(target.dueAmount);
                const platformFee = roundMoney(numericAmount * 0.025);
                const tenantRevenue = roundMoney(numericAmount - platformFee);

                await db.Transaction.create({
                    platformUserId: targetAppointment.platformUserId,
                    tenantId: targetAppointment.tenantId,
                    appointmentId: targetAppointment.id,
                    amount: numericAmount,
                    currency: 'SAR',
                    type: 'booking',
                    status: 'completed',
                    platformFee,
                    tenantRevenue,
                    metadata: {
                        source: 'tenant_remainder_collection',
                        bookingSessionId: bookingSession.id,
                        paymentMethod: resolvedPaymentMethod,
                        paymentAllocations: targetAllocations,
                        paymentTransactionRef: payableSessionAppointments.length > 1
                            ? `${sessionTransactionRefBase}-${index + 1}`
                            : sessionTransactionRefBase,
                        notes: notes || null
                    }
                }, { transaction });

                const newTotalPaid = roundMoney(Number(targetAppointment.totalPaid || 0) + numericAmount);
                await targetAppointment.update({
                    paymentMethod: resolvedPaymentMethod,
                    remainderPaid: true,
                    remainderAmount: 0,
                    totalPaid: newTotalPaid,
                    paymentStatus: newTotalPaid + 0.01 >= roundMoney(targetAppointment.price) ? 'fully_paid' : 'deposit_paid',
                    paidAt: targetAppointment.paidAt || new Date()
                }, { transaction });
            }

            await bookingSession.update({
                paymentMethod: paymentSource,
                status: 'completed'
            }, { transaction });

            const invoice = await ensureAppointmentInvoice(appointment.id, {
                transaction,
                triggerSource: 'tenant_remainder_collection'
            });

            return {
                appointment,
                invoice,
                paymentTransactionRef: sessionTransactionRefBase
            };
        }

        if (appointment.remainderPaid) {
            throw new Error('Remainder already paid');
        }

        const normalizedAllocations = normalizePaymentAllocations({
            amount,
            paymentMethod,
            paymentAllocations,
            fallbackSource: paymentSource
        });

        await createAppointmentPaymentTransactions({
            appointment,
            type: 'remainder',
            amount,
            paymentMethod: paymentSource,
            paymentAllocations: normalizedAllocations,
            processedBy,
            transactionRef: transactionRef || `APT-REMAINDER-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`,
            notes,
            source: 'tenant_remainder_collection',
            transaction
        });

        const resolvedPaymentMethod = normalizedAllocations.length > 1
            ? 'split'
            : normalizedAllocations[0]?.paymentMethod || paymentSource;
        const numericAmount = parseFloat(amount);
        const platformFee = roundMoney(numericAmount * 0.025);
        const tenantRevenue = roundMoney(numericAmount - platformFee);
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

        const newTotalPaid = roundMoney(Number(appointment.totalPaid || 0) + numericAmount);
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
    const context = await loadAppointmentPaymentContext(appointmentId);
    if (!context?.appointment) {
        throw new Error('Appointment not found');
    }

    const { appointment, appointments: sessionAppointments } = context;
    const summary = buildPaymentSummaryFromAppointments(sessionAppointments, appointment);

    return {
        totalPrice: summary.totalPrice,
        depositAmount: summary.depositAmount,
        remainderAmount: summary.remainderAmount,
        totalPaid: summary.totalPaid,
        depositPaid: summary.depositPaid,
        remainderPaid: summary.remainderPaid,
        paymentStatus: summary.paymentStatus,
        remainingBalance: summary.remainingBalance,
        transactions: summary.transactions
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
        const context = await loadAppointmentPaymentContext(appointmentId, {
            transaction,
            lock: true
        });
        if (!context?.appointment) {
            throw new Error('Appointment not found');
        }

        const { appointment, bookingSession, appointments: sessionAppointments } = context;

        const numericAmount = parseFloat(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            throw new Error('Refund amount must be greater than zero');
        }

        const resolvedPaymentMethod = resolveLedgerPaymentMethod(normalizedMethod || appointment.paymentMethod, 'online');
        const totalPaidAcrossContext = roundMoney(
            sessionAppointments.reduce((sum, sessionAppointment) => sum + Number(sessionAppointment.totalPaid || 0), 0)
        );
        if (numericAmount - totalPaidAcrossContext > 0.01) {
            throw new Error('Refund amount cannot exceed the amount already paid');
        }

        const refundTransactionRef = transactionRef || `APT-REFUND-${bookingSession?.bookingReference || appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`;

        const targetAppointments = bookingSession?.id && sessionAppointments.length > 1
            ? sessionAppointments
                .map((sessionAppointment) => ({
                    appointment: sessionAppointment,
                    refundableAmount: roundMoney(Number(sessionAppointment.totalPaid || 0))
                }))
                .filter((entry) => entry.refundableAmount > 0)
            : [{
                appointment,
                refundableAmount: roundMoney(Number(appointment.totalPaid || 0))
            }];

        let remainingRefund = roundMoney(numericAmount);
        let refundLedgerTransaction = null;

        for (let index = 0; index < targetAppointments.length; index += 1) {
            if (remainingRefund <= 0) {
                break;
            }

            const target = targetAppointments[index];
            const targetAppointment = target.appointment;
            const targetRefund = roundMoney(Math.min(target.refundableAmount, remainingRefund));
            if (targetRefund <= 0) {
                continue;
            }

            refundLedgerTransaction = await createAppointmentTransaction({
                appointmentId: targetAppointment.id,
                type: 'refund',
                amount: targetRefund,
                paymentMethod: resolvedPaymentMethod,
                status: 'refunded',
                transactionRef: targetAppointments.length > 1
                    ? `${refundTransactionRef}-${index + 1}`
                    : refundTransactionRef,
                processedBy,
                processedAt: new Date(),
                notes: reason,
                metadata: {
                    source: 'appointment_refund',
                    paymentStatusBefore: targetAppointment.paymentStatus,
                    totalPaidBefore: roundMoney(Number(targetAppointment.totalPaid || 0))
                }
            }, { transaction });

            if (resolvedPaymentMethod === 'wallet') {
                await walletService.creditWallet({
                    platformUserId: targetAppointment.platformUserId,
                    amount: targetRefund,
                    type: 'refund_credit',
                    referenceType: 'appointment',
                    referenceId: targetAppointment.id,
                    metadata: {
                        source: 'appointment_refund',
                        paymentMethod: resolvedPaymentMethod,
                        paymentTransactionRef: targetAppointments.length > 1
                            ? `${refundTransactionRef}-${index + 1}`
                            : refundTransactionRef,
                        refundAmount: targetRefund,
                        notes: reason || null,
                        bookingSessionId: bookingSession?.id || null
                    },
                    transaction
                });
            }

            const platformFee = roundMoney(targetRefund * 0.025);
            const tenantRevenue = roundMoney(targetRefund - platformFee);

            await db.Transaction.create({
                platformUserId: targetAppointment.platformUserId,
                tenantId: targetAppointment.tenantId,
                appointmentId: targetAppointment.id,
                amount: targetRefund,
                currency: 'SAR',
                type: 'refund',
                status: 'refunded',
                platformFee,
                tenantRevenue,
                metadata: {
                    source: 'appointment_refund',
                    paymentMethod: resolvedPaymentMethod,
                    paymentTransactionRef: targetAppointments.length > 1
                        ? `${refundTransactionRef}-${index + 1}`
                        : refundTransactionRef,
                    refundAmount: targetRefund,
                    notes: reason || null,
                    bookingSessionId: bookingSession?.id || null
                }
            }, { transaction });

            const newTotalPaid = roundMoney(Number(targetAppointment.totalPaid || 0) - targetRefund);
            const isFullRefund = newTotalPaid <= 0;

            await targetAppointment.update({
                totalPaid: newTotalPaid,
                paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
                depositPaid: newTotalPaid >= Number(targetAppointment.depositAmount || 0),
                remainderPaid: newTotalPaid >= Number(targetAppointment.price || 0)
            }, { transaction });

            remainingRefund = roundMoney(remainingRefund - targetRefund);
        }

        if (remainingRefund > 0.01) {
            throw new Error('Refund amount cannot exceed the amount already paid');
        }

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

const collectAppointmentStatusCharge = async ({
    appointmentId,
    amount,
    paymentMethod = 'cash',
    reason = null,
    transactionRef = null,
    source = 'tenant_appointment_status_charge',
    transaction = null
}) => {
    const numericAmount = roundMoney(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return null;
    }

    const shouldCommit = !transaction;
    const dbTransaction = transaction || await db.sequelize.transaction();

    try {
        const context = await loadAppointmentPaymentContext(appointmentId, {
            transaction: dbTransaction,
            lock: true
        });
        if (!context?.appointment) {
            throw new Error('Appointment not found');
        }

        const { appointment } = context;
        const totalPaidBefore = roundMoney(Number(appointment.totalPaid || 0));
        const totalPrice = roundMoney(Number(appointment.price || 0));
        const nextTotalPaid = roundMoney(Math.min(totalPrice, totalPaidBefore + numericAmount));
        const resolvedPaymentMethod = resolveLedgerPaymentMethod(paymentMethod || appointment.paymentMethod || 'cash', 'cash');
        const feeRef = transactionRef || `APT-FEE-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`;
        const platformFee = roundMoney(numericAmount * 0.025);
        const tenantRevenue = roundMoney(numericAmount - platformFee);

        if (resolvedPaymentMethod === 'wallet') {
            await walletService.debitWallet({
                platformUserId: appointment.platformUserId,
                amount: numericAmount,
                type: 'service_payment_debit',
                referenceType: 'appointment',
                referenceId: appointment.id,
                metadata: {
                    source,
                    reason,
                    appointmentId: appointment.id
                },
                transaction: dbTransaction
            });
        }

        await createAppointmentTransaction({
            appointmentId: appointment.id,
            type: totalPaidBefore > 0 ? 'remainder' : 'full',
            amount: numericAmount,
            paymentMethod: resolvedPaymentMethod,
            status: 'completed',
            transactionRef: feeRef,
            processedBy: null,
            processedAt: new Date(),
            notes: reason,
            metadata: {
                source,
                reason,
                statusCharge: true
            }
        }, { transaction: dbTransaction });

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
                source,
                reason,
                paymentMethod: resolvedPaymentMethod,
                statusCharge: true,
                transactionRef: feeRef
            }
        }, { transaction: dbTransaction });

        await appointment.update({
            paymentMethod: resolvedPaymentMethod,
            totalPaid: nextTotalPaid,
            paymentStatus: nextTotalPaid >= totalPrice ? 'fully_paid' : 'deposit_paid',
            depositPaid: nextTotalPaid > 0,
            remainderAmount: roundMoney(Math.max(totalPrice - nextTotalPaid, 0)),
            remainderPaid: nextTotalPaid >= totalPrice,
            paidAt: nextTotalPaid >= totalPrice ? (appointment.paidAt || new Date()) : appointment.paidAt
        }, { transaction: dbTransaction });

        if (appointment.platformUserId) {
            await db.PlatformUser.increment('totalSpent', {
                by: numericAmount,
                where: { id: appointment.platformUserId },
                transaction: dbTransaction
            });

            if (appointment.tenantId) {
                await db.CustomerInsight.increment('totalSpent', {
                    by: numericAmount,
                    where: { platformUserId: appointment.platformUserId, tenantId: appointment.tenantId },
                    transaction: dbTransaction
                });
            }
        }

        if (shouldCommit) {
            await dbTransaction.commit();
        }

        const invoice = await ensureAppointmentInvoice(appointment.id, {
            transaction: shouldCommit ? null : dbTransaction,
            triggerSource: source
        });

        return {
            amount: numericAmount,
            paymentMethod: resolvedPaymentMethod,
            invoiceId: invoice?.id || null
        };
    } catch (error) {
        if (shouldCommit && dbTransaction && !dbTransaction.finished) {
            await dbTransaction.rollback();
        }
        throw error;
    }
};

module.exports = {
    calculateSplitPayment,
    createAppointmentPaymentTransactions,
    normalizePaymentAllocations,
    recordRemainderPayment,
    getPaymentSummary,
    refundPayment,
    collectAppointmentStatusCharge
};
