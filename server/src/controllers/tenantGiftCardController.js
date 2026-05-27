const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const db = require('../models');

const ensureTenantId = (req) => req?.tenant?.id || null;

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = ensureTenantId(req);
    const basePath = path.join(__dirname, '../../uploads/tenant-gift-cards', String(tenantId || 'unknown'));
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    cb(null, basePath);
  },
  filename: (_req, file, cb) => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `gift-card-${stamp}${path.extname(file.originalname)}`);
  }
});

const uploadFileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowed.includes(file.mimetype)) {
    cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    return;
  }
  cb(null, true);
};

exports.uploadGiftCardImage = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: uploadFileFilter
}).single('image');

exports.uploadGiftCardImageOptional = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: uploadFileFilter
}).single('image');

exports.listPackages = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const rows = await db.TenantGiftCardPackage.findAll({
      where: { tenantId },
      order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
    });
    return res.json({ success: true, packages: rows });
  } catch (error) {
    console.error('tenant gift list packages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load gift card packages' });
  }
};

exports.createPackage = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const {
      title_en,
      title_ar,
      description_en,
      description_ar,
      displayOrder = 0,
      priceAmount = 0,
      walletCreditAmount = 0,
      bonusAmount = 0,
      startsAt = null,
      endsAt = null,
      isActive = true
    } = req.body || {};

    if (!String(title_en || '').trim() || !String(title_ar || '').trim()) {
      return res.status(400).json({ success: false, message: 'English and Arabic titles are required.' });
    }

    const created = await db.TenantGiftCardPackage.create({
      tenantId,
      title_en: String(title_en || '').trim(),
      title_ar: String(title_ar || '').trim(),
      description_en: description_en || null,
      description_ar: description_ar || null,
      displayOrder: Number(displayOrder || 0),
      priceAmount: Number(priceAmount || 0),
      walletCreditAmount: Number(walletCreditAmount || 0),
      bonusAmount: Number(bonusAmount || 0),
      startsAt: parseDate(startsAt),
      endsAt: parseDate(endsAt),
      isActive: isActive !== false
    });

    if (req.file) {
      const normalizedPath = req.file.path
        .replace(/\\/g, '/')
        .replace(/^.*uploads\//, 'uploads/');
      created.imageUrl = `/${normalizedPath}`;
      await created.save();
    }

    return res.status(201).json({ success: true, package: created });
  } catch (error) {
    console.error('tenant gift create package error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create gift card package' });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const item = await db.TenantGiftCardPackage.findOne({ where: { id: req.params.id, tenantId } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Gift card package not found' });
    }

    const payload = req.body || {};
    if (payload.title_en !== undefined) item.title_en = String(payload.title_en || '').trim();
    if (payload.title_ar !== undefined) item.title_ar = String(payload.title_ar || '').trim();
    if (payload.description_en !== undefined) item.description_en = payload.description_en || null;
    if (payload.description_ar !== undefined) item.description_ar = payload.description_ar || null;
    if (payload.displayOrder !== undefined) item.displayOrder = Number(payload.displayOrder || 0);
    if (payload.priceAmount !== undefined) item.priceAmount = Number(payload.priceAmount || 0);
    if (payload.walletCreditAmount !== undefined) item.walletCreditAmount = Number(payload.walletCreditAmount || 0);
    if (payload.bonusAmount !== undefined) item.bonusAmount = Number(payload.bonusAmount || 0);
    if (payload.startsAt !== undefined) item.startsAt = parseDate(payload.startsAt);
    if (payload.endsAt !== undefined) item.endsAt = parseDate(payload.endsAt);
    if (payload.isActive !== undefined) item.isActive = payload.isActive !== false;

    if (!String(item.title_en || '').trim() || !String(item.title_ar || '').trim()) {
      return res.status(400).json({ success: false, message: 'English and Arabic titles are required.' });
    }

    await item.save();
    return res.json({ success: true, package: item });
  } catch (error) {
    console.error('tenant gift update package error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update gift card package' });
  }
};

exports.togglePackageActive = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const item = await db.TenantGiftCardPackage.findOne({ where: { id: req.params.id, tenantId } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Gift card package not found' });
    }
    item.isActive = req.body?.isActive !== false;
    await item.save();
    return res.json({ success: true, package: item });
  } catch (error) {
    console.error('tenant gift toggle active error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update gift card package status' });
  }
};

exports.uploadPackageImage = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const item = await db.TenantGiftCardPackage.findOne({ where: { id: req.params.id, tenantId } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Gift card package not found' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const normalizedPath = req.file.path
      .replace(/\\/g, '/')
      .replace(/^.*uploads\//, 'uploads/');
    item.imageUrl = `/${normalizedPath}`;
    await item.save();

    return res.json({ success: true, package: item, imageUrl: item.imageUrl });
  } catch (error) {
    console.error('tenant gift upload image error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload gift card image' });
  }
};

exports.getSummaryReport = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const where = { tenantId };
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt[Op.gte] = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt[Op.lte] = new Date(req.query.endDate);
    }

    const tx = await db.TenantGiftCardTransaction.findAll({ where });
    const totals = tx.reduce((acc, row) => {
      acc.transactionsCount += 1;
      acc.grossSales += Number(row.purchaseAmount || 0);
      acc.totalCredit += Number(row.totalCreditAmount || 0);
      return acc;
    }, { transactionsCount: 0, grossSales: 0, totalCredit: 0 });

    const settlementRows = await db.TenantGiftCardSettlement.findAll({ where: { tenantId } });
    const settlements = settlementRows.reduce((acc, row) => {
      const net = Number(row.netTenantPayableAmount || 0);
      if (row.status === 'settled') acc.settled += net;
      else acc.pending += net;
      return acc;
    }, { pending: 0, settled: 0 });

    return res.json({
      success: true,
      summary: {
        ...totals,
        pendingSettlementAmount: settlements.pending,
        settledAmount: settlements.settled
      }
    });
  } catch (error) {
    console.error('tenant gift summary report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load gift card summary report' });
  }
};

exports.getTransactionsReport = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const where = { tenantId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt[Op.gte] = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt[Op.lte] = new Date(req.query.endDate);
    }

    const rows = await db.TenantGiftCardTransaction.findAll({
      where,
      include: [
        { model: db.TenantGiftCardPackage, as: 'package', attributes: ['id', 'title_en', 'title_ar', 'imageUrl'], required: false },
        { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
        { model: db.PlatformUser, as: 'recipient', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
        { model: db.TenantGiftCardSettlement, as: 'settlement', attributes: ['id', 'grossAmount', 'platformFeeAmount', 'netTenantPayableAmount', 'status', 'settledAt'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(req.query.limit || 200)
    });

    return res.json({ success: true, transactions: rows });
  } catch (error) {
    console.error('tenant gift transactions report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load gift card transactions report' });
  }
};

exports.exportTransactionsReportCsv = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const where = { tenantId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt[Op.gte] = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt[Op.lte] = new Date(req.query.endDate);
    }

    const rows = await db.TenantGiftCardTransaction.findAll({
      where,
      include: [
        { model: db.TenantGiftCardPackage, as: 'package', attributes: ['title_en', 'title_ar'], required: false },
        { model: db.PlatformUser, as: 'sender', attributes: ['email', 'firstName', 'lastName'], required: false },
        { model: db.PlatformUser, as: 'recipient', attributes: ['email', 'firstName', 'lastName'], required: false },
        { model: db.TenantGiftCardSettlement, as: 'settlement', attributes: ['grossAmount', 'platformFeeAmount', 'netTenantPayableAmount', 'status', 'settledAt'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });

    const headers = [
      'transaction_id',
      'status',
      'delivery_channel',
      'package_title_en',
      'package_title_ar',
      'purchase_amount',
      'credit_amount',
      'bonus_amount',
      'total_credit_amount',
      'sender_email',
      'recipient_email',
      'recipient_phone',
      'settlement_status',
      'gross_amount',
      'platform_fee_amount',
      'net_tenant_payable_amount',
      'settled_at',
      'created_at'
    ];

    const lines = [headers.join(',')];
    rows.forEach((row) => {
      lines.push([
        escapeCsvCell(row.id),
        escapeCsvCell(row.status),
        escapeCsvCell(row.deliveryChannel),
        escapeCsvCell(row.package?.title_en || ''),
        escapeCsvCell(row.package?.title_ar || ''),
        escapeCsvCell(Number(row.purchaseAmount || 0).toFixed(2)),
        escapeCsvCell(Number(row.creditAmount || 0).toFixed(2)),
        escapeCsvCell(Number(row.bonusAmount || 0).toFixed(2)),
        escapeCsvCell(Number(row.totalCreditAmount || 0).toFixed(2)),
        escapeCsvCell(row.sender?.email || ''),
        escapeCsvCell(row.recipient?.email || row.recipientEmail || ''),
        escapeCsvCell(row.recipientPhone || ''),
        escapeCsvCell(row.settlement?.status || ''),
        escapeCsvCell(row.settlement?.grossAmount != null ? Number(row.settlement.grossAmount).toFixed(2) : ''),
        escapeCsvCell(row.settlement?.platformFeeAmount != null ? Number(row.settlement.platformFeeAmount).toFixed(2) : ''),
        escapeCsvCell(row.settlement?.netTenantPayableAmount != null ? Number(row.settlement.netTenantPayableAmount).toFixed(2) : ''),
        escapeCsvCell(row.settlement?.settledAt ? new Date(row.settlement.settledAt).toISOString() : ''),
        escapeCsvCell(row.createdAt ? new Date(row.createdAt).toISOString() : '')
      ].join(','));
    });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tenant-gift-transactions-${stamp}.csv"`);
    return res.send(lines.join('\n'));
  } catch (error) {
    console.error('tenant gift transactions csv export error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export transactions CSV' });
  }
};

exports.getRedemptionsReport = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const where = { tenantId };
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt[Op.gte] = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt[Op.lte] = new Date(req.query.endDate);
    }

    const rows = await db.GiftCardCodeRedemption.findAll({
      where,
      include: [
        {
          model: db.GiftCardCode,
          as: 'giftCardCode',
          required: true,
          include: [
            {
              model: db.GiftCardTransaction,
              as: 'sourceGiftTransaction',
              include: [
                { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false }
              ],
              required: false
            },
            {
              model: db.TenantGiftCardTransaction,
              as: 'sourceTenantGiftTransaction',
              include: [
                { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false }
              ],
              required: false
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(req.query.limit || 300)
    });

    const summary = {
      totalRedemptions: rows.length,
      totalRedeemedAmount: 0,
      adminGlobalRedemptionsAmount: 0,
      tenantScopedRedemptionsAmount: 0
    };

    const redemptions = rows.map((row) => {
      const redeemedAmount = Number(row.redeemedAmount || 0);
      summary.totalRedeemedAmount += redeemedAmount;
      const scopeType = row.giftCardCode?.scopeType || 'admin_global';
      if (scopeType === 'tenant_scoped') summary.tenantScopedRedemptionsAmount += redeemedAmount;
      else summary.adminGlobalRedemptionsAmount += redeemedAmount;

      const sourceTx = row.giftCardCode?.sourceGiftTransaction || row.giftCardCode?.sourceTenantGiftTransaction || null;
      const sender = sourceTx?.sender || null;
      const senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email : null;

      return {
        id: row.id,
        code: row.giftCardCode?.code || null,
        scopeType,
        redeemedAmount,
        remainingAfter: Number(row.remainingAfter || 0),
        senderName,
        senderEmail: sender?.email || null,
        appointmentId: row.appointmentId || null,
        orderId: row.orderId || null,
        createdAt: row.createdAt
      };
    });

    return res.json({
      success: true,
      summary: {
        totalRedemptions: summary.totalRedemptions,
        totalRedeemedAmount: Number(summary.totalRedeemedAmount.toFixed(2)),
        adminGlobalRedemptionsAmount: Number(summary.adminGlobalRedemptionsAmount.toFixed(2)),
        tenantScopedRedemptionsAmount: Number(summary.tenantScopedRedemptionsAmount.toFixed(2))
      },
      redemptions
    });
  } catch (error) {
    console.error('tenant gift redemptions report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load gift card redemptions report' });
  }
};
