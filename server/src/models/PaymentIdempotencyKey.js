'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PaymentIdempotencyKey extends Model {
        static associate(models) {
            PaymentIdempotencyKey.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });
        }
    }

    PaymentIdempotencyKey.init({
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
            },
            onDelete: 'CASCADE'
        },
        idempotencyKey: {
            type: DataTypes.STRING(191),
            allowNull: false
        },
        requestHash: {
            type: DataTypes.STRING(128),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('processing', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'processing'
        },
        responsePayload: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        errorMessage: {
            type: DataTypes.STRING(500),
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'PaymentIdempotencyKey',
        tableName: 'payment_idempotency_keys',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['platformUserId'] },
            { unique: true, fields: ['platformUserId', 'idempotencyKey'], name: 'uidx_payment_idempotency_user_key' },
            { fields: ['status', 'updatedAt'], name: 'idx_payment_idempotency_status_updated_at' }
        ]
    });

    return PaymentIdempotencyKey;
};
