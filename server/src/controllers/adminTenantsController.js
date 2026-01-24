const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get all tenants with filters and pagination
 */
const listTenants = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            businessType,
            plan,
            city,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        // Apply filters
        if (status) where.status = status;
        if (businessType) where.businessType = businessType;
        if (plan) where.plan = plan;
        if (city) where.city = city;

        // Search by name, email, phone
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } },
                { ownerName: { [Op.iLike]: `%${search}%` } },
                { ownerEmail: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows: tenants } = await db.Tenant.findAndCountAll({
            where,
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            tenants,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('List tenants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenants',
            error: error.message
        });
    }
};

/**
 * Get pending tenants for approval
 */
const getPendingTenants = async (req, res) => {
    try {
        const tenants = await db.Tenant.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'ASC']]
        });

        res.json({
            success: true,
            tenants,
            count: tenants.length
        });

    } catch (error) {
        console.error('Get pending tenants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending tenants'
        });
    }
};

/**
 * Get single tenant details
 */
const getTenantDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const tenant = await db.Tenant.findByPk(id, {
            include: [
                {
                    model: db.User,
                    attributes: ['id', 'email', 'role', 'createdAt']
                }
            ]
        });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Get activity logs for this tenant
        const activities = await db.ActivityLog.findAll({
            where: {
                entityType: 'tenant',
                entityId: id
            },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        // Get booking stats
        const bookingStats = await getBookingStats(tenant.dbSchema);

        res.json({
            success: true,
            tenant,
            activities,
            bookingStats
        });

    } catch (error) {
        console.error('Get tenant details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant details',
            error: error.message
        });
    }
};

/**
 * Approve tenant
 */
const approveTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        if (tenant.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve tenant with status: ${tenant.status}`
            });
        }

        // Update tenant status
        await tenant.update({
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: req.adminId,
            planStartDate: new Date(),
            planEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days trial
        });

        // Initialize subscription and usage tracking
        const { initializeTenantSubscription } = require('../utils/initializeTenantSubscription');
        try {
            await initializeTenantSubscription(tenant.id, 'free-trial');
        } catch (subscriptionError) {
            console.error('Failed to initialize subscription:', subscriptionError);
            // Don't fail the approval if subscription init fails
        }

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'approved',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            details: { notes },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Send approval email (don't wait for it, don't fail if it errors)
        const { sendApprovalEmail } = require('../utils/emailService');
        sendApprovalEmail(tenant).catch(err => {
            console.error('[Approval] Failed to send approval email:', err.message);
            // Don't throw - email failure shouldn't affect approval
        });

        res.json({
            success: true,
            message: 'Tenant approved successfully. Free trial subscription activated.',
            tenant
        });

    } catch (error) {
        console.error('Approve tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve tenant',
            error: error.message
        });
    }
};

/**
 * Reject tenant
 */
const rejectTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        if (tenant.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject tenant with status: ${tenant.status}`
            });
        }

        // Update tenant status
        await tenant.update({
            status: 'rejected',
            rejectionReason: reason
        });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'rejected',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            details: { reason },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Send rejection email (don't wait for it, don't fail if it errors)
        const { sendRejectionEmail } = require('../utils/emailService');
        sendRejectionEmail(tenant, reason).catch(err => {
            console.error('[Rejection] Failed to send rejection email:', err.message);
            // Don't throw - email failure shouldn't affect rejection
        });

        res.json({
            success: true,
            message: 'Tenant rejected',
            tenant
        });

    } catch (error) {
        console.error('Reject tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject tenant',
            error: error.message
        });
    }
};

/**
 * Suspend tenant
 */
const suspendTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Suspension reason is required'
            });
        }

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const previousStatus = tenant.status;

        await tenant.update({
            status: 'suspended',
            suspensionReason: reason
        });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'suspended',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue: { status: previousStatus },
            newValue: { status: 'suspended' },
            details: { reason },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Tenant suspended',
            tenant
        });

    } catch (error) {
        console.error('Suspend tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend tenant',
            error: error.message
        });
    }
};

/**
 * Activate tenant (re-activate after suspension)
 */
const activateTenant = async (req, res) => {
    try {
        const { id } = req.params;

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const previousStatus = tenant.status;

        await tenant.update({
            status: 'approved',
            suspensionReason: null
        });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'activated',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue: { status: previousStatus },
            newValue: { status: 'approved' },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Tenant activated',
            tenant
        });

    } catch (error) {
        console.error('Activate tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate tenant',
            error: error.message
        });
    }
};

/**
 * Update tenant details
 */
const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Store previous values for logging
        const previousValue = tenant.toJSON();

        // Allowed fields to update
        const allowedFields = [
            'name', 'nameAr', 'businessType', 'email', 'phone', 'whatsapp',
            'website', 'address', 'city', 'description', 'descriptionAr',
            'plan', 'planStartDate', 'planEndDate', 'settings', 'layoutTemplate',
            'themeColors'
        ];

        const filteredUpdates = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        }

        await tenant.update(filteredUpdates);

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'updated',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue,
            newValue: filteredUpdates,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Tenant updated',
            tenant
        });

    } catch (error) {
        console.error('Update tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update tenant',
            error: error.message
        });
    }
};

/**
 * Get tenant activity logs
 */
const getTenantActivities = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const offset = (page - 1) * limit;

        const { count, rows: activities } = await db.ActivityLog.findAndCountAll({
            where: {
                entityType: 'tenant',
                entityId: id
            },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            activities,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Get tenant activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activities'
        });
    }
};

// Helper function to get booking stats for a tenant
async function getBookingStats(dbSchema) {
    try {
        // This would query the tenant's schema for booking stats
        // For now, return mock data
        return {
            totalBookings: 0,
            completedBookings: 0,
            cancelledBookings: 0,
            totalRevenue: 0,
            averageRating: 0
        };
    } catch (error) {
        console.error('Get booking stats error:', error);
        return null;
    }
}

module.exports = {
    listTenants,
    getPendingTenants,
    getTenantDetails,
    approveTenant,
    rejectTenant,
    suspendTenant,
    activateTenant,
    updateTenant,
    getTenantActivities
};

