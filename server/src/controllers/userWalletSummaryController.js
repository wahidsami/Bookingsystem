'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const walletService = require('../services/walletService');
const { GIFT_SOURCES } = require('../constants/giftSources');
const { PAYMENT_SOURCE_PRIORITY } = require('../constants/paymentSourcePriority');

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const sumBy = (rows, field) => rows.reduce((sum, row) => sum + toNumber(row?.[field], 0), 0);

exports.getWalletSummary = async (req, res) => {
    try {
        const platformUserId = req.userId;
        if (!platformUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const [walletBalance, tenantRows, globalGiftRows] = await Promise.all([
            walletService.getBalance(platformUserId),
            db.TenantWalletBalance.findAll({
                where: { platformUserId },
                include: [{ model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }],
                order: [['updatedAt', 'DESC']]
            }),
            db.GiftCardTransaction.findAll({
                where: {
                    [Op.or]: [
                        { senderPlatformUserId: platformUserId },
                        { recipientPlatformUserId: platformUserId }
                    ]
                },
                attributes: [
                    'id',
                    'senderPlatformUserId',
                    'recipientPlatformUserId',
                    'status',
                    'totalCreditAmount',
                    'purchaseAmount',
                    'createdAt'
                ],
                order: [['createdAt', 'DESC']],
                limit: 200
            })
        ]);

        const tenantGiftBalances = tenantRows
            .map((row) => ({
                sourceType: GIFT_SOURCES.TENANT_GIFT,
                tenantId: row.tenantId,
                tenantName: row.tenant?.name || row.tenant?.name_en || row.tenant?.name_ar || null,
                balance: toNumber(row.balance, 0),
                currency: row.currency || 'SAR',
                updatedAt: row.updatedAt
            }))
            .filter((entry) => entry.balance > 0);

        const globalReceivedRows = globalGiftRows.filter((row) =>
            row.recipientPlatformUserId === platformUserId && ['redeemed', 'sent_completed_auto_wallet'].includes((row.status || '').toLowerCase())
        );
        const globalPendingRows = globalGiftRows.filter((row) =>
            row.senderPlatformUserId === platformUserId && ['sent_pending_claim', 'sent_pending_external_redeem'].includes((row.status || '').toLowerCase())
        );

        const platformGiftStats = {
            sourceType: GIFT_SOURCES.PLATFORM_GIFT,
            receivedTotal: sumBy(globalReceivedRows, 'totalCreditAmount'),
            pendingToOthersTotal: sumBy(globalPendingRows, 'totalCreditAmount'),
            sentPurchaseTotal: sumBy(globalGiftRows.filter((row) => row.senderPlatformUserId === platformUserId), 'purchaseAmount'),
            transactionCount: globalGiftRows.length
        };

        return res.json({
            success: true,
            summary: {
                paymentSourcePriority: PAYMENT_SOURCE_PRIORITY,
                wallet: {
                    sourceType: GIFT_SOURCES.WALLET,
                    balance: toNumber(walletBalance, 0),
                    currency: 'SAR'
                },
                platformGift: platformGiftStats,
                tenantGiftBalances
            }
        });
    } catch (error) {
        console.error('Get wallet summary error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load wallet summary' });
    }
};

