'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PaymentMethod extends Model {
        static associate(models) {
            PaymentMethod.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });
        }
    }

    PaymentMethod.init({
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
            type: DataTypes.ENUM('card', 'wallet', 'apple_pay', 'stc_pay', 'mada'),
            allowNull: false
        },

        // Card details (last 4 digits only, rest tokenized)
        cardLast4: {
            type: DataTypes.STRING(4),
            allowNull: true
        },
        cardBrand: {
            type: DataTypes.STRING, // visa, mastercard, mada
            allowNull: true
        },
        cardExpiry: {
            type: DataTypes.STRING(7), // MM/YYYY
            allowNull: true
        },
        cardHolderName: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // Tokenization (Stripe Payment Method ID)
        stripePaymentMethodId: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // Status
        isDefault: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'PaymentMethod',
        tableName: 'payment_methods',
        schema: 'public',
        timestamps: true
    });

    return PaymentMethod;
};
