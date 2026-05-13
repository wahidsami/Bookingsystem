/**
 * Payment Service
 * Processes payments with proper error handling and transaction logging
 */

const db = require('../models');
const { Sequelize, Op } = require('sequelize');
const {
    PaymentValidationError,
    CardValidationError,
    PaymentDeclinedError,
    InsufficientFundsError,
    PaymentProcessingError
} = require('../utils/paymentErrorHandler');
const logger = require('../utils/productionLogger');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const notificationOrchestrator = require('./notificationOrchestratorService');
const { createAppointmentTransaction } = require('./paymentTransactionLedgerService');

class PaymentService {
    /**
     * Validate fake card number with proper error handling
     */
    validateCard(cardNumber, expiryDate, cvv) {
        // Remove spaces and dashes
        const cleaned = cardNumber.replace(/[\s-]/g, '');

        // Check if it's a valid format (13-19 digits)
        if (!/^\d{13,19}$/.test(cleaned)) {
            throw new CardValidationError('Invalid card number format', {
                field: 'cardNumber',
                reason: 'Invalid format - must be 13-19 digits'
            });
        }

        // Luhn algorithm check
        let sum = 0;
        let isEven = false;
        for (let i = cleaned.length - 1; i >= 0; i--) {
            let digit = parseInt(cleaned[i]);
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            isEven = !isEven;
        }

        if (sum % 10 !== 0) {
            throw new CardValidationError('Invalid card number', {
                field: 'cardNumber',
                reason: 'Failed Luhn validation'
            });
        }

        // Check expiry date format (MM/YY)
        if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
            throw new CardValidationError('Invalid expiry date format', {
                field: 'expiryDate',
                reason: 'Expected MM/YY format'
            });
        }

        // Check CVV (3-4 digits)
        if (!/^\d{3,4}$/.test(cvv)) {
            throw new CardValidationError('Invalid CVV', {
                field: 'cvv',
                reason: 'CVV must be 3-4 digits'
            });
        }

        // Check if card is expired
        const [month, year] = expiryDate.split('/');
        const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
        if (expiry < new Date()) {
            throw new CardValidationError('Card has expired', {
                field: 'expiryDate',
                expiryDate: expiryDate
            });
        }

        return { valid: true };
    }

    /**
     * Process payment with comprehensive error handling
     */
    async processPayment(paymentData) {
        const { platformUserId, appointmentId, amount, cardNumber, expiryDate, cvv, cardholderName, saveCard, paymentChoice } = paymentData;

        try {
            // Validate required fields
            if (!platformUserId || !appointmentId || !amount) {
                throw new PaymentValidationError('Missing required payment fields', {
                    missingFields: [
                        !platformUserId && 'platformUserId',
                        !appointmentId && 'appointmentId',
                        !amount && 'amount'
                    ].filter(Boolean)
                });
            }

            // Validate amount
            if (amount <= 0) {
                throw new PaymentValidationError('Invalid payment amount', {
                    amount,
                    reason: 'Amount must be greater than 0'
                });
            }

            // Validate card
            this.validateCard(cardNumber, expiryDate, cvv);

            // Check for test card numbers that should fail
            const cleanedCard = cardNumber.replace(/[\s-]/g, '');
            
            // Test card: 4000000000000002 - Always declined
            if (cleanedCard === '4000000000000002') {
                throw new PaymentDeclinedError(
                    'Payment declined by issuer',
                    'CARD_DECLINED',
                    {
                        amount,
                        cardLast4: cleanedCard.slice(-4),
                        attemptedAt: new Date()
                    }
                );
            }

            // Test card: 4000000000009995 - Insufficient funds

        if (cleanedCard === '4000000000009995') {
            throw new Error('Insufficient funds');
        }

        const requestedAmount = parseFloat(amount);

        // Get appointment
        const appointment = await db.Appointment.findByPk(appointmentId, {
            include: [{ model: db.Service, as: 'service' }]
        });

        if (!appointment) {
            throw new Error('Appointment not found');
        }

        if (appointment.platformUserId !== platformUserId) {
            throw new Error('Unauthorized: This appointment does not belong to you');
        }

        if (appointment.status === 'cancelled') {
            throw new Error('Cancelled appointments cannot be paid');
        }

        if (appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID) {
            throw new Error('Appointment is already paid');
        }

        const totalAmount = parseFloat(appointment.price || 0);
        const totalPaid = parseFloat(appointment.totalPaid || 0);
        const depositAmount = parseFloat(appointment.depositAmount || 0);
        const outstandingAmount = parseFloat((totalAmount - totalPaid).toFixed(2));

        if (outstandingAmount <= 0) {
            throw new Error('Appointment has no outstanding balance');
        }

        const normalizedPaymentChoice = paymentChoice === 'booking-fee'
            ? 'booking-fee'
            : paymentChoice === 'online-full'
                ? 'online-full'
                : null;

        // Get tenant from service or appointment
        // For now, we'll need to get tenantId from somewhere
        // Let's assume it's passed or we can get it from the booking context
        const tenantId = paymentData.tenantId;

        let chargeAmount = outstandingAmount;
        let ledgerType = totalPaid > 0 ? 'remainder' : 'full';
        let nextPaymentStatus = APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;
        let nextDepositPaid = appointment.depositPaid || totalPaid > 0;
        let nextRemainderAmount = 0;
        let nextRemainderPaid = true;
        let nextTotalPaid = totalAmount;

        if (normalizedPaymentChoice === 'booking-fee' && appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.PENDING) {
            if (depositAmount <= 0) {
                throw new Error('This booking does not have a deposit configured');
            }

            if (Math.abs(requestedAmount - depositAmount) > 0.01) {
                throw new Error(`Payment amount must match the booking fee of ${depositAmount.toFixed(2)} SAR`);
            }

            chargeAmount = depositAmount;
            ledgerType = depositAmount >= totalAmount ? 'full' : 'deposit';
            nextPaymentStatus = depositAmount >= totalAmount
                ? APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
                : APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID;
            nextDepositPaid = true;
            nextRemainderAmount = parseFloat(Math.max(0, totalAmount - depositAmount).toFixed(2));
            nextRemainderPaid = nextRemainderAmount <= 0;
            nextTotalPaid = parseFloat((totalPaid + chargeAmount).toFixed(2));
        } else {
            if (Math.abs(requestedAmount - outstandingAmount) > 0.01) {
                throw new Error(`Payment amount must match the outstanding balance of ${outstandingAmount.toFixed(2)} SAR`);
            }

            chargeAmount = outstandingAmount;
            ledgerType = appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID ? 'remainder' : 'full';
            nextPaymentStatus = APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;
            nextDepositPaid = appointment.depositPaid || totalPaid > 0;
            nextRemainderAmount = 0;
            nextRemainderPaid = true;
            nextTotalPaid = parseFloat((totalPaid + chargeAmount).toFixed(2));
        }

        // Calculate platform fee (2.5%)
        const platformFee = parseFloat((chargeAmount * 0.025).toFixed(2));
        const tenantRevenue = parseFloat((chargeAmount - platformFee).toFixed(2));

        // Save payment method if requested
        let paymentMethodId = null;
        if (saveCard) {
            const last4 = cardNumber.slice(-4);
            const cardBrand = this.getCardBrand(cleanedCard);
            
            const paymentMethod = await db.PaymentMethod.create({
                platformUserId,
                type: 'card',
                cardLast4: last4,
                cardBrand: cardBrand,
                cardExpiry: expiryDate,
                cardHolderName: cardholderName,
                isDefault: false, // Check if first card
                isActive: true
            });

            paymentMethodId = paymentMethod.id;

            // Set as default if it's the first card
            const cardCount = await db.PaymentMethod.count({
                where: { platformUserId, isActive: true }
            });
            if (cardCount === 1) {
                await paymentMethod.update({ isDefault: true });
            }
        }

        // Create transaction
        const transaction = await db.Transaction.create({
            platformUserId,
            tenantId,
            appointmentId,
            paymentMethodId,
            amount: chargeAmount,
            currency: 'SAR',
            type: 'booking',
            status: 'completed',
            platformFee,
            tenantRevenue,
            metadata: {
                cardLast4: cardNumber.slice(-4),
                cardBrand: this.getCardBrand(cleanedCard),
                fakePayment: true
            }
        });

        // Determine payment method name
        const paymentMethodName = this.getCardBrand(cleanedCard) === 'mada' ? 'Mada Card' 
            : this.getCardBrand(cleanedCard) === 'visa' ? 'Visa Card'
            : this.getCardBrand(cleanedCard) === 'mastercard' ? 'Mastercard'
            : 'Card';

        // Update appointment status and payment information
        await appointment.update({ 
            status: 'confirmed',
            paymentStatus: nextPaymentStatus,
            paymentMethod: paymentMethodName,
            paidAt: new Date(),
            depositPaid: nextDepositPaid,
            remainderAmount: nextRemainderAmount,
            remainderPaid: nextRemainderPaid,
            totalPaid: nextTotalPaid
        });

        await createAppointmentTransaction({
            appointmentId,
            type: ledgerType,
            amount: chargeAmount,
            paymentMethod: 'online',
            status: 'completed',
            processedBy: null,
            processedAt: appointment.paidAt || new Date(),
            transactionRef: `APP-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}-${ledgerType.toUpperCase()}`,
            notes: ledgerType === 'deposit' ? 'Online booking deposit payment' : 'Online booking payment',
            metadata: {
                source: 'customer_mobile_payment',
                paymentChoice: normalizedPaymentChoice || appointment.paymentMethod || null,
                platformUserId,
                tenantId
            }
        });

        // Update platform user stats
        await db.PlatformUser.increment('totalSpent', {
            by: chargeAmount,
            where: { id: platformUserId }
        });

        // Update customer insight if tenantId provided
        if (tenantId) {
            const insight = await db.CustomerInsight.findOne({
                where: { platformUserId, tenantId }
            });
            if (insight) {
                await insight.increment('totalSpent', { by: chargeAmount });
            }
        }

        try {
            const serviceName = appointment.service?.name_en || appointment.service?.name_ar || 'booking';
            await notificationOrchestrator.notifyCustomer({
                tenantId,
                platformUserId,
                eventType: 'booking_payment_received',
                title: nextPaymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID ? 'Booking deposit confirmed' : 'Booking payment confirmed',
                body: nextPaymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                    ? `Your booking fee for ${serviceName} was received successfully.`
                    : `Your payment for ${serviceName} was received successfully.`,
                data: {
                    type: 'booking_payment_received',
                    appointmentId: appointment.id,
                    paymentStatus: nextPaymentStatus
                }
            });
        } catch (notificationError) {
            console.warn('Booking payment notification warning:', notificationError.message);
        }

        return {
            transaction,
            paymentMethodId
        };
        } catch (error) {
            logger.error('Payment processing failed:', {
                error: error.message,
                errorType: error.constructor.name,
                platformUserId: paymentData?.platformUserId,
                appointmentId: paymentData?.appointmentId,
                amount: paymentData?.amount
            });

            // Re-throw with context
            if (error instanceof PaymentValidationError || 
                error instanceof CardValidationError ||
                error instanceof PaymentDeclinedError ||
                error instanceof InsufficientFundsError) {
                throw error;
            }

            throw new PaymentProcessingError(
                'Payment processing failed',
                error.message,
                {
                    originalError: error.message,
                    timestamp: new Date()
                }
            );
        }
    }

    /**
     * Process payment for product order
     * Similar to booking payment but for orders
     */
    async processProductPayment(paymentData) {
        const { platformUserId, orderId, amount, cardNumber, expiryDate, cvv, cardholderName, saveCard } = paymentData;

        // Validate card
        const validation = this.validateCard(cardNumber, expiryDate, cvv);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Check for test card numbers that should fail
        const cleanedCard = cardNumber.replace(/[\s-]/g, '');
        
        // Test card: 4000000000000002 - Always declined
        if (cleanedCard === '4000000000000002') {
            throw new Error('Payment declined by issuer');
        }

        // Test card: 4000000000009995 - Insufficient funds
        if (cleanedCard === '4000000000009995') {
            throw new Error('Insufficient funds');
        }

        const requestedAmount = parseFloat(amount);

        // Get order
        const order = await db.Order.findByPk(orderId, {
            include: [{ model: db.Tenant, as: 'tenant' }]
        });

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.platformUserId !== platformUserId) {
            throw new Error('Unauthorized: This order does not belong to you');
        }

        if (order.paymentStatus === 'paid') {
            throw new Error('Order is already paid');
        }

        if (['cancelled', 'refunded'].includes(order.status)) {
            throw new Error('This order can no longer be paid');
        }

        const totalAmount = parseFloat(order.totalAmount || 0);
        if (Math.abs(requestedAmount - totalAmount) > 0.01) {
            throw new Error(`Payment amount must match the order total of ${totalAmount.toFixed(2)} SAR`);
        }

        const tenantId = order.tenantId;

        // Calculate platform fee (2.5%)
        const platformFee = parseFloat((totalAmount * 0.025).toFixed(2));
        const tenantRevenue = parseFloat((totalAmount - platformFee).toFixed(2));

        // Save payment method if requested
        let paymentMethodId = null;
        if (saveCard) {
            const last4 = cardNumber.slice(-4);
            const cardBrand = this.getCardBrand(cleanedCard);
            
            const paymentMethod = await db.PaymentMethod.create({
                platformUserId,
                type: 'card',
                cardLast4: last4,
                cardBrand: cardBrand,
                cardExpiry: expiryDate,
                cardHolderName: cardholderName,
                isDefault: false,
                isActive: true
            });

            paymentMethodId = paymentMethod.id;

            // Set as default if it's the first card
            const cardCount = await db.PaymentMethod.count({
                where: { platformUserId, isActive: true }
            });
            if (cardCount === 1) {
                await paymentMethod.update({ isDefault: true });
            }
        }

        // Create transaction
        const transaction = await db.Transaction.create({
            platformUserId,
            tenantId,
            orderId,
            paymentMethodId,
            amount: totalAmount,
            currency: 'SAR',
            type: 'product_purchase',
            status: 'completed',
            platformFee,
            tenantRevenue,
            metadata: {
                cardLast4: cardNumber.slice(-4),
                cardBrand: this.getCardBrand(cleanedCard),
                cardBrandName: this.getCardBrand(cleanedCard) === 'mada' ? 'Mada Card' 
                    : this.getCardBrand(cleanedCard) === 'visa' ? 'Visa Card'
                    : this.getCardBrand(cleanedCard) === 'mastercard' ? 'Mastercard'
                    : 'Card',
                fakePayment: true
            }
        });

        const wasPaid = order.paymentStatus === 'paid';

        // Update order payment status and order status
        // Note: paymentMethod field should NOT be updated - it's already set to 'online' when order was created
        // The card brand information is stored in the transaction metadata
        await order.update({ 
            paymentStatus: 'paid',
            status: order.status === 'pending' ? 'confirmed' : order.status,
            paidAt: new Date()
        });

        if (!wasPaid) {
            await db.PlatformUser.increment('totalSpent', {
                by: parseFloat(order.totalAmount || amount),
                where: { id: platformUserId }
            });
        }

        try {
            await notificationOrchestrator.notifyCustomer({
                tenantId,
                platformUserId,
                eventType: 'order_payment_received',
                title: 'Order payment confirmed',
                body: `Payment for order ${order.orderNumber} was received successfully.`,
                data: {
                    type: 'order_payment_received',
                    orderId: order.id,
                    paymentStatus: 'paid'
                }
            });
        } catch (notificationError) {
            console.warn('Order payment notification warning:', notificationError.message);
        }

        return {
            transaction,
            paymentMethodId,
            order
        };
    }

    /**
     * Get card brand from number
     */
    getCardBrand(cardNumber) {
        if (cardNumber.startsWith('4')) return 'visa';
        if (cardNumber.startsWith('5297')) return 'mada'; // Mada cards (Saudi Arabia)
        if (cardNumber.startsWith('5')) return 'mastercard';
        if (cardNumber.startsWith('3')) return 'amex';
        if (cardNumber.startsWith('6')) return 'discover';
        return 'unknown';
    }

    /**
     * Top up wallet
     */
    async topUpWallet(platformUserId, amount, cardNumber, expiryDate, cvv, cardholderName) {
        // Validate card
        const validation = this.validateCard(cardNumber, expiryDate, cvv);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Check test cards
        const cleanedCard = cardNumber.replace(/[\s-]/g, '');
        if (cleanedCard === '4000000000000002') {
            throw new Error('Payment declined');
        }
        if (cleanedCard === '4000000000009995') {
            throw new Error('Insufficient funds');
        }

        // Update wallet balance
        const user = await db.PlatformUser.findByPk(platformUserId);
        if (!user) {
            throw new Error('User not found');
        }

        await user.increment('walletBalance', { by: parseFloat(amount) });

        // Create transaction
        const transaction = await db.Transaction.create({
            platformUserId,
            amount: parseFloat(amount),
            currency: 'SAR',
            type: 'wallet_topup',
            status: 'completed',
            metadata: {
                cardLast4: cardNumber.slice(-4),
                fakePayment: true
            }
        });

        return {
            transaction,
            newBalance: parseFloat(user.walletBalance) + parseFloat(amount)
        };
    }
}

module.exports = new PaymentService();

