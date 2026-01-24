/**
 * Order Service
 * Handles order creation, inventory management, and order status updates
 */

const db = require('../models');
const { Op } = require('sequelize');

class OrderService {
    /**
     * Create a new order
     * @param {Object} orderData - Order data
     * @param {Object} options - Sequelize options (transaction, etc.)
     */
    async createOrder(orderData, options = {}) {
        const transaction = options.transaction || await db.sequelize.transaction();
        const shouldCommit = !options.transaction;

        try {
            const {
                platformUserId,
                tenantId,
                items, // Array of {productId, quantity}
                paymentMethod, // 'online', 'cash_on_delivery', 'pay_on_visit'
                deliveryType = 'pickup', // 'pickup' or 'delivery'
                shippingAddress = null,
                pickupDate = null,
                notes = null
            } = orderData;

            // Validate required fields
            if (!platformUserId || !tenantId || !items || !Array.isArray(items) || items.length === 0) {
                throw new Error('Missing required fields: platformUserId, tenantId, and items are required');
            }

            if (!paymentMethod || !['online', 'cash_on_delivery', 'pay_on_visit'].includes(paymentMethod)) {
                throw new Error('Invalid payment method');
            }

            // Validate and calculate order totals
            let subtotal = 0;
            let totalTax = 0;
            const orderItems = [];

            // Process each item
            for (const item of items) {
                const { productId, quantity } = item;

                if (!productId || !quantity || quantity <= 0) {
                    throw new Error('Invalid item: productId and quantity (positive) are required');
                }

                // Get product with lock (to prevent race conditions)
                const product = await db.Product.findOne({
                    where: {
                        id: productId,
                        tenantId,
                        isAvailable: true
                    },
                    lock: transaction.LOCK.UPDATE, // Lock row for update
                    transaction
                });

                if (!product) {
                    throw new Error(`Product not found or not available: ${productId}`);
                }

                // Check stock availability
                if (product.stock < quantity) {
                    throw new Error(`Insufficient stock for product: ${product.name_en}. Available: ${product.stock}, Requested: ${quantity}`);
                }

                // Calculate item pricing
                const unitPrice = parseFloat(product.price);
                const itemTotal = unitPrice * quantity;
                subtotal += itemTotal;

                // Calculate tax for this item (if product has taxRate)
                const taxRate = parseFloat(product.taxRate || 15); // Default 15% VAT
                const itemTax = itemTotal * (taxRate / 100);
                totalTax += itemTax;

                // Store product snapshot
                orderItems.push({
                    productId: product.id,
                    productName: product.name_en,
                    productNameAr: product.name_ar,
                    productPrice: product.price,
                    productImage: product.images && product.images.length > 0 ? product.images[0] : product.image,
                    productSku: product.sku,
                    quantity,
                    unitPrice,
                    totalPrice: itemTotal
                });

                // Reserve or deduct inventory based on payment method
                if (paymentMethod === 'online') {
                    // Deduct immediately for online payment
                    await product.decrement('stock', { by: quantity, transaction });
                    await product.increment('soldCount', { by: quantity, transaction });
                } else {
                    // For POD/POV, we'll reserve inventory (deduct when payment confirmed)
                    // For now, we'll still deduct but mark payment as pending
                    // In production, you might want a separate "reserved" field
                    await product.decrement('stock', { by: quantity, transaction });
                    await product.increment('soldCount', { by: quantity, transaction });
                }
            }

            // Calculate platform fee (2.5% of subtotal)
            const platformFee = parseFloat((subtotal * 0.025).toFixed(2));

            // Calculate total
            const shippingFee = deliveryType === 'delivery' ? parseFloat((orderData.shippingFee || 0).toFixed(2)) : 0;
            const totalAmount = parseFloat((subtotal + totalTax + shippingFee).toFixed(2));

            // Determine payment status
            const paymentStatus = paymentMethod === 'online' ? 'pending' : 'pending'; // Will be updated after payment

            // Determine initial order status
            const status = paymentMethod === 'online' ? 'pending' : 'confirmed'; // POD/POV are confirmed, online waits for payment

            // Generate unique order number
            const orderNumber = await db.Order.generateOrderNumber();

            // Create order
            const order = await db.Order.create({
                orderNumber,
                platformUserId,
                tenantId,
                paymentMethod,
                paymentStatus,
                status,
                deliveryType,
                shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
                pickupDate,
                notes,
                subtotal: parseFloat(subtotal.toFixed(2)),
                taxAmount: parseFloat(totalTax.toFixed(2)),
                shippingFee,
                platformFee,
                totalAmount
            }, { transaction });

            // Create order items
            for (const itemData of orderItems) {
                await db.OrderItem.create({
                    orderId: order.id,
                    ...itemData
                }, { transaction });
            }

            // Update user stats
            await db.PlatformUser.increment('totalSpent', {
                by: totalAmount,
                where: { id: platformUserId },
                transaction
            });

            if (shouldCommit) {
                await transaction.commit();
            }

            // Reload order with associations
            const fullOrder = await db.Order.findByPk(order.id, {
                include: [
                    { 
                        model: db.OrderItem, 
                        as: 'items',
                        include: [
                            {
                                model: db.Product,
                                as: 'product',
                                required: false
                            }
                        ]
                    },
                    { model: db.Tenant, as: 'tenant' },
                    { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] }
                ],
                transaction: shouldCommit ? null : transaction
            });

            return fullOrder || order;

        } catch (error) {
            if (shouldCommit && !transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    }

    /**
     * Update order payment status
     * @param {String} orderId - Order ID
     * @param {String} paymentStatus - New payment status
     * @param {Object} options - Sequelize options
     */
    async updatePaymentStatus(orderId, paymentStatus, options = {}) {
        const transaction = options.transaction || await db.sequelize.transaction();
        const shouldCommit = !options.transaction;

        try {
            const order = await db.Order.findByPk(orderId, { transaction });

            if (!order) {
                throw new Error('Order not found');
            }

            // Update payment status
            await order.update({
                paymentStatus,
                paidAt: paymentStatus === 'paid' ? new Date() : null
            }, { transaction });

            // If payment confirmed and order was pending, update status
            if (paymentStatus === 'paid' && order.status === 'pending') {
                await order.update({ status: 'confirmed' }, { transaction });
            }

            if (shouldCommit) {
                await transaction.commit();
            }

            return order;

        } catch (error) {
            if (shouldCommit && !transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    }

    /**
     * Update order status
     * @param {String} orderId - Order ID
     * @param {String} status - New status
     * @param {Object} options - Sequelize options
     */
    async updateOrderStatus(orderId, status, options = {}) {
        const order = await db.Order.findByPk(orderId, options);

        if (!order) {
            throw new Error('Order not found');
        }

        const updateData = { status };

        // Set deliveredAt when status changes to delivered
        if (status === 'delivered') {
            updateData.deliveredAt = new Date();
        }

        // Set cancelledAt when status changes to cancelled
        if (status === 'cancelled') {
            updateData.cancelledAt = new Date();
        }

        // Set completed when status changes to completed
        if (status === 'completed') {
            // Ensure payment is confirmed
            if (order.paymentStatus !== 'paid') {
                throw new Error('Cannot complete order with unpaid payment');
            }
        }

        await order.update(updateData, options);

        return order;
    }

    /**
     * Cancel order
     * @param {String} orderId - Order ID
     * @param {String} reason - Cancellation reason
     * @param {Object} options - Sequelize options
     */
    async cancelOrder(orderId, reason, options = {}) {
        const transaction = options.transaction || await db.sequelize.transaction();
        const shouldCommit = !options.transaction;

        try {
            const order = await db.Order.findByPk(orderId, {
                include: [{ model: db.OrderItem, as: 'items' }],
                transaction
            });

            if (!order) {
                throw new Error('Order not found');
            }

            // Check if order can be cancelled
            if (['completed', 'cancelled', 'refunded'].includes(order.status)) {
                throw new Error('Order cannot be cancelled');
            }

            // Restore inventory
            for (const item of order.items) {
                await db.Product.increment('stock', {
                    by: item.quantity,
                    where: { id: item.productId },
                    transaction
                });
                await db.Product.decrement('soldCount', {
                    by: item.quantity,
                    where: { id: item.productId },
                    transaction
                });
            }

            // Update order
            await order.update({
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: reason
            }, { transaction });

            // If payment was made, mark for refund
            if (order.paymentStatus === 'paid') {
                await order.update({
                    paymentStatus: 'refunded'
                }, { transaction });
            }

            if (shouldCommit) {
                await transaction.commit();
            }

            return order;

        } catch (error) {
            if (shouldCommit && !transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    }

    /**
     * Get user orders
     * @param {String} platformUserId - User ID
     * @param {Object} filters - Filter options
     */
    async getUserOrders(platformUserId, filters = {}) {
        const { status, paymentStatus, startDate, endDate } = filters;

        const where = { platformUserId };

        if (status) {
            where.status = status;
        }

        if (paymentStatus) {
            where.paymentStatus = paymentStatus;
        }

        // Filter: Only show orders that should be visible
        // - Online payments: only if paymentStatus is 'paid'
        // - POD/POV: always show (they don't require immediate payment)
        where[Op.or] = [
            { paymentMethod: 'cash_on_delivery' },
            { paymentMethod: 'pay_on_visit' },
            { 
                paymentMethod: 'online',
                paymentStatus: 'paid'
            }
        ];

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const orders = await db.Order.findAll({
            where,
            include: [
                { model: db.OrderItem, as: 'items' },
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'slug', 'logo'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        return orders;
    }

    /**
     * Get order by ID
     * @param {String} orderId - Order ID
     * @param {String} platformUserId - User ID (optional, for authorization)
     */
    async getOrderById(orderId, platformUserId = null) {
        const where = { id: orderId };

        if (platformUserId) {
            where.platformUserId = platformUserId;
        }

        const order = await db.Order.findOne({
            where,
            include: [
                { 
                    model: db.OrderItem, 
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            required: false
                        }
                    ]
                },
                { model: db.Tenant, as: 'tenant' },
                { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] }
            ]
        });

        return order;
    }
}

module.exports = new OrderService();
