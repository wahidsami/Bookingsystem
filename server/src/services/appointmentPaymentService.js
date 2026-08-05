const db = require('../models');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const {
    createAppointmentPaymentTransactions,
    normalizePaymentAllocations
} = require('./splitPaymentService');


const roundMoney = (value) => Number.parseFloat(Number(value || 0).toFixed(2));

const getAppointmentDueAmount = (targetAppointment) => {
    const paymentStatusValue = `${targetAppointment.paymentStatus || ''}`.trim().toLowerCase();
    if (paymentStatusValue === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID) {
        const remainder = roundMoney(targetAppointment.remainderAmount ?? 0);
        return remainder > 0 ? remainder : 0;
    }

    const totalPrice = roundMoney(targetAppointment.price ?? 0);
    const totalPaid = roundMoney(targetAppointment.totalPaid ?? 0);
    const dueAmount = roundMoney(totalPrice - totalPaid);
    return dueAmount > 0 ? dueAmount : 0;
};

/**
 * Process a canonical commercial payment for an appointment (and its booking session).
 * Must be executed within an existing database transaction.
 */
async function processAppointmentPayment({
    tenantId,
    appointment,
    amount,
    paymentMethod,
    paymentAllocations,
    transactionRef,
    notes,
    forensicTrace,
    transaction
}) {
    console.log('[PAYMENT-ENGINE-TRACE] processAppointmentPayment entry:', {
        appointmentId: appointment?.id,
        amount,
        paymentMethod,
        paymentAllocationsLength: paymentAllocations?.length
    });

    if (!transaction) {
        throw new Error('processAppointmentPayment requires a transaction');
    }

    const bookingSession = appointment.bookingSession || null;
    const sessionAppointments = Array.isArray(bookingSession?.appointments)
        ? bookingSession.appointments
            .filter((sessionAppointment) => sessionAppointment && `${sessionAppointment.status || ''}`.trim().toLowerCase() !== 'cancelled')
            .slice()
            .sort((left, right) => {
                const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
                const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
                if (leftIndex !== rightIndex) {
                    return leftIndex - rightIndex;
                }
                return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
            })
        : [appointment]; // Fallback to just the current appointment if no session loaded

    const payableSessionAppointments = sessionAppointments
        .map((sessionAppointment) => ({
            appointment: sessionAppointment,
            dueAmount: getAppointmentDueAmount(sessionAppointment)
        }))
        .filter((entry) => entry.dueAmount > 0.009);

    const forensicPaymentTransactionIds = [];

    const sessionDueAmount = roundMoney(
        payableSessionAppointments.reduce((sum, entry) => sum + entry.dueAmount, 0)
    );
    const numericRequestedAmount = Number(amount);
    const paymentAmount = Number.isFinite(numericRequestedAmount) && numericRequestedAmount > 0
        ? roundMoney(numericRequestedAmount)
        : sessionDueAmount;
        
    const normalizedSessionPaymentAllocations = normalizePaymentAllocations({
        amount: paymentAmount,
        paymentMethod,
        paymentAllocations,
        fallbackSource: paymentMethod || bookingSession?.paymentMethod || appointment.paymentMethod || 'cash'
    });
    
    const allocationBuckets = normalizedSessionPaymentAllocations.map((allocation) => ({
        ...allocation,
        remaining: roundMoney(allocation.amount)
    }));

    const allocateForAppointment = (targetAmount) => {
        let remainingTargetAmount = roundMoney(targetAmount);
        const assignedAllocations = [];

        for (const bucket of allocationBuckets) {
            if (remainingTargetAmount <= 0.009) break;
            if (bucket.remaining <= 0.009) continue;

            const takeAmount = roundMoney(Math.min(bucket.remaining, remainingTargetAmount));
            if (takeAmount <= 0) continue;

            assignedAllocations.push({
                paymentMethod: bucket.paymentMethod,
                amount: takeAmount,
                giftCardCode: bucket.giftCardCode || undefined,
                notes: bucket.notes || undefined
            });
            bucket.remaining = roundMoney(bucket.remaining - takeAmount);
            remainingTargetAmount = roundMoney(remainingTargetAmount - takeAmount);
        }

        return assignedAllocations;
    };

    const sessionTransactionRefBase = transactionRef || `APT-PAY-${bookingSession?.bookingReference || appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`;

    for (let index = 0; index < payableSessionAppointments.length; index += 1) {
        const target = payableSessionAppointments[index];
        const targetAppointment = target.appointment;
        const targetAllocations = allocateForAppointment(target.dueAmount);
        if (targetAllocations.length === 0) continue;

        const targetPaidAmount = roundMoney(targetAllocations.reduce((sum, a) => sum + a.amount, 0));
        const resolvedPaymentMethod = targetAllocations.length > 1
            ? 'split'
            : targetAllocations[0]?.paymentMethod || paymentMethod || targetAppointment.paymentMethod || bookingSession?.paymentMethod || 'cash';
        
        const transactionType = `${targetAppointment.paymentStatus || ''}`.trim().toLowerCase() === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
            ? 'remainder'
            : 'full';

        const createdPaymentBatch = await createAppointmentPaymentTransactions({
            appointment: targetAppointment,
            type: transactionType,
            amount: targetPaidAmount,
            paymentMethod: resolvedPaymentMethod,
            paymentAllocations: targetAllocations,
            processedBy: null,
            transactionRef: payableSessionAppointments.length > 1
                ? `${sessionTransactionRefBase}-${index + 1}`
                : sessionTransactionRefBase,
            notes: notes || 'Payment collected from tenant dashboard',
            source: 'tenant_booking_canonical_payment',
            transaction,
            forensicTrace
        });
        
        if (Array.isArray(createdPaymentBatch?.paymentTransactions)) {
            forensicPaymentTransactionIds.push(
                ...createdPaymentBatch.paymentTransactions.map((entry) => entry.id).filter(Boolean)
            );
        }

        const targetPreviousPaid = roundMoney(targetAppointment.totalPaid ?? 0);
        const targetTotalPrice = roundMoney(targetAppointment.price ?? 0);
        const nextTotalPaid = roundMoney(targetPreviousPaid + targetPaidAmount);
        
        const { calculateAppointmentFinancialState } = require('../utils/appointmentPaymentStatus');
        const financialState = calculateAppointmentFinancialState({
            price: targetTotalPrice,
            totalPaid: nextTotalPaid,
            depositAmount: targetAppointment.depositAmount ?? 0
        });

        Object.assign(targetAppointment, financialState);
        targetAppointment.paymentMethod = resolvedPaymentMethod;
        if (financialState.paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID) {
            targetAppointment.paidAt = targetAppointment.paidAt || new Date();
        }
        
        if (targetAppointment.status === 'pending') {
            targetAppointment.status = 'confirmed';
        }
        await targetAppointment.save({ transaction });
    }

    if (bookingSession?.id) {
        // Will inject bookingService syncBookingSessionTotals dynamically to avoid circular dep
        const { syncBookingSessionTotals: syncTotals } = require('./bookingService');
        await syncTotals(bookingSession.id, transaction);
    }

    if (appointment.platformUserId) {
        const sessionTotalPaidDelta = roundMoney(paymentAmount);
        if (sessionTotalPaidDelta > 0) {
            await db.PlatformUser.increment('totalSpent', {
                by: sessionTotalPaidDelta,
                where: { id: appointment.platformUserId },
                transaction
            });

            await db.CustomerInsight.increment('totalSpent', {
                by: sessionTotalPaidDelta,
                where: { platformUserId: appointment.platformUserId, tenantId },
                transaction
            });
        }
    }

    const { calculateAppointmentFinancialState } = require('../utils/appointmentPaymentStatus');
    const finalFinancialState = calculateAppointmentFinancialState({
        price: appointment.price ?? 0,
        totalPaid: appointment.totalPaid ?? 0,
        depositAmount: appointment.depositAmount ?? 0
    });
    Object.assign(appointment, finalFinancialState);
    
    return {
        appointment,
        forensicPaymentTransactionIds
    };
}

module.exports = {
    processAppointmentPayment
};
