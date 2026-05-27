'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GiftCardCodeRedemption extends Model {
        static associate(models) {
            GiftCardCodeRedemption.belongsTo(models.GiftCardCode, {
                foreignKey: 'giftCardCodeId',
                as: 'giftCardCode'
            });
            GiftCardCodeRedemption.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            GiftCardCodeRedemption.belongsTo(models.Staff, {
                foreignKey: 'redeemedByStaffId',
                as: 'redeemedByStaff'
            });
        }
    }

    GiftCardCodeRedemption.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        giftCardCodeId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        appointmentId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        posInvoiceId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        redeemedAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        remainingAfter: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        redeemedByStaffId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'GiftCardCodeRedemption',
        tableName: 'gift_card_code_redemptions',
        indexes: [
            { fields: ['giftCardCodeId'] },
            { fields: ['tenantId'] },
            { fields: ['appointmentId'] },
            { fields: ['orderId'] },
            { fields: ['posInvoiceId'] }
        ]
    });

    return GiftCardCodeRedemption;
};

