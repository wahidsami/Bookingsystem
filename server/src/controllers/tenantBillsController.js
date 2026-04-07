const db = require('../models');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
    ensureInvoicePdf,
    ensureReceiptPdf
} = require('../services/billDocumentService');
const { serializeBill } = require('../utils/invoiceSnapshotBuilder');
const { PAYABLE_BILL_STATUSES, RETIRABLE_BILL_STATUSES, BILL_STATUS } = require('../utils/billStatus');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

function normalizeBillMetadata(metadata) {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata
        : {};
}

function resolveBillDocumentPath(relativePath) {
    if (!relativePath) return null;

    const sanitizedRelativePath = relativePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^uploads\//, '');
    const absolutePath = path.resolve(UPLOADS_ROOT, sanitizedRelativePath);

    if (!absolutePath.startsWith(UPLOADS_ROOT)) {
        return null;
    }

    return absolutePath;
}

async function findTenantBill(tenantId, billId) {
    return db.Bill.findOne({
        where: {
            id: billId,
            tenantId
        },
        include: [{
            model: db.TenantSubscription,
            as: 'subscription',
            include: [{
                model: db.SubscriptionPackage,
                as: 'package'
            }]
        }, {
            model: db.Tenant,
            as: 'tenant',
            attributes: ['id', 'name', 'name_ar', 'name_en', 'email', 'phone']
        }]
    });
}

async function normalizePendingActivationBills(req) {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        if (!tenantId) {
            return;
        }

        const candidateBills = await db.Bill.findAll({
            where: {
                tenantId,
                type: { [Op.in]: ['initial', 'renewal', 'upgrade'] }
            },
            order: [['createdAt', 'DESC']]
        });

        if (candidateBills.length <= 1) {
            return;
        }

        const groupedBills = new Map();
        for (const bill of candidateBills) {
            const subscriptionKey = bill.tenantSubscriptionId || `tenant:${tenantId}`;
            const group = groupedBills.get(subscriptionKey) || [];
            group.push(bill);
            groupedBills.set(subscriptionKey, group);
        }

        const billsToVoid = [];

        for (const bills of groupedBills.values()) {
            const paidBill = bills.find((bill) => bill.status === BILL_STATUS.PAID);

            if (paidBill) {
                billsToVoid.push(
                    ...bills
                        .filter((bill) =>
                            bill.id !== paidBill.id &&
                            RETIRABLE_BILL_STATUSES.includes(bill.status)
                        )
                        .map((bill) => ({
                            bill,
                            reason: 'superseded_by_paid_subscription_invoice',
                            message: 'Superseded by a paid invoice for the same subscription'
                        }))
                );
                continue;
            }

            if (req.tenant?.status === 'payment_pending') {
                const retriableBills = bills.filter((bill) => RETIRABLE_BILL_STATUSES.includes(bill.status));
                if (retriableBills.length > 1) {
                    const [latestBill, ...olderBills] = retriableBills;
                    if (latestBill) {
                        billsToVoid.push(...olderBills.map((bill) => ({
                            bill,
                            reason: 'superseded_by_newer_pending_activation_invoice',
                            message: 'Superseded by a newer pending activation invoice'
                        })));
                    }
                }
            }
        }

        for (const item of billsToVoid) {
            try {
                const bill = item.bill;
                const billMetadata = normalizeBillMetadata(bill.metadata);

                await bill.update({
                    status: BILL_STATUS.VOID,
                    paymentFailureReason: item.message,
                    metadata: {
                        ...billMetadata,
                        voidedAt: new Date().toISOString(),
                        voidReason: item.reason
                    }
                });
            } catch (billError) {
                console.error(`[Bills] Failed to void superseded bill ${bill.id}:`, billError);
            }
        }
    } catch (error) {
        console.error('[Bills] normalizePendingActivationBills failed:', error);
    }
}

async function serveTenantBillDocument(req, res, documentField) {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const { id } = req.params;
        const bill = await findTenantBill(tenantId, id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        const absolutePath = resolveBillDocumentPath(bill[documentField]);
        if (absolutePath && fs.existsSync(absolutePath)) {
            return res.sendFile(absolutePath);
        }

        const generatedDocument = documentField === 'receiptPdfPath'
            ? await ensureReceiptPdf(bill)
            : await ensureInvoicePdf(bill);

        if (!generatedDocument?.absolutePath || !fs.existsSync(generatedDocument.absolutePath)) {
            return res.status(404).json({
                success: false,
                message: 'Document not generated yet'
            });
        }

        return res.sendFile(generatedDocument.absolutePath);
    } catch (error) {
        console.error(`serveTenantBillDocument ${documentField} error:`, error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load bill document'
        });
    }
}

exports.getBills = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        await normalizePendingActivationBills(req);

        const bills = await db.Bill.findAll({
            where: {
                tenantId,
                status: {
                    [Op.ne]: BILL_STATUS.VOID
                }
            },
            order: [['createdAt', 'DESC']],
            include: [{
                model: db.TenantSubscription,
                as: 'subscription',
                include: [{
                    model: db.SubscriptionPackage,
                    as: 'package'
                }]
            }, {
                model: db.Tenant,
                as: 'tenant',
                attributes: ['id', 'name', 'name_ar', 'name_en', 'email', 'phone']
            }]
        });

        res.json({
            success: true,
            bills: bills.map((bill) => serializeBill(bill, { includePaymentToken: true }))
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
        await normalizePendingActivationBills(req);

        const bill = await db.Bill.findOne({
            where: {
                tenantId,
                status: PAYABLE_BILL_STATUSES
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
            bill: serializeBill(bill, { includePaymentToken: true })
        });
    } catch (error) {
        console.error('getCurrentUnpaidBill error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load unpaid bill'
        });
    }
};

exports.getBillDetails = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const { id } = req.params;
        const bill = await findTenantBill(tenantId, id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        res.json({
            success: true,
            bill: serializeBill(bill, { includePaymentToken: true })
        });
    } catch (error) {
        console.error('getBillDetails error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load bill details'
        });
    }
};

exports.getInvoicePdf = async (req, res) => serveTenantBillDocument(req, res, 'invoicePdfPath');

exports.getReceiptPdf = async (req, res) => serveTenantBillDocument(req, res, 'receiptPdfPath');
