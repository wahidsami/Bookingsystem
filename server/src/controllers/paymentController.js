const paymentService = require('../services/paymentService');
const db = require('../models');
const logger = require('../utils/productionLogger');
const { handlePaymentError } = require('../utils/paymentErrorHandler');

/**
 * Process payment for booking or order
 * POST /api/v1/payments/process
 */
const processPayment = async (req, res, next) => {
    try {
        const { appointmentId, orderId, amount, cardNumber, expiryDate, cvv, cardholderName, saveCard, tenantId } = req.body;
        const platformUserId = req.userId;

        // Check authentication
        if (!platformUserId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please login.'
            });
        }

        // Validate required fields
        const missingFields = [];
        if (!appointmentId && !orderId) missingFields.push('appointmentId or orderId');
        if (!amount) missingFields.push('amount');
        if (!cardNumber) missingFields.push('cardNumber');
        if (!expiryDate) missingFields.push('expiryDate');
        if (!cvv) missingFields.push('cvv');
        if (!cardholderName) missingFields.push('cardholderName');

        if (missingFields.length > 0) {
            logger.warn('Payment request with missing fields', {
                missingFields,
                userId: platformUserId
            });
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Log payment attempt
        logger.info('Payment attempt', {
            userId: platformUserId,
            hasAppointment: !!appointmentId,
            hasOrder: !!orderId,
            amount: amount
        });

        // Process payment based on type (booking or order)
        let result;
        if (orderId) {
            // Product order payment
            result = await paymentService.processProductPayment({
                platformUserId,
                orderId,
                amount,
                cardNumber,
                expiryDate,
                cvv,
                cardholderName,
                saveCard: saveCard || false
            });
        } else {
            // Booking payment (existing flow)
            result = await paymentService.processPayment({
                platformUserId,
                appointmentId,
                amount,
                cardNumber,
                expiryDate,
                cvv,
                cardholderName,
                saveCard: saveCard || false,
                tenantId
            });
        }

        res.json({
            success: true,
            message: 'Payment processed successfully',
            transaction: result.transaction,
            paymentMethodId: result.paymentMethodId,
            order: result.order || null
        });
    } catch (error) {
        console.error('Process payment error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Top up wallet
 * POST /api/v1/payments/wallet/topup
 */
const topUpWallet = async (req, res) => {
    try {
        const { amount, cardNumber, expiryDate, cvv, cardholderName } = req.body;
        const platformUserId = req.userId;

        if (!amount || !cardNumber || !expiryDate || !cvv || !cardholderName) {
            return res.status(400).json({
                success: false,
                message: 'All payment fields are required'
            });
        }

        if (parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }

        const result = await paymentService.topUpWallet(
            platformUserId,
            amount,
            cardNumber,
            expiryDate,
            cvv,
            cardholderName
        );

        res.json({
            success: true,
            message: 'Wallet topped up successfully',
            transaction: result.transaction,
            newBalance: result.newBalance
        });
    } catch (error) {
        console.error('Top up wallet error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get payment history
 * GET /api/v1/payments/history
 */
const getPaymentHistory = async (req, res) => {
    try {
        const { type, status, startDate, endDate } = req.query;
        const platformUserId = req.userId;

        const where = { platformUserId };

        if (type) where.type = type;
        if (status) where.status = status;

        const { Op } = require('sequelize');
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const transactions = await db.Transaction.findAll({
            where,
            include: [
                { model: db.Appointment, include: [{ model: db.Service, as: 'service' }, { model: db.Staff, as: 'staff' }] },
                { model: db.Tenant, as: 'tenant' },
                { model: db.PaymentMethod, as: 'paymentMethod' }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            transactions,
            count: transactions.length
        });
    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    processPayment,
    topUpWallet,
    getPaymentHistory
};

