'use strict';

const { Op } = require('sequelize');
const db = require('../models');

exports.listTenantGiftPackages = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const now = new Date();
        const packages = await db.TenantGiftCardPackage.findAll({
            where: {
                tenantId,
                isActive: true,
                [Op.and]: [
                    { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
                    { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }] }
                ]
            },
            order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
        });

        res.json({ success: true, packages });
    } catch (error) {
        console.error('Public tenant gift list error:', error);
        res.status(500).json({ success: false, message: 'Failed to load tenant gift cards' });
    }
};

