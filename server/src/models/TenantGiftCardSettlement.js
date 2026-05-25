'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantGiftCardSettlement extends Model {
        static associate(models) {
            TenantGiftCardSettlement.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            TenantGiftCardSettlement.belongsTo(models.TenantGiftCardTransaction, {
                foreignKey: 'transactionId',
                as: 'transaction'
            });
            TenantGiftCardSettlement.belongsTo(models.TenantGiftCardPackage, {
                foreignKey: 'packageId',
                as: 'package'
            });
        }
    }

    TenantGiftCardSettlement.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        transactionId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true
        },
        packageId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        grossAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        platformFeeAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        netTenantPayableAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        settledAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('pending', 'partially_settled', 'settled'),
            allowNull: false,
            defaultValue: 'pending'
        },
        settledAt: {
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
        modelName: 'TenantGiftCardSettlement',
        tableName: 'tenant_gift_card_settlements',
        indexes: [
            { fields: ['tenantId', 'status'] },
            { fields: ['transactionId'], unique: true }
        ]
    });

    return TenantGiftCardSettlement;
};
