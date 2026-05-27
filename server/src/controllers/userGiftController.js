'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const walletService = require('../services/walletService');
const paymentService = require('../services/paymentService');
const notificationOrchestrator = require('../services/notificationOrchestratorService');
const { sendEmail } = require('../utils/emailService');
const { getServerPublicUrl } = require('../utils/url');

const CLAIM_EXPIRY_HOURS = 24 * 30; // 30 days

const normalize = (value) => `${value || ''}`.trim();
const normalizePhone = (value) => normalize(value).replace(/\s+/g, '');
const generateGiftCode = (prefix = 'RFH') => {
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

    if (cardNumber === '4000000000000002') {
        throw new Error('Payment declined by issuer');
    }
    if (cardNumber === '4000000000009995') {
        throw new Error('Insufficient funds');
    }

    return { cardNumber, expiryDate, cvv, cardholderName };
};

const createGiftPurchaseTransaction = async ({
    platformUserId,
    amount,
    cardNumber,
    cardholderName,
    giftFlow,
    packageId,
    tenantId = null,
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

const findActivePackage = async (packageId) => {
    if (!packageId) return null;
    const now = new Date();
    return db.GiftCardPackage.findOne({
        where: {
            id: packageId,
            isActive: true,
            [Op.and]: [
                { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
                { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }] }
            ]
        }
    });
};

exports.getGiftPackages = async (req, res) => {
    try {
        const now = new Date();
        const packages = await db.GiftCardPackage.findAll({
            where: {
                isActive: true,
                [Op.and]: [
                    { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
                    { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }] }
                ]
            },
            order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
        });

        res.json({ success: true, packages });
    } catch (error) {
        console.error('Get gift packages error:', error);
        res.status(500).json({ success: false, message: 'Failed to load gift packages' });
    }
};

exports.rechargeFromGiftPackage = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const platformUserId = req.userId;
        const { packageId } = req.body || {};
        const paymentPayload = validateGiftPaymentPayload(req.body || {});

        const giftPackage = await findActivePackage(packageId);
        if (!giftPackage) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Gift package not found or inactive' });
        }

        const totalCredit = Number.parseFloat(giftPackage.walletCreditAmount || 0) + Number.parseFloat(giftPackage.bonusAmount || 0);
        const purchaseAmount = Number.parseFloat(giftPackage.priceAmount || 0);

        const paymentTransaction = await createGiftPurchaseTransaction({
            platformUserId,
            amount: purchaseAmount,
            cardNumber: paymentPayload.cardNumber,
            cardholderName: paymentPayload.cardholderName,
            giftFlow: 'self_recharge',
            packageId: giftPackage.id,
            transaction
        });

        const giftTx = await db.GiftCardTransaction.create({
            senderPlatformUserId: platformUserId,
            recipientPlatformUserId: platformUserId,
            packageId: giftPackage.id,
            purchaseAmount: giftPackage.priceAmount,
            creditAmount: giftPackage.walletCreditAmount,
            bonusAmount: giftPackage.bonusAmount,
            totalCreditAmount: totalCredit,
            status: 'redeemed',
            deliveryChannel: 'in_app',
            claimedAt: new Date(),
            metadata: { flow: 'self_recharge', paymentTransactionId: paymentTransaction.id }
        }, { transaction });

        const walletResult = await walletService.creditWallet({
            platformUserId,
            amount: totalCredit,
            type: 'topup',
            referenceType: 'gift_card_transaction',
            referenceId: giftTx.id,
            metadata: {
                packageId: giftPackage.id,
                packageTitle: giftPackage.title_en
            },
            transaction
        });

        await transaction.commit();
        res.json({
            success: true,
            message: 'Wallet recharged successfully',
            walletBalance: walletResult.balanceAfter,
            transaction: giftTx
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Recharge from gift package error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to recharge wallet' });
    }
};

exports.sendGiftPackage = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const senderId = req.userId;
        const { packageId, recipientEmail, recipientPhone, message } = req.body || {};
        const paymentPayload = validateGiftPaymentPayload(req.body || {});
        const email = normalize(recipientEmail).toLowerCase();
        const phone = normalizePhone(recipientPhone);

        if (!email && !phone) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'recipientEmail or recipientPhone is required' });
        }

        const giftPackage = await findActivePackage(packageId);
        if (!giftPackage) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Gift package not found or inactive' });
        }

        const sender = await db.PlatformUser.findByPk(senderId, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
            transaction
        });
        if (!sender) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Sender not found' });
        }

        const recipient = await db.PlatformUser.findOne({
            where: {
                [Op.or]: [
                    ...(email ? [db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('email')), email)] : []),
                    ...(phone ? [{ phone }] : [])
                ]
            },
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
            transaction
        });

        const totalCredit = Number.parseFloat(giftPackage.walletCreditAmount || 0) + Number.parseFloat(giftPackage.bonusAmount || 0);
        const purchaseAmount = Number.parseFloat(giftPackage.priceAmount || 0);
        const claimToken = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + (CLAIM_EXPIRY_HOURS * 60 * 60 * 1000));

        const paymentTransaction = await createGiftPurchaseTransaction({
            platformUserId: senderId,
            amount: purchaseAmount,
            cardNumber: paymentPayload.cardNumber,
            cardholderName: paymentPayload.cardholderName,
            giftFlow: 'send_gift',
            packageId: giftPackage.id,
            transaction
        });

        const isRecipientRegistered = !!recipient?.id;
        let createdGiftCode = null;
        if (!isRecipientRegistered) {
            // Collision-safe gift code generation
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const candidate = generateGiftCode('RFH');
                const exists = await db.GiftCardCode.findOne({ where: { code: candidate }, transaction });
                if (!exists) {
                    createdGiftCode = await db.GiftCardCode.create({
                        code: candidate,
                        scopeType: 'admin_global',
                        tenantId: null,
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
                    }, { transaction });
                    break;
                }
            }
            if (!createdGiftCode) {
                throw new Error('Failed to generate unique gift code');
            }
        }

        const giftTx = await db.GiftCardTransaction.create({
            senderPlatformUserId: senderId,
            recipientPlatformUserId: recipient?.id || null,
            recipientEmail: email || null,
            recipientPhone: phone || null,
            packageId: giftPackage.id,
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
        }, { transaction });

        if (createdGiftCode?.id) {
            createdGiftCode.sourceGiftCardTransactionId = giftTx.id;
            await createdGiftCode.save({ transaction });
        }

        let walletResult = null;
        if (isRecipientRegistered) {
            walletResult = await walletService.creditWallet({
                platformUserId: recipient.id,
                amount: totalCredit,
                type: 'gift_received_credit',
                referenceType: 'gift_card_transaction',
                referenceId: giftTx.id,
                metadata: {
                    senderId: sender.id,
                    senderName: `${sender.firstName || ''} ${sender.lastName || ''}`.trim()
                },
                transaction
            });
        }

        await transaction.commit();

        const senderName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Someone';
        if (isRecipientRegistered) {
            await notificationOrchestrator.notifyCustomer({
                tenantId: null,
                platformUserId: recipient.id,
                eventType: 'gift_card_received',
                title: 'You received a gift card',
                body: `${senderName} has sent you a gift card of ${totalCredit.toFixed(2)} SAR.`,
                data: {
                    type: 'gift_card_received',
                    giftTransactionId: giftTx.id,
                    amount: totalCredit
                }
            }).catch(() => undefined);
        } else if (email) {
            const code = createdGiftCode?.code || '';
            const claimLink = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1/users/gifts/claim/open?token=${encodeURIComponent(claimToken)}`;
            await sendEmail({
                to: email,
                subject: `${senderName} sent you a Refah gift card`,
                template: 'customer_review_invite',
                data: {
                    customerName: 'Dear customer',
                    tenantName: 'Refah',
                    serviceName: `Gift card ${totalCredit.toFixed(2)} SAR - Code: ${code}`,
                    appointmentDate: new Date().toLocaleString('en-US'),
                    reviewLink: claimLink,
                    googleReviewUrl: ''
                }
            }).catch(() => undefined);
        }

        res.json({
            success: true,
            message: isRecipientRegistered
                ? 'Gift sent and credited successfully'
                : 'Gift sent to recipient email with redeem code.',
            transaction: giftTx,
            recipientWalletBalance: walletResult?.balanceAfter || null,
            externalRedeemCode: createdGiftCode?.code || null
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Send gift package error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to send gift package' });
    }
};

exports.claimGift = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const platformUserId = req.userId;
        const { token } = req.body || {};
        if (!token) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'token is required' });
        }

        const giftTx = await db.GiftCardTransaction.findOne({
            where: {
                claimToken: token,
                status: {
                    [Op.in]: ['sent_pending_claim', 'sent_pending_external_redeem']
                }
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!giftTx) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Gift claim not found' });
        }
        if (giftTx.expiresAt && new Date(giftTx.expiresAt).getTime() < Date.now()) {
            giftTx.status = 'expired';
            await giftTx.save({ transaction });
            await transaction.commit();
            return res.status(410).json({ success: false, message: 'Gift claim expired' });
        }

        giftTx.recipientPlatformUserId = platformUserId;
        giftTx.status = 'redeemed';
        giftTx.claimedAt = new Date();
        giftTx.claimToken = null;
        await giftTx.save({ transaction });

        const walletResult = await walletService.creditWallet({
            platformUserId,
            amount: giftTx.totalCreditAmount,
            type: 'gift_received_credit',
            referenceType: 'gift_card_transaction',
            referenceId: giftTx.id,
            metadata: { claimedViaToken: true },
            transaction
        });

        await transaction.commit();
        res.json({
            success: true,
            message: 'Gift claimed successfully',
            walletBalance: walletResult.balanceAfter,
            transaction: giftTx
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Claim gift error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to claim gift' });
    }
};

exports.listMyGiftTransactions = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const rows = await db.GiftCardTransaction.findAll({
            where: {
                [Op.or]: [
                    { senderPlatformUserId: platformUserId },
                    { recipientPlatformUserId: platformUserId }
                ]
            },
            include: [
                { model: db.GiftCardPackage, as: 'package', required: false }
            ],
            order: [['createdAt', 'DESC']],
            limit: 100
        });

        res.json({ success: true, transactions: rows, count: rows.length });
    } catch (error) {
        console.error('List my gift transactions error:', error);
        res.status(500).json({ success: false, message: 'Failed to load gift history' });
    }
};

exports.openGiftClaimLink = async (req, res) => {
    const token = `${req.query.token || ''}`.trim();
    if (!token) {
        return res.status(400).send('Invalid token');
    }
    const deepLink = `com.refah.mobile://gift-claim?token=${encodeURIComponent(token)}`;
    const legacy = `refah://gift-claim?token=${encodeURIComponent(token)}`;
    const html = `<!doctype html><html><body style="font-family:Arial;padding:24px"><h3>Claim your Refah gift</h3><a href="${deepLink}">Open Refah App</a><script>setTimeout(function(){window.location.href='${deepLink}'},300);setTimeout(function(){window.location.href='${legacy}'},700);</script></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
};
