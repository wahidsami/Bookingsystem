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

const GIFT_CARD_DISCOUNT_PRESETS = ['2', '5', '7', '10'];
const GIFT_CARD_EXPIRATION_PRESETS = {
  '1_week': 7,
  '2_weeks': 14,
  '3_weeks': 21,
  '1_month': 30,
  '2_months': 60,
  '3_months': 90,
  '1_year': 365
};

const normalizeText = (value) => `${value || ''}`.trim();
const normalizeOptionalText = (value) => {
  const text = normalizeText(value);
  return text || null;
};

const calculateDiscountPercent = (walletCreditAmount, priceAmount) => {
  const credit = Number(walletCreditAmount || 0);
  const price = Number(priceAmount || 0);
  if (!Number.isFinite(credit) || credit <= 0 || !Number.isFinite(price) || price < 0 || price > credit) {
    return 0;
  }
  return Number((100 - ((price / credit) * 100)).toFixed(2));
};

const calculatePriceAmount = (walletCreditAmount, discountPercent) => {
  const credit = Number(walletCreditAmount || 0);
  const discount = Number(discountPercent || 0);
  if (!Number.isFinite(credit) || credit <= 0 || !Number.isFinite(discount) || discount < 0) {
    return 0;
  }
  return Number(Math.max(0, credit - (credit * (discount / 100))).toFixed(2));
};

const deriveDiscountPreset = (discountPercent) => {
  const numeric = Number(discountPercent || 0);
  const preset = GIFT_CARD_DISCOUNT_PRESETS.find((value) => Math.abs(Number(value) - numeric) < 0.01);
  return preset || 'custom';
};

const resolveDiscountPercent = (payload = {}, fallbackPercent = null, fallbackPrice = null, fallbackCredit = null) => {
  const explicitPreset = normalizeText(payload.discountPreset);
  const explicitPercent = payload.discountPercent ?? payload.discountValue;

  if (explicitPreset === 'custom') {
    const customPercent = Number(explicitPercent);
    return Number.isFinite(customPercent) ? customPercent : Number(fallbackPercent || 0);
  }

  if (GIFT_CARD_DISCOUNT_PRESETS.includes(explicitPreset)) {
    return Number(explicitPreset);
  }

  if (explicitPercent !== undefined && explicitPercent !== null && `${explicitPercent}`.trim() !== '') {
    const parsed = Number(explicitPercent);
    return Number.isFinite(parsed) ? parsed : Number(fallbackPercent || 0);
  }

  const credit = Number(fallbackCredit || 0);
  const price = Number(fallbackPrice || 0);
  if (credit > 0 && price >= 0 && price <= credit) {
    return calculateDiscountPercent(credit, price);
  }

  return Number(fallbackPercent || 0);
};

const resolveExpirationRange = (payload = {}, fallbackItem = null) => {
  const preset = normalizeText(payload.expirationPreset || fallbackItem?.expirationPreset || 'never') || 'never';
  if (preset === 'never') {
    return { expirationPreset: 'never', startsAt: null, endsAt: null };
  }

  const days = GIFT_CARD_EXPIRATION_PRESETS[preset];
  if (!days) {
    return {
      expirationPreset: normalizeText(fallbackItem?.expirationPreset || 'never') || 'never',
      startsAt: fallbackItem?.startsAt ? parseDate(fallbackItem.startsAt) : new Date(),
      endsAt: fallbackItem?.endsAt ? parseDate(fallbackItem.endsAt) : null
    };
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + (days * 24 * 60 * 60 * 1000));
  return { expirationPreset: preset, startsAt, endsAt };
};

const resolveGiftCardPackageText = (payload = {}, fallbackItem = null) => {
  const title = normalizeText(
    payload.title ?? payload.title_en ?? payload.title_ar ?? fallbackItem?.title ?? fallbackItem?.title_en ?? fallbackItem?.title_ar
  );
  const description = normalizeOptionalText(
    payload.description ?? payload.description_en ?? payload.description_ar ?? fallbackItem?.description ?? fallbackItem?.description_en ?? fallbackItem?.description_ar
  );

  return { title, description };
};

const deriveExpirationPresetFromDates = (item) => {
  if (!item?.endsAt) return 'never';
  const startSource = item.startsAt || item.createdAt || item.endsAt;
  const start = parseDate(startSource);
  const end = parseDate(item.endsAt);
  if (!start || !end) return 'never';
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const preset = Object.entries(GIFT_CARD_EXPIRATION_PRESETS).find(([key, value]) => key !== 'never' && Math.abs((value?.days || 0) - diffDays) <= 2);
  return preset?.[0] || 'never';
};

const normalizeGiftCardPackage = (item) => ({
  id: item.id,
  tenantId: item.tenantId,
  title: normalizeText(item.title || item.title_en || item.title_ar),
  description: normalizeOptionalText(item.description || item.description_en || item.description_ar),
  title_en: normalizeText(item.title_en || item.title || item.title_ar),
  title_ar: normalizeText(item.title_ar || item.title || item.title_en),
  description_en: normalizeOptionalText(item.description_en || item.description || item.description_ar),
  description_ar: normalizeOptionalText(item.description_ar || item.description || item.description_en),
  displayOrder: Number(item.displayOrder || 0),
  discountPercent: item.discountPercent != null ? Number(item.discountPercent) : calculateDiscountPercent(item.walletCreditAmount, item.priceAmount),
  priceAmount: Number(item.priceAmount || 0),
  walletCreditAmount: Number(item.walletCreditAmount || 0),
  bonusAmount: Number(item.bonusAmount || 0),
  discountPreset: normalizeText(item.discountPreset) || deriveDiscountPreset(item.discountPercent != null ? Number(item.discountPercent) : calculateDiscountPercent(item.walletCreditAmount, item.priceAmount)),
  expirationPreset: normalizeText(item.expirationPreset) || deriveExpirationPresetFromDates(item),
  startsAt: item.startsAt || null,
  endsAt: item.endsAt || null,
  imageUrl: item.imageUrl || null,
  thumbnailUrl: item.thumbnailUrl || null,
  isActive: item.isActive !== false,
  createdAt: item.createdAt || null,
  updatedAt: item.updatedAt || null
});

const getActiveGiftPackageWhere = (tenantId, extraWhere = {}) => {
  const now = new Date();
  return {
    tenantId,
    ...extraWhere,
    isActive: true,
    [Op.and]: [
      { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
      { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }] }
    ]
  };
};

const formatPersonName = (person, fallback = 'Unavailable') => {
  if (!person) return fallback;
  const name = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return name || person.displayName || person.name || person.email || fallback;
};

const buildGiftCardPurchasedByLabel = (transaction, staffLookup, accountLookup) => {
  const metadata = transaction?.metadata || {};
  const sender = transaction?.sender || null;
  const staffId = metadata.createdByStaffId || metadata.paymentCollectedByStaffId || null;
  const accountId = metadata.createdByTenantAccountId || metadata.paymentCollectedByTenantAccountId || null;

  if (sender) return formatPersonName(sender);
  if (staffId && staffLookup.has(staffId)) return staffLookup.get(staffId);
  if (accountId && accountLookup.has(accountId)) return accountLookup.get(accountId);
  return metadata.createdByLabel || metadata.paymentCollectedByLabel || 'Tenant';
};

const buildGiftCardRedeemedByLabel = (redemptions, staffLookup) => {
  const latestRedemption = Array.isArray(redemptions) && redemptions.length
    ? redemptions.slice().sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0]
    : null;
  const staffId = latestRedemption?.redeemedByStaffId || null;
  if (staffId && staffLookup.has(staffId)) return staffLookup.get(staffId);
  if (latestRedemption?.redeemedByStaff) return formatPersonName(latestRedemption.redeemedByStaff);
  return 'Unavailable';
};

const buildGiftCardCustomerLabel = (transaction) => {
  const recipient = transaction?.recipient || null;
  if (recipient) return formatPersonName(recipient);
  return transaction?.recipientEmail || transaction?.recipientPhone || 'Unavailable';
};

const buildGiftCardRows = async ({ tenantId, where = {}, limit = 300 }) => {
  const transactionRows = await db.TenantGiftCardTransaction.findAll({
    where: { tenantId, ...where },
    include: [
      { model: db.TenantGiftCardPackage, as: 'package', attributes: ['id', 'title_en', 'title_ar', 'imageUrl'], required: false },
      { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
      { model: db.PlatformUser, as: 'recipient', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
      { model: db.TenantGiftCardSettlement, as: 'settlement', attributes: ['id', 'grossAmount', 'platformFeeAmount', 'netTenantPayableAmount', 'status', 'settledAt'], required: false },
      {
        model: db.GiftCardCode,
        as: 'giftCode',
        required: false,
        include: [
          {
            model: db.GiftCardCodeRedemption,
            as: 'redemptions',
            required: false,
            include: [
              { model: db.Staff, as: 'redeemedByStaff', attributes: ['id', 'name', 'email'], required: false }
            ]
          }
        ]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit
  });

  const staffIds = new Set();
  const accountIds = new Set();
  transactionRows.forEach((row) => {
    const metadata = row?.metadata || {};
    if (metadata.createdByStaffId) staffIds.add(String(metadata.createdByStaffId));
    if (metadata.paymentCollectedByStaffId) staffIds.add(String(metadata.paymentCollectedByStaffId));
    if (metadata.createdByTenantAccountId) accountIds.add(String(metadata.createdByTenantAccountId));
    if (metadata.paymentCollectedByTenantAccountId) accountIds.add(String(metadata.paymentCollectedByTenantAccountId));
    const redemptions = Array.isArray(row?.giftCode?.redemptions) ? row.giftCode.redemptions : [];
    redemptions.forEach((redemption) => {
      if (redemption?.redeemedByStaffId) staffIds.add(String(redemption.redeemedByStaffId));
    });
  });

  const [staffRows, accountRows] = await Promise.all([
    staffIds.size
      ? db.Staff.findAll({
          where: { id: { [Op.in]: Array.from(staffIds) } },
          attributes: ['id', 'name', 'email']
        })
      : [],
    accountIds.size
      ? db.TenantDashboardAccount.findAll({
          where: { id: { [Op.in]: Array.from(accountIds) } },
          attributes: ['id', 'displayName', 'email']
        })
      : []
  ]);

  const staffLookup = new Map(staffRows.map((row) => [row.id, row.name || row.email || 'Unavailable']));
  const accountLookup = new Map(accountRows.map((row) => [row.id, row.displayName || row.email || 'Unavailable']));

  return transactionRows.map((transaction) => {
    const giftCode = transaction.giftCode || null;
    const redemptions = Array.isArray(giftCode?.redemptions) ? giftCode.redemptions : [];
    const redeemedAmount = redemptions.reduce((sum, redemption) => sum + Number(redemption?.redeemedAmount || 0), 0);
    const latestRedemption = redemptions.length
      ? redemptions.slice().sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0]
      : null;
    const purchasedBy = buildGiftCardPurchasedByLabel(transaction, staffLookup, accountLookup);
    const redeemedBy = buildGiftCardRedeemedByLabel(redemptions, staffLookup);

    return {
      id: giftCode?.id || transaction.id,
      giftCardCode: giftCode?.code || 'Unavailable',
      saleNumber: transaction.id,
      purchasedBy,
      redeemedBy,
      customer: buildGiftCardCustomerLabel(transaction),
      status: giftCode?.status || transaction.status || 'Unavailable',
      issueDate: giftCode?.createdAt || transaction.createdAt || null,
      expiryDate: giftCode?.expiresAt || transaction.expiresAt || null,
      originalAmount: Number((giftCode?.initialAmount ?? transaction.totalCreditAmount ?? 0).toFixed(2)),
      redeemedAmount: Number(redeemedAmount.toFixed(2)),
      remainingBalance: giftCode?.remainingAmount == null ? null : Number(giftCode.remainingAmount),
      invoiceNumber: transaction?.settlement?.metadata?.invoiceNumber
        || transaction?.metadata?.invoiceNumber
        || transaction?.invoiceNumber
        || 'Unavailable',
      paymentMethod: transaction?.metadata?.paymentMethod || 'Unavailable',
      location: transaction?.metadata?.location || 'Unavailable',
      employee: redeemedBy !== 'Unavailable' ? redeemedBy : purchasedBy,
      sourceTransaction: transaction.toJSON ? transaction.toJSON() : transaction,
      redemptions: redemptions.map((redemption) => ({
        id: redemption.id,
        redeemedAmount: Number(redemption.redeemedAmount || 0),
        remainingAfter: Number(redemption.remainingAfter || 0),
        redeemedBy: redemption?.redeemedByStaff
          ? formatPersonName(redemption.redeemedByStaff)
          : (redemption?.redeemedByStaffId && staffLookup.has(redemption.redeemedByStaffId)
            ? staffLookup.get(redemption.redeemedByStaffId)
            : 'Unavailable'),
        redeemedAt: redemption.createdAt || null,
        appointmentId: redemption.appointmentId || null,
        orderId: redemption.orderId || null,
        posInvoiceId: redemption.posInvoiceId || null,
        metadata: redemption.metadata || {}
      })),
      latestRedemption: latestRedemption ? {
        id: latestRedemption.id,
        redeemedAmount: Number(latestRedemption.redeemedAmount || 0),
        remainingAfter: Number(latestRedemption.remainingAfter || 0),
        redeemedBy: latestRedemption?.redeemedByStaff
          ? formatPersonName(latestRedemption.redeemedByStaff)
          : (latestRedemption?.redeemedByStaffId && staffLookup.has(latestRedemption.redeemedByStaffId)
            ? staffLookup.get(latestRedemption.redeemedByStaffId)
            : 'Unavailable'),
        redeemedAt: latestRedemption.createdAt || null
      } : null
    };
  });
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
      where: getActiveGiftPackageWhere(tenantId),
      order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
    });
    return res.json({ success: true, packages: rows.map(normalizeGiftCardPackage) });
  } catch (error) {
    console.error('tenant gift list packages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load gift card packages' });
  }
};

exports.createPackage = async (req, res) => {
  try {
    const tenantId = ensureTenantId(req);
    const {
      title,
      title_en,
      title_ar,
      description,
      description_en,
      description_ar,
      displayOrder = 0,
      priceAmount,
      walletCreditAmount = 0,
      bonusAmount = 0,
      discountPreset,
      discountPercent,
      discountValue,
      expirationPreset,
      isActive = true
    } = req.body || {};

    const text = resolveGiftCardPackageText({ title, title_en, title_ar, description, description_en, description_ar });
    if (!text.title) {
      return res.status(400).json({ success: false, message: 'Gift card title is required.' });
    }

    const walletAmount = Number(walletCreditAmount || 0);
    if (!Number.isFinite(walletAmount) || walletAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Gift card value must be greater than 0.' });
    }

    const percent = resolveDiscountPercent({
      discountPreset,
      discountPercent,
      discountValue
    }, 10, priceAmount, walletAmount);
    if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
      return res.status(400).json({ success: false, message: 'Discount percentage must be between 0 and 100.' });
    }

    const computedPrice = calculatePriceAmount(walletAmount, percent);
    const discountPresetValue = deriveDiscountPreset(percent);
    const expiration = resolveExpirationRange({ expirationPreset });

    const created = await db.TenantGiftCardPackage.create({
      tenantId,
      title: text.title,
      description: text.description,
      title_en: text.title,
      title_ar: text.title,
      description_en: text.description,
      description_ar: text.description,
      displayOrder: Number(displayOrder || 0),
      discountPreset: discountPresetValue,
      discountPercent: percent,
      priceAmount: computedPrice,
      walletCreditAmount: walletAmount,
      bonusAmount: Number(bonusAmount || 0),
      expirationPreset: expiration.expirationPreset,
      startsAt: expiration.startsAt,
      endsAt: expiration.endsAt,
      isActive: isActive !== false
    });

    if (req.file) {
      const normalizedPath = req.file.path
        .replace(/\\/g, '/')
        .replace(/^.*uploads\//, 'uploads/');
      created.imageUrl = `/${normalizedPath}`;
      await created.save();
    }

    return res.status(201).json({ success: true, package: normalizeGiftCardPackage(created) });
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
    if (payload.displayOrder !== undefined) item.displayOrder = Number(payload.displayOrder || 0);
    if (payload.bonusAmount !== undefined) item.bonusAmount = Number(payload.bonusAmount || 0);
    if (payload.isActive !== undefined) item.isActive = payload.isActive !== false;

    const text = resolveGiftCardPackageText(payload, item);
    if (payload.title !== undefined || payload.title_en !== undefined || payload.title_ar !== undefined) {
      item.title = text.title;
      item.title_en = text.title;
      item.title_ar = text.title;
    }
    if (payload.description !== undefined || payload.description_en !== undefined || payload.description_ar !== undefined) {
      item.description = text.description;
      item.description_en = text.description;
      item.description_ar = text.description;
    }

    const pricingPayloadKeys = ['walletCreditAmount', 'priceAmount', 'discountPreset', 'discountPercent', 'discountValue'];
    const hasPricingUpdate = pricingPayloadKeys.some((key) => payload[key] !== undefined);
    if (hasPricingUpdate) {
      const walletAmount = payload.walletCreditAmount !== undefined ? Number(payload.walletCreditAmount || 0) : Number(item.walletCreditAmount || 0);
      if (!Number.isFinite(walletAmount) || walletAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Gift card value must be greater than 0.' });
      }
      const percent = resolveDiscountPercent(payload, Number(item.discountPercent || 0), payload.priceAmount ?? item.priceAmount, walletAmount);
      if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
        return res.status(400).json({ success: false, message: 'Discount percentage must be between 0 and 100.' });
      }
      item.walletCreditAmount = walletAmount;
      item.discountPreset = deriveDiscountPreset(percent);
      item.discountPercent = percent;
      item.priceAmount = calculatePriceAmount(walletAmount, percent);
    }

    if (payload.expirationPreset !== undefined) {
      const expiration = resolveExpirationRange({ expirationPreset: payload.expirationPreset }, item);
      item.expirationPreset = expiration.expirationPreset;
      item.startsAt = expiration.startsAt;
      item.endsAt = expiration.endsAt;
    }

    await item.save();
    return res.json({ success: true, package: normalizeGiftCardPackage(item) });
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
    return res.json({ success: true, package: normalizeGiftCardPackage(item) });
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

    return res.json({ success: true, package: normalizeGiftCardPackage(item), imageUrl: item.imageUrl });
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
        { model: db.TenantGiftCardSettlement, as: 'settlement', attributes: ['id', 'grossAmount', 'platformFeeAmount', 'netTenantPayableAmount', 'status', 'settledAt'], required: false },
        {
          model: db.GiftCardCode,
          as: 'giftCode',
          required: false,
          include: [
            {
              model: db.GiftCardCodeRedemption,
              as: 'redemptions',
              required: false,
              include: [
                { model: db.Staff, as: 'redeemedByStaff', attributes: ['id', 'name', 'email'], required: false }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(req.query.limit || 200)
    });

    const giftCards = await buildGiftCardRows({ tenantId, where, limit: Number(req.query.limit || 300) });
    const summary = giftCards.reduce((acc, row) => {
      const originalAmount = Number(row.originalAmount || 0);
      const redeemedAmount = Number(row.redeemedAmount || 0);
      const remainingBalance = row.remainingBalance == null ? 0 : Number(row.remainingBalance || 0);
      acc.totalGiftCards += 1;
      acc.totalOriginalAmount += originalAmount;
      acc.totalRedeemedAmount += redeemedAmount;
      acc.totalRemainingBalance += remainingBalance;
      if (`${row.status || ''}`.trim().toLowerCase() === 'redeemed') acc.redeemedCount += 1;
      else if (`${row.status || ''}`.trim().toLowerCase() === 'partially_redeemed') acc.partiallyRedeemedCount += 1;
      else if (`${row.status || ''}`.trim().toLowerCase() === 'expired') acc.expiredCount += 1;
      else if (`${row.status || ''}`.trim().toLowerCase() === 'cancelled') acc.cancelledCount += 1;
      else acc.issuedCount += 1;
      return acc;
    }, {
      totalGiftCards: 0,
      totalOriginalAmount: 0,
      totalRedeemedAmount: 0,
      totalRemainingBalance: 0,
      issuedCount: 0,
      redeemedCount: 0,
      partiallyRedeemedCount: 0,
      expiredCount: 0,
      cancelledCount: 0
    });

    return res.json({
      success: true,
      transactions: rows,
      giftCards,
      giftCardSummary: {
        totalGiftCards: summary.totalGiftCards,
        totalOriginalAmount: Number(summary.totalOriginalAmount.toFixed(2)),
        totalRedeemedAmount: Number(summary.totalRedeemedAmount.toFixed(2)),
        totalRemainingBalance: Number(summary.totalRemainingBalance.toFixed(2)),
        issuedCount: summary.issuedCount,
        redeemedCount: summary.redeemedCount,
        partiallyRedeemedCount: summary.partiallyRedeemedCount,
        expiredCount: summary.expiredCount,
        cancelledCount: summary.cancelledCount
      }
    });
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
      'package_title',
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
        escapeCsvCell(row.package?.title_en || row.package?.title_ar || ''),
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
