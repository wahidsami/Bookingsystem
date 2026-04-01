'use strict';

const db = require('../models');
const { ServiceCategory } = db;

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[&]/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

exports.listCategories = async (req, res) => {
    try {
        const { includeHidden } = req.query;
        const where = includeHidden === 'true' ? {} : { isActive: true };

        const categories = await ServiceCategory.findAll({
            where,
            order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']]
        });

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Error listing categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list categories'
        });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name_en, name_ar, icon, sortOrder } = req.body;

        if (!name_en || !name_ar) {
            return res.status(400).json({
                success: false,
                message: 'Both English and Arabic names are required'
            });
        }

        const slug = slugify(name_en);
        const existing = await ServiceCategory.findOne({ where: { slug } });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'A category with a similar English name already exists'
            });
        }

        let finalSortOrder = sortOrder;
        if (finalSortOrder === undefined || finalSortOrder === null) {
            const maxSort = await ServiceCategory.max('sortOrder');
            finalSortOrder = (maxSort || 0) + 1;
        }

        const category = await ServiceCategory.create({
            name_en: name_en.trim(),
            name_ar: name_ar.trim(),
            slug,
            icon: icon || null,
            sortOrder: finalSortOrder,
            isActive: true
        });

        res.status(201).json({
            success: true,
            category
        });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create category'
        });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar, icon, sortOrder, isActive } = req.body;

        const category = await ServiceCategory.findByPk(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        if (name_en !== undefined) {
            category.name_en = name_en.trim();
            category.slug = slugify(name_en);
        }
        if (name_ar !== undefined) {
            category.name_ar = name_ar.trim();
        }
        if (icon !== undefined) {
            category.icon = icon;
        }
        if (sortOrder !== undefined) {
            category.sortOrder = sortOrder;
        }
        if (isActive !== undefined) {
            category.isActive = isActive;
        }

        await category.save();

        res.json({
            success: true,
            category
        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update category'
        });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { hard } = req.query;

        const category = await ServiceCategory.findByPk(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        if (hard === 'true') {
            await category.destroy();
            return res.json({
                success: true,
                message: 'Category permanently deleted'
            });
        }

        category.isActive = false;
        await category.save();

        res.json({
            success: true,
            message: 'Category hidden successfully'
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete category'
        });
    }
};

exports.reorderCategories = async (req, res) => {
    try {
        const { orderMap } = req.body;

        if (!Array.isArray(orderMap) || orderMap.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'orderMap array is required'
            });
        }

        await db.sequelize.transaction(async (transaction) => {
            for (const item of orderMap) {
                await ServiceCategory.update(
                    { sortOrder: item.sortOrder },
                    {
                        where: { id: item.id },
                        transaction
                    }
                );
            }
        });

        const categories = await ServiceCategory.findAll({
            order: [['sortOrder', 'ASC']]
        });

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Error reordering categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder categories'
        });
    }
};
