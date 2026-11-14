'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PaymentTransaction extends Model {
        static associate(models) {
            PaymentTransaction.belongsTo(models.Appointment, {
                foreignKey: 'appointmentId',
                as: 'appointment'
            });
            PaymentTransaction.belongsTo(models.Order, {
                foreignKey: 'orderId',
                as: 'order'
            });
            PaymentTransaction.belongsTo(models.Staff, {
                foreignKey: 'processedBy',
                as: 'processor'
            });
        }

        /**
         * Check if transaction is completed
         */
        isCompleted() {
            return this.status === 'completed';
        }

        /**
         * Check if transaction was refunded
         */
        isRefunded() {
            return this.status === 'refunded';
        }

        /**
         * Check if transaction is verified (non-transfer methods are always verified)
         */
        isVerified() {
            return !this.verificationStatus || this.verificationStatus === 'verified';
        }

        /**
         * Check if transaction is pending verification
         */
        isPendingVerification() {
            return this.verificationStatus === 'pending_verification';
        }
    }

    PaymentTransaction.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },

        // Reference (one of these must be set)
        appointmentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'appointments',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'orders',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },

        // Transaction Details
        type: {
            type: DataTypes.ENUM('deposit', 'remainder', 'full', 'refund'),
            allowNull: false,
            comment: 'deposit = booking fee online, remainder = at salon, full = paid in full, refund = money back'
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0.01
            }
        },
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'SAR'
        },

        // Payment Method
        paymentMethod: {
            type: DataTypes.ENUM('online', 'cash', 'card_pos', 'wallet', 'bank_transfer', 'gift_card_code'),
            allowNull: false,
            comment: 'online = credit card online, cash = at salon, card_pos = POS terminal, wallet = digital wallet, gift_card_code = gift card redemption code'
        },

        // Status
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled'),
            allowNull: false,
            defaultValue: 'completed'
        },

        // External References
        transactionRef: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Payment gateway transaction ID'
        },
        gatewayResponse: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            comment: 'Full response from payment gateway'
        },

        // Processing
        processedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Staff member who processed (for in-person payments)'
        },
        processedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        // Metadata
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            comment: 'Additional payment details (notes, receipt URL, etc.)'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Admin/staff notes about this transaction'
        },

        // Bank-Transfer Verification Lifecycle
        verificationStatus: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'verified',
            validate: {
                isIn: [['pending_verification', 'verified', 'rejected']]
            },
            comment: 'Verification lifecycle: pending_verification, verified, rejected'
        },
        verifiedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Staff or user ID who verified or rejected this transaction'
        },
        verifiedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Timestamp when verification or rejection took place'
        },
        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Audited reason for rejecting bank transfer'
        },
        proofAttachmentUrl: {
            type: DataTypes.STRING(1024),
            allowNull: true,
            comment: 'URL/path to bank transfer slip or payment proof'
        }
    }, {
        sequelize,
        modelName: 'PaymentTransaction',
        tableName: 'payment_transactions',
        schema: 'public',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['appointment_id'] },
            { fields: ['order_id'] },
            { fields: ['type'] },
            { fields: ['status'] },
            { fields: ['processed_at'] },
            { fields: ['transaction_ref'], where: { transaction_ref: { [sequelize.Sequelize.Op.ne]: null } } }
        ],
        validate: {
            // Must have either appointmentId or orderId, unless it's a gift card
            hasReference() {
                if (this.metadata?.isGiftCard) return;
                
                if (!this.appointmentId && !this.orderId) {
                    throw new Error('Must have either appointmentId or orderId');
                }
                if (this.appointmentId && this.orderId) {
                    throw new Error('Cannot have both appointmentId and orderId');
                }
            }
        }
    });

    
    PaymentTransaction.addHook('afterCreate', async (transaction, options) => {
        const forensicTrace = options?.forensicTrace || null;
        if (forensicTrace) {
            forensicTrace.log('Model hook entered', {
                model: 'PaymentTransaction.afterCreate',
                id: transaction.id
            });
        } else {
            console.log('[DIAGNOSTIC] PaymentTransaction afterCreate hook entered');
        }
        try {
            const FinancialLedgerService = require('../services/financialLedgerService');
            let tenantId = null;
            let customerId = null;
            let entityType = null;
            let entityId = null;

            if (transaction.appointmentId) {
                const appointment = await sequelize.models.Appointment.findByPk(transaction.appointmentId, {
                    include: [{ model: sequelize.models.BookingSession, as: 'bookingSession' }],
                    transaction: options?.transaction
                });
                if (appointment) {
                    tenantId = appointment.tenantId;
                    customerId = appointment.platformUserId || appointment.customerId || appointment.bookingSession?.customerId || null;
                    entityType = 'Booking';
                    entityId = appointment.id;
                }
            } else if (transaction.orderId) {
                const order = await sequelize.models.Order.findByPk(transaction.orderId, {
                    transaction: options?.transaction
                });
                if (order) {
                    tenantId = order.tenantId;
                    customerId = order.platformUserId || order.customerId || null;
                    entityType = order.orderType === 'pos' ? 'PosReceipt' : 'Order';
                    entityId = order.id;
                }
            } else {
                const meta = typeof transaction.metadata === 'string' ? (JSON.parse(transaction.metadata || '{}')) : (transaction.metadata || {});
                if (meta.isGiftCard || meta.giftCardTransactionId) {
                    tenantId = meta.tenantId || null;
                    customerId = meta.recipientId || null;
                    entityType = 'GiftCard';
                    entityId = meta.giftCardTransactionId || transaction.id;
                }
            }

            const isConfirmedRevenue = transaction.status === 'completed' && (!transaction.verificationStatus || transaction.verificationStatus === 'verified');
            if (tenantId && entityType && entityId && isConfirmedRevenue) {
                await FinancialLedgerService.recordRevenue({
                    tenantId,
                    customerId,
                    entityType,
                    entityId,
                    amount: transaction.type === 'refund' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
                    currency: transaction.currency,
                    paymentMethod: transaction.paymentMethod,
                    status: transaction.status,
                    description: transaction.notes || `Payment ${transaction.type}`
                }, options.transaction);
            }
            if (forensicTrace) {
                forensicTrace.log('Model hook exited', {
                    model: 'PaymentTransaction.afterCreate',
                    id: transaction.id,
                    recordedRevenue: Boolean(tenantId && entityType && entityId)
                });
            }
        } catch (error) {
            if (forensicTrace) {
                forensicTrace.log('Model hook exception', {
                    model: 'PaymentTransaction.afterCreate',
                    id: transaction.id,
                    message: error?.message || String(error),
                    stack: error?.stack || null
                });
            } else {
                console.error('Failed to create FinancialLedgerEntry in PaymentTransaction hook', error);
            }
            throw error;
        }
    });


    PaymentTransaction.addHook('afterUpdate', async (transaction, options) => {
        try {
            if (transaction.changed('verificationStatus') && transaction.verificationStatus === 'verified' && transaction.status === 'completed') {
                const FinancialLedgerService = require('../services/financialLedgerService');
                let tenantId = null;
                let customerId = null;
                let entityType = null;
                let entityId = null;

                if (transaction.appointmentId) {
                    const appointment = await sequelize.models.Appointment.findByPk(transaction.appointmentId, {
                        include: [{ model: sequelize.models.BookingSession, as: 'bookingSession' }],
                        transaction: options?.transaction
                    });
                    if (appointment) {
                        tenantId = appointment.tenantId;
                        customerId = appointment.platformUserId || appointment.customerId || appointment.bookingSession?.customerId || null;
                        entityType = 'Booking';
                        entityId = appointment.id;
                    }
                } else if (transaction.orderId) {
                    const order = await sequelize.models.Order.findByPk(transaction.orderId, {
                        transaction: options?.transaction
                    });
                    if (order) {
                        tenantId = order.tenantId;
                        customerId = order.platformUserId || order.customerId || null;
                        entityType = order.orderType === 'pos' ? 'PosReceipt' : 'Order';
                        entityId = order.id;
                    }
                }

                if (tenantId && entityType && entityId) {
                    await FinancialLedgerService.recordRevenue({
                        tenantId,
                        customerId,
                        entityType,
                        entityId,
                        amount: transaction.type === 'refund' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
                        currency: transaction.currency,
                        paymentMethod: transaction.paymentMethod,
                        status: transaction.status,
                        description: transaction.notes || `Verified payment ${transaction.type}`
                    }, options?.transaction);
                }
            }
        } catch (error) {
            console.error('Failed to create FinancialLedgerEntry in PaymentTransaction afterUpdate hook', error);
            throw error;
        }
    });

    return PaymentTransaction;

};

