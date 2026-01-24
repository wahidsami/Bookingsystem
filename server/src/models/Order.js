'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Order extends Model {
        static associate(models) {
            // Order belongs to PlatformUser
            Order.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });

            // Order belongs to Tenant
            Order.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            // Order has many OrderItems
            Order.hasMany(models.OrderItem, {
                foreignKey: 'orderId',
                as: 'items'
            });

            // Order can have a Transaction
            Order.hasOne(models.Transaction, {
                foreignKey: 'orderId',
                as: 'transaction'
            });
        }

        /**
         * Generate unique order number
         * Format: ORD-YYYY-XXXXXX (e.g., ORD-2026-001234)
         */
        static async generateOrderNumber() {
            const year = new Date().getFullYear();
            const prefix = `ORD-${year}-`;
            
            // Find the last order number for this year
            const lastOrder = await Order.findOne({
                where: {
                    orderNumber: {
                        [sequelize.Sequelize.Op.like]: `${prefix}%`
                    }
                },
                order: [['createdAt', 'DESC']]
            });

            let sequence = 1;
            if (lastOrder) {
                const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2]);
                sequence = lastSequence + 1;
            }

            return `${prefix}${sequence.toString().padStart(6, '0')}`;
        }
    }

    Order.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        orderNumber: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'Unique order number (e.g., ORD-2026-001234)'
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
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        // Order Status
        status: {
            type: DataTypes.ENUM(
                'pending',
                'confirmed',
                'processing',
                'ready_for_pickup',
                'shipped',
                'delivered',
                'completed',
                'cancelled',
                'refunded'
            ),
            defaultValue: 'pending',
            comment: 'Current order status'
        },
        // Payment Information
        paymentMethod: {
            type: DataTypes.ENUM('online', 'cash_on_delivery', 'pay_on_visit'),
            allowNull: false,
            comment: 'Payment method selected by customer'
        },
        paymentStatus: {
            type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded'),
            defaultValue: 'pending',
            comment: 'Payment status'
        },
        // Pricing Breakdown
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Sum of all items before tax'
        },
        taxAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Total tax amount'
        },
        shippingFee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Delivery/shipping fee (if applicable)'
        },
        platformFee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Platform commission'
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Final total amount (subtotal + tax + shipping - discounts)'
        },
        // Delivery/Pickup Information
        deliveryType: {
            type: DataTypes.ENUM('pickup', 'delivery'),
            allowNull: false,
            defaultValue: 'pickup',
            comment: 'Pickup at salon or delivery'
        },
        shippingAddress: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Shipping address: {street, city, building, floor, apartment, phone, notes}'
        },
        pickupDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When customer will pick up (for pay_on_visit)'
        },
        // Tracking Information
        trackingNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Tracking number for shipped orders'
        },
        estimatedDeliveryDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Estimated delivery date'
        },
        deliveredAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Actual delivery date'
        },
        // Notes
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Customer notes/instructions'
        },
        tenantNotes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Internal notes for tenant'
        },
        cancelledAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When order was cancelled'
        },
        cancellationReason: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Reason for cancellation'
        }
    }, {
        sequelize,
        modelName: 'Order',
        tableName: 'orders',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['platformUserId']
            },
            {
                fields: ['tenantId']
            },
            {
                fields: ['orderNumber'],
                unique: true
            },
            {
                fields: ['status']
            },
            {
                fields: ['paymentStatus']
            },
            {
                fields: ['createdAt']
            }
        ]
    });

    // Hook to generate order number before create
    Order.beforeCreate(async (order) => {
        if (!order.orderNumber) {
            order.orderNumber = await Order.generateOrderNumber();
        }
    });

    return Order;
};
