'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Transaction extends Model {
        static associate(models) {
            Transaction.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });

            Transaction.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            Transaction.belongsTo(models.Appointment, {
                foreignKey: 'appointmentId',
                as: 'appointment'
            });

            Transaction.belongsTo(models.BookingSession, {
                foreignKey: 'bookingSessionId',
                as: 'bookingSession'
            });

            Transaction.belongsTo(models.Order, {
                foreignKey: 'orderId',
                as: 'order'
            });

            Transaction.belongsTo(models.PaymentMethod, {
                foreignKey: 'paymentMethodId',
                as: 'paymentMethod'
            });
        }
    }

    Transaction.init({
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
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        appointmentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'appointments',
                key: 'id'
            }
        },
        bookingSessionId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'booking_sessions',
                key: 'id'
            }
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'order_id', // Database column is snake_case
            references: {
                model: 'orders',
                key: 'id'
            }
        },
        paymentMethodId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'payment_methods',
                key: 'id'
            }
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'SAR'
        },
        type: {
            type: DataTypes.ENUM('booking', 'product_purchase', 'refund', 'wallet_topup', 'loyalty_redemption'),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
            defaultValue: 'pending'
        },
        stripePaymentIntentId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        stripeChargeId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        platformFee: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        tenantRevenue: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        failureReason: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Transaction',
        tableName: 'transactions',
        schema: 'public',
        timestamps: true,
        underscored: false,
        validate: {
            hasReference() {
                if (this.type === 'wallet_topup' || this.type === 'loyalty_redemption') return;

                const references = [this.appointmentId, this.bookingSessionId, this.orderId].filter(Boolean);
                if (references.length === 0) {
                    throw new Error('Must have either appointmentId, bookingSessionId, or orderId');
                }

                if (references.length > 1) {
                    throw new Error('Cannot have more than one transaction reference');
                }
            }
        }
    });

    
    Transaction.addHook('afterSave', async (transaction, options) => {
        try {
            if (transaction.status !== 'completed' && transaction.status !== 'refunded') return;
            // Avoid duplicate logging if handled elsewhere, but since Transaction is used for Wallet Topups:
            if (transaction.type === 'wallet_topup' || transaction.type === 'loyalty_redemption') {
                const FinancialLedgerService = require('../services/financialLedgerService');
                
                await FinancialLedgerService.recordRevenue({
                    tenantId: transaction.tenantId,
                    customerId: transaction.platformUserId,
                    entityType: transaction.type === 'wallet_topup' ? 'WalletTopup' : 'LoyaltyRedemption',
                    entityId: transaction.id,
                    amount: transaction.status === 'refunded' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
                    currency: transaction.currency,
                    paymentMethod: transaction.paymentMethodId || 'online',
                    status: transaction.status,
                    description: `${transaction.type} ${transaction.status}`
                }, options.transaction);
            }
        } catch (error) {
            console.error('Failed to record revenue for Transaction', error);
        }
    });

    return Transaction;

};

