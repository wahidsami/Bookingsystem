'use strict';

const db = require('../models');

const SUPPORTED_LEDGER_TYPES = new Set([
    'topup',
    'gift_purchase',
    'gift_sent_debit',
    'gift_received_credit',
    'service_payment_debit',
    'product_payment_debit',
    'refund_credit',
    'admin_adjustment'
]);

const toAmount = (value) => {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) {
        throw new Error('Invalid wallet amount');
    }
    return amount;
};

class WalletService {
    async getBalance(platformUserId) {
        const user = await db.PlatformUser.findByPk(platformUserId, {
            attributes: ['id', 'walletBalance']
        });
        if (!user) {
            throw new Error('User not found');
        }
        return Number.parseFloat(user.walletBalance || 0);
    }

    async getLedger(platformUserId, { limit = 50, offset = 0 } = {}) {
        const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
        const safeOffset = Math.max(0, Number(offset) || 0);

        return db.WalletLedgerEntry.findAll({
            where: { platformUserId },
            order: [['createdAt', 'DESC']],
            limit: safeLimit,
            offset: safeOffset
        });
    }

    async creditWallet({
        platformUserId,
        amount,
        type = 'topup',
        referenceType = null,
        referenceId = null,
        metadata = {},
        transaction: externalTransaction = null,
        forensicTrace = null
    }) {
        return this.#applyWalletDelta({
            platformUserId,
            amount,
            direction: 'credit',
            type,
            referenceType,
            referenceId,
            metadata,
            externalTransaction,
            forensicTrace
        });
    }

    async debitWallet({
        platformUserId,
        amount,
        type,
        referenceType = null,
        referenceId = null,
        metadata = {},
        transaction: externalTransaction = null,
        forensicTrace = null
    }) {
        return this.#applyWalletDelta({
            platformUserId,
            amount,
            direction: 'debit',
            type,
            referenceType,
            referenceId,
            metadata,
            externalTransaction,
            forensicTrace
        });
    }

    async #applyWalletDelta({
        platformUserId,
        amount,
        direction,
        type,
        referenceType,
        referenceId,
        metadata,
        externalTransaction,
        forensicTrace
    }) {
        if (!platformUserId) {
            throw new Error('platformUserId is required');
        }
        if (!SUPPORTED_LEDGER_TYPES.has(type)) {
            throw new Error('Unsupported wallet ledger type');
        }

        const normalizedAmount = toAmount(amount);
        if (normalizedAmount <= 0) {
            throw new Error('Wallet amount must be greater than 0');
        }

        const shouldCommit = !externalTransaction;
        const transaction = externalTransaction || await db.sequelize.transaction();

        try {
            const user = await db.PlatformUser.findByPk(platformUserId, {
                transaction,
                lock: transaction.LOCK.UPDATE,
                ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
            });

            if (!user) {
                throw new Error('User not found');
            }

            const balanceBefore = Number.parseFloat(user.walletBalance || 0);
            const delta = direction === 'debit' ? -normalizedAmount : normalizedAmount;
            const balanceAfter = Number.parseFloat((balanceBefore + delta).toFixed(2));

            if (balanceAfter < 0) {
                throw new Error('Insufficient wallet balance');
            }

            user.walletBalance = balanceAfter;
            await user.save({ transaction, ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {}) });

            const ledgerEntry = await db.WalletLedgerEntry.create({
                platformUserId,
                type,
                direction,
                amount: normalizedAmount,
                currency: 'SAR',
                balanceBefore,
                balanceAfter,
                referenceType,
                referenceId,
                metadata: metadata || {}
            }, {
                transaction,
                ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
            });

            if (shouldCommit) {
                await transaction.commit();
            }

            return {
                ledgerEntry,
                balanceBefore,
                balanceAfter
            };
        } catch (error) {
            if (shouldCommit && transaction && !transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    }
}

module.exports = new WalletService();
