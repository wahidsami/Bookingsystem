'use strict';

const db = require('../models');
const { Op } = require('sequelize');
const paymentService = require('../services/paymentService');
const tenantWalletService = require('../services/tenantWalletService');
const tenantSettlementService = require('../services/tenantSettlementService');

const toMoney = (value) => Number.parseFloat((Number.parseFloat(value || 0)).toFixed(2));

const normalize = (val) => `${val || ''}`.trim();

const extractIdempotencyKey = (req) => {
    return (
        normalize(req.headers['idempotency-key']) ||
        normalize(req.headers['x-idempotency-key']) ||
        normalize(req.body?.idempotencyKey) ||
        null
    );
};

const crypto = require('crypto');

const computePayloadHash = (payload) => {
    return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
};

const reserveIdempotency = async (platformUserId, key, payload) => {
    if (!key) return null;
    const requestHash = computePayloadHash(payload);

    try {
        const [record, created] = await db.PaymentIdempotencyKey.findOrCreate({
            where: {
                platformUserId,
                idempotencyKey: key
            },
            defaults: {
                platformUserId,
                idempotencyKey: key,
                requestHash,
                status: 'processing',
                responsePayload: null
            }
        });

        if (!created) {
            if (record.status === 'completed' && record.responsePayload) {
                return { isCompleted: true, response: record.responsePayload };
            }
            if (record.status === 'processing') {
                const ageMs = Date.now() - new Date(record.createdAt).getTime();
                if (ageMs < 60000) {
                    const conflictError = new Error('Recharge operation already in progress. Please wait.');
                    conflictError.statusCode = 409;
                    throw conflictError;
                }
            }
        }
        return { isCompleted: false, record };
    } catch (err) {
        if (err.statusCode === 409) throw err;
        console.warn('Idempotency reservation notice:', err.message);
        return null;
    }
};

const completeIdempotency = async (idempotencyResult, responsePayload) => {
    if (idempotencyResult?.record) {
        await idempotencyResult.record.update({
            status: 'completed',
            responsePayload
        }).catch((e) => console.warn('Idempotency complete update warning:', e.message));
    }
};

const releaseIdempotency = async (idempotencyResult) => {
    if (idempotencyResult?.record) {
        await idempotencyResult.record.destroy().catch((e) => console.warn('Idempotency release warning:', e.message));
    }
};

/**
 * POST /api/v1/users/tenant-wallet/recharge
 * Direct card recharge of a customer's tenant-scoped wallet
 */
exports.rechargeTenantWallet = async (req, res) => {
    let idempotency = null;
    try {
        const platformUserId = req.userId;
        const { tenantId, payment } = req.body || {};
        const rawAmount = req.body?.amount;

        if (!platformUserId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'tenantId is required' });
        }

        const amount = toMoney(rawAmount);
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Valid positive recharge amount is required' });
        }

        // Verify tenant exists and is active
        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Salon/Tenant not found' });
        }

        // Idempotency check
        const idempotencyKey = extractIdempotencyKey(req);
        if (idempotencyKey) {
            idempotency = await reserveIdempotency(platformUserId, idempotencyKey, { tenantId, amount });
            if (idempotency?.isCompleted) {
                return res.status(200).json(idempotency.response);
            }
        }

        // Validate card details
        const cardNumber = normalize(payment?.cardNumber);
        const expiryDate = normalize(payment?.expiryDate);
        const cvv = normalize(payment?.cvv);
        const cardholderName = normalize(payment?.cardholderName) || 'Valued Customer';

        paymentService.validateCard(cardNumber, expiryDate, cvv);

        const cleanedCard = cardNumber.replace(/[\s-]/g, '');

        // Simulated card decline checks
        if (cleanedCard === '4000000000000002') {
            await releaseIdempotency(idempotency);
            return res.status(402).json({ success: false, message: 'Card declined by issuing bank', code: 'CARD_DECLINED' });
        }
        if (cleanedCard === '4000000000009995') {
            await releaseIdempotency(idempotency);
            return res.status(402).json({ success: false, message: 'Insufficient funds on payment card', code: 'INSUFFICIENT_FUNDS' });
        }

        // Commission lookup from TenantSettings (do NOT invent commission if unconfigured)
        const tenantSettings = await db.TenantSettings.findOne({ where: { tenantId } });
        let platformFee = 0.00;
        let commissionStatus = 'not_configured';
        const commissionRate = tenantSettings?.commissionRate != null ? Number(tenantSettings.commissionRate) : null;

        if (commissionRate !== null && !isNaN(commissionRate) && commissionRate >= 0) {
            platformFee = toMoney(amount * (commissionRate / 100));
            commissionStatus = 'configured';
        }

        const tenantRevenue = toMoney(amount - platformFee);
        const cardBrand = paymentService.getCardBrand(cleanedCard);
        const cardLast4 = cleanedCard.slice(-4);

        // Execute atomic financial transaction
        const dbTx = await db.sequelize.transaction();
        try {
            // 1. Create Transaction (authoritative platform financial record)
            const transaction = await db.Transaction.create({
                platformUserId,
                tenantId,
                amount,
                currency: 'SAR',
                type: 'wallet_topup',
                status: 'completed',
                platformFee,
                tenantRevenue,
                metadata: {
                    subType: 'tenant_wallet_card_recharge',
                    cardLast4,
                    cardBrand,
                    cardholderName,
                    commissionRate,
                    commissionStatus,
                    gatewayFeeAmount: 0.00,
                    gatewayFeeStatus: 'not_configured',
                    fakePayment: true
                }
            }, { transaction: dbTx });

            // 2. Credit Customer's Tenant-Scoped Wallet & create TenantWalletLedgerEntry
            const walletCreditResult = await tenantWalletService.creditTenantWallet({
                platformUserId,
                tenantId,
                amount,
                type: 'tenant_wallet_card_recharge',
                referenceType: 'transaction',
                referenceId: transaction.id,
                metadata: {
                    source: 'direct_card_recharge',
                    transactionId: transaction.id,
                    cardLast4,
                    cardBrand
                },
                transaction: dbTx
            });

            // 3. Create Tenant Settlement Ledger Entry (gross, fee, net payable)
            const now = new Date();
            const settlementPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const settlement = await tenantSettlementService.recordSettlementEntry({
                tenantId,
                sourceTransactionId: transaction.id,
                sourceType: 'wallet_recharge',
                grossAmount: amount,
                platformFeeAmount: platformFee,
                gatewayFeeAmount: 0.00,
                refundAmount: 0.00,
                adjustmentAmount: 0.00,
                netPayableAmount: tenantRevenue,
                status: 'pending',
                settlementPeriod,
                metadata: {
                    platformUserId,
                    cardLast4,
                    commissionRate,
                    commissionStatus
                },
                transaction: dbTx
            });

            await dbTx.commit();

            const responsePayload = {
                success: true,
                message: 'Tenant wallet recharged successfully',
                tenantId,
                tenantName: tenant.name_ar || tenant.name || tenant.name_en,
                rechargeAmount: amount,
                currency: 'SAR',
                balanceBefore: walletCreditResult.balanceBefore,
                balanceAfter: walletCreditResult.balanceAfter,
                transactionId: transaction.id,
                settlementId: settlement.id,
                platformFee,
                netPayable: tenantRevenue,
                createdAt: transaction.createdAt
            };

            await completeIdempotency(idempotency, responsePayload);

            return res.status(200).json(responsePayload);
        } catch (txError) {
            await dbTx.rollback();
            throw txError;
        }
    } catch (error) {
        console.error('Direct tenant wallet recharge error:', error);
        if (idempotency) {
            await releaseIdempotency(idempotency);
        }
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to complete wallet recharge'
        });
    }
};

/**
 * POST /api/v1/users/tenant-wallet/refund
 * Explicit accounting refund for direct wallet recharge
 */
exports.refundTenantWalletRecharge = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const { transactionId, reason } = req.body || {};

        if (!transactionId) {
            return res.status(400).json({ success: false, message: 'transactionId is required' });
        }

        const transaction = await db.Transaction.findOne({
            where: {
                id: transactionId,
                platformUserId,
                type: 'wallet_topup',
                status: 'completed'
            }
        });

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Eligible completed recharge transaction not found' });
        }

        const refundAmount = toMoney(transaction.amount);
        const tenantId = transaction.tenantId;

        // Check if customer has enough wallet balance remaining
        const currentBalance = await tenantWalletService.getTenantBalance(platformUserId, tenantId);
        if (currentBalance < refundAmount) {
            return res.status(400).json({
                success: false,
                message: `Cannot refund: Current balance (${currentBalance.toFixed(2)} SAR) is less than recharge amount (${refundAmount.toFixed(2)} SAR). Customer has already spent part of this credit.`
            });
        }

        const dbTx = await db.sequelize.transaction();
        try {
            // 1. Debit tenant wallet
            const debitResult = await tenantWalletService.debitTenantWallet({
                platformUserId,
                tenantId,
                amount: refundAmount,
                type: 'tenant_wallet_card_recharge_refund',
                referenceType: 'transaction',
                referenceId: transaction.id,
                metadata: {
                    source: 'recharge_refund',
                    reason: reason || 'Customer requested refund'
                },
                transaction: dbTx
            });

            // 2. Mark Transaction refunded
            await transaction.update({
                status: 'refunded',
                metadata: {
                    ...transaction.metadata,
                    refundedAt: new Date(),
                    refundReason: reason || 'Customer refund'
                }
            }, { transaction: dbTx });

            // 3. Update or create settlement refund reversal entry
            const originalSettlement = await db.TenantSettlement.findOne({
                where: { sourceTransactionId: transaction.id },
                transaction: dbTx
            });

            if (originalSettlement) {
                await originalSettlement.update({
                    refundAmount: refundAmount,
                    netPayableAmount: 0.00,
                    status: 'cancelled',
                    metadata: {
                        ...originalSettlement.metadata,
                        cancelledReason: 'Transaction refunded'
                    }
                }, { transaction: dbTx });
            }

            await dbTx.commit();

            return res.json({
                success: true,
                message: 'Wallet recharge refunded successfully',
                refundAmount,
                balanceBefore: debitResult.balanceBefore,
                balanceAfter: debitResult.balanceAfter
            });
        } catch (err) {
            await dbTx.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Wallet recharge refund error:', error);
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Failed to process refund'
        });
    }
};
