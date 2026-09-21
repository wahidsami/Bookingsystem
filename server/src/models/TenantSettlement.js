'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantSettlement extends Model {
        static associate(models) {
            TenantSettlement.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            TenantSettlement.belongsTo(models.Transaction, {
                foreignKey: 'sourceTransactionId',
                as: 'transaction'
            });
        }
    }

    TenantSettlement.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        sourceTransactionId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'transactions',
                key: 'id'
            },
            onDelete: 'SET NULL'
        },
        sourceType: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'wallet_recharge, booking, product_order, adjustment, refund'
        },
        grossAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        platformFeeAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        gatewayFeeAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        refundAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        adjustmentAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        netPayableAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: 'pending',
            comment: 'pending, partially_settled, settled, cancelled'
        },
        settlementPeriod: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'e.g. 2026-09'
        },
        settlementReference: {
            type: DataTypes.STRING(100),
            allowNull: true
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
        modelName: 'TenantSettlement',
        tableName: 'tenant_settlements',
        indexes: [
            { fields: ['tenantId', 'status'] },
            { fields: ['settlementPeriod'] },
            { fields: ['sourceTransactionId'] },
            { fields: ['sourceType'] }
        ]
    });

    return TenantSettlement;
};
