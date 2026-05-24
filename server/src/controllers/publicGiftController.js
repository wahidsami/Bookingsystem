'use strict';

const db = require('../models');
const { Op } = require('sequelize');

exports.listActiveGiftPackages = async (req, res) => {
    try {
        const now = new Date();
        const packages = await db.GiftCardPackage.findAll({
            where: {
                isActive: true,
                [Op.and]: [
                    {
                        [Op.or]: [
                            { startsAt: null },
                            { startsAt: { [Op.lte]: now } }
                        ]
                    },
                    {
                        [Op.or]: [
                            { endsAt: null },
                            { endsAt: { [Op.gte]: now } }
                        ]
                    }
                ]
            },
            order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
        });

        res.json({ success: true, packages });
    } catch (error) {
        console.error('List active gift packages error:', error);
        res.status(500).json({ success: false, message: 'Failed to load gift packages' });
    }
};

