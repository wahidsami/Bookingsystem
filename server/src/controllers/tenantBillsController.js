const db = require('../models');

exports.getBills = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;

        const bills = await db.Bill.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']],
            include: [{
                model: db.TenantSubscription,
                as: 'subscription',
                include: [{
                    model: db.SubscriptionPackage,
                    as: 'package',
                    attributes: ['id', 'name', 'name_ar']
                }]
            }]
        });

        res.json({
            success: true,
            bills: bills.map((bill) => ({
                id: bill.id,
                billNumber: bill.billNumber,
                amount: parseFloat(bill.amount || 0),
                currency: bill.currency,
                dueDate: bill.dueDate,
                status: bill.status,
                paidAt: bill.paidAt,
                createdAt: bill.createdAt,
                type: bill.type,
                planSnapshot: bill.planSnapshot || {},
                metadata: bill.metadata || {},
                paymentToken: bill.status === 'UNPAID' ? bill.paymentToken : undefined
            }))
        });
    } catch (error) {
        console.error('getBills error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load bills'
        });
    }
};

exports.getCurrentUnpaidBill = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;

        const bill = await db.Bill.findOne({
            where: {
                tenantId,
                status: 'UNPAID'
            },
            order: [['createdAt', 'DESC']]
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'No unpaid bill found'
            });
        }

        res.json({
            success: true,
            bill: {
                id: bill.id,
                billNumber: bill.billNumber,
                amount: parseFloat(bill.amount || 0),
                currency: bill.currency,
                dueDate: bill.dueDate,
                status: bill.status,
                type: bill.type,
                paymentToken: bill.paymentToken,
                planSnapshot: bill.planSnapshot || {}
            }
        });
    } catch (error) {
        console.error('getCurrentUnpaidBill error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load unpaid bill'
        });
    }
};
