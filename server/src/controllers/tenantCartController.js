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
const { createForensicTrace } = require('../utils/forensicTrace');

const CLAIM_EXPIRY_HOURS = 24 * 30;
const VALID_PAYMENT_METHODS = ['cash', 'card_pos', 'wallet', 'bank_transfer', 'gift_card_code'];

const normalizeText = (value) => `${value || ''}`.trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, '');

const parseMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
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

const resolveCustomer = async (payload = {}, options = {}) => {
  const transaction = options.transaction || null;
  const forensicTrace = options.forensicTrace || null;
  const customerId = normalizeText(payload.customerId);
  const email = normalizeEmail(payload.customerEmail);
  const phone = normalizePhone(payload.customerPhone);
  const firstName = normalizeText(payload.customerFirstName || payload.firstName || payload.customerName);
  const lastName = normalizeText(payload.customerLastName || payload.lastName);
  const birthDate = normalizeText(payload.customerBirthDate || payload.dateOfBirth);

  if (customerId) {
    const customer = await db.PlatformUser.findByPk(customerId, {
      transaction,
      ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
    });
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
      await customer.update(updates, {
        transaction,
        ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
      });
    }

    return { customer, created: false };
  }

  if (!email && !phone) {
    if (!firstName) {
      throw new Error('Customer name is required');
    }
    const guest = await userService.findOrCreatePlatformUser({
      email: `guest+${Date.now()}${crypto.randomBytes(4).toString('hex')}@guest.refah.local`,
      phone: await userService.generateGuestPhonePlaceholder(),
      firstName,
      lastName
    }, transaction ? {
      transaction,
      ...(forensicTrace ? { forensicTrace } : {})
    } : { forensicTrace });
    return { customer: guest, created: true };
  }

  const existing = await userService.findUserByEmailOrPhone(email, phone, { forensicTrace });
  if (existing) {
    const updates = {};
    if (firstName && !existing.firstName) updates.firstName = firstName;
    if (lastName && !existing.lastName) updates.lastName = lastName;
    if (email && !existing.email) updates.email = email;
    if (phone && !existing.phone) updates.phone = phone;
    if (birthDate && !existing.dateOfBirth) updates.dateOfBirth = birthDate;

    if (Object.keys(updates).length > 0) {
      await existing.update(updates, {
        transaction,
        ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
      });
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
  }, transaction ? {
    transaction,
    ...(forensicTrace ? { forensicTrace } : {})
  } : { forensicTrace });

  if (birthDate && !guest.dateOfBirth) {
    await guest.update({ dateOfBirth: birthDate }, {
      transaction,
      ...(forensicTrace?.sqlLogger ? { logging: forensicTrace.sqlLogger } : {})
    });
  }

  return { customer: guest, created: true };
};

exports.purchaseGiftCard = async (req, res) => {
  const forensicTrace = createForensicTrace({ label: 'POST /api/v1/tenant/cart/gift-cards/purchase', req, res });
  forensicTrace.log('BEGIN transaction', { scope: 'purchaseGiftCard' });
  const tx = await db.sequelize.transaction({ logging: forensicTrace.sqlLogger });
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
    let resolvedPackageId = packageId;
    let resolvedAmount = amount;

    // TODO: [COMPATIBILITY LAYER] Temporary fallback for legacy POS clients sending a cart array.
    // This MUST NOT become the canonical API contract. To be removed once legacy POS is deprecated.
    if (!resolvedPackageId && Array.isArray(req.body.items) && req.body.items.length > 0) {
      resolvedPackageId = req.body.items[0].giftCardId || req.body.items[0].packageId;
      resolvedAmount = req.body.items[0].price;
    }

    if (!tenantId || !resolvedPackageId) {
      throw new Error('tenantId and packageId are required');
    }

    const giftPackage = await getActiveGiftPackage(tenantId, resolvedPackageId);
    if (!giftPackage) {
      await tx.rollback();
      forensicTrace.log('ROLLBACK', { scope: 'purchaseGiftCard', reason: 'gift package not found or inactive' });
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

    const { customer: recipient, created: createdGuest } = await resolveCustomer(recipientPayload, {
      transaction: tx,
      forensicTrace
    });
    if (!recipient && !normalizeEmail(customerEmail) && !normalizePhone(customerPhone)) {
      throw new Error('Customer email or phone is required for gift card delivery');
    }
    const purchaseAmount = parseMoney(giftPackage.priceAmount || resolvedAmount || 0);
    if (resolvedAmount !== undefined && resolvedAmount !== null && Math.abs(parseMoney(resolvedAmount) - purchaseAmount) > 0.5) {
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
        const exists = await db.GiftCardCode.findOne({
          where: { code: candidate },
          transaction: tx,
          logging: forensicTrace.sqlLogger
        });
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
          }, { transaction: tx, logging: forensicTrace.sqlLogger });
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
      senderPlatformUserId: senderId,
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
    }, { transaction: tx, logging: forensicTrace.sqlLogger });

    if (giftCardCode?.id) {
      giftCardCode.sourceTenantGiftCardTransactionId = giftTx.id;
      await giftCardCode.save({ transaction: tx, logging: forensicTrace.sqlLogger });
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
        transaction: tx,
        forensicTrace
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
      transaction: tx,
      forensicTrace
    });

    const paymentTransaction = await db.PaymentTransaction.create({
      type: 'full',
      amount: purchaseAmount,
      paymentMethod: paymentMethod || 'cash',
      status: 'completed',
      processedBy: req.staffId || null,
      processedAt: new Date(),
      metadata: {
        isGiftCard: true,
        source: 'gift_card_purchase',
        giftCardTransactionId: giftTx.id,
        tenantId,
        recipientId: recipient?.id || null,
        senderId
      }
    }, { transaction: tx, logging: forensicTrace.sqlLogger, forensicTrace });

    const platformFee = parseFloat((purchaseAmount * 0.025).toFixed(2));
    const tenantRevenue = parseFloat((purchaseAmount - platformFee).toFixed(2));

    const saleTransaction = await db.Transaction.create({
      platformUserId: senderId || recipient?.id,
      tenantId: tenantId,
      amount: purchaseAmount,
      currency: 'SAR',
      type: 'wallet_topup',
      status: 'completed',
      platformFee,
      tenantRevenue,
      metadata: {
        isGiftCard: true,
        source: 'gift_card_purchase',
        giftCardTransactionId: giftTx.id,
        paymentMethod: paymentMethod || 'cash'
      }
      }, { transaction: tx, logging: forensicTrace.sqlLogger, forensicTrace });

    await tx.commit();
    forensicTrace.log('COMMIT', {
      scope: 'purchaseGiftCard',
      giftCardTransactionId: giftTx.id,
      paymentTransactionId: paymentTransaction.id,
      transactionId: saleTransaction.id
    });

    try {
      const verification = {
        giftCardTransactionExists: await db.TenantGiftCardTransaction.count({
          where: { id: giftTx.id },
          logging: forensicTrace.sqlLogger
        }),
        paymentTransactionExists: await db.PaymentTransaction.count({
          where: { id: paymentTransaction.id },
          logging: forensicTrace.sqlLogger
        }),
        transactionExists: await db.Transaction.count({
          where: { id: saleTransaction.id },
          logging: forensicTrace.sqlLogger
        }),
        tenantGiftSettlementExists: await db.TenantGiftCardSettlement.count({
          where: { transactionId: giftTx.id },
          logging: forensicTrace.sqlLogger
        })
      };
      forensicTrace.log('Post-commit verification', verification);
    } catch (verificationError) {
      forensicTrace.log('Verification exception', {
        message: verificationError?.message || String(verificationError),
        stack: verificationError?.stack || null
      });
    }

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
        forensicTrace.log('Exception', {
          scope: 'purchaseGiftCard.notification',
          message: notificationError?.message || String(notificationError),
          stack: notificationError?.stack || null
        });
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
        forensicTrace.log('Exception', {
          scope: 'purchaseGiftCard.email',
          message: emailError?.message || String(emailError),
          stack: emailError?.stack || null
        });
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
    forensicTrace.log('ROLLBACK', { scope: 'purchaseGiftCard', message: error?.message || String(error) });
    forensicTrace.log('Exception', { message: error?.message || String(error), stack: error?.stack || null });
    return res.status(400).json({ success: false, message: error.message || 'Failed to complete gift card purchase' });
  }
};

exports.purchaseProducts = async (req, res) => {
  const forensicTrace = createForensicTrace({ label: 'POST /api/v1/tenant/cart/products/purchase', req, res });
  forensicTrace.log('BEGIN request flow', { scope: 'purchaseProducts' });
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
    }, { forensicTrace });
    if (!recipient) {
      throw new Error('Customer details are required');
    }

    const orderNotes = [
      normalizeText(notes),
      recipientType === 'gift' ? 'gift_purchase' : 'self_purchase'
    ].filter(Boolean).join(' | ');

    let order;
    await db.sequelize.transaction(async (tx) => {
      order = await orderService.createOrder({
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
        transaction: tx,
        skipNotification: true,
        skipInvoiceEmail: true,
        forensicTrace
      });

      const splitPaymentService = require('../services/splitPaymentService');
      const orderTotal = parseMoney(order?.totalAmount ?? 0);
      
      console.log('--- tenantCartController BEFORE normalizePaymentAllocations ---');
      console.log(`order.id: ${order.id}`);
      console.log(`order.subtotal: ${order.subtotal}`);
      console.log(`order.taxAmount: ${order.taxAmount}`);
      console.log(`order.shippingFee: ${order.shippingFee}`);
      console.log(`order.totalAmount: ${order.totalAmount}`);
      console.log(`paymentMethod (raw): ${paymentMethod}`);
      console.log(`paymentAllocations (raw):`, paymentAllocations);
      console.log(`JSON.stringify(paymentAllocations):`, JSON.stringify(paymentAllocations));
      
      const payload = {
        amount: orderTotal,
        paymentMethod: paymentMethod || 'cash',
        paymentAllocations,
        fallbackSource: paymentMethod || 'cash'
      };
      console.log(`EXACT OBJECT BEING PASSED:`, JSON.stringify(payload, null, 2));

      const normalizedAllocations = splitPaymentService.normalizePaymentAllocations(payload);

      await orderService.updatePaymentStatus(order.id, 'paid', {
        transaction: tx,
        paymentMethod: paymentMethod || 'cash',
        paymentAllocations: normalizedAllocations,
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
        },
        forensicTrace
      });
    });

    const updatedOrder = await orderService.getOrderById(order.id);

    try {
      const invoice = await db.CustomerInvoice.findOne({
        where: { entityType: 'order', entityId: order.id },
        include: [{
          model: db.CustomerInvoiceItem,
          as: 'items',
          required: false
        }],
        logging: forensicTrace.sqlLogger
      });
      const verification = {
        orderExists: await db.Order.count({ where: { id: order.id }, logging: forensicTrace.sqlLogger }),
        orderItemsExist: await db.OrderItem.count({ where: { orderId: order.id }, logging: forensicTrace.sqlLogger }),
        paymentTransactionExists: await db.PaymentTransaction.count({ where: { orderId: order.id }, logging: forensicTrace.sqlLogger }),
        transactionExists: await db.Transaction.count({ where: { orderId: order.id }, logging: forensicTrace.sqlLogger }),
        customerInvoiceExists: await db.CustomerInvoice.count({ where: { entityType: 'order', entityId: order.id }, logging: forensicTrace.sqlLogger }),
        customerInvoiceItemsExist: Array.isArray(invoice?.items) ? invoice.items.length : 0
      };
      forensicTrace.log('Post-commit verification', verification);
    } catch (verificationError) {
      forensicTrace.log('Verification exception', {
        message: verificationError?.message || String(verificationError),
        stack: verificationError?.stack || null
      });
    }

    return res.json({
      success: true,
      message: 'Product purchase completed successfully',
      order: updatedOrder || order
    });
  } catch (error) {
    forensicTrace.log('Exception', { message: error?.message || String(error), stack: error?.stack || null });
    return res.status(400).json({ success: false, message: error.message || 'Failed to complete product purchase' });
  }
};
