'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const paymentService = require('../services/paymentService');
const tenantWalletService = require('../services/tenantWalletService');
const tenantGiftSettlementService = require('../services/tenantGiftSettlementService');
const notificationOrchestrator = require('../services/notificationOrchestratorService');
const { sendEmail } = require('../utils/emailService');
const { getServerPublicUrl } = require('../utils/url');

const CLAIM_EXPIRY_HOURS = 24 * 30;

const normalize = (value) => `${value || ''}`.trim();
const normalizePhone = (value) => normalize(value).replace(/\s+/g, '');
const generateGiftCode = (prefix = 'TN') => {
    const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `${prefix}-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
};

const validateGiftPaymentPayload = (payload = {}) => {
    const cardNumber = normalize(payload.cardNumber).replace(/[\s-]/g, '');
    const expiryDate = normalize(payload.expiryDate);
    const cvv = normalize(payload.cvv);
    const cardholderName = normalize(payload.cardholderName);

    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
        throw new Error('cardNumber, expiryDate, cvv, and cardholderName are required');
    }

    paymentService.validateCard(cardNumber, expiryDate, cvv);
    if (cardNumber === '4000000000000002') throw new Error('Payment declined by issuer');
    if (cardNumber === '4000000000009995') throw new Error('Insufficient funds');

    return { cardNumber, cardholderName };
};

const findActiveTenantPackage = async (tenantId, packageId) => {
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

const createPaymentTransaction = async ({
    platformUserId,
    tenantId,
    amount,
    cardNumber,
    cardholderName,
    giftFlow,
    packageId,
    transaction
}) => {
    return db.Transaction.create({
        platformUserId,
        tenantId,
        amount,
        currency: 'SAR',
        type: 'wallet_topup',
        status: 'completed',
        platformFee: 0,
        tenantRevenue: amount,
        metadata: {
            paymentSource: 'fake_gateway_card',
            giftFlow,
            packageId,
            cardLast4: cardNumber.slice(-4),
            cardBrand: paymentService.getCardBrand(cardNumber),
            cardholderName
        }
    }, { transaction });
};

exports.purchaseForSelf = async (req, res) => {
    const tx = await db.sequelize.transaction();
    try {
        const senderId = req.userId;
        const { tenantId, packageId } = req.body || {};
        const paymentPayload = validateGiftPaymentPayload(req.body || {});
        if (!tenantId || !packageId) throw new Error('tenantId and packageId are required');

        const giftPackage = await findActiveTenantPackage(tenantId, packageId);
        if (!giftPackage) {
            await tx.rollback();
            return res.status(404).json({ success: false, message: 'Gift package not found or inactive' });
        }

        const purchaseAmount = Number(giftPackage.priceAmount || 0);
        const totalCredit = Number(giftPackage.walletCreditAmount || 0) + Number(giftPackage.bonusAmount || 0);

        const paymentTransaction = await createPaymentTransaction({
            platformUserId: senderId,
            tenantId,
            amount: purchaseAmount,
            cardNumber: paymentPayload.cardNumber,
            cardholderName: paymentPayload.cardholderName,
            giftFlow: 'tenant_self_recharge',
            packageId: giftPackage.id,
            transaction: tx
        });

        const giftTx = await db.TenantGiftCardTransaction.create({
            tenantId,
            packageId: giftPackage.id,
            senderPlatformUserId: senderId,
            recipientPlatformUserId: senderId,
            purchaseAmount: giftPackage.priceAmount,
            creditAmount: giftPackage.walletCreditAmount,
            bonusAmount: giftPackage.bonusAmount,
            totalCreditAmount: totalCredit,
            status: 'redeemed',
            deliveryChannel: 'in_app',
            claimedAt: new Date(),
            metadata: { flow: 'self_recharge', paymentTransactionId: paymentTransaction.id }
        }, { transaction: tx });

        const walletResult = await tenantWalletService.creditTenantWallet({
            platformUserId: senderId,
            tenantId,
            amount: totalCredit,
            type: 'tenant_gift_credit',
            referenceType: 'tenant_gift_card_transaction',
            referenceId: giftTx.id,
            metadata: { packageId: giftPackage.id, packageTitle: giftPackage.title_en },
            transaction: tx
        });

        await tenantGiftSettlementService.createPendingSettlement({
            tenantId,
            transactionId: giftTx.id,
            packageId: giftPackage.id,
            grossAmount: purchaseAmount,
            platformFeeAmount: 0,
            metadata: { paymentTransactionId: paymentTransaction.id },
            transaction: tx
        });

        await tx.commit();
        res.json({
            success: true,
            message: 'Tenant gift wallet recharged successfully',
            walletBalance: walletResult.balanceAfter,
            transaction: giftTx
        });
    } catch (error) {
        await tx.rollback();
        console.error('Tenant self purchase gift error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to complete purchase' });
    }
};

exports.sendGift = async (req, res) => {
    const tx = await db.sequelize.transaction();
    try {
        const senderId = req.userId;
        const { tenantId, packageId, recipientEmail, recipientPhone, message } = req.body || {};
        const paymentPayload = validateGiftPaymentPayload(req.body || {});
        const email = normalize(recipientEmail).toLowerCase();
        const phone = normalizePhone(recipientPhone);
        if (!tenantId || !packageId) throw new Error('tenantId and packageId are required');
        if (!email && !phone) throw new Error('recipientEmail or recipientPhone is required');

        const giftPackage = await findActiveTenantPackage(tenantId, packageId);
        if (!giftPackage) {
            await tx.rollback();
            return res.status(404).json({ success: false, message: 'Gift package not found or inactive' });
        }

        const sender = await db.PlatformUser.findByPk(senderId, { transaction: tx });
        if (!sender) throw new Error('Sender not found');

        const recipient = await db.PlatformUser.findOne({
            where: {
                [Op.or]: [
                    ...(email ? [db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('email')), email)] : []),
                    ...(phone ? [{ phone }] : [])
                ]
            },
            transaction: tx
        });

        const purchaseAmount = Number(giftPackage.priceAmount || 0);
        const totalCredit = Number(giftPackage.walletCreditAmount || 0) + Number(giftPackage.bonusAmount || 0);
        const claimToken = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + (CLAIM_EXPIRY_HOURS * 60 * 60 * 1000));

        const paymentTransaction = await createPaymentTransaction({
            platformUserId: senderId,
            tenantId,
            amount: purchaseAmount,
            cardNumber: paymentPayload.cardNumber,
            cardholderName: paymentPayload.cardholderName,
            giftFlow: 'tenant_send_gift',
            packageId: giftPackage.id,
            transaction: tx
        });

        const isRecipientRegistered = !!recipient?.id;
        let createdGiftCode = null;
        if (!isRecipientRegistered) {
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const candidate = generateGiftCode('TN');
                const exists = await db.GiftCardCode.findOne({ where: { code: candidate }, transaction: tx });
                if (!exists) {
                    createdGiftCode = await db.GiftCardCode.create({
                        code: candidate,
                        scopeType: 'tenant_scoped',
                        tenantId,
                        sourceGiftCardTransactionId: null,
                        sourceTenantGiftCardTransactionId: null,
                        initialAmount: totalCredit,
                        remainingAmount: totalCredit,
                        currency: 'SAR',
                        recipientEmail: email || null,
                        recipientPhone: phone || null,
                        status: 'issued',
                        expiresAt,
                        metadata: {
                            packageId: giftPackage.id,
                            packageTitle: giftPackage.title_en,
                            senderPlatformUserId: senderId
                        }
                    }, { transaction: tx });
                    break;
                }
            }
            if (!createdGiftCode) {
                throw new Error('Failed to generate unique tenant gift code');
            }
        }

        const giftTx = await db.TenantGiftCardTransaction.create({
            tenantId,
            packageId: giftPackage.id,
            senderPlatformUserId: senderId,
            recipientPlatformUserId: recipient?.id || null,
            recipientEmail: email || null,
            recipientPhone: phone || null,
            purchaseAmount: giftPackage.priceAmount,
            creditAmount: giftPackage.walletCreditAmount,
            bonusAmount: giftPackage.bonusAmount,
            totalCreditAmount: totalCredit,
            status: isRecipientRegistered ? 'sent_completed_auto_wallet' : 'sent_pending_external_redeem',
            deliveryChannel: isRecipientRegistered ? 'in_app' : 'email',
            claimToken: isRecipientRegistered ? null : claimToken,
            claimedAt: isRecipientRegistered ? new Date() : null,
            expiresAt,
            deliveryMode: isRecipientRegistered ? 'auto_wallet' : 'external_code',
            giftCardCodeId: createdGiftCode?.id || null,
            recipientResolvedPlatformUserId: recipient?.id || null,
            metadata: {
                senderMessage: normalize(message) || null,
                paymentTransactionId: paymentTransaction.id,
                externalRedeemCode: createdGiftCode?.code || null
            }
        }, { transaction: tx });

        if (createdGiftCode?.id) {
            createdGiftCode.sourceTenantGiftCardTransactionId = giftTx.id;
            await createdGiftCode.save({ transaction: tx });
        }

        if (isRecipientRegistered) {
            await tenantWalletService.creditTenantWallet({
                platformUserId: recipient.id,
                tenantId,
                amount: totalCredit,
                type: 'tenant_gift_credit',
                referenceType: 'tenant_gift_card_transaction',
                referenceId: giftTx.id,
                metadata: {
                    senderId: sender.id,
                    senderName: `${sender.firstName || ''} ${sender.lastName || ''}`.trim()
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
            metadata: { paymentTransactionId: paymentTransaction.id },
            transaction: tx
        });

        await tx.commit();

        if (isRecipientRegistered) {
            try {
                await notificationOrchestrator.sendCustomerPush({
                    platformUserId: recipient.id,
                    eventType: 'gift_card_received',
                    title: 'You received a gift card',
                    body: `${sender.firstName || 'Someone'} sent you ${totalCredit.toFixed(2)} SAR for this center.`,
                    data: { type: 'tenant_gift_card_received', giftTransactionId: giftTx.id, tenantId }
                });
            } catch (notifyError) {
                console.warn('Tenant gift push notification failed:', notifyError.message);
            }
        } else if (email) {
            const claimLink = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1/users/tenant-gifts/claim/open?token=${encodeURIComponent(claimToken)}`;
            const code = createdGiftCode?.code || '';
            await sendEmail({
                to: email,
                subject: `${sender.firstName || 'A friend'} sent you a Refah gift card`,
                template: 'appointment_confirmation',
                data: {
                    customerName: normalize(message) || 'Guest',
                    appointmentDate: new Date().toISOString(),
                    serviceName: `Gift card ${totalCredit.toFixed(2)} SAR - Code: ${code}`,
                    confirmationLink: claimLink
                }
            });
        }

        res.json({
            success: true,
            message: isRecipientRegistered
                ? 'Gift sent and credited successfully'
                : 'Gift sent to recipient email with redeem code.',
            transaction: giftTx,
            externalRedeemCode: createdGiftCode?.code || null
        });
    } catch (error) {
        await tx.rollback();
        console.error('Tenant send gift error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to send gift' });
    }
};

exports.claimGift = async (req, res) => {
    const tx = await db.sequelize.transaction();
    try {
        const platformUserId = req.userId;
        const token = normalize(req.body?.token);
        if (!token) throw new Error('token is required');

        const giftTx = await db.TenantGiftCardTransaction.findOne({
            where: {
                claimToken: token,
                status: {
                    [Op.in]: ['sent_pending_claim', 'sent_pending_external_redeem']
                }
            },
            transaction: tx,
            lock: tx.LOCK.UPDATE
        });
        if (!giftTx) return res.status(404).json({ success: false, message: 'Gift claim not found' });
        if (giftTx.expiresAt && new Date(giftTx.expiresAt).getTime() < Date.now()) {
            giftTx.status = 'expired';
            await giftTx.save({ transaction: tx });
            await tx.commit();
            return res.status(410).json({ success: false, message: 'Gift claim expired' });
        }

        giftTx.recipientPlatformUserId = platformUserId;
        giftTx.status = 'redeemed';
        giftTx.claimedAt = new Date();
        giftTx.claimToken = null;
        await giftTx.save({ transaction: tx });

        const walletResult = await tenantWalletService.creditTenantWallet({
            platformUserId,
            tenantId: giftTx.tenantId,
            amount: giftTx.totalCreditAmount,
            type: 'tenant_gift_credit',
            referenceType: 'tenant_gift_card_transaction',
            referenceId: giftTx.id,
            transaction: tx
        });

        await tx.commit();
        res.json({ success: true, message: 'Gift claimed successfully', walletBalance: walletResult.balanceAfter, transaction: giftTx });
    } catch (error) {
        await tx.rollback();
        console.error('Tenant gift claim error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to claim gift' });
    }
};

exports.listMyTenantGiftTransactions = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const rows = await db.TenantGiftCardTransaction.findAll({
            where: {
                [Op.or]: [
                    { senderPlatformUserId: platformUserId },
                    { recipientPlatformUserId: platformUserId }
                ]
            },
            include: [
                { model: db.TenantGiftCardPackage, as: 'package', required: false },
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'businessName', 'businessNameAr'], required: false }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, transactions: rows });
    } catch (error) {
        console.error('List tenant gift transactions error:', error);
        res.status(500).json({ success: false, message: 'Failed to load tenant gift history' });
    }
};

exports.getTenantWalletBalance = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const { tenantId } = req.query || {};
        if (!tenantId) return res.status(400).json({ success: false, message: 'tenantId is required' });
        const balance = await tenantWalletService.getTenantBalance(platformUserId, tenantId);
        const ledger = await tenantWalletService.getTenantLedger(platformUserId, tenantId, { limit: Number(req.query.limit || 50) });
        res.json({ success: true, tenantId, balance, ledger });
    } catch (error) {
        console.error('Tenant wallet balance error:', error);
        res.status(500).json({ success: false, message: 'Failed to load tenant wallet balance' });
    }
};

exports.openGiftClaimLink = async (req, res) => {
    const token = normalize(req.query.token);
    if (!token) {
        return res.status(400).send('Missing token');
    }
    const deepLink = `com.refah.mobile://tenant-gift-claim?token=${encodeURIComponent(token)}`;
    const legacy = `refah://tenant-gift-claim?token=${encodeURIComponent(token)}`;
    const html = `<!doctype html><html><body style="font-family:Arial;padding:24px"><h3>Claim your Refah tenant gift</h3><a href="${deepLink}">Open Refah App</a><script>setTimeout(function(){window.location.href='${deepLink}'},300);setTimeout(function(){window.location.href='${legacy}'},700);</script></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
};
