const orderService = require('../services/orderService');
const db = require('../models');

/**
 * Create a new order
 * POST /api/v1/orders
 * Requires authentication
 */
const createOrder = async (req, res) => {
    try {
        const {
            tenantId,
            items, // [{productId, quantity}]
            paymentMethod, // 'online', 'cash_on_delivery', 'pay_on_visit'
            deliveryType = 'pickup', // 'pickup' or 'delivery'
            shippingAddress,
            pickupDate,
            notes
        } = req.body;

        const platformUserId = req.userId;

        if (!platformUserId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Validate required fields
        if (!tenantId || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'tenantId and items array are required'
            });
        }

        if (!paymentMethod || !['online', 'cash_on_delivery', 'pay_on_visit'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Valid paymentMethod is required: online, cash_on_delivery, or pay_on_visit'
            });
        }

        // Validate delivery type
        if (deliveryType === 'delivery' && !shippingAddress) {
            return res.status(400).json({
                success: false,
                message: 'shippingAddress is required for delivery orders'
            });
        }

        // Create order
        const order = await orderService.createOrder({
            platformUserId,
            tenantId,
            items,
            paymentMethod,
            deliveryType,
            shippingAddress,
            pickupDate,
            notes
        });

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to create order'
        });
    }
};

/**
 * Get user orders
 * GET /api/v1/orders
 * Requires authentication
 */
const getUserOrders = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const { status, paymentStatus, startDate, endDate } = req.query;

        if (!platformUserId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const orders = await orderService.getUserOrders(platformUserId, {
            status,
            paymentStatus,
            startDate,
            endDate
        });

        res.json({
            success: true,
            orders,
            count: orders.length
        });

    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch orders'
        });
    }
};

/**
 * Get order by ID
 * GET /api/v1/orders/:id
 * Requires authentication
 */
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const platformUserId = req.userId;

        if (!platformUserId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const order = await orderService.getOrderById(id, platformUserId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch order'
        });
    }
};

/**
 * Cancel order
 * PATCH /api/v1/orders/:id/cancel
 * Requires authentication
 */
const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const platformUserId = req.userId;

        if (!platformUserId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Verify order belongs to user
        const order = await db.Order.findOne({
            where: { id, platformUserId }
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const cancelledOrder = await orderService.cancelOrder(id, reason);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order: cancelledOrder
        });

    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to cancel order'
        });
    }
};

/**
 * Update order status (for tenant admin)
 * PATCH /api/v1/orders/:id/status
 * Requires tenant authentication
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const tenantId = req.tenantId;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant authentication required'
            });
        }

        // Verify order belongs to tenant
        const order = await db.Order.findOne({
            where: { id, tenantId }
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const updatedOrder = await orderService.updateOrderStatus(id, status);

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update order status'
        });
    }
};

/**
 * Update payment status (for tenant admin - POD/POV)
 * PATCH /api/v1/orders/:id/payment
 * Requires tenant authentication
 */
const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;
        const tenantId = req.tenantId;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant authentication required'
            });
        }

        // Verify order belongs to tenant
        const order = await db.Order.findOne({
            where: { id, tenantId }
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const updatedOrder = await orderService.updatePaymentStatus(id, paymentStatus);

        res.json({
            success: true,
            message: 'Payment status updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update payment status'
        });
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    updatePaymentStatus
};
