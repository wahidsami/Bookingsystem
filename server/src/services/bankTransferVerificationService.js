'use strict';

const db = require('../models');
const { calculateAppointmentFinancialState, APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const roundMoney = (v) => Number.parseFloat(Number(v || 0).toFixed(2));

/**
 * Service handling the bank transfer verification lifecycle:
 * Submitted (pending_verification) -> Verified OR Rejected
 */
class BankTransferVerificationService {
    /**
     * Recalculate an appointment's financial status strictly based on verified transactions.
     * Must be called within a database transaction.
     */
    static async recalculateAppointmentFinancials(appointmentId, transaction) {
        const appointment = await db.Appointment.findByPk(appointmentId, {
            include: [
                {
                    model: db.PaymentTransaction,
                    as: 'paymentTransactions'
                },
                {
                    model: db.BookingSession,
                    as: 'bookingSession'
                }
            ],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!appointment) {
            throw new Error(`Appointment ${appointmentId} not found`);
        }

        const transactions = appointment.paymentTransactions || [];
        
        let verifiedPaid = 0;
        let refundedAmount = 0;
        let pendingTransferAmount = 0;

        for (const tx of transactions) {
            const amount = roundMoney(tx.amount);
            const isVerified = !tx.verificationStatus || tx.verificationStatus === 'verified';
            const isPending = tx.verificationStatus === 'pending_verification';

            if (tx.type === 'refund' || tx.status === 'refunded') {
                refundedAmount = roundMoney(refundedAmount + amount);
            } else if (tx.status === 'completed' && isVerified) {
                verifiedPaid = roundMoney(verifiedPaid + amount);
            } else if (isPending && tx.status !== 'failed' && tx.status !== 'cancelled') {
                pendingTransferAmount = roundMoney(pendingTransferAmount + amount);
            }
        }

        const netConfirmedPaid = roundMoney(Math.max(verifiedPaid - refundedAmount, 0));
        const totalPrice = roundMoney(appointment.price ?? 0);

        const financialState = calculateAppointmentFinancialState({
            price: totalPrice,
            totalPaid: netConfirmedPaid,
            depositAmount: appointment.depositAmount ?? 0,
            pendingTransferAmount
        });

        Object.assign(appointment, financialState);
        if (financialState.paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID) {
            appointment.paidAt = appointment.paidAt || new Date();
            if (appointment.status === 'pending') {
                appointment.status = 'confirmed';
            }
        }

        await appointment.save({ transaction });

        if (appointment.bookingSessionId) {
            const { syncBookingSessionTotals } = require('./bookingService');
            await syncBookingSessionTotals(appointment.bookingSessionId, transaction);
        }

        return appointment;
    }

    /**
     * Verify a pending bank transfer.
     * Transitions status to verified, records revenue, and updates confirmed balance.
     */
    static async verifyBankTransfer({
        tenantId,
        appointmentId,
        transactionId,
        verifiedBy,
        notes = null,
        proofAttachmentUrl = null
    }) {
        return await db.sequelize.transaction(async (t) => {
            const paymentTx = await db.PaymentTransaction.findOne({
                where: { id: transactionId, appointmentId },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            if (!paymentTx) {
                throw new Error('Payment transaction not found for this appointment');
            }

            const appointment = await db.Appointment.findByPk(appointmentId, {
                transaction: t
            });

            if (!appointment || appointment.tenantId !== tenantId) {
                throw new Error('Unauthorized or tenant mismatch');
            }

            // Idempotent: If already verified, return existing state
            if (paymentTx.verificationStatus === 'verified' && paymentTx.status === 'completed') {
                return {
                    success: true,
                    alreadyVerified: true,
                    transaction: paymentTx,
                    appointment
                };
            }

            if (paymentTx.verificationStatus === 'rejected') {
                throw new Error('Cannot verify a rejected bank transfer. A new payment must be submitted.');
            }

            paymentTx.verificationStatus = 'verified';
            paymentTx.status = 'completed';
            paymentTx.verifiedBy = verifiedBy || null;
            paymentTx.verifiedAt = new Date();
            if (proofAttachmentUrl) {
                paymentTx.proofAttachmentUrl = proofAttachmentUrl;
            }
            if (notes) {
                paymentTx.notes = paymentTx.notes ? `${paymentTx.notes} | ${notes}` : notes;
            }

            await paymentTx.save({ transaction: t });

            // Recalculate appointment financials with verified money
            const updatedAppointment = await this.recalculateAppointmentFinancials(appointmentId, t);

            // Audit Log
            try {
                if (db.ActivityLog) {
                    await db.ActivityLog.create({
                        tenantId,
                        entityType: 'Appointment',
                        entityId: appointmentId,
                        action: 'payment_received',
                        performedByType: 'Staff',
                        performedById: verifiedBy || null,
                        details: {
                            type: 'bank_transfer_verified',
                            transactionId: paymentTx.id,
                            amount: paymentTx.amount,
                            newTotalPaid: updatedAppointment.totalPaid,
                            isLocked: updatedAppointment.isLocked
                        }
                    }, { transaction: t });
                }
            } catch (auditErr) {
                console.warn('ActivityLog error on bank transfer verification:', auditErr.message);
            }

            return {
                success: true,
                alreadyVerified: false,
                transaction: paymentTx,
                appointment: updatedAppointment
            };
        });
    }

    /**
     * Reject a pending bank transfer.
     */
    static async rejectBankTransfer({
        tenantId,
        appointmentId,
        transactionId,
        rejectedBy,
        reason
    }) {
        if (!reason || !reason.trim()) {
            throw new Error('Rejection reason is required');
        }

        return await db.sequelize.transaction(async (t) => {
            const paymentTx = await db.PaymentTransaction.findOne({
                where: { id: transactionId, appointmentId },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            if (!paymentTx) {
                throw new Error('Payment transaction not found for this appointment');
            }

            const appointment = await db.Appointment.findByPk(appointmentId, {
                transaction: t
            });

            if (!appointment || appointment.tenantId !== tenantId) {
                throw new Error('Unauthorized or tenant mismatch');
            }

            if (paymentTx.verificationStatus === 'rejected') {
                return {
                    success: true,
                    alreadyRejected: true,
                    transaction: paymentTx,
                    appointment
                };
            }

            if (paymentTx.verificationStatus === 'verified') {
                throw new Error('Cannot reject an already verified transfer. Use authorized refund/adjustment.');
            }

            paymentTx.verificationStatus = 'rejected';
            paymentTx.status = 'failed';
            paymentTx.rejectionReason = reason.trim();
            paymentTx.verifiedBy = rejectedBy || null;
            paymentTx.verifiedAt = new Date();

            await paymentTx.save({ transaction: t });

            // Recalculate appointment financials (removes pending transfer amount)
            const updatedAppointment = await this.recalculateAppointmentFinancials(appointmentId, t);

            // Audit Log
            try {
                if (db.ActivityLog) {
                    await db.ActivityLog.create({
                        tenantId,
                        entityType: 'Appointment',
                        entityId: appointmentId,
                        action: 'rejected',
                        performedByType: 'Staff',
                        performedById: rejectedBy || null,
                        details: {
                            type: 'bank_transfer_rejected',
                            transactionId: paymentTx.id,
                            reason: reason.trim(),
                            amount: paymentTx.amount
                        }
                    }, { transaction: t });
                }
            } catch (auditErr) {
                console.warn('ActivityLog error on bank transfer rejection:', auditErr.message);
            }

            return {
                success: true,
                alreadyRejected: false,
                transaction: paymentTx,
                appointment: updatedAppointment
            };
        });
    }

    /**
     * List all bank transfers for an appointment with details.
     */
    static async listBankTransfers(appointmentId, tenantId) {
        const appointment = await db.Appointment.findOne({
            where: { id: appointmentId, tenantId }
        });

        if (!appointment) {
            throw new Error('Appointment not found');
        }

        const transfers = await db.PaymentTransaction.findAll({
            where: {
                appointmentId,
                paymentMethod: 'bank_transfer'
            },
            include: [
                {
                    model: db.Staff,
                    as: 'processor',
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        return transfers;
    }
}

module.exports = BankTransferVerificationService;
