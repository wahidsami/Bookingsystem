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

            Bill.hasMany(models.BillPaymentAttempt, {
                foreignKey: 'billId',
                as: 'paymentAttempts'
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
        subtotalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Taxable subtotal before VAT'
        },
        platformMarkupRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Refah subscription package markup rate captured at invoice issue time'
        },
        platformMarkupAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Refah markup amount included in the taxable subtotal'
        },
        vatRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'VAT rate captured at invoice issue time'
        },
        vatAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'VAT amount captured at invoice issue time'
        },
        discountAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Final invoice amount including VAT'
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
            type: DataTypes.ENUM('DRAFT', 'UNPAID', 'FAILED', 'PAID', 'EXPIRED', 'VOID'),
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
        invoiceIssuedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        invoiceTitle: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        invoiceTemplateMode: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'bilingual_ar_en'
        },
        sellerSnapshot: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        buyerSnapshot: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        lineItemsSnapshot: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        planSnapshot: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        },
        invoicePdfPath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        receiptPdfPath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        paymentProvider: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        paymentReference: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        paymentMethod: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        paymentCapturedAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        paymentFailureReason: {
            type: DataTypes.TEXT,
            allowNull: true
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
            { fields: ['dueDate'] },
            { fields: ['invoiceIssuedAt'] },
            { fields: ['paidAt'] }
        ]
    });

    return Bill;
};
