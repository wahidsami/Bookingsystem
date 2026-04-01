const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');

async function generateBillNumber() {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const count = await db.Bill.count({
        where: {
            billNumber: {
                [Op.like]: `${prefix}%`
            }
        }
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

function generatePaymentToken() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    generateBillNumber,
    generatePaymentToken
};
