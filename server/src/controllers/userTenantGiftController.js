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
const buildPhoneCandidates = (value) => {
    const raw = normalizePhone(value);
    const digits = raw.replace(/\D+/g, '');
    const candidates = new Set([raw, digits]);
    if (digits) {
        candidates.add(`+${digits}`);
        if (digits.startsWith('0')) {
            candidates.add(digits.replace(/^0+/, ''));
        }
    }
    return Array.from(candidates).filter(Boolean);
};
const generateGiftCode = (prefix = 'TN') => {
    const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `${prefix}-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
};

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const IDEMPOTENCY_MAX_LENGTH = 191;
const IDEMPOTENCY_PROCESSING_TTL_MS = 2 * 60 * 1000;

const normalizeIdempotencyKey = (value) => {
    const raw = `${value || ''}`.trim();
    if (!raw) return null;
    return raw.slice(0, IDEMPOTENCY_MAX_LENGTH);
};

const buildPayloadHash = (payload) => {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

const reserveIdempotency = async (platformUserId, idempotencyKey, requestHash) => {
    if (!idempotencyKey) return { record: null, replayed: false };

    let record = await db.PaymentIdempotencyKey.findOne({
        where: { platformUserId, idempotencyKey }
    });

    if (record) {
        if (record.requestHash !== requestHash) {
            const err = new Error('This idempotency key was already used with different request data.');
            err.statusCode = 409;
            throw err;
        }
        if (record.status === 'completed' && record.responsePayload) {
            return { record, replayed: true, responsePayload: record.responsePayload };
        }
        const isStillProcessing = record.status === 'processing'
            && (Date.now() - new Date(record.updatedAt).getTime()) < IDEMPOTENCY_PROCESSING_TTL_MS;
        if (isStillProcessing) {
            const err = new Error('Request is already being processed. Please wait a moment and retry.');
            err.statusCode = 409;
            throw err;
        }
        await record.update({
            status: 'processing',
            responsePayload: null,
            errorMessage: null,
            requestHash
        });
        return { record, replayed: false };
    }

    record = await db.PaymentIdempotencyKey.create({
        platformUserId,
        idempotencyKey,
        requestHash,
        status: 'processing',
        responsePayload: null,
        errorMessage: null
    });
    return { record, replayed: false };
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

const buildRecipientWhere = ({ email, phone }) => {
    const phoneCandidates = buildPhoneCandidates(phone);
    return {
        [Op.or]: [
            ...(email ? [db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('email')), email)] : []),
            ...(phoneCandidates.length ? [{ phone: { [Op.in]: phoneCandidates } }] : [])
        ]
    };
};

const sendTenantGiftClaimEmail = async ({
    to,
    senderName,
    totalCredit,
    code,
    claimLink
}) => {
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

exports.checkTenantGiftRecipient = async (req, res) => {
    try {
        const email = normalize(req.query?.recipientEmail).toLowerCase();
        const phone = normalizePhone(req.query?.recipientPhone);
        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'recipientEmail or recipientPhone is required' });
        }

        const recipient = await db.PlatformUser.findOne({
            where: buildRecipientWhere({ email, phone }),
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage']
        });

        if (!recipient) {
            return res.json({
                success: true,
                exists: false,
                recipient: null,
                normalized: { email: email || null, phone: phone || null }
            });
        }

        return res.json({
            success: true,
            exists: true,
            recipient: {
                id: recipient.id,
                name: `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() || 'Refah Customer',
                email: recipient.email || null,
                phone: recipient.phone || null,
                profileImage: recipient.profileImage || null
            }
        });
    } catch (error) {
        console.error('Check tenant gift recipient error:', error);
        res.status(500).json({ success: false, message: 'Failed to verify recipient' });
    }
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
    const senderId = req.userId;
    const { tenantId, packageId } = req.body || {};
    const idempotencyKey = normalizeIdempotencyKey(req.headers[IDEMPOTENCY_HEADER] || req.body?.idempotencyKey);
    let idempotencyRecord = null;

    try {
        const paymentPayload = validateGiftPaymentPayload(req.body || {});
        if (!tenantId || !packageId) throw new Error('tenantId and packageId are required');

        if (idempotencyKey) {
            const requestHash = buildPayloadHash({
                senderId,
                tenantId,
                packageId,
                cardLast4: paymentPayload.cardNumber.slice(-4)
            });
            const { record, replayed, responsePayload } = await reserveIdempotency(senderId, idempotencyKey, requestHash);
            if (replayed) {
                res.setHeader('x-idempotency-replayed', 'true');
                return res.json(responsePayload);
            }
            idempotencyRecord = record;
        }

        const tx = await db.sequelize.transaction();
        try {
            const giftPackage = await findActiveTenantPackage(tenantId, packageId);
            if (!giftPackage) {
                await tx.rollback();
                if (idempotencyRecord) {
                    await idempotencyRecord.update({ status: 'failed', errorMessage: 'Gift package not found or inactive' }).catch(() => undefined);
                }
                return res.status(404).json({ success: false, message: 'Gift package not found or inactive' });
            }
            const packageTitle = giftPackage.title || giftPackage.title_en || giftPackage.title_ar || 'Tenant gift card';

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
                metadata: { packageId: giftPackage.id, packageTitle },
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

            const finalResponse = {
                success: true,
                message: 'Tenant gift wallet recharged successfully',
                walletBalance: walletResult.balanceAfter,
                transaction: giftTx
            };

            if (idempotencyRecord) {
                await idempotencyRecord.update({
                    status: 'completed',
                    responsePayload: finalResponse
                }).catch(() => undefined);
            }

            return res.json(finalResponse);
        } catch (innerError) {
            await tx.rollback();
            throw innerError;
        }
    } catch (error) {
        if (idempotencyRecord) {
            await idempotencyRecord.update({
                status: 'failed',
                errorMessage: error.message
            }).catch(() => undefined);
        }
        console.error('Tenant self purchase gift error:', error);
        return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to complete purchase' });
    }
};

exports.sendGift = async (req, res) => {
    const senderId = req.userId;
    const { tenantId, packageId, recipientEmail, recipientPhone, message } = req.body || {};
    const idempotencyKey = normalizeIdempotencyKey(req.headers[IDEMPOTENCY_HEADER] || req.body?.idempotencyKey);
    let idempotencyRecord = null;

    try {
        const paymentPayload = validateGiftPaymentPayload(req.body || {});
        const email = normalize(recipientEmail).toLowerCase();
        const phone = normalizePhone(recipientPhone);
        if (!tenantId || !packageId) throw new Error('tenantId and packageId are required');
        if (!email && !phone) throw new Error('recipientEmail or recipientPhone is required');

        if (idempotencyKey) {
            const requestHash = buildPayloadHash({
                senderId,
                tenantId,
                packageId,
                email,
                phone,
                cardLast4: paymentPayload.cardNumber.slice(-4)
            });
            const { record, replayed, responsePayload } = await reserveIdempotency(senderId, idempotencyKey, requestHash);
            if (replayed) {
                res.setHeader('x-idempotency-replayed', 'true');
                return res.json(responsePayload);
            }
            idempotencyRecord = record;
        }

        const tx = await db.sequelize.transaction();
        try {
            const giftPackage = await findActiveTenantPackage(tenantId, packageId);
            if (!giftPackage) {
                await tx.rollback();
                if (idempotencyRecord) {
                    await idempotencyRecord.update({ status: 'failed', errorMessage: 'Gift package not found or inactive' }).catch(() => undefined);
                }
                return res.status(404).json({ success: false, message: 'Gift package not found or inactive' });
            }
            const packageTitle = giftPackage.title || giftPackage.title_en || giftPackage.title_ar || 'Tenant gift card';

            const sender = await db.PlatformUser.findByPk(senderId, { transaction: tx });
            if (!sender) throw new Error('Sender not found');

            const recipient = await db.PlatformUser.findOne({
                where: buildRecipientWhere({ email, phone }),
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
            if (!isRecipientRegistered && !email) {
                throw new Error('Recipient email is required for users without an account');
            }
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
                                packageTitle,
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

            const senderName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Someone';
            if (isRecipientRegistered) {
                try {
                    await notificationOrchestrator.notifyCustomer({
                        tenantId,
                        platformUserId: recipient.id,
                        eventType: 'gift_card_received',
                        title: 'You received a gift card',
                        body: `${senderName} sent you ${totalCredit.toFixed(2)} SAR for this center.`,
                        data: { type: 'tenant_gift_card_received', giftTransactionId: giftTx.id, tenantId }
                    });
                } catch (notifyError) {
                    console.warn('Tenant gift push notification failed:', notifyError.message);
                }

                if (email) {
                    const claimLink = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1/users/tenant-gifts/claim/open?token=${encodeURIComponent(claimToken)}`;
                    const code = createdGiftCode?.code || '';
                    sendTenantGiftClaimEmail({
                        to: email,
                        senderName,
                        totalCredit,
                        code,
                        claimLink
                    }).catch(() => undefined);
                }
            } else if (email) {
                const claimLink = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1/users/tenant-gifts/claim/open?token=${encodeURIComponent(claimToken)}`;
                const code = createdGiftCode?.code || '';
                sendTenantGiftClaimEmail({
                    to: email,
                    senderName,
                    totalCredit,
                    code,
                    claimLink
                }).catch(() => undefined);
            }

            const finalResponse = {
                success: true,
                message: isRecipientRegistered
                    ? 'Gift sent and credited successfully'
                    : 'Gift sent to recipient email with redeem code.',
                transaction: giftTx,
                externalRedeemCode: createdGiftCode?.code || null
            };

            if (idempotencyRecord) {
                await idempotencyRecord.update({
                    status: 'completed',
                    responsePayload: finalResponse
                }).catch(() => undefined);
            }

            return res.json(finalResponse);
        } catch (innerError) {
            await tx.rollback();
            throw innerError;
        }
    } catch (error) {
        if (idempotencyRecord) {
            await idempotencyRecord.update({
                status: 'failed',
                errorMessage: error.message
            }).catch(() => undefined);
        }
        console.error('Tenant send gift error:', error);
        return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to send gift' });
    }
};

exports.claimGift = async (req, res) => {
    const tx = await db.sequelize.transaction();
    try {
        const platformUserId = req.userId;
        const rawCode = normalize(req.body?.code);
        const rawToken = normalize(req.body?.token);

        if (!rawCode && !rawToken) {
            await tx.rollback();
            return res.status(400).json({ success: false, message: 'voucher code or claim token is required' });
        }

        let giftTx = null;
        let giftCode = null;

        if (rawCode) {
            // Path 1: Human-readable voucher code (e.g. TN-XXXX-XXXX-XXXX)
            giftCode = await db.GiftCardCode.findOne({
                where: { code: rawCode },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });

            if (!giftCode) {
                await tx.rollback();
                return res.status(404).json({ success: false, message: 'Voucher code not found' });
            }

            if (giftCode.status === 'redeemed' || Number(giftCode.remainingAmount || 0) <= 0) {
                await tx.rollback();
                return res.status(400).json({ success: false, message: 'Voucher code already redeemed' });
            }

            const giftTxId = giftCode.sourceTenantGiftCardTransactionId;
            if (giftTxId) {
                giftTx = await db.TenantGiftCardTransaction.findOne({
                    where: {
                        id: giftTxId,
                        status: { [Op.in]: ['sent_pending_claim', 'sent_pending_external_redeem'] }
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
            } else {
                giftTx = await db.TenantGiftCardTransaction.findOne({
                    where: {
                        giftCardCodeId: giftCode.id,
                        status: { [Op.in]: ['sent_pending_claim', 'sent_pending_external_redeem'] }
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
            }

            if (!giftTx) {
                await tx.rollback();
                return res.status(404).json({ success: false, message: 'Associated gift transaction not found or already claimed' });
            }
        } else if (rawToken) {
            // Path 2: Internal 48-char claim token
            giftTx = await db.TenantGiftCardTransaction.findOne({
                where: {
                    claimToken: rawToken,
                    status: {
                        [Op.in]: ['sent_pending_claim', 'sent_pending_external_redeem']
                    }
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });

            if (!giftTx) {
                await tx.rollback();
                return res.status(404).json({ success: false, message: 'Gift claim not found or already redeemed' });
            }

            if (giftTx.giftCardCodeId) {
                giftCode = await db.GiftCardCode.findByPk(giftTx.giftCardCodeId, {
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
            }
        }

        // Check expiration
        if (giftTx.expiresAt && new Date(giftTx.expiresAt).getTime() < Date.now()) {
            giftTx.status = 'expired';
            await giftTx.save({ transaction: tx });
            if (giftCode) {
                giftCode.status = 'expired';
                await giftCode.save({ transaction: tx });
            }
            await tx.commit();
            return res.status(410).json({ success: false, message: 'Gift claim expired' });
        }

        giftTx.recipientPlatformUserId = platformUserId;
        giftTx.recipientResolvedPlatformUserId = platformUserId;
        giftTx.status = 'redeemed';
        giftTx.claimedAt = new Date();
        giftTx.claimToken = null;
        await giftTx.save({ transaction: tx });

        if (giftCode) {
            giftCode.remainingAmount = 0;
            giftCode.status = 'redeemed';
            await giftCode.save({ transaction: tx });
        }

        const walletResult = await tenantWalletService.creditTenantWallet({
            platformUserId,
            tenantId: giftTx.tenantId,
            amount: giftTx.totalCreditAmount,
            type: 'tenant_gift_credit',
            referenceType: 'tenant_gift_card_transaction',
            referenceId: giftTx.id,
            metadata: {
                flow: rawCode ? 'voucher_code_claim' : 'claim_token_claim',
                voucherCode: giftCode?.code || null
            },
            transaction: tx
        });

        await tx.commit();
        return res.json({
            success: true,
            message: 'Gift claimed successfully',
            walletBalance: walletResult.balanceAfter,
            transaction: giftTx
        });
    } catch (error) {
        await tx.rollback();
        console.error('Tenant gift claim error:', error);
        return res.status(400).json({ success: false, message: error.message || 'Failed to claim gift' });
    }
};

exports.getReceivedTenantGifts = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const { status } = req.query || {};
        const where = {
            [Op.or]: [
                { recipientPlatformUserId: platformUserId },
                { recipientResolvedPlatformUserId: platformUserId }
            ]
        };
        if (status) {
            where.status = status;
        }
        const rows = await db.TenantGiftCardTransaction.findAll({
            where,
            include: [
                { model: db.TenantGiftCardPackage, as: 'package', required: false },
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar', 'logo'], required: false },
                { model: db.PlatformUser, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false },
                { model: db.GiftCardCode, as: 'giftCode', attributes: ['id', 'code', 'status', 'expiresAt'], required: false }
            ],
            order: [['createdAt', 'DESC']]
        });
        return res.json({ success: true, gifts: rows, data: rows });
    } catch (error) {
        console.error('List received tenant gifts error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load received tenant gifts' });
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
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }
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
