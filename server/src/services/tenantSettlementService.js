'use strict';

const db = require('../models');
const { Op } = require('sequelize');

const toMoney = (value) => Number.parseFloat((Number.parseFloat(value || 0)).toFixed(2));

class TenantSettlementService {
    /**
     * Record a tenant settlement ledger entry
     */
    async recordSettlementEntry({
        tenantId,
        sourceTransactionId = null,
        sourceType,
        grossAmount,
        platformFeeAmount = 0.00,
        gatewayFeeAmount = 0.00,
        refundAmount = 0.00,
        adjustmentAmount = 0.00,
        netPayableAmount = null,
        status = 'pending',
        settlementPeriod = null,
        settlementReference = null,
        settledAt = null,
        metadata = {},
        transaction: externalTransaction = null
    }) {
        if (!tenantId || !sourceType) {
            throw new Error('tenantId and sourceType are required for settlement entry');
        }

        const gross = toMoney(grossAmount);
        const platformFee = toMoney(platformFeeAmount);
        const gatewayFee = toMoney(gatewayFeeAmount);
        const refund = toMoney(refundAmount);
        const adjustment = toMoney(adjustmentAmount);

        // Calculate net payable if not provided: gross - platformFee - gatewayFee - refund + adjustment
        const calculatedNet = netPayableAmount !== null
            ? toMoney(netPayableAmount)
            : toMoney(gross - platformFee - gatewayFee - refund + adjustment);

        const now = new Date();
        const period = settlementPeriod || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const createOptions = externalTransaction ? { transaction: externalTransaction } : {};

        return db.TenantSettlement.create({
            tenantId,
            sourceTransactionId,
            sourceType,
            grossAmount: gross,
            platformFeeAmount: platformFee,
            gatewayFeeAmount: gatewayFee,
            refundAmount: refund,
            adjustmentAmount: adjustment,
            netPayableAmount: calculatedNet,
            status,
            settlementPeriod: period,
            settlementReference,
            settledAt,
            metadata: {
                ...metadata,
                gatewayFeeStatus: gatewayFee === 0 ? 'not_configured' : 'configured'
            }
        }, createOptions);
    }

    /**
     * Get financial settlement summary for a single tenant (Tenant portal view)
     * Strictly isolated to tenantId
     */
    async getTenantSettlementSummary(tenantId, options = {}) {
        if (!tenantId) throw new Error('tenantId is required');

        const { startDate, endDate, period } = options;
        const whereClause = { tenantId };

        if (period) {
            whereClause.settlementPeriod = period;
        }

        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
            if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
        }

        // Fetch settlement ledger entries
        const settlementRows = await db.TenantSettlement.findAll({
            where: whereClause,
            include: [
                {
                    model: db.Transaction,
                    as: 'transaction',
                    attributes: ['id', 'amount', 'type', 'status', 'createdAt', 'metadata'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Categorize by sourceType
        let onlineBookingsGross = 0;
        let onlineBookingsFees = 0;
        let onlineOrdersGross = 0;
        let onlineOrdersFees = 0;
        let walletRechargesGross = 0;
        let walletRechargesFees = 0;
        let totalGross = 0;
        let totalPlatformFees = 0;
        let totalGatewayFees = 0;
        let totalRefunds = 0;
        let totalAdjustments = 0;
        let totalNetPayable = 0;
        let totalSettled = 0;

        const transactions = settlementRows.map(row => {
            const gross = toMoney(row.grossAmount);
            const pFee = toMoney(row.platformFeeAmount);
            const gFee = toMoney(row.gatewayFeeAmount);
            const ref = toMoney(row.refundAmount);
            const adj = toMoney(row.adjustmentAmount);
            const net = toMoney(row.netPayableAmount);
            const isSettled = row.status === 'settled';

            totalGross += gross;
            totalPlatformFees += pFee;
            totalGatewayFees += gFee;
            totalRefunds += ref;
            totalAdjustments += adj;
            totalNetPayable += net;
            if (isSettled) totalSettled += net;

            if (row.sourceType === 'booking') {
                onlineBookingsGross += gross;
                onlineBookingsFees += pFee;
            } else if (row.sourceType === 'product_order') {
                onlineOrdersGross += gross;
                onlineOrdersFees += pFee;
            } else if (row.sourceType === 'wallet_recharge') {
                walletRechargesGross += gross;
                walletRechargesFees += pFee;
            }

            return {
                id: row.id,
                sourceTransactionId: row.sourceTransactionId,
                sourceType: row.sourceType,
                grossAmount: gross,
                platformFeeAmount: pFee,
                gatewayFeeAmount: gFee,
                refundAmount: ref,
                adjustmentAmount: adj,
                netPayableAmount: net,
                status: row.status,
                settlementPeriod: row.settlementPeriod,
                settlementReference: row.settlementReference,
                settledAt: row.settledAt,
                createdAt: row.createdAt,
                metadata: row.metadata
            };
        });

        const remainingPayable = toMoney(totalNetPayable - totalSettled);

        return {
            tenantId,
            period: period || 'all',
            summary: {
                onlineBookings: {
                    gross: toMoney(onlineBookingsGross),
                    fees: toMoney(onlineBookingsFees),
                    net: toMoney(onlineBookingsGross - onlineBookingsFees)
                },
                onlineOrders: {
                    gross: toMoney(onlineOrdersGross),
                    fees: toMoney(onlineOrdersFees),
                    net: toMoney(onlineOrdersGross - onlineOrdersFees)
                },
                customerWalletRecharges: {
                    gross: toMoney(walletRechargesGross),
                    fees: toMoney(walletRechargesFees),
                    net: toMoney(walletRechargesGross - walletRechargesFees)
                },
                grossRevenue: toMoney(totalGross),
                platformFees: toMoney(totalPlatformFees),
                gatewayFees: toMoney(totalGatewayFees),
                refunds: toMoney(totalRefunds),
                adjustments: toMoney(totalAdjustments),
                netAmountPayable: toMoney(totalNetPayable),
                settledAmount: toMoney(totalSettled),
                remainingAmount: remainingPayable
            },
            transactionsCount: transactions.length,
            transactions
        };
    }

    /**
     * Get platform-wide settlement report (Super Admin view)
     * Filterable by tenantId, date range, status, settlementPeriod
     */
    async getSuperAdminSettlementReport(options = {}) {
        const { tenantId, startDate, endDate, status, settlementPeriod } = options;

        const whereClause = {};
        if (tenantId) whereClause.tenantId = tenantId;
        if (status) whereClause.status = status;
        if (settlementPeriod) whereClause.settlementPeriod = settlementPeriod;

        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
            if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
        }

        const settlements = await db.TenantSettlement.findAll({
            where: whereClause,
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'email', 'phone', 'city'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Group by tenantId and settlementPeriod
        const groups = new Map();

        settlements.forEach(row => {
            const key = `${row.tenantId}_${row.settlementPeriod}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    tenantId: row.tenantId,
                    tenantName: row.tenant?.name || row.tenant?.name_ar || row.tenant?.name_en || 'Unknown Salon',
                    tenantCity: row.tenant?.city || '-',
                    settlementPeriod: row.settlementPeriod,
                    onlineBookingRevenue: 0,
                    onlineOrderRevenue: 0,
                    walletCardRecharges: 0,
                    grossTotal: 0,
                    platformFees: 0,
                    gatewayFees: 0,
                    refunds: 0,
                    adjustments: 0,
                    netPayable: 0,
                    settledAmount: 0,
                    settlementStatus: 'pending',
                    settlementDate: null,
                    settlementReference: null,
                    transactionCount: 0,
                    transactionIds: []
                });
            }

            const item = groups.get(key);
            const gross = toMoney(row.grossAmount);
            const pFee = toMoney(row.platformFeeAmount);
            const gFee = toMoney(row.gatewayFeeAmount);
            const ref = toMoney(row.refundAmount);
            const adj = toMoney(row.adjustmentAmount);
            const net = toMoney(row.netPayableAmount);

            item.grossTotal += gross;
            item.platformFees += pFee;
            item.gatewayFees += gFee;
            item.refunds += ref;
            item.adjustments += adj;
            item.netPayable += net;
            item.transactionCount += 1;
            if (row.sourceTransactionId) {
                item.transactionIds.push(row.sourceTransactionId);
            }

            if (row.sourceType === 'booking') {
                item.onlineBookingRevenue += gross;
            } else if (row.sourceType === 'product_order') {
                item.onlineOrderRevenue += gross;
            } else if (row.sourceType === 'wallet_recharge') {
                item.walletCardRecharges += gross;
            }

            if (row.status === 'settled') {
                item.settledAmount += net;
                item.settlementDate = row.settledAt;
                item.settlementReference = row.settlementReference;
            }
        });

        // Normalize group totals and status
        const rows = Array.from(groups.values()).map(g => {
            g.onlineBookingRevenue = toMoney(g.onlineBookingRevenue);
            g.onlineOrderRevenue = toMoney(g.onlineOrderRevenue);
            g.walletCardRecharges = toMoney(g.walletCardRecharges);
            g.grossTotal = toMoney(g.grossTotal);
            g.platformFees = toMoney(g.platformFees);
            g.gatewayFees = toMoney(g.gatewayFees);
            g.refunds = toMoney(g.refunds);
            g.adjustments = toMoney(g.adjustments);
            g.netPayable = toMoney(g.netPayable);
            g.settledAmount = toMoney(g.settledAmount);
            g.remainingPayable = toMoney(g.netPayable - g.settledAmount);

            if (g.settledAmount >= g.netPayable && g.netPayable > 0) {
                g.settlementStatus = 'settled';
            } else if (g.settledAmount > 0) {
                g.settlementStatus = 'partially_settled';
            } else {
                g.settlementStatus = 'pending';
            }
            return g;
        });

        const overallTotals = rows.reduce((acc, r) => ({
            totalGross: toMoney(acc.totalGross + r.grossTotal),
            totalPlatformFees: toMoney(acc.totalPlatformFees + r.platformFees),
            totalGatewayFees: toMoney(acc.totalGatewayFees + r.gatewayFees),
            totalRefunds: toMoney(acc.totalRefunds + r.refunds),
            totalAdjustments: toMoney(acc.totalAdjustments + r.adjustments),
            totalNetPayable: toMoney(acc.totalNetPayable + r.netPayable),
            totalSettled: toMoney(acc.totalSettled + r.settledAmount),
            totalRemaining: toMoney(acc.totalRemaining + r.remainingPayable),
            totalTransactions: acc.totalTransactions + r.transactionCount
        }), {
            totalGross: 0,
            totalPlatformFees: 0,
            totalGatewayFees: 0,
            totalRefunds: 0,
            totalAdjustments: 0,
            totalNetPayable: 0,
            totalSettled: 0,
            totalRemaining: 0,
            totalTransactions: 0
        });

        return {
            success: true,
            filters: { tenantId: tenantId || null, status: status || null, settlementPeriod: settlementPeriod || null },
            totals: overallTotals,
            recordsCount: rows.length,
            rows
        };
    }

    /**
     * Get transaction drill-down for Super Admin
     */
    async getSuperAdminTenantTransactions(tenantId, options = {}) {
        if (!tenantId) throw new Error('tenantId is required');
        const { limit = 50, offset = 0, sourceType, status } = options;

        const where = { tenantId };
        if (sourceType) where.sourceType = sourceType;
        if (status) where.status = status;

        const { count, rows } = await db.TenantSettlement.findAndCountAll({
            where,
            include: [
                {
                    model: db.Transaction,
                    as: 'transaction',
                    attributes: ['id', 'amount', 'type', 'status', 'createdAt', 'metadata'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: Number(limit) || 50,
            offset: Number(offset) || 0
        });

        return {
            success: true,
            tenantId,
            totalCount: count,
            rows: rows.map(r => ({
                id: r.id,
                sourceTransactionId: r.sourceTransactionId,
                sourceType: r.sourceType,
                grossAmount: toMoney(r.grossAmount),
                platformFeeAmount: toMoney(r.platformFeeAmount),
                gatewayFeeAmount: toMoney(r.gatewayFeeAmount),
                refundAmount: toMoney(r.refundAmount),
                adjustmentAmount: toMoney(r.adjustmentAmount),
                netPayableAmount: toMoney(r.netPayableAmount),
                status: r.status,
                settlementPeriod: r.settlementPeriod,
                settlementReference: r.settlementReference,
                settledAt: r.settledAt,
                createdAt: r.createdAt,
                metadata: r.metadata
            }))
        };
    }
}

module.exports = new TenantSettlementService();
