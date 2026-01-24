/**
 * Tenant Order Controller
 * Handles order management for tenant dashboard
 */

const db = require('../models');
const { Op } = require('sequelize');
const orderService = require('../services/orderService');

/**
 * Get all orders for tenant
 * GET /api/v1/tenant/orders
 */
exports.getOrders = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { 
            status, 
            paymentStatus, 
            startDate, 
            endDate,
            search,
            page = 1,
            limit = 20
        } = req.query;

        // Build where clause
        const where = { tenantId };

        // Status filter
        if (status) {
            where.status = status;
        }

        // Payment status filter
        if (paymentStatus) {
            where.paymentStatus = paymentStatus;
        } else {
            // Default filter: Only show orders that should be visible
            // - Online payments: only if paymentStatus is 'paid'
            // - POD/POV: always show (they don't require immediate payment)
            where[Op.and] = [
                {
                    [Op.or]: [
                        { paymentMethod: 'cash_on_delivery' },
                        { paymentMethod: 'pay_on_visit' },
                        { 
                            paymentMethod: 'online',
                            paymentStatus: 'paid'
                        }
                    ]
                }
            ];
        }

        // Date filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        // Search filter (order number or customer name)
        // Combine with existing Op.and if it exists
        if (search) {
            const searchConditions = [
                { orderNumber: { [Op.iLike]: `%${search}%` } },
                { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
                { '$user.lastName$': { [Op.iLike]: `%${search}%` } }
            ];
            
            if (where[Op.and]) {
                where[Op.and].push({ [Op.or]: searchConditions });
            } else {
                where[Op.or] = searchConditions;
            }
        }

        // Calculate pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get orders with pagination
        const { count, rows: orders } = await db.Order.findAndCountAll({
            where,
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'photo'],
                    required: false
                },
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'image', 'category'],
                            required: false
                        }
                    ],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        // Calculate totals
        const totalOrders = await db.Order.count({ where: { tenantId } });
        const pendingOrders = await db.Order.count({ 
            where: { tenantId, status: { [Op.in]: ['pending', 'confirmed', 'processing'] } } 
        });
        const completedOrders = await db.Order.count({ 
            where: { tenantId, status: 'completed' } 
        });
        const cancelledOrders = await db.Order.count({ 
            where: { tenantId, status: { [Op.in]: ['cancelled', 'refunded'] } } 
        });

        res.json({
            success: true,
            orders,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit))
            },
            stats: {
                total: totalOrders,
                pending: pendingOrders,
                completed: completedOrders,
                cancelled: cancelledOrders
            }
        });
    } catch (error) {
        console.error('Get tenant orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
};

/**
 * Get single order by ID
 * GET /api/v1/tenant/orders/:id
 */
exports.getOrder = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const order = await db.Order.findOne({
            where: { id, tenantId },
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'photo'],
                    required: false
                },
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'image', 'category', 'price'],
                            required: false
                        }
                    ],
                    required: false
                },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'logo', 'phone', 'email'],
                    required: false
                }
            ]
        });

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
        console.error('Get tenant order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
};

/**
 * Update order status
 * PATCH /api/v1/tenant/orders/:id/status
 */
exports.updateOrderStatus = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { status, trackingNumber, estimatedDeliveryDate } = req.body;

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

        // Update order status
        const updateData = { status };
        
        // Add tracking info if provided
        if (trackingNumber) {
            updateData.trackingNumber = trackingNumber;
        }
        
        if (estimatedDeliveryDate) {
            updateData.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
        }

        // Use orderService for status update logic
        const updatedOrder = await orderService.updateOrderStatus(id, status);

        // Update tracking fields if provided
        if (trackingNumber || estimatedDeliveryDate) {
            await updatedOrder.update(updateData);
        }

        // Reload order with associations
        const fullOrder = await db.Order.findByPk(id, {
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'photo'],
                    required: false
                },
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            required: false
                        }
                    ],
                    required: false
                }
            ]
        });

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order: fullOrder
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update order status',
            error: error.message
        });
    }
};

/**
 * Update payment status (for POD/POV)
 * PATCH /api/v1/tenant/orders/:id/payment
 */
exports.updatePaymentStatus = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { paymentStatus } = req.body;

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

        // Update payment status using orderService
        const updatedOrder = await orderService.updatePaymentStatus(id, paymentStatus);

        // Reload order with associations
        const fullOrder = await db.Order.findByPk(id, {
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'photo'],
                    required: false
                },
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            required: false
                        }
                    ],
                    required: false
                }
            ]
        });

        res.json({
            success: true,
            message: 'Payment status updated successfully',
            order: fullOrder
        });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update payment status',
            error: error.message
        });
    }
};
