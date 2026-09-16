'use strict';

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Generate URL-friendly slug from string
 */
function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Controller for Services 2 Tenant-Owned Service Categories
 */
const tenantServiceCategoryController = {
    /**
     * List all categories for authenticated tenant
     * GET /api/v1/tenant/services2/categories
     */
    getCategories: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized tenant' });
            }

            const { search, isActive } = req.query;
            const whereClause = { tenantId };

            if (isActive !== undefined) {
                whereClause.isActive = isActive === 'true' || isActive === true;
            }

            if (search && typeof search === 'string' && search.trim()) {
                const term = `%${search.trim()}%`;
                whereClause[Op.or] = [
                    { name_en: { [Op.iLike]: term } },
                    { name_ar: { [Op.iLike]: term } },
                    { slug: { [Op.iLike]: term } }
                ];
            }

            const categories = await db.TenantServiceCategory.findAll({
                where: whereClause,
                order: [
                    ['sortOrder', 'ASC'],
                    ['name_en', 'ASC']
                ],
                include: [
                    {
                        model: db.Service,
                        as: 'services',
                        attributes: ['id', 'name_en', 'name_ar', 'finalPrice', 'duration', 'isActive'],
                        required: false
                    },
                    {
                        model: db.ServicePackage,
                        as: 'packages',
                        attributes: ['id', 'name_en', 'name_ar', 'totalPrice', 'totalDuration', 'isActive'],
                        required: false
                    }
                ]
            });

            // Map categories to include summary statistics
            const formatted = categories.map(cat => {
                const plain = cat.toJSON();
                return {
                    ...plain,
                    servicesCount: plain.services?.length || 0,
                    packagesCount: plain.packages?.length || 0,
                    totalItemsCount: (plain.services?.length || 0) + (plain.packages?.length || 0)
                };
            });

            return res.status(200).json({
                success: true,
                categories: formatted,
                total: formatted.length
            });
        } catch (error) {
            console.error('Error fetching tenant service categories:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve service categories',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Get single category by ID
     * GET /api/v1/tenant/services2/categories/:id
     */
    getCategory: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;

            const category = await db.TenantServiceCategory.findOne({
                where: { id, tenantId },
                include: [
                    {
                        model: db.Service,
                        as: 'services',
                        attributes: ['id', 'name_en', 'name_ar', 'finalPrice', 'duration', 'isActive']
                    },
                    {
                        model: db.ServicePackage,
                        as: 'packages',
                        attributes: ['id', 'name_en', 'name_ar', 'totalPrice', 'totalDuration', 'isActive']
                    }
                ]
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Service category not found'
                });
            }

            const plain = category.toJSON();
            return res.status(200).json({
                success: true,
                category: {
                    ...plain,
                    servicesCount: plain.services?.length || 0,
                    packagesCount: plain.packages?.length || 0
                }
            });
        } catch (error) {
            console.error('Error fetching category:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve category',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Create new tenant-owned category
     * POST /api/v1/tenant/services2/categories
     */
    createCategory: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized tenant' });
            }

            const {
                name_en,
                name_ar,
                description_en,
                description_ar,
                slug,
                icon,
                sortOrder,
                isActive
            } = req.body;

            if (!name_en || !name_en.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'English category name (name_en) is required'
                });
            }

            if (!name_ar || !name_ar.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Arabic category name (name_ar) is required'
                });
            }

            // Generate or sanitize slug
            let finalSlug = slugify(slug || name_en);
            if (!finalSlug) {
                finalSlug = `cat-${Date.now()}`;
            }

            // Ensure slug is unique per tenant
            let existingSlug = await db.TenantServiceCategory.findOne({
                where: { tenantId, slug: finalSlug }
            });

            if (existingSlug) {
                finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
            }

            // Determine sortOrder if not provided
            let finalSortOrder = typeof sortOrder === 'number' ? sortOrder : 0;
            if (sortOrder === undefined) {
                const maxSort = await db.TenantServiceCategory.max('sortOrder', {
                    where: { tenantId }
                });
                finalSortOrder = (Number(maxSort) || 0) + 1;
            }

            const category = await db.TenantServiceCategory.create({
                tenantId,
                name_en: name_en.trim(),
                name_ar: name_ar.trim(),
                description_en: description_en ? description_en.trim() : null,
                description_ar: description_ar ? description_ar.trim() : null,
                slug: finalSlug,
                icon: icon ? icon.trim() : null,
                sortOrder: finalSortOrder,
                isActive: isActive !== undefined ? Boolean(isActive) : true
            });

            return res.status(201).json({
                success: true,
                message: 'Tenant service category created successfully',
                category
            });
        } catch (error) {
            console.error('Error creating tenant service category:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create category',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Update category
     * PUT /api/v1/tenant/services2/categories/:id
     */
    updateCategory: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;

            const category = await db.TenantServiceCategory.findOne({
                where: { id, tenantId }
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Service category not found'
                });
            }

            const {
                name_en,
                name_ar,
                description_en,
                description_ar,
                slug,
                icon,
                sortOrder,
                isActive
            } = req.body;

            if (name_en !== undefined) {
                if (!name_en || !name_en.trim()) {
                    return res.status(400).json({ success: false, message: 'English name cannot be empty' });
                }
                category.name_en = name_en.trim();
            }

            if (name_ar !== undefined) {
                if (!name_ar || !name_ar.trim()) {
                    return res.status(400).json({ success: false, message: 'Arabic name cannot be empty' });
                }
                category.name_ar = name_ar.trim();
            }

            if (description_en !== undefined) {
                category.description_en = description_en ? description_en.trim() : null;
            }

            if (description_ar !== undefined) {
                category.description_ar = description_ar ? description_ar.trim() : null;
            }

            if (icon !== undefined) {
                category.icon = icon ? icon.trim() : null;
            }

            if (sortOrder !== undefined && typeof sortOrder === 'number') {
                category.sortOrder = sortOrder;
            }

            if (isActive !== undefined) {
                category.isActive = Boolean(isActive);
            }

            if (slug !== undefined) {
                let candidateSlug = slugify(slug);
                if (candidateSlug && candidateSlug !== category.slug) {
                    const slugConflict = await db.TenantServiceCategory.findOne({
                        where: {
                            tenantId,
                            slug: candidateSlug,
                            id: { [Op.ne]: id }
                        }
                    });
                    if (slugConflict) {
                        return res.status(400).json({
                            success: false,
                            message: `Category with slug "${candidateSlug}" already exists for this tenant`
                        });
                    }
                    category.slug = candidateSlug;
                }
            }

            await category.save();

            return res.status(200).json({
                success: true,
                message: 'Category updated successfully',
                category
            });
        } catch (error) {
            console.error('Error updating category:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update category',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Safely delete a category
     * DELETE /api/v1/tenant/services2/categories/:id
     * Enforces NON-DESTRUCTIVE safety: cannot delete if active services or packages belong to it
     */
    deleteCategory: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;

            const category = await db.TenantServiceCategory.findOne({
                where: { id, tenantId }
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Service category not found'
                });
            }

            // Safe Non-Destructive check: ensure no services or packages are bound to this category
            const [servicesCount, packagesCount] = await Promise.all([
                db.Service.count({
                    where: { tenantId, tenantServiceCategoryId: id }
                }),
                db.ServicePackage.count({
                    where: { tenantId, tenantServiceCategoryId: id }
                })
            ]);

            if (servicesCount > 0 || packagesCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete category containing active services or bundles. Please reassign or remove member items before deleting this category.',
                    counts: {
                        services: servicesCount,
                        packages: packagesCount
                    }
                });
            }

            await category.destroy();

            return res.status(200).json({
                success: true,
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting category:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete category',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = tenantServiceCategoryController;
