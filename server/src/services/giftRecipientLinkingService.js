'use strict';

const { Op } = require('sequelize');
const db = require('../models');

const normalizeEmail = (value) => `${value || ''}`.trim().toLowerCase();
const normalizePhone = (value) => `${value || ''}`.trim().replace(/\s+/g, '');
const PENDING_GIFT_STATUSES = ['sent_pending_claim', 'sent_pending_external_redeem'];

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

const buildRecipientWhere = ({ email, phone }) => {
    const normalizedEmail = normalizeEmail(email);
    const phoneCandidates = buildPhoneCandidates(phone);

    return {
        recipientPlatformUserId: null,
        status: {
            [Op.in]: PENDING_GIFT_STATUSES
        },
        [Op.or]: [
            ...(normalizedEmail
                ? [db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('recipientEmail')), normalizedEmail)]
                : []),
            ...(phoneCandidates.length
                ? [{ recipientPhone: { [Op.in]: phoneCandidates } }]
                : [])
        ]
    };
};

const reconcileModel = async (Model, platformUserId, email, phone, transaction) => {
    const where = buildRecipientWhere({ email, phone });
    const [updatedCount] = await Model.update(
        {
            recipientPlatformUserId: platformUserId,
            recipientResolvedPlatformUserId: platformUserId
        },
        {
            where,
            transaction
        }
    );

    return updatedCount || 0;
};

/**
 * Link pending gift records to a newly created PlatformUser.
 * This does not credit wallets. It only makes previously sent gifts visible
 * under the new user's gift history so the existing claim/redeem flow can continue.
 */
const linkPendingGiftRecipients = async ({
    platformUserId,
    email,
    phone,
    transaction = null
}) => {
    if (!platformUserId) {
        return { globalLinkedCount: 0, tenantLinkedCount: 0 };
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedEmail && !normalizedPhone) {
        return { globalLinkedCount: 0, tenantLinkedCount: 0 };
    }

    const runner = async (trx) => {
        const [globalLinkedCount, tenantLinkedCount] = await Promise.all([
            reconcileModel(db.GiftCardTransaction, platformUserId, normalizedEmail, normalizedPhone, trx),
            reconcileModel(db.TenantGiftCardTransaction, platformUserId, normalizedEmail, normalizedPhone, trx)
        ]);

        return { globalLinkedCount, tenantLinkedCount };
    };

    if (transaction) {
        return runner(transaction);
    }

    return db.sequelize.transaction((trx) => runner(trx));
};

module.exports = {
    linkPendingGiftRecipients
};
