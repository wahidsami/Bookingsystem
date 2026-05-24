'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class WalletLedgerEntry extends Model {
        static associate(models) {
            WalletLedgerEntry.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });
        }
    }

    WalletLedgerEntry.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'platform_users',
                key: 'id'
            }
        },
        type: {
            type: DataTypes.ENUM(
                'topup',
                'gift_purchase',
                'gift_sent_debit',
                'gift_received_credit',
                'service_payment_debit',
                'product_payment_debit',
                'refund_credit',
                'admin_adjustment'
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
        modelName: 'WalletLedgerEntry',
        tableName: 'wallet_ledger_entries',
        indexes: [
            { fields: ['platformUserId'] },
            { fields: ['type'] },
            { fields: ['createdAt'] },
            { fields: ['referenceType', 'referenceId'] }
        ]
    });

    return WalletLedgerEntry;
};

