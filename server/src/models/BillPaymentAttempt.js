'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class BillPaymentAttempt extends Model {
        static associate(models) {
            BillPaymentAttempt.belongsTo(models.Bill, {
                foreignKey: 'billId',
                as: 'bill'
            });
        }
    }

    BillPaymentAttempt.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        billId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'bills',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        source: {
            type: DataTypes.ENUM(
                'public_payment_link',
                'admin_manual_reconciliation',
                'provider_webhook',
                'legacy_subscription_payment'
            ),
            allowNull: false,
            defaultValue: 'public_payment_link'
        },
        status: {
            type: DataTypes.ENUM(
                'pending',
                'succeeded',
                'failed',
                'already_paid',
                'expired',
                'duplicate_ignored'
            ),
            allowNull: false,
            defaultValue: 'pending'
        },
        paymentProvider: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        paymentMethod: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        paymentReference: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        checkoutSessionId: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        gatewayStatus: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        requestedAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        capturedAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        failureReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        idempotencyKey: {
            type: DataTypes.STRING(191),
            allowNull: false,
            unique: true
        },
        processedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        performedByType: {
            type: DataTypes.ENUM('tenant_user', 'super_admin', 'system', 'payment_gateway'),
            allowNull: false,
            defaultValue: 'system'
        },
        performedById: {
            type: DataTypes.UUID,
            allowNull: true
        },
        performedByName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        gatewaySummary: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'BillPaymentAttempt',
        tableName: 'bill_payment_attempts',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['billId'] },
            { fields: ['status'] },
            { fields: ['source'] },
            { fields: ['paymentReference'] },
            { fields: ['processedAt'] },
            { unique: true, fields: ['idempotencyKey'] }
        ]
    });

    return BillPaymentAttempt;
};
