'use strict';

const db = require('../models');

const toMoney = (value) => Number.parseFloat((Number.parseFloat(value || 0)).toFixed(2));

class TenantGiftSettlementService {
    async createPendingSettlement({
        tenantId,
        transactionId,
        packageId,
        grossAmount,
        platformFeeAmount = 0,
        metadata = {},
        transaction: externalTransaction = null,
        forensicTrace = null
    }) {
        if (!tenantId || !transactionId || !packageId) {
            throw new Error('tenantId, transactionId, and packageId are required');
        }

        const gross = toMoney(grossAmount);
        const fee = toMoney(platformFeeAmount);
        const net = toMoney(gross - fee);

        if (gross <= 0) {
            throw new Error('grossAmount must be greater than 0');
        }
        if (net < 0) {
            throw new Error('netTenantPayableAmount cannot be negative');
        }

        const createOptions = {
            ...(externalTransaction ? { transaction: externalTransaction } : undefined),
            ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
        };

        return db.TenantGiftCardSettlement.create({
            tenantId,
            transactionId,
            packageId,
            grossAmount: gross,
            platformFeeAmount: fee,
            netTenantPayableAmount: net,
            settledAmount: 0,
            status: 'pending',
            metadata: metadata || {}
        }, createOptions);
    }
}

module.exports = new TenantGiftSettlementService();
