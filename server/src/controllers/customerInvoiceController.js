const fs = require('fs');
const { Op } = require('sequelize');
const db = require('../models');
const {
    ensureCustomerInvoicePdf,
    ensureCustomerReceiptPdf,
    resolveUploadPath
} = require('../services/customerInvoiceDocumentService');

function parsePagination(query = {}) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

function buildDateFilter(startDate, endDate) {
    if (!startDate && !endDate) return null;
    const where = {};
    if (startDate) where[Op.gte] = new Date(startDate);
    if (endDate) where[Op.lte] = new Date(endDate);
    return where;
}

async function listInvoices(where, query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const invoiceWhere = { ...where };
    const issuedAt = buildDateFilter(query.startDate, query.endDate);
    if (issuedAt) invoiceWhere.issuedAt = issuedAt;
    if (query.status) invoiceWhere.status = query.status;
    if (query.entityType) invoiceWhere.entityType = query.entityType;
    if (query.tenantId) invoiceWhere.tenantId = query.tenantId;

    const { count, rows } = await db.CustomerInvoice.findAndCountAll({
        where: invoiceWhere,
        include: [
            {
                model: db.Tenant,
                as: 'tenant',
                attributes: ['id', 'name', 'name_en', 'name_ar', 'slug', 'logo'],
                required: false
            },
            {
                model: db.PlatformUser,
                as: 'platformUser',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            }
        ],
        order: [['issuedAt', 'DESC']],
        limit,
        offset
    });

    return {
        invoices: rows,
        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        }
    };
}

exports.listUserInvoices = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const result = await listInvoices({ platformUserId }, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('listUserInvoices error:', error);
        res.status(500).json({ success: false, message: 'Failed to load invoices', error: error.message });
    }
};

exports.getUserInvoiceById = async (req, res) => {
    try {
        const invoice = await db.CustomerInvoice.findOne({
            where: {
                id: req.params.id,
                platformUserId: req.userId
            },
            include: [
                { model: db.CustomerInvoiceItem, as: 'items' },
                { model: db.CustomerInvoiceEvent, as: 'events' },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'slug', 'logo'],
                    required: false
                }
            ]
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        res.json({ success: true, invoice });
    } catch (error) {
        console.error('getUserInvoiceById error:', error);
        res.status(500).json({ success: false, message: 'Failed to load invoice', error: error.message });
    }
};

exports.listTenantInvoices = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const result = await listInvoices({ tenantId }, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('listTenantInvoices error:', error);
        res.status(500).json({ success: false, message: 'Failed to load tenant invoices', error: error.message });
    }
};

exports.getTenantInvoiceById = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const invoice = await db.CustomerInvoice.findOne({
            where: { id: req.params.id, tenantId },
            include: [
                { model: db.CustomerInvoiceItem, as: 'items' },
                { model: db.CustomerInvoiceEvent, as: 'events' },
                {
                    model: db.PlatformUser,
                    as: 'platformUser',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                }
            ]
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        res.json({ success: true, invoice });
    } catch (error) {
        console.error('getTenantInvoiceById error:', error);
        res.status(500).json({ success: false, message: 'Failed to load tenant invoice', error: error.message });
    }
};

exports.listAdminInvoices = async (req, res) => {
    try {
        const where = {};
        if (req.query.platformUserId) where.platformUserId = req.query.platformUserId;
        if (req.query.tenantId) where.tenantId = req.query.tenantId;
        const result = await listInvoices(where, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('listAdminInvoices error:', error);
        res.status(500).json({ success: false, message: 'Failed to load customer invoices', error: error.message });
    }
};

exports.getAdminInvoiceById = async (req, res) => {
    try {
        const invoice = await db.CustomerInvoice.findByPk(req.params.id, {
            include: [
                { model: db.CustomerInvoiceItem, as: 'items' },
                { model: db.CustomerInvoiceEvent, as: 'events' },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'slug', 'logo'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'platformUser',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                }
            ]
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        res.json({ success: true, invoice });
    } catch (error) {
        console.error('getAdminInvoiceById error:', error);
        res.status(500).json({ success: false, message: 'Failed to load invoice', error: error.message });
    }
};

exports.listAdminUserInvoices = async (req, res) => {
    try {
        const result = await listInvoices({ platformUserId: req.params.id }, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('listAdminUserInvoices error:', error);
        res.status(500).json({ success: false, message: 'Failed to load user invoices', error: error.message });
    }
};

async function serveInvoiceDocument(req, res, { scope, type }) {
    const field = type === 'receipt' ? 'receiptPdfPath' : 'invoicePdfPath';
    const where = { id: req.params.id };
    if (scope === 'user') where.platformUserId = req.userId;
    if (scope === 'tenant') where.tenantId = req.tenantId || req.tenant?.id;

    const invoice = await db.CustomerInvoice.findOne({ where });
    if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    let absolutePath = resolveUploadPath(invoice[field]);
    if ((!absolutePath || !fs.existsSync(absolutePath))) {
        const generated = type === 'receipt'
            ? await ensureCustomerReceiptPdf(invoice)
            : await ensureCustomerInvoicePdf(invoice);
        absolutePath = generated?.absolutePath || null;
    }

    if (!absolutePath || !fs.existsSync(absolutePath)) {
        return res.status(404).json({ success: false, message: `${type} PDF not generated yet` });
    }

    return res.sendFile(absolutePath);
}

exports.getUserInvoicePdf = async (req, res) => {
    try {
        return await serveInvoiceDocument(req, res, { scope: 'user', type: 'invoice' });
    } catch (error) {
        console.error('getUserInvoicePdf error:', error);
        res.status(500).json({ success: false, message: 'Failed to load invoice PDF', error: error.message });
    }
};

exports.getUserReceiptPdf = async (req, res) => {
    try {
        return await serveInvoiceDocument(req, res, { scope: 'user', type: 'receipt' });
    } catch (error) {
        console.error('getUserReceiptPdf error:', error);
        res.status(500).json({ success: false, message: 'Failed to load receipt PDF', error: error.message });
    }
};

exports.getTenantInvoicePdf = async (req, res) => {
    try {
        return await serveInvoiceDocument(req, res, { scope: 'tenant', type: 'invoice' });
    } catch (error) {
        console.error('getTenantInvoicePdf error:', error);
        res.status(500).json({ success: false, message: 'Failed to load invoice PDF', error: error.message });
    }
};

exports.getTenantReceiptPdf = async (req, res) => {
    try {
        return await serveInvoiceDocument(req, res, { scope: 'tenant', type: 'receipt' });
    } catch (error) {
        console.error('getTenantReceiptPdf error:', error);
        res.status(500).json({ success: false, message: 'Failed to load receipt PDF', error: error.message });
    }
};

exports.getAdminInvoicePdf = async (req, res) => {
    try {
        return await serveInvoiceDocument(req, res, { scope: 'admin', type: 'invoice' });
    } catch (error) {
        console.error('getAdminInvoicePdf error:', error);
        res.status(500).json({ success: false, message: 'Failed to load invoice PDF', error: error.message });
    }
};

exports.getAdminReceiptPdf = async (req, res) => {
    try {
        return await serveInvoiceDocument(req, res, { scope: 'admin', type: 'receipt' });
    } catch (error) {
        console.error('getAdminReceiptPdf error:', error);
        res.status(500).json({ success: false, message: 'Failed to load receipt PDF', error: error.message });
    }
};
