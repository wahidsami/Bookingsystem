const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get all subscription packages
 */
exports.listPackages = async (req, res) => {
    try {
        const { includeInactive } = req.query;
        
        const where = {};
        if (!includeInactive) {
            where.isActive = true;
        }
        
        const packages = await db.SubscriptionPackage.findAll({
            where,
            order: [['displayOrder', 'ASC'], ['monthlyPrice', 'ASC']],
            attributes: {
                include: [
                    'sixMonthSavings',
                    'annualSavings',
                    'sixMonthPerMonth',
                    'annualPerMonth'
                ]
            }
        });
        
        res.json({
            success: true,
            packages
        });
    } catch (error) {
        console.error('List packages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch packages'
        });
    }
};

/**
 * Get single package details
 */
exports.getPackage = async (req, res) => {
    try {
        const { id } = req.params;
        
        const package = await db.SubscriptionPackage.findByPk(id, {
            include: [
                {
                    model: db.TenantSubscription,
                    as: 'subscriptions',
                    attributes: ['id', 'tenantId', 'status', 'currentPeriodEnd'],
                    where: { status: 'active' },
                    required: false
                }
            ]
        });
        
        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }
        
        res.json({
            success: true,
            package
        });
    } catch (error) {
        console.error('Get package error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch package'
        });
    }
};

/**
 * Create new subscription package
 */
exports.createPackage = async (req, res) => {
    try {
        const {
            name,
            name_ar,
            slug,
            description,
            description_ar,
            monthlyPrice,
            sixMonthPrice,
            annualPrice,
            limits,
            platformCommission,
            displayOrder,
            isActive,
            isFeatured,
            isCustom,
            customTenantId
        } = req.body;
        
        // Validate required fields
        if (!name || !name_ar || !slug) {
            return res.status(400).json({
                success: false,
                message: 'Name (EN/AR) and slug are required'
            });
        }
        
        // Check if slug already exists
        const existing = await db.SubscriptionPackage.findOne({ where: { slug } });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A package with this slug already exists'
            });
        }
        
        // Create package
        const package = await db.SubscriptionPackage.create({
            name,
            name_ar,
            slug,
            description,
            description_ar,
            monthlyPrice: monthlyPrice || 0,
            sixMonthPrice: sixMonthPrice || 0,
            annualPrice: annualPrice || 0,
            limits: limits || {},
            platformCommission: platformCommission || 5.00,
            displayOrder: displayOrder || 0,
            isActive: isActive !== undefined ? isActive : true,
            isFeatured: isFeatured || false,
            isCustom: isCustom || false,
            customTenantId: customTenantId || null,
            createdBy: req.adminId
        });
        
        // Log activity
        await db.ActivityLog.create({
            entityType: 'package',
            entityId: package.id,
            action: 'created',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName || 'Super Admin',
            details: {
                packageName: name,
                slug
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        res.status(201).json({
            success: true,
            message: 'Package created successfully',
            package
        });
    } catch (error) {
        console.error('Create package error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create package'
        });
    }
};

/**
 * Update subscription package
 */
exports.updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            name_ar,
            slug,
            description,
            description_ar,
            monthlyPrice,
            sixMonthPrice,
            annualPrice,
            limits,
            platformCommission,
            displayOrder,
            isActive,
            isFeatured
        } = req.body;
        
        const package = await db.SubscriptionPackage.findByPk(id);
        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }
        
        // If slug is changing, check uniqueness
        if (slug && slug !== package.slug) {
            const existing = await db.SubscriptionPackage.findOne({
                where: { slug, id: { [Op.ne]: id } }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'A package with this slug already exists'
                });
            }
        }
        
        // Update package
        await package.update({
            name: name || package.name,
            name_ar: name_ar || package.name_ar,
            slug: slug || package.slug,
            description: description !== undefined ? description : package.description,
            description_ar: description_ar !== undefined ? description_ar : package.description_ar,
            monthlyPrice: monthlyPrice !== undefined ? monthlyPrice : package.monthlyPrice,
            sixMonthPrice: sixMonthPrice !== undefined ? sixMonthPrice : package.sixMonthPrice,
            annualPrice: annualPrice !== undefined ? annualPrice : package.annualPrice,
            limits: limits || package.limits,
            platformCommission: platformCommission !== undefined ? platformCommission : package.platformCommission,
            displayOrder: displayOrder !== undefined ? displayOrder : package.displayOrder,
            isActive: isActive !== undefined ? isActive : package.isActive,
            isFeatured: isFeatured !== undefined ? isFeatured : package.isFeatured,
            updatedBy: req.adminId
        });
        
        // Log activity
        await db.ActivityLog.create({
            entityType: 'package',
            entityId: package.id,
            action: 'updated',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName || 'Super Admin',
            details: {
                packageName: package.name,
                changes: Object.keys(req.body)
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        res.json({
            success: true,
            message: 'Package updated successfully',
            package
        });
    } catch (error) {
        console.error('Update package error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update package'
        });
    }
};

/**
 * Delete subscription package
 */
exports.deletePackage = async (req, res) => {
    try {
        const { id } = req.params;
        
        const package = await db.SubscriptionPackage.findByPk(id);
        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }
        
        // Check if any tenants are using this package
        const activeSubscriptions = await db.TenantSubscription.count({
            where: {
                packageId: id,
                status: { [Op.in]: ['active', 'trial'] }
            }
        });
        
        if (activeSubscriptions > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete package. ${activeSubscriptions} tenant(s) are currently using it. Please deactivate instead.`
            });
        }
        
        // Log activity before deletion
        await db.ActivityLog.create({
            entityType: 'package',
            entityId: package.id,
            action: 'deleted',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName || 'Super Admin',
            details: {
                packageName: package.name,
                slug: package.slug
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        await package.destroy();
        
        res.json({
            success: true,
            message: 'Package deleted successfully'
        });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete package'
        });
    }
};

/**
 * Get package statistics
 */
exports.getPackageStats = async (req, res) => {
    try {
        const stats = await db.SubscriptionPackage.findAll({
            attributes: [
                'id',
                'name',
                'slug',
                [db.sequelize.fn('COUNT', db.sequelize.col('subscriptions.id')), 'totalSubscriptions'],
                [db.sequelize.fn('SUM', 
                    db.sequelize.literal(`CASE WHEN subscriptions.status = 'active' THEN 1 ELSE 0 END`)
                ), 'activeSubscriptions'],
                [db.sequelize.fn('SUM', 
                    db.sequelize.literal(`CASE WHEN subscriptions.status = 'trial' THEN 1 ELSE 0 END`)
                ), 'trialSubscriptions']
            ],
            include: [
                {
                    model: db.TenantSubscription,
                    as: 'subscriptions',
                    attributes: [],
                    required: false
                }
            ],
            group: ['SubscriptionPackage.id'],
            raw: true
        });
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Package stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch package statistics'
        });
    }
};

