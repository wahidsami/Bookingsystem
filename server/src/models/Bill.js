'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Bill extends Model {
        static associate(models) {
            Bill.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            Bill.belongsTo(models.TenantSubscription, {
                foreignKey: 'tenantSubscriptionId',
                as: 'subscription'
            });
        }
    }

    Bill.init({
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
        tenantSubscriptionId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenant_subscriptions',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        billNumber: {
            type: DataTypes.STRING(32),
            allowNull: false,
            unique: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'SAR'
        },
        dueDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('UNPAID', 'PAID', 'EXPIRED'),
            allowNull: false,
            defaultValue: 'UNPAID'
        },
        paymentToken: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true
        },
        paymentTokenExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        planSnapshot: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        },
        type: {
            type: DataTypes.ENUM('initial', 'renewal', 'upgrade'),
            allowNull: false,
            defaultValue: 'initial'
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'Bill',
        tableName: 'bills',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId'] },
            { fields: ['tenantSubscriptionId'] },
            { fields: ['status'] },
            { fields: ['paymentToken'], unique: true },
            { fields: ['dueDate'] }
        ]
    });

    return Bill;
};
