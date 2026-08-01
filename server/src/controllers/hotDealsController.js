/**
 * Hot Deals Controller
 * Handles promotional deals creation, approval, and management
 */

const db = require('../models');
const promotionService = require('../services/promotionService');
const { getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');
const { normalizePackageEntitlements, toNumericEntitlement } = require('../utils/packageEntitlements');
const fs = require('fs');
const path = require('path');

const serializeHotDeal = (deal) => {
    if (!deal) return null;

    const plainDeal = typeof deal.get === 'function' ? deal.get({ plain: true }) : { ...deal };
    const service = plainDeal.service
        ? {
            ...plainDeal.service,
            name: plainDeal.service.name || plainDeal.service.name_en || plainDeal.service.name_ar || null
        }
        : null;
    const tenant = plainDeal.tenant
        ? {
            ...plainDeal.tenant,
            name: plainDeal.tenant.name || plainDeal.tenant.name_en || plainDeal.tenant.name_ar || null,
            businessNameEn: plainDeal.tenant.businessNameEn || plainDeal.tenant.name_en || plainDeal.tenant.name || null,
            businessNameAr: plainDeal.tenant.businessNameAr || plainDeal.tenant.name_ar || plainDeal.tenant.nameAr || null
        }
        : null;

    return {
        ...plainDeal,
        image: plainDeal.image || service?.image || tenant?.coverImage || null,
        service,
        tenant,
        serviceName: service?.name || null,
        redemptionCount: plainDeal.redemptionCount ?? plainDeal.currentRedemptions ?? 0
    };
};

const stripImmutableHotDealFields = (updates = {}) => {
    const immutableFields = new Set([
        'id',
        'tenantId',
        'approvedBy',
        'approvedAt',
        'currentRedemptions',
        'createdAt',
        'updatedAt',
        'status',
        'isActive',
        'tenant',
        'service',
        'approver'
    ]);

    return Object.entries(updates).reduce((acc, [key, value]) => {
        if (!immutableFields.has(key)) {
            acc[key] = value;
        }
        return acc;
    }, {});
};

const canBePublishedNow = (deal) => {
    const now = new Date();
    const validFrom = deal?.validFrom ? new Date(deal.validFrom) : null;
    const validUntil = deal?.validUntil ? new Date(deal.validUntil) : null;

    if (validUntil && !Number.isNaN(validUntil.getTime()) && validUntil < now) {
        return false;
    }

    if (validFrom && !Number.isNaN(validFrom.getTime()) && validFrom > now) {
        return true;
    }

    return true;
};

/**
 * Get hot deals limits for current tenant
 * GET /api/v1/tenant/hot-deals/limits
 */
const getHotDealsLimits = async (req, res) => {
    try {
        const tenantId = req.tenantId;

        const subscriptionResult = await getActiveSubscriptionForTenant(tenantId, {
            statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE', 'past_due']
        });

        if (!subscriptionResult?.subscription || !subscriptionResult?.package) {
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

        const packageLimits = normalizePackageEntitlements(subscriptionResult.package.limits || {});
        const maxHotDeals = toNumericEntitlement(packageLimits.maxHotDeals, 0);
        const autoApprove = Boolean(packageLimits.autoApproveHotDeals);

        // Count all created deals for the tenant so the quota never resets after
        // pausing, hiding, or expiring a deal.
        const currentCount = await db.HotDeal.count({
            where: { tenantId }
        });

        const canCreate = maxHotDeals === -1 || currentCount < maxHotDeals;

        return res.json({
            success: true,
            canCreate,
            limits: {
                packageName: subscriptionResult.package?.name || 'Unknown',
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
            deals: deals.map(serializeHotDeal)
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
 * Get a single hot deal for a tenant
 * GET /api/v1/tenant/hot-deals/:id
 */
const getTenantHotDealById = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const deal = await db.HotDeal.findOne({
            where: { id, tenantId },
            include: [{
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar', 'duration']
            }]
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Hot deal not found'
            });
        }

        res.json({
            success: true,
            deal: serializeHotDeal(deal)
        });
    } catch (error) {
        console.error('Get tenant hot deal detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch hot deal details'
        });
    }
};

/**
 * Create a new hot deal
 * POST /api/v1/tenant/hot-deals
 */
const createHotDeal = async (req, res) => {
    try {
        const tenantId = req.tenantId;
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

        const imagePath = req.file?.path
            ? req.file.path.replace(/\\/g, '/').split('uploads/')[1]
            : null;

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
        const originalPrice = parseFloat(
            service.finalPrice || service.rawPrice || service.basePrice || 0
        );

        if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Service price is not configured correctly for hot deals'
            });
        }
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
        const status = canCreate.autoApprove ? 'active' : 'pending';

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
            image: imagePath,
            status,
            isActive: true
        });

        const hydratedDeal = await db.HotDeal.findByPk(deal.id, {
            include: [{
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar', 'duration']
            }]
        });

        res.status(201).json({
            success: true,
            deal: serializeHotDeal(hydratedDeal || deal),
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
        const tenantId = req.tenantId;
        const updates = req.body;

        const uploadedImagePath = req.file?.path
            ? req.file.path.replace(/\\/g, '/').split('uploads/')[1]
            : null;

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

        // Require the tenant to pause a live deal before editing it.
        if (deal.status === 'active') {
            return res.status(400).json({
                success: false,
                message: 'Pause the hot deal before editing it'
            });
        }

        const nextServiceId = updates.serviceId || deal.serviceId;
        const service = await db.Service.findByPk(nextServiceId);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        if (service.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update deals for your own services'
            });
        }

        const originalPrice = parseFloat(
            service.finalPrice || service.rawPrice || service.basePrice || 0
        );

        if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Service price is not configured correctly for hot deals'
            });
        }

        const nextDiscountType = updates.discountType || deal.discountType;
        const nextDiscountValue = updates.discountValue ?? deal.discountValue;
        const nextValidFrom = updates.validFrom || deal.validFrom;
        const nextValidUntil = updates.validUntil || deal.validUntil;

        if (new Date(nextValidUntil) <= new Date(nextValidFrom)) {
            return res.status(400).json({
                success: false,
                message: 'Valid until must be after valid from'
            });
        }

        let discountedPrice;
        if (nextDiscountType === 'percentage') {
            const discount = (originalPrice * parseFloat(nextDiscountValue)) / 100;
            discountedPrice = originalPrice - discount;
        } else {
            discountedPrice = originalPrice - parseFloat(nextDiscountValue);
        }

        if (discountedPrice < originalPrice * 0.5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum discount is 50%'
            });
        }

        // Remove old image file only when we have a replacement.
        if (uploadedImagePath && deal.image && deal.image !== uploadedImagePath) {
            const oldImageAbsolutePath = path.join(__dirname, '../../uploads', deal.image);
            if (fs.existsSync(oldImageAbsolutePath)) {
                fs.unlinkSync(oldImageAbsolutePath);
            }
        }

        await deal.update({
            ...stripImmutableHotDealFields(updates),
            serviceId: nextServiceId,
            discountType: nextDiscountType,
            discountValue: nextDiscountValue,
            originalPrice,
            discountedPrice,
            validFrom: nextValidFrom,
            validUntil: nextValidUntil,
            ...(uploadedImagePath ? { image: uploadedImagePath } : {})
        });

        const hydratedDeal = await db.HotDeal.findByPk(id, {
            include: [{
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar', 'duration']
            }]
        });

        return res.json({
            success: true,
            deal: serializeHotDeal(hydratedDeal || deal)
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
 * Pause/unpublish a hot deal
 * DELETE /api/v1/tenant/hot-deals/:id
 */
const deleteHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

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

        await deal.update({
            status: 'paused',
            isActive: false
        });

        res.json({
            success: true,
            message: 'Hot deal hidden successfully'
        });
    } catch (error) {
        console.error('Delete hot deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to hide hot deal'
        });
    }
};

/**
 * Pause a hot deal
 * POST /api/v1/tenant/hot-deals/:id/pause
 */
const pauseHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

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

        if (deal.status === 'paused' && !deal.isActive) {
            return res.json({
                success: true,
                deal: serializeHotDeal(deal),
                message: 'Hot deal is already paused'
            });
        }

        await deal.update({
            status: 'paused',
            isActive: false
        });

        const hydratedDeal = await db.HotDeal.findByPk(id, {
            include: [{
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar', 'duration']
            }]
        });

        return res.json({
            success: true,
            deal: serializeHotDeal(hydratedDeal || deal),
            message: 'Hot deal paused successfully'
        });
    } catch (error) {
        console.error('Pause hot deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to pause hot deal'
        });
    }
};

/**
 * Publish a paused hot deal
 * POST /api/v1/tenant/hot-deals/:id/resume
 */
const resumeHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

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

        if (deal.status === 'active' && deal.isActive) {
            return res.json({
                success: true,
                deal: serializeHotDeal(deal),
                message: 'Hot deal is already live'
            });
        }

        if (!canBePublishedNow(deal)) {
            return res.status(400).json({
                success: false,
                message: 'Extend the validity dates before publishing this hot deal'
            });
        }

        const nextStatus = deal.approvedAt ? 'active' : 'pending';
        await deal.update({
            status: nextStatus,
            isActive: true
        });

        const hydratedDeal = await db.HotDeal.findByPk(id, {
            include: [{
                model: db.Service,
                as: 'service',
                attributes: ['id', 'name_en', 'name_ar', 'duration']
            }]
        });

        return res.json({
            success: true,
            deal: serializeHotDeal(hydratedDeal || deal),
            message: nextStatus === 'active' ? 'Hot deal published successfully' : 'Hot deal returned to review'
        });
    } catch (error) {
        console.error('Resume hot deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to publish hot deal'
        });
    }
};

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * Get hot deals for admin marketing dashboard
 * GET /api/v1/admin/hot-deals
 */
const getAdminHotDeals = async (req, res) => {
    try {
        const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
        const allowedStatuses = new Set(['all', 'pending', 'approved', 'active', 'expired', 'rejected', 'paused']);
        const where = {};

        if (allowedStatuses.has(status) && status !== 'all') {
            where.status = status;
        }

        const deals = await db.HotDeal.findAll({
            where,
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'nameAr', 'coverImage']
                },
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar', 'rawPrice', 'finalPrice', 'image']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const summary = deals.reduce((acc, deal) => {
            const key = deal.status || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        res.json({
            success: true,
            deals: deals.map(serializeHotDeal),
            summary
        });
    } catch (error) {
        console.error('Get admin hot deals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch hot deals'
        });
    }
};

/**
 * Get all hot deals pending approval
 * GET /api/v1/admin/hot-deals/pending
 */
const getPendingHotDeals = async (req, res) => {
    req.query.status = 'pending';
    return getAdminHotDeals(req, res);
};

/**
 * Approve a hot deal
 * POST /api/v1/admin/hot-deals/:id/approve
 */
const approveHotDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;

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
 * Get all customer-visible hot deals
 * GET /api/v1/hot-deals
 */
const getActiveHotDeals = async (req, res) => {
    try {
        const now = new Date();

        const allDeals = await db.HotDeal.findAll({
            where: {
                status: 'active',
                isActive: true
            },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'logo', 'coverImage', 'slug']
                },
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'image']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        const visibilityChecks = allDeals.map((deal) => {
            const serialized = serializeHotDeal(deal);
            const reasons = [];
            const validFrom = serialized.validFrom ? new Date(serialized.validFrom) : null;
            const validUntil = serialized.validUntil ? new Date(serialized.validUntil) : null;

            if (!serialized.isActive) {
                reasons.push('inactive');
            }
            if (!['pending', 'active'].includes(serialized.status)) {
                reasons.push(`status:${serialized.status || 'unknown'}`);
            }
            if (validFrom && !Number.isNaN(validFrom.getTime()) && validFrom > now) {
                reasons.push('not-yet-valid');
            }
            if (validUntil && !Number.isNaN(validUntil.getTime()) && validUntil < now) {
                reasons.push('expired');
            }

            return {
                ...serialized,
                visible: reasons.length === 0,
                reasons
            };
        });

        const deals = visibilityChecks.filter((deal) => deal.visible);

        console.info('[hot-deals] public feed', JSON.stringify({
            total: allDeals.length,
            visible: deals.length,
            deals: visibilityChecks.map((deal) => ({
                id: deal.id,
                title: deal.title_en || deal.title_ar || 'Untitled',
                status: deal.status,
                isActive: deal.isActive,
                validFrom: deal.validFrom,
                validUntil: deal.validUntil,
                visible: deal.visible,
                reasons: deal.reasons
            }))
        }));

        res.json({
            success: true,
            deals: deals.map(({ visible, reasons, ...deal }) => deal)
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
    getTenantHotDealById,
    createHotDeal,
    updateHotDeal,
    deleteHotDeal,
    pauseHotDeal,
    resumeHotDeal,

    // Admin endpoints
    getAdminHotDeals,
    getPendingHotDeals,
    approveHotDeal,
    rejectHotDeal,

    // Public endpoints
    getActiveHotDeals
};
