'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const orderService = require('../services/orderService');
const userService = require('../services/userService');
const tenantWalletService = require('../services/tenantWalletService');
const tenantGiftSettlementService = require('../services/tenantGiftSettlementService');
const notificationOrchestrator = require('../services/notificationOrchestratorService');
const { sendEmail } = require('../utils/emailService');
const { getServerPublicUrl } = require('../utils/url');

const CLAIM_EXPIRY_HOURS = 24 * 30;
const VALID_PAYMENT_METHODS = ['cash', 'card_pos', 'wallet', 'bank_transfer', 'gift_card_code'];

const normalizeText = (value) => `${value || ''}`.trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, '');

const parseMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const normalizeAllocations = (amount, paymentMethod, paymentAllocations = []) => {
  const total = parseMoney(amount);
  if (total <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const sourceAllocations = Array.isArray(paymentAllocations) && paymentAllocations.length > 0
    ? paymentAllocations
    : [{ paymentMethod, amount: total }];

  const normalized = sourceAllocations.map((allocation, index) => {
    const allocationAmount = parseMoney(allocation?.amount);
    if (allocationAmount <= 0) {
      throw new Error(`Invalid payment allocation amount at position ${index + 1}`);
    }

    const method = normalizeText(allocation?.paymentMethod || paymentMethod || 'cash').toLowerCase();
    if (!VALID_PAYMENT_METHODS.includes(method)) {
      throw new Error(`Invalid payment method in allocation ${index + 1}`);
    }

    return {
      paymentMethod: method,
      amount: allocationAmount,
      giftCardCode: normalizeText(allocation?.giftCardCode || allocation?.giftCardCodeNumber || '') || null,
      notes: normalizeText(allocation?.notes || '') || null
    };
  });

  const totalAllocations = normalized.reduce((sum, allocation) => sum + parseMoney(allocation.amount), 0);
  const difference = parseMoney(total - totalAllocations);

  if (Math.abs(difference) > 0.5) {
    throw new Error('Payment allocations must add up to the payment amount');
  }

  if (Math.abs(difference) > 0.0001 && normalized.length > 0) {
    const lastIndex = normalized.length - 1;
    normalized[lastIndex] = {
      ...normalized[lastIndex],
      amount: parseMoney(normalized[lastIndex].amount + difference)
    };
  }

  return normalized;
};

const splitName = (fullName = '') => {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || 'Guest';
  const lastName = parts.join(' ') || 'User';
  return { firstName, lastName };
};

const buildClaimLink = (token) => {
  const base = (getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '');
  return `${base}/api/v1/users/tenant-gifts/claim/open?token=${encodeURIComponent(token)}`;
};

const generateGiftCode = (prefix = 'TN') => {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${prefix}-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
};

const sendTenantGiftClaimEmail = async ({ to, senderName, totalCredit, code, claimLink }) => {
  return sendEmail({
    to,
    subject: `${senderName} sent you a Refah gift card`,
    template: 'customer_review_invite',
    data: {
      customerName: 'Dear customer',
      tenantName: 'Refah',
      serviceName: `Gift card ${Number(totalCredit || 0).toFixed(2)} SAR - Code: ${code || '-'}`,
      appointmentDate: new Date().toLocaleString('en-US'),
      reviewLink: claimLink,
      googleReviewUrl: claimLink
    }
  });
};

const getActiveGiftPackage = async (tenantId, packageId) => {
  const now = new Date();
  return db.TenantGiftCardPackage.findOne({
    where: {
      tenantId,
      id: packageId,
      isActive: true,
      [Op.and]: [
        { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }] }
      ]
    }
  });
};

const resolveCustomer = async (payload = {}, transaction = null) => {
  const customerId = normalizeText(payload.customerId);
  const email = normalizeEmail(payload.customerEmail);
  const phone = normalizePhone(payload.customerPhone);
  const firstName = normalizeText(payload.customerFirstName || payload.firstName || payload.customerName);
  const lastName = normalizeText(payload.customerLastName || payload.lastName);
  const birthDate = normalizeText(payload.customerBirthDate || payload.dateOfBirth);

  if (customerId) {
    const customer = await db.PlatformUser.findByPk(customerId, { transaction });
    if (!customer) {
      throw new Error('Customer not found');
    }

    const updates = {};
    if (firstName && !customer.firstName) updates.firstName = firstName;
    if (lastName && !customer.lastName) updates.lastName = lastName;
    if (email && !customer.email) updates.email = email;
    if (phone && !customer.phone) updates.phone = phone;
    if (birthDate && !customer.dateOfBirth) updates.dateOfBirth = birthDate;

    if (Object.keys(updates).length > 0) {
      await customer.update(updates, { transaction });
    }

    return { customer, created: false };
  }

  if (!email && !phone) {
    if (!firstName) {
      throw new Error('Customer name is required');
    }
    return { customer: null, created: false };
  }

  const existing = await userService.findUserByEmailOrPhone(email, phone);
  if (existing) {
    const updates = {};
    if (firstName && !existing.firstName) updates.firstName = firstName;
    if (lastName && !existing.lastName) updates.lastName = lastName;
    if (email && !existing.email) updates.email = email;
    if (phone && !existing.phone) updates.phone = phone;
    if (birthDate && !existing.dateOfBirth) updates.dateOfBirth = birthDate;

    if (Object.keys(updates).length > 0) {
      await existing.update(updates, { transaction });
    }

    return { customer: existing, created: false };
  }

  if (!firstName) {
    throw new Error('Customer name is required');
  }

  const guest = await userService.findOrCreatePlatformUser({
    email,
    phone,
    firstName,
    lastName
  }, transaction ? { transaction } : {});

  if (birthDate && !guest.dateOfBirth) {
    await guest.update({ dateOfBirth: birthDate }, { transaction });
  }

  return { customer: guest, created: true };
};

exports.purchaseGiftCard = async (req, res) => {
  const tx = await db.sequelize.transaction();
  try {
    const tenantId = req.tenantId;
    const senderId = req.userId || null;
    const {
      packageId,
      customerId,
      customerName,
      customerFirstName,
      customerLastName,
      customerEmail,
      customerPhone,
      customerBirthDate,
      amount,
      paymentMethod,
      paymentAllocations,
      notes
    } = req.body || {};

    if (!tenantId || !packageId) {
      throw new Error('tenantId and packageId are required');
    }

    const giftPackage = await getActiveGiftPackage(tenantId, packageId);
    if (!giftPackage) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: 'Gift package not found or inactive' });
    }

    const normalizedEmail = normalizeEmail(customerEmail);
    const normalizedPhone = normalizePhone(customerPhone);
    const recipientPayload = {
      customerId,
      customerName,
      customerFirstName,
      customerLastName,
      customerEmail: normalizedEmail,
      customerPhone: normalizedPhone,
      customerBirthDate
    };

    const { customer: recipient, created: createdGuest } = await resolveCustomer(recipientPayload, tx);
    if (!recipient && !normalizeEmail(customerEmail) && !normalizePhone(customerPhone)) {
      throw new Error('Customer email or phone is required for gift card delivery');
    }
    const purchaseAmount = parseMoney(giftPackage.priceAmount || amount || 0);
    if (amount !== undefined && amount !== null && Math.abs(parseMoney(amount) - purchaseAmount) > 0.5) {
      throw new Error('Payment amount does not match the selected gift card price');
    }
    const totalCredit = parseMoney(Number(giftPackage.walletCreditAmount || 0) + Number(giftPackage.bonusAmount || 0));
    const normalizedAllocations = normalizeAllocations(purchaseAmount, paymentMethod || 'cash', paymentAllocations);
    const claimToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + (CLAIM_EXPIRY_HOURS * 60 * 60 * 1000));
    const packageTitle = giftPackage.title || giftPackage.title_en || giftPackage.title_ar || 'Tenant gift card';
    const isRefahRecipient = !!recipient?.id && !createdGuest;
    const externalCodeNeeded = !isRefahRecipient;

    let giftCardCode = null;
    if (externalCodeNeeded) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateGiftCode('TN');
        const exists = await db.GiftCardCode.findOne({ where: { code: candidate }, transaction: tx });
        if (!exists) {
          giftCardCode = await db.GiftCardCode.create({
            code: candidate,
            scopeType: 'tenant_scoped',
            tenantId,
            sourceGiftCardTransactionId: null,
            sourceTenantGiftCardTransactionId: null,
            initialAmount: totalCredit,
            remainingAmount: totalCredit,
            currency: 'SAR',
            recipientEmail: normalizedEmail || null,
            recipientPhone: normalizedPhone || null,
            status: 'issued',
            expiresAt,
            metadata: {
              packageId: giftPackage.id,
              packageTitle,
              createdByTenantAccountId: req.tenantAccountId || null,
              createdByStaffId: req.staffId || null
            }
          }, { transaction: tx });
          break;
        }
      }
      if (!giftCardCode) {
        throw new Error('Failed to generate unique tenant gift code');
      }
    }

    const giftTx = await db.TenantGiftCardTransaction.create({
      tenantId,
      packageId: giftPackage.id,
      senderPlatformUserId: null,
      recipientPlatformUserId: recipient?.id || null,
      recipientEmail: normalizedEmail || null,
      recipientPhone: normalizedPhone || null,
      purchaseAmount: giftPackage.priceAmount,
      creditAmount: giftPackage.walletCreditAmount,
      bonusAmount: giftPackage.bonusAmount,
      totalCreditAmount: totalCredit,
      status: isRefahRecipient ? 'sent_completed_auto_wallet' : 'sent_pending_external_redeem',
      deliveryChannel: isRefahRecipient ? 'in_app' : 'email',
      claimToken: isRefahRecipient ? null : claimToken,
      claimedAt: isRefahRecipient ? new Date() : null,
      expiresAt,
      deliveryMode: isRefahRecipient ? 'auto_wallet' : 'external_code',
      giftCardCodeId: giftCardCode?.id || null,
      recipientResolvedPlatformUserId: recipient?.id || null,
      metadata: {
        senderMessage: normalizeText(notes) || null,
        packageTitle,
        paymentMethod: paymentMethod || 'cash',
        paymentAllocations: normalizedAllocations,
        paymentCollectedByTenantAccountId: req.tenantAccountId || null,
        paymentCollectedByStaffId: req.staffId || null,
        externalRedeemCode: giftCardCode?.code || null
      }
    }, { transaction: tx });

    if (giftCardCode?.id) {
      giftCardCode.sourceTenantGiftCardTransactionId = giftTx.id;
      await giftCardCode.save({ transaction: tx });
    }

    if (recipient?.id && isRefahRecipient) {
      await tenantWalletService.creditTenantWallet({
        platformUserId: recipient.id,
        tenantId,
        amount: totalCredit,
        type: 'tenant_gift_credit',
        referenceType: 'tenant_gift_card_transaction',
        referenceId: giftTx.id,
        metadata: {
          senderId,
          senderName: `${req.tenant?.name || req.tenant?.name_en || 'Refah'}`.trim(),
          packageTitle
        },
        transaction: tx
      });
    }

    await tenantGiftSettlementService.createPendingSettlement({
      tenantId,
      transactionId: giftTx.id,
      packageId: giftPackage.id,
      grossAmount: purchaseAmount,
      platformFeeAmount: 0,
      metadata: {
        paymentMethod: paymentMethod || 'cash',
        paymentAllocations: normalizedAllocations,
        createdByTenantAccountId: req.tenantAccountId || null,
        createdByStaffId: req.staffId || null
      },
      transaction: tx
    });

    await tx.commit();

    const senderName = req.tenant?.name_ar || req.tenant?.name_en || req.tenant?.name || 'Refah';
    if (recipient?.id && isRefahRecipient) {
      try {
        await notificationOrchestrator.notifyCustomer({
          tenantId,
          platformUserId: recipient.id,
          eventType: 'gift_card_received',
          title: 'You received a gift card',
          body: `${senderName} added ${totalCredit.toFixed(2)} SAR to your wallet.`,
          data: {
            type: 'tenant_gift_card_received',
            giftTransactionId: giftTx.id,
            tenantId
          }
        });
      } catch (notificationError) {
        console.warn('Tenant gift push notification failed:', notificationError.message);
      }
    }

    if (!isRefahRecipient && normalizedEmail) {
      try {
        await sendTenantGiftClaimEmail({
          to: normalizedEmail,
          senderName,
          totalCredit,
          code: giftCardCode?.code || '',
          claimLink: buildClaimLink(claimToken)
        });
      } catch (emailError) {
        console.warn('Tenant gift email warning:', emailError.message);
      }
    }

    return res.json({
      success: true,
      message: isRefahRecipient
        ? 'Gift card credited successfully'
        : 'Gift card sent to recipient email',
      transaction: giftTx,
      externalRedeemCode: giftCardCode?.code || null,
      recipient: recipient ? {
        id: recipient.id,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        email: recipient.email,
        phone: recipient.phone
      } : null
    });
  } catch (error) {
    await tx.rollback();
    console.error('Tenant cart gift card purchase error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to complete gift card purchase' });
  }
};

exports.purchaseProducts = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const senderId = req.userId || null;
    const {
      items,
      customerId,
      customerName,
      customerFirstName,
      customerLastName,
      customerEmail,
      customerPhone,
      customerBirthDate,
      recipientType,
      notes,
      paymentMethod,
      paymentAllocations,
      transactionRef
    } = req.body || {};

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product is required' });
    }

    const { customer: recipient, created: createdGuest } = await resolveCustomer({
      customerId,
      customerName,
      customerFirstName,
      customerLastName,
      customerEmail,
      customerPhone,
      customerBirthDate
    });
    if (!recipient) {
      throw new Error('Customer details are required');
    }

    const orderNotes = [
      normalizeText(notes),
      recipientType === 'gift' ? 'gift_purchase' : 'self_purchase'
    ].filter(Boolean).join(' | ');

    const order = await orderService.createOrder({
      platformUserId: recipient.id,
      tenantId,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity || 0)
      })),
      paymentMethod: 'pay_on_visit',
      deliveryType: 'pickup',
      notes: orderNotes
    }, {
      skipNotification: true,
      skipInvoiceEmail: true
    });

    const orderTotal = parseMoney(order?.totalAmount || 0);
    const normalizedAllocations = normalizeAllocations(
      orderTotal,
      paymentMethod || 'cash',
      paymentAllocations
    );

    await orderService.updatePaymentStatus(order.id, 'paid', {
      paymentMethod: paymentMethod || 'cash',
      processedBy: req.staffId || req.tenantAccountId || null,
      transactionRef: transactionRef || `CART-ORDER-${order.orderNumber}`,
      notes: orderNotes,
      skipNotification: recipientType === 'self',
      metadata: {
        source: 'tenant_cart_products',
        recipientType: recipientType || 'self',
        paymentAllocations: normalizedAllocations,
        createdByTenantAccountId: req.tenantAccountId || null,
        createdByStaffId: req.staffId || null,
        senderId,
        recipientCreatedAsGuest: createdGuest,
        recipientId: recipient.id
      }
    });

    const updatedOrder = await orderService.getOrderById(order.id);

    return res.json({
      success: true,
      message: 'Product purchase completed successfully',
      order: updatedOrder || order
    });
  } catch (error) {
    console.error('Tenant cart product purchase error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to complete product purchase' });
  }
};
