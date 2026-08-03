'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FinancialLedgerEntry extends Model {
        static associate(models) {
            this.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            this.belongsTo(models.Customer, {
                foreignKey: 'customerId',
                as: 'customer'
            });
            // polymorphic associations are handled loosely via entityType and entityId
        }
    }
    FinancialLedgerEntry.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        customerId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        entityType: {
            type: DataTypes.STRING, // 'Booking', 'Order', 'PosReceipt', 'WalletTopup', 'GiftCard'
            allowNull: false,
        },
        entityId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Positive for revenue, negative for refund'
        },
        currency: {
            type: DataTypes.STRING,
            defaultValue: 'SAR',
        },
        status: {
            type: DataTypes.STRING, // 'completed', 'refunded'
            defaultValue: 'completed',
        },
        paymentMethod: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        }
    }, {
        sequelize,
        modelName: 'FinancialLedgerEntry',
        tableName: 'financial_ledger_entries',
        indexes: [
            {
                fields: ['tenantId']
            },
            {
                fields: ['entityType', 'entityId']
            },
            {
                fields: ['createdAt']
            }
        ]
    });
    return FinancialLedgerEntry;
};

