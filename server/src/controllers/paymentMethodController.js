const db = require('../models');
const { Op } = require('sequelize');
const paymentService = require('../services/paymentService');

/**
 * Get user's payment methods
 * GET /api/v1/users/payment-methods
 */
const getPaymentMethods = async (req, res) => {
    try {
        const paymentMethods = await db.PaymentMethod.findAll({
            where: {
                platformUserId: req.userId,
                isActive: true
            },
            order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            paymentMethods
        });
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Add payment method
 * POST /api/v1/users/payment-methods
 */
const addPaymentMethod = async (req, res) => {
    try {
        const { cardNumber, expiryDate, cvv, cardholderName } = req.body;
        const platformUserId = req.userId;

        if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
            return res.status(400).json({
                success: false,
                message: 'All card fields are required'
            });
        }

        // Validate card
        const validation = paymentService.validateCard(cardNumber, expiryDate, cvv);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error
            });
        }

        const cleanedCard = cardNumber.replace(/\s/g, '');
        const last4 = cleanedCard.slice(-4);
        const cardBrand = paymentService.getCardBrand(cleanedCard);

        // Check if this is the first card (set as default)
        const cardCount = await db.PaymentMethod.count({
            where: { platformUserId, isActive: true }
        });

        const paymentMethod = await db.PaymentMethod.create({
            platformUserId,
            type: 'card',
            cardLast4: last4,
            cardBrand: cardBrand,
            cardExpiry: expiryDate,
            cardHolderName: cardholderName,
            isDefault: cardCount === 0, // First card is default
            isActive: true
        });

        res.json({
            success: true,
            message: 'Payment method added successfully',
            paymentMethod
        });
    } catch (error) {
        console.error('Add payment method error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Set default payment method
 * PUT /api/v1/users/payment-methods/:id/set-default
 */
const setDefaultPaymentMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const platformUserId = req.userId;

        // Find the payment method
        const paymentMethod = await db.PaymentMethod.findOne({
            where: {
                id,
                platformUserId,
                isActive: true
            }
        });

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }

        // Remove default from all other payment methods
        await db.PaymentMethod.update(
            { isDefault: false },
            {
                where: {
                    platformUserId,
                    isActive: true,
                    id: { [Op.ne]: id }
                }
            }
        );

        // Set this one as default
        await paymentMethod.update({ isDefault: true });

        res.json({
            success: true,
            message: 'Default payment method updated'
        });
    } catch (error) {
        console.error('Set default payment method error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Delete payment method
 * DELETE /api/v1/users/payment-methods/:id
 */
const deletePaymentMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const platformUserId = req.userId;

        const paymentMethod = await db.PaymentMethod.findOne({
            where: {
                id,
                platformUserId,
                isActive: true
            }
        });

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }

        // If it's the default, we need to set another one as default
        if (paymentMethod.isDefault) {
            const otherMethod = await db.PaymentMethod.findOne({
                where: {
                    platformUserId,
                    isActive: true,
                    id: { [Op.ne]: id }
                }
            });

            if (otherMethod) {
                await otherMethod.update({ isDefault: true });
            }
        }

        // Soft delete (set isActive to false)
        await paymentMethod.update({ isActive: false });

        res.json({
            success: true,
            message: 'Payment method deleted successfully'
        });
    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getPaymentMethods,
    addPaymentMethod,
    setDefaultPaymentMethod,
    deletePaymentMethod
};

