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
        const { status, packageId, limit = 50, offset = 0 } = req.query;
        const where = {};
        if (status) where.status = status;
        if (packageId) where.packageId = packageId;

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

