'use strict';

const db = require('../models');

const SUPPORTED_LEDGER_TYPES = new Set([
    'tenant_gift_credit',
    'tenant_gift_redeem_debit',
    'tenant_gift_refund_credit',
    'tenant_gift_admin_adjustment',
    'tenant_manual_topup_credit'
]);

const toAmount = (value) => {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) {
        throw new Error('Invalid tenant wallet amount');
    }
    return amount;
};

class TenantWalletService {
    async getTenantBalance(platformUserId, tenantId) {
        if (!platformUserId || !tenantId) {
            throw new Error('platformUserId and tenantId are required');
        }

        const row = await db.TenantWalletBalance.findOne({
            where: { platformUserId, tenantId }
        });

        return Number.parseFloat(row?.balance || 0);
    }

    async getTenantLedger(platformUserId, tenantId, { limit = 50, offset = 0 } = {}) {
        const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
        const safeOffset = Math.max(0, Number(offset) || 0);

        return db.TenantWalletLedgerEntry.findAll({
            where: { platformUserId, tenantId },
            order: [['createdAt', 'DESC']],
            limit: safeLimit,
            offset: safeOffset
        });
    }

    async creditTenantWallet({
        platformUserId,
        tenantId,
        amount,
        type = 'tenant_gift_credit',
        referenceType = null,
        referenceId = null,
        metadata = {},
        transaction: externalTransaction = null,
        forensicTrace = null
    }) {
        return this.#applyDelta({
            platformUserId,
            tenantId,
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

    async debitTenantWallet({
        platformUserId,
        tenantId,
        amount,
        type = 'tenant_gift_redeem_debit',
        referenceType = null,
        referenceId = null,
        metadata = {},
        transaction: externalTransaction = null,
        forensicTrace = null
    }) {
        return this.#applyDelta({
            platformUserId,
            tenantId,
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

    async assertCanSpendFromTenantWallet({ platformUserId, tenantId, amount }) {
        const normalizedAmount = toAmount(amount);
        if (normalizedAmount <= 0) {
            throw new Error('Amount must be greater than 0');
        }
        const balance = await this.getTenantBalance(platformUserId, tenantId);
        if (balance < normalizedAmount) {
            throw new Error('Insufficient tenant gift wallet balance');
        }
        return true;
    }

    async #applyDelta({
        platformUserId,
        tenantId,
        amount,
        direction,
        type,
        referenceType,
        referenceId,
        metadata,
        externalTransaction,
        forensicTrace
    }) {
        if (!platformUserId || !tenantId) {
            throw new Error('platformUserId and tenantId are required');
        }
        if (!SUPPORTED_LEDGER_TYPES.has(type)) {
            throw new Error('Unsupported tenant wallet ledger type');
        }

        const normalizedAmount = toAmount(amount);
        if (normalizedAmount <= 0) {
            throw new Error('Tenant wallet amount must be greater than 0');
        }

        const shouldCommit = !externalTransaction;
        const transaction = externalTransaction || await db.sequelize.transaction();

        try {
            const [balanceRow] = await db.TenantWalletBalance.findOrCreate({
                where: { platformUserId, tenantId },
                defaults: {
                    platformUserId,
                    tenantId,
                    balance: 0,
                    currency: 'SAR'
                },
                transaction,
                ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
            });

            await balanceRow.reload({ transaction, lock: transaction.LOCK.UPDATE, ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {}) });

            const balanceBefore = Number.parseFloat(balanceRow.balance || 0);
            const delta = direction === 'debit' ? -normalizedAmount : normalizedAmount;
            const balanceAfter = Number.parseFloat((balanceBefore + delta).toFixed(2));

            if (balanceAfter < 0) {
                throw new Error('Insufficient tenant gift wallet balance');
            }

            balanceRow.balance = balanceAfter;
            await balanceRow.save({ transaction, ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {}) });

            const ledgerEntry = await db.TenantWalletLedgerEntry.create({
                platformUserId,
                tenantId,
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

module.exports = new TenantWalletService();
