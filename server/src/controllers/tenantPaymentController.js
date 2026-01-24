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
        const tenantId = req.user.tenantId;

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
        const tenantId = req.user.tenantId;
        const staffId = req.user.id; // Staff member processing payment
        const { amount, paymentMethod, notes } = req.body;

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

        // Validate payment method
        const validMethods = ['cash', 'card_pos', 'wallet'];
        if (!validMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: `Payment method must be one of: ${validMethods.join(', ')}`
            });
        }

        // Record the remainder payment
        const updatedAppointment = await splitPaymentService.recordRemainderPayment(id, {
            amount: parseFloat(amount),
            paymentMethod,
            processedBy: staffId,
            notes
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
        const tenantId = req.user.tenantId;
        const staffId = req.user.id;
        const { amount, reason } = req.body;

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
            processedBy: staffId
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

module.exports = {
    getPaymentSummary,
    recordPayment,
    refundPayment
};
