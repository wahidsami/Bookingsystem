const paymentService = require('../services/paymentService');
const db = require('../models');
const crypto = require('crypto');
const logger = require('../utils/productionLogger');
const { handlePaymentError } = require('../utils/paymentErrorHandler');
const walletService = require('../services/walletService');

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const IDEMPOTENCY_MAX_LENGTH = 191;
const IDEMPOTENCY_PROCESSING_TTL_MS = 2 * 60 * 1000;

const normalizeIdempotencyKey = (value) => {
    const raw = `${value || ''}`.trim();
    if (!raw) return null;
    return raw.slice(0, IDEMPOTENCY_MAX_LENGTH);
};

const buildPaymentRequestHash = (payload) => crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

/**
 * Process payment for booking or order
 * POST /api/v1/payments/process
 */
const processPayment = async (req, res, next) => {
    let idempotencyRecord = null;
    let idempotencyKey = null;
    try {
        const {
            appointmentId,
            orderId,
            bookingSessionId,
            amount,
            cardNumber,
            expiryDate,
            cvv,
            cardholderName,
            saveCard,
            tenantId,
            paymentChoice,
            paymentMethod,
            idempotencyKey: bodyIdempotencyKey
        } = req.body;
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
        if (!appointmentId && !orderId && !bookingSessionId) missingFields.push('appointmentId or orderId or bookingSessionId');
        if (!amount) missingFields.push('amount');
        const normalizedPaymentMethod = `${paymentMethod || 'card'}`.trim().toLowerCase();
        const isWalletPayment = normalizedPaymentMethod === 'wallet';
        idempotencyKey = normalizeIdempotencyKey(req.headers[IDEMPOTENCY_HEADER] || bodyIdempotencyKey);

        const idempotencyPayload = {
            platformUserId,
            appointmentId: appointmentId || null,
            orderId: orderId || null,
            bookingSessionId: bookingSessionId || null,
            amount: Number(parseFloat(amount || 0).toFixed(2)),
            paymentMethod: normalizedPaymentMethod,
            paymentChoice: paymentChoice || null
        };
        const requestHash = buildPaymentRequestHash(idempotencyPayload);

        if (idempotencyKey) {
            idempotencyRecord = await db.PaymentIdempotencyKey.findOne({
                where: { platformUserId, idempotencyKey }
            });

            if (idempotencyRecord) {
                if (idempotencyRecord.requestHash !== requestHash) {
                    return res.status(409).json({
                        success: false,
                        message: 'This idempotency key was already used with different payment data.'
                    });
                }

                if (idempotencyRecord.status === 'completed' && idempotencyRecord.responsePayload) {
                    res.setHeader('x-idempotency-replayed', 'true');
                    return res.json(idempotencyRecord.responsePayload);
                }

                const isStillProcessing = idempotencyRecord.status === 'processing'
                    && (Date.now() - new Date(idempotencyRecord.updatedAt).getTime()) < IDEMPOTENCY_PROCESSING_TTL_MS;

                if (isStillProcessing) {
                    return res.status(409).json({
                        success: false,
                        message: 'Payment is already being processed. Please wait a moment and retry.'
                    });
                }

                await idempotencyRecord.update({
                    status: 'processing',
                    responsePayload: null,
                    errorMessage: null,
                    requestHash
                });
            } else {
                idempotencyRecord = await db.PaymentIdempotencyKey.create({
                    platformUserId,
                    idempotencyKey,
                    requestHash,
                    status: 'processing',
                    responsePayload: null,
                    errorMessage: null
                });
            }
        }

        if (!isWalletPayment) {
            if (!cardNumber) missingFields.push('cardNumber');
            if (!expiryDate) missingFields.push('expiryDate');
            if (!cvv) missingFields.push('cvv');
            if (!cardholderName) missingFields.push('cardholderName');
        }

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
            hasBookingSession: !!bookingSessionId,
            hasOrder: !!orderId,
            amount: amount
        });

        // Process payment based on type (booking/order/booking-session)
        let result;
        if (bookingSessionId) {
            const session = await db.BookingSession.findByPk(bookingSessionId, {
                include: [{ model: db.Appointment, as: 'appointments' }]
            });

            if (!session) {
                return res.status(404).json({ success: false, message: 'Booking session not found' });
            }
            if (session.platformUserId !== platformUserId) {
                return res.status(403).json({ success: false, message: 'Unauthorized: This booking session does not belong to you' });
            }

            const payableAppointments = (session.appointments || []).filter((appointment) => {
                if (!appointment || appointment.status === 'cancelled') return false;
                const paymentStatus = `${appointment.paymentStatus || ''}`.trim().toLowerCase();
                if (paymentStatus === 'fully_paid' || paymentStatus === 'paid') return false;
                const outstanding = parseFloat((Number(appointment.price || 0) - Number(appointment.totalPaid || 0)).toFixed(2));
                return outstanding > 0.009;
            });

            if (payableAppointments.length === 0) {
                return res.status(400).json({ success: false, message: 'No payable appointments found in this booking session' });
            }

            const requestedAmount = Number(parseFloat(amount).toFixed(2));
            const computedPayableNow = Number(payableAppointments.reduce((sum, appointment) => {
                const paymentMethodRaw = `${appointment.paymentMethod || ''}`.trim().toLowerCase();
                const totalAmount = Number(appointment.price || 0);
                const totalPaid = Number(appointment.totalPaid || 0);
                const depositAmount = Number(appointment.depositAmount || 0);
                const status = `${appointment.paymentStatus || ''}`.trim().toLowerCase();
                if (paymentMethodRaw === 'booking-fee' && status === 'pending' && depositAmount > 0 && totalPaid <= 0.009) {
                    return sum + depositAmount;
                }
                return sum + Math.max(0, totalAmount - totalPaid);
            }, 0).toFixed(2));

            if (Math.abs(requestedAmount - computedPayableNow) > 0.01) {
                return res.status(400).json({
                    success: false,
                    message: `Payment amount must match session due amount of ${computedPayableNow.toFixed(2)} SAR`
                });
            }

            const transactions = [];
            for (const appointment of payableAppointments) {
                const paymentMethodRaw = `${appointment.paymentMethod || ''}`.trim().toLowerCase();
                const totalAmount = Number(appointment.price || 0);
                const totalPaid = Number(appointment.totalPaid || 0);
                const depositAmount = Number(appointment.depositAmount || 0);
                const status = `${appointment.paymentStatus || ''}`.trim().toLowerCase();
                const isInitialDeposit = paymentMethodRaw === 'booking-fee' && status === 'pending' && depositAmount > 0 && totalPaid <= 0.009;
                const appointmentAmount = Number((isInitialDeposit ? depositAmount : Math.max(0, totalAmount - totalPaid)).toFixed(2));
                const appointmentPaymentChoice = isInitialDeposit ? 'booking-fee' : 'online-full';

                const txResult = isWalletPayment
                    ? await paymentService.processWalletPayment({
                        platformUserId,
                        appointmentId: appointment.id,
                        amount: appointmentAmount,
                        tenantId: tenantId || session.tenantId || appointment.tenantId,
                        paymentChoice: appointmentPaymentChoice
                    })
                    : await paymentService.processPayment({
                        platformUserId,
                        appointmentId: appointment.id,
                        amount: appointmentAmount,
                        cardNumber,
                        expiryDate,
                        cvv,
                        cardholderName,
                        saveCard: saveCard || false,
                        tenantId: tenantId || session.tenantId || appointment.tenantId,
                        paymentChoice: appointmentPaymentChoice
                    });

                transactions.push({
                    appointmentId: appointment.id,
                    amount: appointmentAmount,
                    paymentChoice: appointmentPaymentChoice,
                    transactionId: txResult?.transaction?.id || null
                });
            }

            const payload = {
                success: true,
                message: 'Booking session payment processed successfully',
                bookingSessionId: session.id,
                payableAppointments: payableAppointments.length,
                transactions
            };

            if (idempotencyRecord) {
                await idempotencyRecord.update({
                    status: 'completed',
                    responsePayload: payload,
                    errorMessage: null
                });
            }

            return res.json(payload);
        }

        if (isWalletPayment) {
            result = await paymentService.processWalletPayment({
                platformUserId,
                appointmentId,
                orderId,
                amount,
                tenantId,
                paymentChoice
            });
        } else if (orderId) {
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
            result = await paymentService.processPayment({
                platformUserId,
                appointmentId,
                amount,
                cardNumber,
                expiryDate,
                cvv,
                cardholderName,
                saveCard: saveCard || false,
                tenantId,
                paymentChoice
            });
        }

        const payload = {
            success: true,
            message: 'Payment processed successfully',
            transaction: result.transaction,
            paymentMethodId: result.paymentMethodId,
            order: result.order || null
        };

        if (idempotencyRecord) {
            await idempotencyRecord.update({
                status: 'completed',
                responsePayload: payload,
                errorMessage: null
            });
        }

        res.json(payload);
    } catch (error) {
        if (idempotencyRecord) {
            await idempotencyRecord.update({
                status: 'failed',
                errorMessage: `${error?.message || 'Payment failed'}`.slice(0, 500)
            }).catch(() => undefined);
        }
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

/**
 * Get wallet balance
 * GET /api/v1/payments/wallet/balance
 */
const getWalletBalance = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const balance = await walletService.getBalance(platformUserId);

        res.json({
            success: true,
            walletBalance: balance
        });
    } catch (error) {
        console.error('Get wallet balance error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get wallet ledger history
 * GET /api/v1/payments/wallet/ledger
 */
const getWalletLedger = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const { limit = 50, offset = 0 } = req.query;

        const entries = await walletService.getLedger(platformUserId, {
            limit,
            offset
        });

        res.json({
            success: true,
            entries,
            count: entries.length
        });
    } catch (error) {
        console.error('Get wallet ledger error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    processPayment,
    topUpWallet,
    getPaymentHistory,
    getWalletBalance,
    getWalletLedger
};

