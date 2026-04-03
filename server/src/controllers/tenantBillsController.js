const db = require('../models');
const fs = require('fs');
const path = require('path');
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

        const bills = await db.Bill.findAll({
            where: { tenantId },
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
