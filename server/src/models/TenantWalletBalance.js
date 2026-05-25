'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantWalletBalance extends Model {
        static associate(models) {
            TenantWalletBalance.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });
            TenantWalletBalance.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    TenantWalletBalance.init({
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true
        },
        balance: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        currency: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: 'SAR'
        }
    }, {
        sequelize,
        modelName: 'TenantWalletBalance',
        tableName: 'tenant_wallet_balances',
        indexes: [
            { fields: ['platformUserId', 'tenantId'], unique: true }
        ]
    });

    return TenantWalletBalance;
};
