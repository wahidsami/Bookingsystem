/**
 * Hot Deals Controller
 * Handles promotional deals creation, approval, and management
 */

const db = require('../models');
const promotionService = require('../services/promotionService');
const { Op } = require('sequelize');

/**
 * Get hot deals limits for current tenant
 * GET /api/v1/tenant/hot-deals/limits
 */
const getHotDealsLimits = async (req, res) => {
    try {
        const tenantId = req.tenantId;

        // Get tenant's subscription
        const tenant = await db.Tenant.findByPk(tenantId, {
            include: [{
                model: db.TenantSubscription,
                as: 'subscription',
                where: { status: 'active' },
                required: false,
                include: [{
                    model: db.SubscriptionPackage,
                    as: 'package'
                }]
            }]
        });

        if (!tenant || !tenant.subscription) {
            return res.json({
                success: true,
                canCreate: false,
                limits: {
                    packageName: 'Free',
                    maxHotDeals: 0,
                    autoApprove: false,
                    currentCount: 0
                }
            });
        }

        const packageLimits = tenant.subscription.package?.limits || {};
        const maxHotDeals = packageLimits.maxHotDeals || 0;
        const autoApprove = packageLimits.autoApproveHotDeals || false;

        // Count current active/pending deals
        const currentCount = await db.HotDeal.count({
            where: {
                tenantId,
                status: { [Op.in]: ['pending', 'active'] }
            }
        });

        const canCreate = maxHotDeals === -1 || currentCount < maxHotDeals;

        return res.json({
            success: true,
            canCreate,
            limits: {
                packageName: tenant.subscription.package?.name || 'Unknown',
                maxHotDeals,
                autoApprove,
                currentCount
            }
        });
    } catch (error) {
        console.error('Get hot deals limits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch limits'
        });
    }
};

/**
 * Get all hot deals for a tenant
 * GET /api/v1/tenant/hot-deals
 */
const getTenantHotDeals = async (req, res) => {
    try {
        const tenantId = req.tenantId;

        const deals = await db.HotDeal.findAll({
            where: { tenantId },
            include: [{
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar', 'duration']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            deals
        });
    } catch (error) {
        console.error('Get tenant hot deals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch hot deals'
        });
    }
};

/**
 * Create a new hot deal
 * POST /api/v1/tenant/hot-deals
 */
const createHotDeal = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const {
            serviceId,
            title_en,
            title_ar,
            description_en,
            description_ar,
            discountType, // 'percentage' or 'fixed_amount'
            discountValue,
            validFrom,
            validUntil,
            maxRedemptions = -1
        } = req.body;

        // Check if tenant can create hot deals
        const canCreate = await promotionService.canCreateHotDeal(tenantId);

        if (!canCreate.allowed) {
            return res.status(403).json({
                success: false,
                message: canCreate.reason
            });
        }

        // Get service to calculate prices
        const service = await db.Service.findByPk(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        if (service.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'You can only create deals for your own services'
            });
        }

        // Calculate discounted price
        const originalPrice = parseFloat(service.price);
        let discountedPrice;

        if (discountType === 'percentage') {
            const discount = (originalPrice * discountValue) / 100;
            discountedPrice = originalPrice - discount;
        } else {
            discountedPrice = originalPrice - parseFloat(discountValue);
        }

        // Validate discount (max 50%)
        if (discountedPrice < originalPrice * 0.5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum discount is 50%'
            });
        }

        // Validate dates
        if (new Date(validUntil) <= new Date(validFrom)) {
            return res.status(400).json({
                success: false,
                message: 'Valid until must be after valid from'
            });
        }

        // Create hot deal
        const status = canCreate.autoApprove ? 'approved' : 'pending';

        const deal = await db.HotDeal.create({
            tenantId,
            serviceId,
            title_en,
            title_ar,
            description_en,
            description_ar,
            discountType,
            discountValue,
            originalPrice,
            discountedPrice,
            validFrom,
            validUntil,
            maxRedemptions,
            status,
            isActive: true
        });

        res.status(201).json({
            success: true,
            deal,
            autoApproved: canCreate.autoApprove
        });
    } catch (error) {
        console.error('Create hot deal error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create hot deal'
        });
    }
};

/**
 * Update a hot deal
 * PUT /api/v1/tenant/hot-deals/:id
 */
const updateHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const updates = req.body;

        const deal = await db.HotDeal.findByPk(id);
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Hot deal not found'
            });
        }

        if (deal.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Reject updates to active deals
        if (deal.status === 'active') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update active deals'
            });
        }

        await deal.update(updates);

        res.json({
            success: true,
            deal
        });
    } catch (error) {
        console.error('Update hot deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update hot deal'
        });
    }
};

/**
 * Delete a hot deal
 * DELETE /api/v1/tenant/hot-deals/:id
 */
const deleteHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const deal = await db.HotDeal.findByPk(id);
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Hot deal not found'
            });
        }

        if (deal.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await deal.destroy();

        res.json({
            success: true,
            message: 'Hot deal deleted successfully'
        });
    } catch (error) {
        console.error('Delete hot deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete hot deal'
        });
    }
};

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * Get all hot deals pending approval
 * GET /api/v1/admin/hot-deals/pending
 */
const getPendingHotDeals = async (req, res) => {
    try {
        const deals = await db.HotDeal.findAll({
            where: { status: 'pending' },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'businessNameEn', 'businessNameAr']
                },
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name', 'name_ar', 'price']
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        res.json({
            success: true,
            deals
        });
    } catch (error) {
        console.error('Get pending hot deals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending hot deals'
        });
    }
};

/**
 * Approve a hot deal
 * POST /api/v1/admin/hot-deals/:id/approve
 */
const approveHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        const deal = await db.HotDeal.findByPk(id);
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Hot deal not found'
            });
        }

        if (deal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending deals can be approved'
            });
        }

        await deal.update({
            status: 'active',
            approvedBy: adminId,
            approvedAt: new Date()
        });

        res.json({
            success: true,
            deal
        });
    } catch (error) {
        console.error('Approve hot deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve hot deal'
        });
    }
};

/**
 * Reject a hot deal
 * POST /api/v1/admin/hot-deals/:id/reject
 */
const rejectHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const deal = await db.HotDeal.findByPk(id);
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Hot deal not found'
            });
        }

        if (deal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending deals can be rejected'
            });
        }

        await deal.update({
            status: 'rejected',
            rejectionReason: reason
        });

        res.json({
            success: true,
            deal
        });
    } catch (error) {
        console.error('Reject hot deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject hot deal'
        });
    }
};

// ============================================
// PUBLIC ENDPOINTS (for mobile app)
// ============================================

/**
 * Get all active hot deals
 * GET /api/v1/hot-deals
 */
const getActiveHotDeals = async (req, res) => {
    try {
        const now = new Date();

        const deals = await db.HotDeal.findAll({
            where: {
                status: 'active',
                isActive: true,
                validFrom: { [Op.lte]: now },
                validUntil: { [Op.gte]: now }
            },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'businessNameEn', 'businessNameAr', 'logo', 'slug']
                },
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name', 'name_ar', 'duration']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        res.json({
            success: true,
            deals
        });
    } catch (error) {
        console.error('Get active hot deals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch hot deals'
        });
    }
};

module.exports = {
    // Tenant endpoints
    getHotDealsLimits,
    getTenantHotDeals,
    createHotDeal,
    updateHotDeal,
    deleteHotDeal,

    // Admin endpoints
    getPendingHotDeals,
    approveHotDeal,
    rejectHotDeal,

    // Public endpoints
    getActiveHotDeals
};
