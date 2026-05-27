'use strict';

const db = require('../models');
const { Op } = require('sequelize');

const toNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const validatePackageInput = (payload = {}) => {
    const title_en = `${payload.title_en || ''}`.trim();
    const title_ar = `${payload.title_ar || ''}`.trim();
    const priceAmount = toNumber(payload.priceAmount, NaN);
    const walletCreditAmount = toNumber(payload.walletCreditAmount, NaN);
    const bonusAmount = toNumber(payload.bonusAmount, 0);

    if (!title_en || !title_ar) {
        return 'title_en and title_ar are required';
    }
    if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
        return 'priceAmount must be greater than 0';
    }
    if (!Number.isFinite(walletCreditAmount) || walletCreditAmount <= 0) {
        return 'walletCreditAmount must be greater than 0';
    }
    if (!Number.isFinite(bonusAmount) || bonusAmount < 0) {
        return 'bonusAmount cannot be negative';
    }

    return null;
};

const parseReportFilters = (query = {}) => {
    const { status, packageId, startDate, endDate } = query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (packageId) where.packageId = packageId;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    return where;
};

const buildGiftReport = (transactions = []) => {
    const totals = {
        transactionsCount: transactions.length,
        purchaseAmountTotal: 0,
        creditAmountTotal: 0,
        bonusAmountTotal: 0
    };

    const byStatus = {};
    const topPurchasersMap = new Map();
    const topRecipientsMap = new Map();
    const byPackageMap = new Map();

    for (const tx of transactions) {
        const purchase = toNumber(tx.purchaseAmount, 0);
        const credit = toNumber(tx.creditAmount, 0);
        const bonus = toNumber(tx.bonusAmount, 0);
        const totalCredit = toNumber(tx.totalCreditAmount, credit + bonus);

        totals.purchaseAmountTotal += purchase;
        totals.creditAmountTotal += totalCredit;
        totals.bonusAmountTotal += bonus;

        byStatus[tx.status] = (byStatus[tx.status] || 0) + 1;

        const senderId = tx.senderPlatformUserId || 'unknown';
        const senderName = tx.sender
            ? `${tx.sender.firstName || ''} ${tx.sender.lastName || ''}`.trim() || tx.sender.email || 'Unknown'
            : tx.recipientEmail || 'Unknown';
        const senderEmail = tx.sender?.email || null;

        const currentSender = topPurchasersMap.get(senderId) || {
            senderId,
            senderName,
            senderEmail,
            transactionsCount: 0,
            purchaseAmountTotal: 0,
            creditAmountTotal: 0
        };
        currentSender.transactionsCount += 1;
        currentSender.purchaseAmountTotal += purchase;
        currentSender.creditAmountTotal += totalCredit;
        topPurchasersMap.set(senderId, currentSender);

        const recipientId = tx.recipientPlatformUserId || tx.recipientEmail || tx.recipientPhone || 'unknown';
        const recipientName = tx.recipient
            ? `${tx.recipient.firstName || ''} ${tx.recipient.lastName || ''}`.trim() || tx.recipient.email || 'Unknown'
            : tx.recipientEmail || tx.recipientPhone || 'Unknown';
        const recipientEmail = tx.recipient?.email || tx.recipientEmail || null;
        const currentRecipient = topRecipientsMap.get(recipientId) || {
            recipientId,
            recipientName,
            recipientEmail,
            transactionsCount: 0,
            receivedCreditTotal: 0
        };
        currentRecipient.transactionsCount += 1;
        currentRecipient.receivedCreditTotal += totalCredit;
        topRecipientsMap.set(recipientId, currentRecipient);

        const packageIdValue = tx.packageId || 'unknown';
        const packageTitle = tx.package?.title_en || tx.package?.title_ar || 'Unknown package';
        const currentPackage = byPackageMap.get(packageIdValue) || {
            packageId: packageIdValue,
            packageTitle,
            transactionsCount: 0,
            purchaseAmountTotal: 0,
            creditAmountTotal: 0
        };
        currentPackage.transactionsCount += 1;
        currentPackage.purchaseAmountTotal += purchase;
        currentPackage.creditAmountTotal += totalCredit;
        byPackageMap.set(packageIdValue, currentPackage);
    }

    const topPurchasers = Array.from(topPurchasersMap.values()).sort((a, b) => b.purchaseAmountTotal - a.purchaseAmountTotal).slice(0, 10);
    const topRecipients = Array.from(topRecipientsMap.values()).sort((a, b) => b.receivedCreditTotal - a.receivedCreditTotal).slice(0, 10);
    const byPackage = Array.from(byPackageMap.values()).sort((a, b) => b.purchaseAmountTotal - a.purchaseAmountTotal);

    return {
        totals: {
            ...totals,
            purchaseAmountTotal: Number(totals.purchaseAmountTotal.toFixed(2)),
            creditAmountTotal: Number(totals.creditAmountTotal.toFixed(2)),
            bonusAmountTotal: Number(totals.bonusAmountTotal.toFixed(2))
        },
        byStatus,
        topPurchasers: topPurchasers.map((item) => ({
            ...item,
            purchaseAmountTotal: Number(item.purchaseAmountTotal.toFixed(2)),
            creditAmountTotal: Number(item.creditAmountTotal.toFixed(2))
        })),
        topRecipients: topRecipients.map((item) => ({
            ...item,
            receivedCreditTotal: Number(item.receivedCreditTotal.toFixed(2))
        })),
        byPackage: byPackage.map((item) => ({
            ...item,
            purchaseAmountTotal: Number(item.purchaseAmountTotal.toFixed(2)),
            creditAmountTotal: Number(item.creditAmountTotal.toFixed(2))
        }))
    };
};

exports.listGiftPackages = async (req, res) => {
    try {
        const { includeInactive } = req.query;
        const where = {};
        if (!includeInactive) {
            where.isActive = true;
        }

        const packages = await db.GiftCardPackage.findAll({
            where,
            order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
        });

        res.json({ success: true, packages });
    } catch (error) {
        console.error('List gift packages error:', error);
        res.status(500).json({ success: false, message: 'Failed to list gift packages' });
    }
};

exports.getGiftPackage = async (req, res) => {
    try {
        const item = await db.GiftCardPackage.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Gift package not found' });
        }
        res.json({ success: true, package: item });
    } catch (error) {
        console.error('Get gift package error:', error);
        res.status(500).json({ success: false, message: 'Failed to get gift package' });
    }
};

exports.createGiftPackage = async (req, res) => {
    try {
        const validationError = validatePackageInput(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const payload = req.body || {};
        const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
        const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;

        if (startsAt && endsAt && endsAt < startsAt) {
            return res.status(400).json({ success: false, message: 'endsAt must be after startsAt' });
        }

        const created = await db.GiftCardPackage.create({
            title_en: `${payload.title_en}`.trim(),
            title_ar: `${payload.title_ar}`.trim(),
            description_en: payload.description_en || null,
            description_ar: payload.description_ar || null,
            displayOrder: Number.parseInt(payload.displayOrder, 10) || 0,
            priceAmount: toNumber(payload.priceAmount),
            walletCreditAmount: toNumber(payload.walletCreditAmount),
            bonusAmount: toNumber(payload.bonusAmount, 0),
            imageUrl: payload.imageUrl || null,
            startsAt,
            endsAt,
            isActive: payload.isActive !== false,
            createdByAdminId: req.adminId || null
        });

        res.status(201).json({ success: true, package: created });
    } catch (error) {
        console.error('Create gift package error:', error);
        res.status(500).json({ success: false, message: 'Failed to create gift package' });
    }
};

exports.updateGiftPackage = async (req, res) => {
    try {
        const item = await db.GiftCardPackage.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Gift package not found' });
        }

        const payload = req.body || {};
        const merged = {
            title_en: payload.title_en ?? item.title_en,
            title_ar: payload.title_ar ?? item.title_ar,
            priceAmount: payload.priceAmount ?? item.priceAmount,
            walletCreditAmount: payload.walletCreditAmount ?? item.walletCreditAmount,
            bonusAmount: payload.bonusAmount ?? item.bonusAmount
        };

        const validationError = validatePackageInput(merged);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const nextStartsAt = payload.startsAt !== undefined ? (payload.startsAt ? new Date(payload.startsAt) : null) : item.startsAt;
        const nextEndsAt = payload.endsAt !== undefined ? (payload.endsAt ? new Date(payload.endsAt) : null) : item.endsAt;
        if (nextStartsAt && nextEndsAt && nextEndsAt < nextStartsAt) {
            return res.status(400).json({ success: false, message: 'endsAt must be after startsAt' });
        }

        await item.update({
            ...(payload.title_en !== undefined ? { title_en: `${payload.title_en}`.trim() } : {}),
            ...(payload.title_ar !== undefined ? { title_ar: `${payload.title_ar}`.trim() } : {}),
            ...(payload.description_en !== undefined ? { description_en: payload.description_en || null } : {}),
            ...(payload.description_ar !== undefined ? { description_ar: payload.description_ar || null } : {}),
            ...(payload.displayOrder !== undefined ? { displayOrder: Number.parseInt(payload.displayOrder, 10) || 0 } : {}),
            ...(payload.priceAmount !== undefined ? { priceAmount: toNumber(payload.priceAmount) } : {}),
            ...(payload.walletCreditAmount !== undefined ? { walletCreditAmount: toNumber(payload.walletCreditAmount) } : {}),
            ...(payload.bonusAmount !== undefined ? { bonusAmount: toNumber(payload.bonusAmount, 0) } : {}),
            ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl || null } : {}),
            ...(payload.startsAt !== undefined ? { startsAt: payload.startsAt ? new Date(payload.startsAt) : null } : {}),
            ...(payload.endsAt !== undefined ? { endsAt: payload.endsAt ? new Date(payload.endsAt) : null } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive === true } : {})
        });

        res.json({ success: true, package: item });
    } catch (error) {
        console.error('Update gift package error:', error);
        res.status(500).json({ success: false, message: 'Failed to update gift package' });
    }
};

exports.deleteGiftPackage = async (req, res) => {
    try {
        const item = await db.GiftCardPackage.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Gift package not found' });
        }

        await item.destroy();
        res.json({ success: true, message: 'Gift package deleted' });
    } catch (error) {
        console.error('Delete gift package error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete gift package' });
    }
};

exports.listGiftTransactions = async (req, res) => {
    try {
        const { status, packageId, startDate, endDate, limit = 50, offset = 0 } = req.query;
        const where = {};
        if (status) where.status = status;
        if (packageId) where.packageId = packageId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const rows = await db.GiftCardTransaction.findAll({
            where,
            include: [
                { model: db.GiftCardPackage, as: 'package', required: false },
                { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false },
                { model: db.PlatformUser, as: 'recipient', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false }
            ],
            order: [['createdAt', 'DESC']],
            limit: Math.max(1, Math.min(200, Number(limit) || 50)),
            offset: Math.max(0, Number(offset) || 0)
        });

        res.json({ success: true, transactions: rows, count: rows.length });
    } catch (error) {
        console.error('List gift transactions error:', error);
        res.status(500).json({ success: false, message: 'Failed to list gift transactions' });
    }
};

exports.getGiftTransactionsReport = async (req, res) => {
    try {
        const where = parseReportFilters(req.query);

        const transactions = await db.GiftCardTransaction.findAll({
            where,
            include: [
                { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
                { model: db.PlatformUser, as: 'recipient', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
                { model: db.GiftCardPackage, as: 'package', attributes: ['id', 'title_en', 'title_ar'], required: false }
            ],
            order: [['createdAt', 'DESC']]
        });

        const report = buildGiftReport(transactions);

        res.json({
            success: true,
            report
        });
    } catch (error) {
        console.error('Gift transactions report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate gift transactions report' });
    }
};

exports.exportGiftTransactionsReportCsv = async (req, res) => {
    try {
        const where = parseReportFilters(req.query);
        const transactions = await db.GiftCardTransaction.findAll({
            where,
            include: [
                { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
                { model: db.PlatformUser, as: 'recipient', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
                { model: db.GiftCardPackage, as: 'package', attributes: ['id', 'title_en', 'title_ar'], required: false }
            ],
            order: [['createdAt', 'DESC']]
        });

        const report = buildGiftReport(transactions);
        const escape = (v) => `"${`${v ?? ''}`.replace(/"/g, '""')}"`;
        const lines = [];
        lines.push('Metric,Value');
        lines.push(`Transactions Count,${report.totals.transactionsCount}`);
        lines.push(`Total Purchase Amount,${report.totals.purchaseAmountTotal}`);
        lines.push(`Total Credit Amount,${report.totals.creditAmountTotal}`);
        lines.push(`Total Bonus Amount,${report.totals.bonusAmountTotal}`);
        lines.push('');

        lines.push('Status,Count');
        Object.entries(report.byStatus).forEach(([status, count]) => lines.push(`${escape(status)},${count}`));
        lines.push('');

        lines.push('Top Purchasers');
        lines.push('Sender,Email,Transactions,Purchase Amount,Credit Amount');
        report.topPurchasers.forEach((row) => {
            lines.push(`${escape(row.senderName)},${escape(row.senderEmail || '')},${row.transactionsCount},${row.purchaseAmountTotal},${row.creditAmountTotal}`);
        });
        lines.push('');

        lines.push('Top Recipients');
        lines.push('Recipient,Email,Transactions,Received Credit');
        report.topRecipients.forEach((row) => {
            lines.push(`${escape(row.recipientName)},${escape(row.recipientEmail || '')},${row.transactionsCount},${row.receivedCreditTotal}`);
        });
        lines.push('');

        lines.push('By Package');
        lines.push('Package,Transactions,Purchase Amount,Credit Amount');
        report.byPackage.forEach((row) => {
            lines.push(`${escape(row.packageTitle)},${row.transactionsCount},${row.purchaseAmountTotal},${row.creditAmountTotal}`);
        });

        const csv = lines.join('\n');
        const stamp = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=\"gift-transactions-report-${stamp}.csv\"`);
        return res.status(200).send(csv);
    } catch (error) {
        console.error('Export gift report CSV error:', error);
        return res.status(500).json({ success: false, message: 'Failed to export report CSV' });
    }
};

exports.getGiftRedemptionsReport = async (req, res) => {
    try {
        const where = {};
        if (req.query.startDate || req.query.endDate) {
            where.createdAt = {};
            if (req.query.startDate) where.createdAt[Op.gte] = new Date(req.query.startDate);
            if (req.query.endDate) where.createdAt[Op.lte] = new Date(req.query.endDate);
        }
        if (req.query.tenantId) {
            where.tenantId = req.query.tenantId;
        }

        const redemptions = await db.GiftCardCodeRedemption.findAll({
            where,
            include: [
                {
                    model: db.GiftCardCode,
                    as: 'giftCardCode',
                    required: true,
                    include: [
                        { model: db.GiftCardTransaction, as: 'sourceGiftTransaction', include: [{ model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false }], required: false },
                        { model: db.TenantGiftCardTransaction, as: 'sourceTenantGiftTransaction', include: [{ model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false }], required: false }
                    ]
                },
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'email'], required: false }
            ],
            order: [['createdAt', 'DESC']],
            limit: Math.max(1, Math.min(500, Number(req.query.limit) || 200))
        });

        const outstandingAdminLiability = await db.GiftCardCode.sum('remainingAmount', {
            where: {
                scopeType: 'admin_global',
                status: { [Op.in]: ['issued', 'partially_redeemed'] }
            }
        }) || 0;

        const outstandingTenantLiabilityRows = await db.GiftCardCode.findAll({
            where: {
                scopeType: 'tenant_scoped',
                status: { [Op.in]: ['issued', 'partially_redeemed'] }
            },
            attributes: ['tenantId', [db.sequelize.fn('SUM', db.sequelize.col('remainingAmount')), 'remainingAmount']],
            group: ['tenantId'],
            raw: true
        });

        const tenantIds = outstandingTenantLiabilityRows
            .map((row) => row.tenantId)
            .filter(Boolean);
        const tenantMap = new Map();
        if (tenantIds.length) {
            const tenants = await db.Tenant.findAll({
                where: { id: { [Op.in]: tenantIds } },
                attributes: ['id', 'name', 'email'],
                raw: true
            });
            tenants.forEach((t) => tenantMap.set(t.id, t));
        }

        const byTenant = new Map();
        let totalRedeemedAmount = 0;
        let adminGlobalRedeemed = 0;
        let tenantScopedRedeemed = 0;

        const mappedRedemptions = redemptions.map((row) => {
            const amount = toNumber(row.redeemedAmount, 0);
            totalRedeemedAmount += amount;
            const scopeType = row.giftCardCode?.scopeType || 'admin_global';
            if (scopeType === 'tenant_scoped') tenantScopedRedeemed += amount;
            else adminGlobalRedeemed += amount;

            const tenantId = row.tenantId;
            const current = byTenant.get(tenantId) || {
                tenantId,
                tenantName: row.tenant?.name || 'Unknown',
                redeemedAmount: 0,
                redemptionsCount: 0
            };
            current.redeemedAmount += amount;
            current.redemptionsCount += 1;
            byTenant.set(tenantId, current);

            const sender = row.giftCardCode?.sourceGiftTransaction?.sender
                || row.giftCardCode?.sourceTenantGiftTransaction?.sender
                || null;

            return {
                id: row.id,
                code: row.giftCardCode?.code || null,
                scopeType,
                tenantId: row.tenantId,
                tenantName: row.tenant?.name || null,
                redeemedAmount: amount,
                remainingAfter: toNumber(row.remainingAfter, 0),
                appointmentId: row.appointmentId || null,
                orderId: row.orderId || null,
                senderName: sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email : null,
                senderEmail: sender?.email || null,
                createdAt: row.createdAt
            };
        });

        const tenantOutstanding = outstandingTenantLiabilityRows.map((row) => ({
            tenantId: row.tenantId,
            tenantName: tenantMap.get(row.tenantId)?.name || 'Unknown',
            remainingLiability: toNumber(row.remainingAmount, 0)
        })).sort((a, b) => b.remainingLiability - a.remainingLiability);

        const tenantSettlementRows = await db.TenantGiftCardSettlement.findAll({
            attributes: [
                'tenantId',
                [db.sequelize.fn('SUM', db.sequelize.col('netTenantPayableAmount')), 'netPayable'],
                [db.sequelize.fn('SUM', db.sequelize.literal(`CASE WHEN status = 'settled' THEN "netTenantPayableAmount" ELSE 0 END`)), 'settledPayable']
            ],
            group: ['tenantId'],
            raw: true
        });

        const payableByTenant = tenantSettlementRows.map((row) => {
            const netPayable = toNumber(row.netPayable, 0);
            const settledPayable = toNumber(row.settledPayable, 0);
            return {
                tenantId: row.tenantId,
                tenantName: tenantMap.get(row.tenantId)?.name || 'Unknown',
                netPayable,
                settledPayable,
                pendingPayable: Number((netPayable - settledPayable).toFixed(2))
            };
        }).sort((a, b) => b.pendingPayable - a.pendingPayable);

        return res.json({
            success: true,
            report: {
                totals: {
                    redemptionsCount: mappedRedemptions.length,
                    totalRedeemedAmount: Number(totalRedeemedAmount.toFixed(2)),
                    adminGlobalRedeemed: Number(adminGlobalRedeemed.toFixed(2)),
                    tenantScopedRedeemed: Number(tenantScopedRedeemed.toFixed(2)),
                    outstandingAdminLiability: Number(toNumber(outstandingAdminLiability, 0).toFixed(2)),
                    outstandingTenantLiability: Number(tenantOutstanding.reduce((sum, row) => sum + row.remainingLiability, 0).toFixed(2))
                },
                recentRedemptions: mappedRedemptions,
                byTenant: Array.from(byTenant.values()).map((row) => ({
                    ...row,
                    redeemedAmount: Number(row.redeemedAmount.toFixed(2))
                })).sort((a, b) => b.redeemedAmount - a.redeemedAmount),
                tenantOutstandingLiability: tenantOutstanding,
                tenantPayables: payableByTenant
            }
        });
    } catch (error) {
        console.error('Gift redemptions report error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load gift redemptions report' });
    }
};
