'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantWalletLedgerEntry extends Model {
        static associate(models) {
            TenantWalletLedgerEntry.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });
            TenantWalletLedgerEntry.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    TenantWalletLedgerEntry.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM(
                'tenant_gift_credit',
                'tenant_gift_redeem_debit',
                'tenant_gift_refund_credit',
                'tenant_gift_admin_adjustment',
                'tenant_manual_topup_credit'
            ),
            allowNull: false
        },
        direction: {
            type: DataTypes.ENUM('credit', 'debit'),
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: 'SAR'
        },
        balanceBefore: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        balanceAfter: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        referenceType: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        referenceId: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'TenantWalletLedgerEntry',
        tableName: 'tenant_wallet_ledger_entries',
        indexes: [
            { fields: ['platformUserId', 'tenantId', 'createdAt'] },
            { fields: ['tenantId', 'type'] },
            { fields: ['referenceType', 'referenceId'] }
        ]
    });

    return TenantWalletLedgerEntry;
};
