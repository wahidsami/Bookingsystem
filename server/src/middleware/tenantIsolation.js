/**
 * Cross-Tenant Data Isolation Utility
 * Ensures all queries are scoped to the authenticated user's tenant
 */

/**
 * Add tenant scoping to queries
 * Automatically filters data by tenant when needed
 */
const ensureTenantIsolation = {
    /**
     * Build a where clause for tenant-specific queries
     * @param {string} tenantId - The tenant ID to filter by
     * @returns {Object} Sequelize where clause
     */
    byTenant: (tenantId) => ({
        tenantId
    }),

    /**
     * Build a where clause for user-specific queries
     * @param {string} userId - The user ID to filter by
     * @returns {Object} Sequelize where clause
     */
    byUser: (userId) => ({
        platformUserId: userId
    }),

    /**
     * Build a where clause for staff member queries
     * Ensures staff belongs to tenant
     * @param {string} staffId - Staff ID
     * @param {string} tenantId - Tenant ID
     * @returns {Object} Sequelize where clause
     */
    byStaff: (staffId, tenantId) => ({
        id: staffId,
        tenantId
    }),

    /**
     * Build a where clause for service queries
     * Ensures service belongs to tenant
     * @param {string} serviceId - Service ID
     * @param {string} tenantId - Tenant ID
     * @returns {Object} Sequelize where clause
     */
    byService: (serviceId, tenantId) => ({
        id: serviceId,
        tenantId
    }),

    /**
     * Build a where clause for appointment queries
     * Ensures appointment belongs to user or tenant
     * @param {string} appointmentId - Appointment ID
     * @param {string} platformUserId - Optional: user ID
     * @param {string} tenantId - Optional: tenant ID
     * @returns {Object} Sequelize where clause
     */
    byAppointment: (appointmentId, platformUserId = null, tenantId = null) => {
        const where = { id: appointmentId };
        if (platformUserId) where.platformUserId = platformUserId;
        if (tenantId) where.tenantId = tenantId;
        return where;
    },

    /**
     * Build a where clause for product queries
     * @param {string} productId - Product ID
     * @param {string} tenantId - Tenant ID
     * @returns {Object} Sequelize where clause
     */
    byProduct: (productId, tenantId) => ({
        id: productId,
        tenantId
    }),

    /**
     * Build a where clause for order queries
     * @param {string} orderId - Order ID
     * @param {string} tenantId - Tenant ID
     * @returns {Object} Sequelize where clause
     */
    byOrder: (orderId, tenantId) => ({
        id: orderId,
        tenantId
    })
};

/**
 * Middleware to verify tenant ownership before accessing resource
 * @param {string} resourceType - Type of resource ('appointment', 'staff', 'service', etc.)
 * @returns {Function} Express middleware
 */
const verifyTenantOwnership = (resourceType) => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params.id || req.body.id;
            const tenantId = req.tenantId;
            const userId = req.userId;

            if (!resourceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource ID is required'
                });
            }

            const db = require('../models');
            let resource;

            switch (resourceType) {
                case 'appointment':
                    resource = await db.Appointment.findByPk(resourceId);
                    // Check if user owns it or works for the tenant
                    if (resource && resource.platformUserId !== userId && resource.tenantId !== tenantId) {
                        return res.status(403).json({
                            success: false,
                            message: 'Unauthorized access to this appointment'
                        });
                    }
                    break;

                case 'staff':
                    resource = await db.Staff.findByPk(resourceId);
                    if (resource && resource.tenantId !== tenantId) {
                        return res.status(403).json({
                            success: false,
                            message: 'Unauthorized access to this staff member'
                        });
                    }
                    break;

                case 'service':
                    resource = await db.Service.findByPk(resourceId);
                    if (resource && resource.tenantId !== tenantId) {
                        return res.status(403).json({
                            success: false,
                            message: 'Unauthorized access to this service'
                        });
                    }
                    break;

                case 'product':
                    resource = await db.Product.findByPk(resourceId);
                    if (resource && resource.tenantId !== tenantId) {
                        return res.status(403).json({
                            success: false,
                            message: 'Unauthorized access to this product'
                        });
                    }
                    break;

                case 'order':
                    resource = await db.Order.findByPk(resourceId);
                    if (resource && resource.tenantId !== tenantId) {
                        return res.status(403).json({
                            success: false,
                            message: 'Unauthorized access to this order'
                        });
                    }
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid resource type'
                    });
            }

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            // Store resource in request for use in controller
            req.resource = resource;
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error verifying resource ownership',
                error: error.message
            });
        }
    };
};

/**
 * Middleware to verify user owns their own appointment
 */
const verifyAppointmentOwnership = async (req, res, next) => {
    try {
        const appointmentId = req.params.id || req.params.appointmentId;
        const userId = req.userId;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'Appointment ID is required'
            });
        }

        const db = require('../models');
        const appointment = await db.Appointment.findByPk(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        if (appointment.platformUserId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to this appointment'
            });
        }

        req.appointment = appointment;
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error verifying appointment ownership',
            error: error.message
        });
    }
};

module.exports = {
    ensureTenantIsolation,
    verifyTenantOwnership,
    verifyAppointmentOwnership
};
