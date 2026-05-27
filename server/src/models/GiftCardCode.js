'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GiftCardCode extends Model {
        static associate(models) {
            GiftCardCode.belongsTo(models.GiftCardTransaction, {
                foreignKey: 'sourceGiftCardTransactionId',
                as: 'sourceGiftTransaction'
            });
            GiftCardCode.belongsTo(models.TenantGiftCardTransaction, {
                foreignKey: 'sourceTenantGiftCardTransactionId',
                as: 'sourceTenantGiftTransaction'
            });
            GiftCardCode.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            GiftCardCode.hasMany(models.GiftCardCodeRedemption, {
                foreignKey: 'giftCardCodeId',
                as: 'redemptions'
            });
        }
    }

    GiftCardCode.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        code: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true
        },
        scopeType: {
            type: DataTypes.ENUM('admin_global', 'tenant_scoped'),
            allowNull: false
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        sourceGiftCardTransactionId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        sourceTenantGiftCardTransactionId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        initialAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        remainingAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: 'SAR'
        },
        recipientEmail: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        recipientPhone: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('issued', 'partially_redeemed', 'redeemed', 'expired', 'cancelled'),
            allowNull: false,
            defaultValue: 'issued'
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'GiftCardCode',
        tableName: 'gift_card_codes',
        indexes: [
            { unique: true, fields: ['code'] },
            { fields: ['status'] },
            { fields: ['tenantId'] },
            { fields: ['expiresAt'] },
            { fields: ['sourceGiftCardTransactionId'] },
            { fields: ['sourceTenantGiftCardTransactionId'] }
        ]
    });

    return GiftCardCode;
};

