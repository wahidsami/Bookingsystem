'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GiftCardTransaction extends Model {
        static associate(models) {
            GiftCardTransaction.belongsTo(models.GiftCardPackage, {
                foreignKey: 'packageId',
                as: 'package'
            });
            GiftCardTransaction.belongsTo(models.PlatformUser, {
                foreignKey: 'senderPlatformUserId',
                as: 'sender'
            });
            GiftCardTransaction.belongsTo(models.PlatformUser, {
                foreignKey: 'recipientPlatformUserId',
                as: 'recipient'
            });
            GiftCardTransaction.hasOne(models.GiftCardCode, {
                foreignKey: 'sourceGiftCardTransactionId',
                as: 'giftCode'
            });
        }
    }

    GiftCardTransaction.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        senderPlatformUserId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        recipientPlatformUserId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        recipientEmail: {
            type: DataTypes.STRING,
            allowNull: true
        },
        recipientPhone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        packageId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        purchaseAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        creditAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        bonusAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        totalCreditAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM(
                'purchased',
                'sent_pending_claim',
                'sent_completed',
                'sent_completed_auto_wallet',
                'sent_pending_external_redeem',
                'redeemed',
                'partially_redeemed',
                'cancelled',
                'expired'
            ),
            allowNull: false,
            defaultValue: 'purchased'
        },
        deliveryChannel: {
            type: DataTypes.ENUM('in_app', 'email', 'sms_whatsapp_future'),
            allowNull: false,
            defaultValue: 'in_app'
        },
        claimToken: {
            type: DataTypes.STRING,
            allowNull: true
        },
        claimedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        deliveryMode: {
            type: DataTypes.ENUM('auto_wallet', 'external_code'),
            allowNull: true
        },
        giftCardCodeId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        recipientResolvedPlatformUserId: {
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'GiftCardTransaction',
        tableName: 'gift_card_transactions',
        indexes: [
            { fields: ['packageId'] },
            { fields: ['senderPlatformUserId'] },
            { fields: ['recipientPlatformUserId'] },
            { fields: ['status'] },
            { fields: ['claimToken'] },
            { fields: ['giftCardCodeId'] },
            { fields: ['recipientResolvedPlatformUserId'] },
            { fields: ['createdAt'] }
        ]
    });

    return GiftCardTransaction;
};
