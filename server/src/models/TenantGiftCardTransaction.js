'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantGiftCardTransaction extends Model {
        static associate(models) {
            TenantGiftCardTransaction.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            TenantGiftCardTransaction.belongsTo(models.TenantGiftCardPackage, {
                foreignKey: 'packageId',
                as: 'package'
            });
            TenantGiftCardTransaction.belongsTo(models.PlatformUser, {
                foreignKey: 'senderPlatformUserId',
                as: 'sender'
            });
            TenantGiftCardTransaction.belongsTo(models.PlatformUser, {
                foreignKey: 'recipientPlatformUserId',
                as: 'recipient'
            });
            TenantGiftCardTransaction.hasOne(models.TenantGiftCardSettlement, {
                foreignKey: 'transactionId',
                as: 'settlement'
            });
            TenantGiftCardTransaction.hasOne(models.GiftCardCode, {
                foreignKey: 'sourceTenantGiftCardTransactionId',
                as: 'giftCode'
            });
        }
    }

    TenantGiftCardTransaction.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        packageId: {
            type: DataTypes.UUID,
            allowNull: false
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
        modelName: 'TenantGiftCardTransaction',
        tableName: 'tenant_gift_card_transactions',
        indexes: [
            { fields: ['tenantId', 'status'] },
            { fields: ['packageId'] },
            { fields: ['senderPlatformUserId'] },
            { fields: ['recipientPlatformUserId'] },
            { fields: ['claimToken'] },
            { fields: ['giftCardCodeId'] },
            { fields: ['recipientResolvedPlatformUserId'] },
            { fields: ['createdAt'] }
        ]
    });

    return TenantGiftCardTransaction;
};
