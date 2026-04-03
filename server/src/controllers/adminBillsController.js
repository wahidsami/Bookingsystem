const fs = require('fs');
const path = require('path');
const db = require('../models');
const {
    ensureInvoicePdf,
    ensureReceiptPdf
} = require('../services/billDocumentService');
const { serializeBill } = require('../utils/invoiceSnapshotBuilder');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

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

async function findBillById(id, tenantId = null) {
    const where = { id };
    if (tenantId) {
        where.tenantId = tenantId;
    }

    return db.Bill.findOne({
        where,
        include: [
            {
                model: db.Tenant,
                as: 'tenant',
                attributes: ['id', 'name', 'name_ar', 'name_en', 'email', 'phone', 'status']
            },
            {
                model: db.TenantSubscription,
                as: 'subscription',
                include: [{
                    model: db.SubscriptionPackage,
                    as: 'package'
                }]
            }
        ]
    });
}

async function serveBillDocument(req, res, documentField) {
    try {
        const { id } = req.params;
        const bill = await findBillById(id);

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
        console.error(`serveBillDocument ${documentField} error:`, error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load bill document'
        });
    }
}

exports.getTenantBills = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const bills = await db.Bill.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_ar', 'name_en', 'email', 'phone', 'status']
                },
                {
                    model: db.TenantSubscription,
                    as: 'subscription',
                    include: [{
                        model: db.SubscriptionPackage,
                        as: 'package'
                    }]
                }
            ]
        });

        const summary = bills.reduce(
            (accumulator, bill) => {
                const amount = Number(bill.totalAmount ?? bill.amount ?? 0);
                if (bill.status === 'PAID') {
                    accumulator.paidCount += 1;
                    accumulator.paidTotal += amount;
                } else if (bill.status === 'UNPAID') {
                    accumulator.unpaidCount += 1;
                    accumulator.unpaidTotal += amount;
                } else if (bill.status === 'EXPIRED') {
                    accumulator.expiredCount += 1;
                    accumulator.expiredTotal += amount;
                }
                accumulator.totalAmount += amount;
                return accumulator;
            },
            {
                paidCount: 0,
                paidTotal: 0,
                unpaidCount: 0,
                unpaidTotal: 0,
                expiredCount: 0,
                expiredTotal: 0,
                totalAmount: 0
            }
        );

        res.json({
            success: true,
            bills: bills.map((bill) => serializeBill(bill, { includePaymentToken: true })),
            summary
        });
    } catch (error) {
        console.error('getTenantBills error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load tenant bills'
        });
    }
};

exports.getBillDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const bill = await findBillById(id);

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

exports.getInvoicePdf = async (req, res) => serveBillDocument(req, res, 'invoicePdfPath');

exports.getReceiptPdf = async (req, res) => serveBillDocument(req, res, 'receiptPdfPath');
