const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const db = require('../models');
const {
    ensureInvoicePdf,
    ensureReceiptPdf
} = require('../services/billDocumentService');
const { serializeBill } = require('../utils/invoiceSnapshotBuilder');
const {
    settleBillPayment
} = require('../services/billPaymentReconciliationService');
const { BILL_STATUS, createBillStatusSummarySeed } = require('../utils/billStatus');

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
            },
            {
                model: db.BillPaymentAttempt,
                as: 'paymentAttempts',
                separate: true,
                order: [
                    ['processedAt', 'DESC'],
                    ['createdAt', 'DESC']
                ]
            }
        ]
    });
}

exports.listBills = async (req, res) => {
    try {
        const {
            status,
            type,
            tenantId,
            search,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const numericPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (numericPage - 1) * numericLimit;
        const where = {};

        if (status && status !== 'ALL') {
            where.status = status;
        }

        if (type && type !== 'ALL') {
            where.type = type;
        }

        if (tenantId) {
            where.tenantId = tenantId;
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
            }
            if (endDate) {
                where.createdAt[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
            }
        }

        const include = [
            {
                model: db.Tenant,
                as: 'tenant',
                attributes: ['id', 'name', 'name_ar', 'name_en', 'email', 'phone', 'status'],
                required: false
            },
            {
                model: db.TenantSubscription,
                as: 'subscription',
                include: [{
                    model: db.SubscriptionPackage,
                    as: 'package'
                }]
            }
        ];

        if (search) {
            const pattern = `%${search.trim()}%`;
            where[Op.or] = [
                { billNumber: { [Op.iLike]: pattern } },
                { paymentReference: { [Op.iLike]: pattern } },
                { '$tenant.name$': { [Op.iLike]: pattern } },
                { '$tenant.name_en$': { [Op.iLike]: pattern } },
                { '$tenant.name_ar$': { [Op.iLike]: pattern } },
                { '$tenant.email$': { [Op.iLike]: pattern } }
            ];
        }

        const [{ count, rows }, summaryRows] = await Promise.all([
            db.Bill.findAndCountAll({
            where,
            include,
            distinct: true,
            order: [['createdAt', 'DESC']],
            limit: numericLimit,
            offset
            }),
            db.Bill.findAll({
                where,
                include,
                attributes: ['id', 'status', 'amount', 'totalAmount']
            })
        ]);

        const summary = summaryRows.reduce(
            (accumulator, bill) => {
                const amount = Number(bill.totalAmount ?? bill.amount ?? 0);
                const statusKey = bill.status || 'UNPAID';
                if (!accumulator[statusKey]) {
                    accumulator[statusKey] = { count: 0, totalAmount: 0 };
                }
                accumulator[statusKey].count += 1;
                accumulator[statusKey].totalAmount += amount;
                return accumulator;
            },
            createBillStatusSummarySeed()
        );

        return res.json({
            success: true,
            bills: rows.map((bill) => serializeBill(bill, {
                includePaymentToken: true,
                includePaymentAttempts: false
            })),
            summary,
            pagination: {
                total: count,
                page: numericPage,
                limit: numericLimit,
                totalPages: Math.ceil(count / numericLimit) || 1
            }
        });
    } catch (error) {
        console.error('listBills error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load invoices'
        });
    }
};

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
                },
                {
                    model: db.BillPaymentAttempt,
                    as: 'paymentAttempts',
                    separate: true,
                    order: [
                        ['processedAt', 'DESC'],
                        ['createdAt', 'DESC']
                    ]
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
                } else if (bill.status === 'FAILED') {
                    accumulator.failedCount += 1;
                    accumulator.failedTotal += amount;
                } else if (bill.status === 'DRAFT') {
                    accumulator.draftCount += 1;
                    accumulator.draftTotal += amount;
                } else if (bill.status === 'EXPIRED') {
                    accumulator.expiredCount += 1;
                    accumulator.expiredTotal += amount;
                } else if (bill.status === 'VOID') {
                    accumulator.voidCount += 1;
                    accumulator.voidTotal += amount;
                }
                accumulator.totalAmount += amount;
                return accumulator;
            },
            {
                paidCount: 0,
                paidTotal: 0,
                unpaidCount: 0,
                unpaidTotal: 0,
                failedCount: 0,
                failedTotal: 0,
                draftCount: 0,
                draftTotal: 0,
                expiredCount: 0,
                expiredTotal: 0,
                voidCount: 0,
                voidTotal: 0,
                totalAmount: 0
            }
        );

        res.json({
            success: true,
            bills: bills.map((bill) => serializeBill(bill, {
                includePaymentToken: true,
                includePaymentAttempts: true
            })),
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
            bill: serializeBill(bill, {
                includePaymentToken: true,
                includePaymentAttempts: true
            })
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

exports.reconcileBillPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            paymentProvider,
            paymentReference,
            paymentMethod,
            checkoutSessionId,
            gatewayStatus,
            gatewaySummary,
            notes,
            idempotencyKey
        } = req.body || {};

        if (!paymentProvider || !paymentReference || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Payment provider, payment reference, and payment method are required'
            });
        }

        const reconciliation = await settleBillPayment({
            billId: id,
            source: 'admin_manual_reconciliation',
            paymentStatus: 'succeeded',
            paymentProvider,
            paymentReference,
            paymentMethod,
            checkoutSessionId,
            gatewayStatus: gatewayStatus || 'admin_reconciled',
            gatewaySummary,
            notes,
            idempotencyKey,
            actor: {
                type: 'super_admin',
                id: req.adminId || null,
                name: req.adminName || 'super-admin'
            }
        });

        if (reconciliation.expired) {
            return res.status(400).json({
                success: false,
                message: 'This invoice is expired and cannot be reconciled as paid',
                bill: reconciliation.bill,
                attempt: reconciliation.attempt
            });
        }

        if (!reconciliation.success) {
            return res.status(400).json({
                success: false,
                message: reconciliation.attempt?.failureReason || 'Failed to reconcile invoice payment',
                duplicate: Boolean(reconciliation.duplicate),
                bill: reconciliation.bill,
                attempt: reconciliation.attempt
            });
        }

        res.json({
            success: true,
            message: reconciliation.alreadyPaid
                ? 'Invoice is already paid'
                : reconciliation.duplicate
                    ? 'This reconciliation request was already processed'
                : 'Invoice payment reconciled successfully',
            alreadyPaid: Boolean(reconciliation.alreadyPaid),
            duplicate: Boolean(reconciliation.duplicate),
            bill: reconciliation.bill,
            attempt: reconciliation.attempt
        });
    } catch (error) {
        console.error('reconcileBillPayment error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to reconcile invoice payment'
        });
    }
};

exports.voidBill = async (req, res) => {
    try {
        const { id } = req.params;
        const reason = (req.body?.reason || '').toString().trim();
        const bill = await findBillById(id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        if (bill.status === BILL_STATUS.PAID) {
            return res.status(400).json({
                success: false,
                message: 'Paid invoices cannot be voided'
            });
        }

        if (bill.status === BILL_STATUS.VOID) {
            return res.status(400).json({
                success: false,
                message: 'Invoice is already voided'
            });
        }

        const previousStatus = bill.status;
        const currentMetadata = bill.metadata && typeof bill.metadata === 'object' && !Array.isArray(bill.metadata)
            ? bill.metadata
            : {};
        const now = new Date();
        const voidMessage = reason || 'Voided by admin';

        await bill.update({
            status: BILL_STATUS.VOID,
            paymentFailureReason: voidMessage,
            metadata: {
                ...currentMetadata,
                voidedAt: now.toISOString(),
                voidReason: 'voided_by_admin',
                voidNotes: reason || null,
                voidedByAdminId: req.adminId || null,
                voidedByAdminName: req.adminName || 'super-admin'
            }
        });

        try {
            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: bill.tenantId,
                action: 'updated',
                performedByType: 'super_admin',
                performedById: req.adminId || null,
                performedByName: req.adminName || 'super-admin',
                details: {
                    event: 'invoice_voided',
                    billId: bill.id,
                    billNumber: bill.billNumber,
                    previousStatus,
                    reason: reason || null
                },
                previousValue: {
                    status: previousStatus
                },
                newValue: {
                    status: BILL_STATUS.VOID
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        } catch (activityLogError) {
            console.error('voidBill activity log error:', activityLogError);
        }

        const updatedBill = await findBillById(id);

        return res.json({
            success: true,
            message: 'Invoice voided successfully',
            bill: serializeBill(updatedBill, {
                includePaymentToken: true,
                includePaymentAttempts: true
            })
        });
    } catch (error) {
        console.error('voidBill error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to void invoice'
        });
    }
};
