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

        console.log('[DIAGNOSTIC] Entering FinancialLedgerService.recordRevenue()');
        try {
            const dbName = await db.sequelize.query('SELECT current_database();', { type: db.sequelize.QueryTypes.SELECT, transaction });
            console.log('[DIAGNOSTIC] current_database:', dbName[0]);
            
            const schemaName = await db.sequelize.query('SELECT current_schema();', { type: db.sequelize.QueryTypes.SELECT, transaction });
            console.log('[DIAGNOSTIC] current_schema:', schemaName[0]);
            
            console.log('[DIAGNOSTIC] process.env.DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : 'undefined');
            console.log('[DIAGNOSTIC] Sequelize database name:', db.sequelize.config.database);

            const regClass = await db.sequelize.query("SELECT to_regclass('public.financial_ledger_entries');", { type: db.sequelize.QueryTypes.SELECT, transaction });
            console.log('[DIAGNOSTIC] to_regclass result:', regClass[0]);

            return await db.FinancialLedgerEntry.create({
                tenantId,
                customerId,
                entityType,
                entityId,
                amount,
                currency,
                paymentMethod,
                status,
                description,
            }, { transaction });
        } catch (error) {
            console.log('[DIAGNOSTIC] FULL ERROR in recordRevenue:', {
                message: error.message,
                stack: error.stack,
                parent: error.parent,
                original: error.original,
                sql: error.sql
            });
            throw error;
        }
    }
}

module.exports = FinancialLedgerService;
