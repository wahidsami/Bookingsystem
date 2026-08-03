const db = require('../models');

/**
 * Service to record revenue-generating operations into the canonical FinancialLedgerEntry.
 */
class FinancialLedgerService {
    /**
     * @param {Object} params
     * @param {string} params.tenantId - UUID of the tenant
     * @param {string} params.customerId - UUID of the customer (optional)
     * @param {string} params.entityType - 'Booking', 'Order', 'PosReceipt', 'WalletTopup', 'GiftCard', etc.
     * @param {string} params.entityId - UUID of the entity
     * @param {number} params.amount - Amount (positive for revenue, negative for refunds)
     * @param {string} params.currency - ISO currency code (default: 'SAR')
     * @param {string} params.paymentMethod - Payment method (e.g. 'cash', 'card', 'mada', 'wallet', 'applepay')
     * @param {string} params.status - 'completed', 'refunded'
     * @param {string} params.description - Optional description
     * @param {import('sequelize').Transaction} transaction - Sequelize transaction object
     */
    static async recordRevenue({
        tenantId,
        customerId = null,
        entityType,
        entityId,
        amount,
        currency = 'SAR',
        paymentMethod = null,
        status = 'completed',
        description = null,
    }, transaction = null) {
        if (!tenantId || !entityType || !entityId || amount === undefined) {
            throw new Error('Missing required fields for FinancialLedgerEntry');
        }

        // return db.FinancialLedgerEntry.create({
        //     tenantId,
        //     customerId,
        //     entityType,
        //     entityId,
        //     amount,
        //     currency,
        //     paymentMethod,
        //     status,
        //     description,
        // }, { transaction });
        return null;
    }
}

module.exports = FinancialLedgerService;
