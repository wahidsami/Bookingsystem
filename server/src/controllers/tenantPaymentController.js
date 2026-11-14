/**
 * Tenant Payment Controller
 * Handles in-person payment recording for appointments
 */

const db = require('../models');
const splitPaymentService = require('../services/splitPaymentService');

/**
 * Get payment summary for an appointment
 * GET /api/v1/tenant/appointments/:id/payment
 */
const getPaymentSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

        // Verify appointment belongs to tenant
        const appointment = await db.Appointment.findByPk(id, {
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId }
            }]
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or not authorized'
            });
        }

        const summary = await splitPaymentService.getPaymentSummary(id);

        res.json({
            success: true,
            paymentSummary: summary
        });
    } catch (error) {
        console.error('Get payment summary error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get payment summary'
        });
    }
};

/**
 * Record remainder payment (at salon)
 * POST /api/v1/tenant/appointments/:id/record-payment
 */
const recordPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const { amount, paymentMethod, paymentAllocations, notes, transactionRef } = req.body;

        // Verify appointment belongs to tenant
        const appointment = await db.Appointment.findByPk(id, {
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId }
            }]
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or not authorized'
            });
        }

        const validMethods = ['cash', 'card_pos', 'wallet', 'bank_transfer', 'gift_card_code'];
        if ((!Array.isArray(paymentAllocations) || paymentAllocations.length === 0) && !validMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: `Payment method must be one of: ${validMethods.join(', ')}`
            });
        }

        if (Array.isArray(paymentAllocations) && paymentAllocations.length > 0) {
            paymentAllocations.forEach((allocation, index) => {
                const method = `${allocation?.paymentMethod || ''}`.trim().toLowerCase();
                if (!['cash', 'card_pos', 'wallet', 'bank_transfer', 'gift_card_code'].includes(method)) {
                    throw new Error(`Invalid payment method in allocation ${index + 1}`);
                }
            });
        }

        // Record the remainder payment
        const updatedAppointment = await splitPaymentService.recordRemainderPayment(id, {
            amount: parseFloat(amount),
            paymentMethod,
            paymentAllocations,
            processedBy: null,
            notes,
            transactionRef
        });

        // Get updated payment summary
        const summary = await splitPaymentService.getPaymentSummary(id);

        res.json({
            success: true,
            message: 'Payment recorded successfully',
            appointment: updatedAppointment,
            paymentSummary: summary
        });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to record payment'
        });
    }
};

/**
 * Refund payment
 * POST /api/v1/tenant/appointments/:id/refund
 */
const refundPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId || req.user?.tenantId;
        const staffId = req.userId || req.user?.id;
        const { amount, reason, paymentMethod } = req.body;

        // Verify appointment belongs to tenant
        const appointment = await db.Appointment.findByPk(id, {
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId }
            }]
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or not authorized'
            });
        }

        // Process refund
        const refundTransaction = await splitPaymentService.refundPayment(id, {
            amount: parseFloat(amount),
            reason,
            processedBy: staffId,
            paymentMethod
        });

        // Get updated payment summary
        const summary = await splitPaymentService.getPaymentSummary(id);

        res.json({
            success: true,
            message: 'Refund processed successfully',
            refund: refundTransaction,
            paymentSummary: summary
        });
    } catch (error) {
        console.error('Refund payment error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to process refund'
        });
    }
};

const BankTransferVerificationService = require('../services/bankTransferVerificationService');

/**
 * Verify a pending bank transfer
 * POST /api/v1/tenant/appointments/:id/bank-transfers/:transactionId/verify
 */
const verifyBankTransfer = async (req, res) => {
    try {
        const { id, transactionId } = req.params;
        const tenantId = req.tenantId || req.user?.tenantId;
        const staffId = req.userId || req.user?.id;
        const { notes, proofAttachmentUrl } = req.body || {};

        const result = await BankTransferVerificationService.verifyBankTransfer({
            tenantId,
            appointmentId: id,
            transactionId,
            verifiedBy: staffId,
            notes,
            proofAttachmentUrl
        });

        res.json({
            success: true,
            message: result.alreadyVerified ? 'Bank transfer was already verified' : 'Bank transfer verified successfully',
            transaction: result.transaction,
            appointment: result.appointment
        });
    } catch (error) {
        console.error('Verify bank transfer error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to verify bank transfer'
        });
    }
};

/**
 * Reject a pending bank transfer
 * POST /api/v1/tenant/appointments/:id/bank-transfers/:transactionId/reject
 */
const rejectBankTransfer = async (req, res) => {
    try {
        const { id, transactionId } = req.params;
        const tenantId = req.tenantId || req.user?.tenantId;
        const staffId = req.userId || req.user?.id;
        const { reason } = req.body || {};

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const result = await BankTransferVerificationService.rejectBankTransfer({
            tenantId,
            appointmentId: id,
            transactionId,
            rejectedBy: staffId,
            reason
        });

        res.json({
            success: true,
            message: result.alreadyRejected ? 'Bank transfer was already rejected' : 'Bank transfer rejected successfully',
            transaction: result.transaction,
            appointment: result.appointment
        });
    } catch (error) {
        console.error('Reject bank transfer error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to reject bank transfer'
        });
    }
};

/**
 * List bank transfers for an appointment
 * GET /api/v1/tenant/appointments/:id/bank-transfers
 */
const listBankTransfers = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId || req.user?.tenantId;

        const transfers = await BankTransferVerificationService.listBankTransfers(id, tenantId);

        res.json({
            success: true,
            transfers
        });
    } catch (error) {
        console.error('List bank transfers error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to list bank transfers'
        });
    }
};

/**
 * Authorized Auditable Financial Exception / Adjustment
 * POST /api/v1/tenant/appointments/:id/financial-exception
 */
const applyFinancialException = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId || req.user?.tenantId;
        const staffId = req.userId || req.user?.id;
        const { action, amount, reason, paymentMethod, reference } = req.body || {};

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Reason is strictly required for financial exceptions'
            });
        }

        const appointment = await db.Appointment.findByPk(id, {
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId }
            }]
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or not authorized'
            });
        }

        const numericAmount = parseFloat(amount || appointment.totalPaid || 0);

        if (action === 'refund_and_cancel') {
            // Process audited refund
            const refundTx = await splitPaymentService.refundPayment(id, {
                amount: numericAmount,
                reason: `[FINANCIAL_EXCEPTION] ${reason.trim()} | Ref: ${reference || 'N/A'}`,
                processedBy: staffId,
                paymentMethod: paymentMethod || 'cash'
            });

            // Mark appointment cancelled with audited note
            await appointment.update({
                status: 'cancelled',
                notes: `${appointment.notes || ''}\n[FINANCIAL_EXCEPTION_CANCELLED] Reason: ${reason.trim()} | ProcessedBy: ${staffId} | Date: ${new Date().toISOString()}`
            });

            // Audit Log
            try {
                if (db.ActivityLog) {
                    await db.ActivityLog.create({
                        tenantId,
                        entityType: 'Appointment',
                        entityId: id,
                        action: 'refund_issued',
                        performedByType: 'Staff',
                        performedById: staffId,
                        details: {
                            exceptionType: 'refund_and_cancel',
                            amount: numericAmount,
                            reason: reason.trim(),
                            refundTransactionId: refundTx?.id
                        }
                    });
                }
            } catch (auditErr) {
                console.warn('ActivityLog warning on financial exception:', auditErr.message);
            }

            const summary = await splitPaymentService.getPaymentSummary(id);

            return res.json({
                success: true,
                message: 'Financial exception processed: full refund issued and booking cancelled with audit trail',
                refund: refundTx,
                appointment,
                paymentSummary: summary
            });
        }

        return res.status(400).json({
            success: false,
            message: 'Unsupported financial exception action. Allowed: refund_and_cancel'
        });

    } catch (error) {
        console.error('Apply financial exception error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to process financial exception'
        });
    }
};

module.exports = {
    getPaymentSummary,
    recordPayment,
    refundPayment,
    verifyBankTransfer,
    rejectBankTransfer,
    listBankTransfers,
    applyFinancialException
};

