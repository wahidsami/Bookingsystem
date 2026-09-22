'use strict';

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Tenant Resource Controller
 * Handles CRUD and management of Resource Types and Resource Instances.
 * Enforces strict tenant isolation on all queries and mutations.
 */
const tenantResourceController = {
    /**
     * List all resource types for authenticated tenant
     * GET /api/v1/tenant/resource-types
     */
    getResourceTypes: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized tenant' });
            }

            const { isActive, search } = req.query;
            const whereClause = { tenantId };

            if (isActive !== undefined) {
                whereClause.is_active = isActive === 'true' || isActive === true;
            }

            if (search && typeof search === 'string' && search.trim()) {
                const term = `%${search.trim()}%`;
                whereClause[Op.or] = [
                    { name_en: { [Op.iLike]: term } },
                    { name_ar: { [Op.iLike]: term } }
                ];
            }

            const resourceTypes = await db.ResourceType.findAll({
                where: whereClause,
                order: [['createdAt', 'ASC']],
                include: [
                    {
                        model: db.Resource,
                        as: 'resources',
                        attributes: ['id', 'name_en', 'name_ar', 'is_active'],
                        required: false
                    }
                ]
            });

            const formatted = resourceTypes.map(type => {
                const plain = type.toJSON();
                const resources = plain.resources || [];
                return {
                    ...plain,
                    resourcesCount: resources.length,
                    activeResourcesCount: resources.filter(r => r.is_active).length
                };
            });

            return res.status(200).json({
                success: true,
                resourceTypes: formatted,
                total: formatted.length
            });
        } catch (error) {
            console.error('Error fetching tenant resource types:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve resource types',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Get single resource type by ID
     * GET /api/v1/tenant/resource-types/:id
     */
    getResourceType: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;

            const resourceType = await db.ResourceType.findOne({
                where: { id, tenantId },
                include: [
                    {
                        model: db.Resource,
                        as: 'resources',
                        order: [['name_en', 'ASC']]
                    }
                ]
            });

            if (!resourceType) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource type not found'
                });
            }

            const plain = resourceType.toJSON();
            const resources = plain.resources || [];

            return res.status(200).json({
                success: true,
                resourceType: {
                    ...plain,
                    resourcesCount: resources.length,
                    activeResourcesCount: resources.filter(r => r.is_active).length
                }
            });
        } catch (error) {
            console.error('Error fetching resource type:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve resource type',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Create a new resource type
     * POST /api/v1/tenant/resource-types
     */
    createResourceType: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized tenant' });
            }

            const { name_en, name_ar, is_active } = req.body;

            const trimmedEn = `${name_en ?? ''}`.trim();
            const trimmedAr = `${name_ar ?? ''}`.trim();

            if (!trimmedEn || !trimmedAr) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource type name in both English and Arabic is required'
                });
            }

            // Check duplicate name within same tenant
            const existing = await db.ResourceType.findOne({
                where: {
                    tenantId,
                    [Op.or]: [
                        { name_en: { [Op.iLike]: trimmedEn } },
                        { name_ar: { [Op.iLike]: trimmedAr } }
                    ]
                }
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: 'A resource type with this name already exists for your salon'
                });
            }

            const resourceType = await db.ResourceType.create({
                tenantId,
                name_en: trimmedEn,
                name_ar: trimmedAr,
                is_active: is_active !== undefined ? (is_active === true || is_active === 'true') : true
            });

            return res.status(201).json({
                success: true,
                message: 'Resource type created successfully',
                resourceType
            });
        } catch (error) {
            console.error('Error creating resource type:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create resource type',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Update an existing resource type
     * PUT /api/v1/tenant/resource-types/:id
     */
    updateResourceType: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;
            const { name_en, name_ar, is_active } = req.body;

            const resourceType = await db.ResourceType.findOne({
                where: { id, tenantId }
            });

            if (!resourceType) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource type not found'
                });
            }

            if (name_en !== undefined) {
                const trimmedEn = `${name_en}`.trim();
                if (!trimmedEn) {
                    return res.status(400).json({ success: false, message: 'English name cannot be empty' });
                }
                resourceType.name_en = trimmedEn;
            }

            if (name_ar !== undefined) {
                const trimmedAr = `${name_ar}`.trim();
                if (!trimmedAr) {
                    return res.status(400).json({ success: false, message: 'Arabic name cannot be empty' });
                }
                resourceType.name_ar = trimmedAr;
            }

            if (is_active !== undefined) {
                resourceType.is_active = is_active === true || is_active === 'true';
            }

            await resourceType.save();

            return res.status(200).json({
                success: true,
                message: 'Resource type updated successfully',
                resourceType
            });
        } catch (error) {
            console.error('Error updating resource type:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update resource type',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Delete or deactivate resource type
     * DELETE /api/v1/tenant/resource-types/:id
     * Mandatory Safeguard #1: Prefers safe deactivation if resources exist
     */
    deleteResourceType: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;

            const resourceType = await db.ResourceType.findOne({
                where: { id, tenantId }
            });

            if (!resourceType) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource type not found'
                });
            }

            // Check if there are attached resources or service requirements
            const resourceCount = await db.Resource.count({ where: { resourceTypeId: id } });
            const requirementCount = await db.ServiceResourceRequirement.count({ where: { resourceTypeId: id } });

            if (resourceCount > 0 || requirementCount > 0) {
                // Safely deactivate instead of breaking references
                resourceType.is_active = false;
                await resourceType.save();

                return res.status(200).json({
                    success: true,
                    message: 'Resource type has linked resources or requirements and was safely deactivated',
                    deactivated: true
                });
            }

            // Unreferenced: Safe to hard delete
            await resourceType.destroy();

            return res.status(200).json({
                success: true,
                message: 'Resource type deleted successfully',
                deleted: true
            });
        } catch (error) {
            console.error('Error deleting resource type:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete resource type',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * List all resources (instances) for authenticated tenant
     * GET /api/v1/tenant/resources
     */
    getResources: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized tenant' });
            }

            const { resourceTypeId, isActive, search } = req.query;
            const whereClause = { tenantId };

            if (resourceTypeId) {
                whereClause.resourceTypeId = resourceTypeId;
            }

            if (isActive !== undefined) {
                whereClause.is_active = isActive === 'true' || isActive === true;
            }

            if (search && typeof search === 'string' && search.trim()) {
                const term = `%${search.trim()}%`;
                whereClause[Op.or] = [
                    { name_en: { [Op.iLike]: term } },
                    { name_ar: { [Op.iLike]: term } }
                ];
            }

            const resources = await db.Resource.findAll({
                where: whereClause,
                order: [['createdAt', 'ASC']],
                include: [
                    {
                        model: db.ResourceType,
                        as: 'resourceType',
                        attributes: ['id', 'name_en', 'name_ar', 'is_active']
                    }
                ]
            });

            return res.status(200).json({
                success: true,
                resources,
                total: resources.length
            });
        } catch (error) {
            console.error('Error fetching tenant resources:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve resources',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Get single resource by ID
     * GET /api/v1/tenant/resources/:id
     */
    getResource: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;

            const resource = await db.Resource.findOne({
                where: { id, tenantId },
                include: [
                    {
                        model: db.ResourceType,
                        as: 'resourceType',
                        attributes: ['id', 'name_en', 'name_ar', 'is_active']
                    }
                ]
            });

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            return res.status(200).json({
                success: true,
                resource
            });
        } catch (error) {
            console.error('Error fetching resource:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve resource',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Create a new resource instance
     * POST /api/v1/tenant/resources
     */
    createResource: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized tenant' });
            }

            const { resourceTypeId, name_en, name_ar, is_active } = req.body;

            const trimmedEn = `${name_en ?? ''}`.trim();
            const trimmedAr = `${name_ar ?? ''}`.trim();

            if (!trimmedEn || !trimmedAr) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource name in both English and Arabic is required'
                });
            }

            if (!resourceTypeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource type ID is required'
                });
            }

            // CRITICAL SAFEGUARD: Verify resourceTypeId belongs to the authenticated tenant
            const resourceType = await db.ResourceType.findOne({
                where: { id: resourceTypeId, tenantId }
            });

            if (!resourceType) {
                return res.status(400).json({
                    success: false,
                    message: 'The selected resource type does not exist or does not belong to your salon'
                });
            }

            // Check duplicate name within the same resource type
            const existing = await db.Resource.findOne({
                where: {
                    tenantId,
                    resourceTypeId,
                    [Op.or]: [
                        { name_en: { [Op.iLike]: trimmedEn } },
                        { name_ar: { [Op.iLike]: trimmedAr } }
                    ]
                }
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: 'A resource with this name already exists in this resource category'
                });
            }

            const resource = await db.Resource.create({
                tenantId,
                resourceTypeId,
                name_en: trimmedEn,
                name_ar: trimmedAr,
                is_active: is_active !== undefined ? (is_active === true || is_active === 'true') : true
            });

            await resource.reload({
                include: [
                    {
                        model: db.ResourceType,
                        as: 'resourceType',
                        attributes: ['id', 'name_en', 'name_ar', 'is_active']
                    }
                ]
            });

            return res.status(201).json({
                success: true,
                message: 'Resource instance created successfully',
                resource
            });
        } catch (error) {
            console.error('Error creating resource:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create resource',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Update an existing resource instance
     * PUT /api/v1/tenant/resources/:id
     */
    updateResource: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;
            const { resourceTypeId, name_en, name_ar, is_active } = req.body;

            const resource = await db.Resource.findOne({
                where: { id, tenantId }
            });

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            if (resourceTypeId !== undefined) {
                const resourceType = await db.ResourceType.findOne({
                    where: { id: resourceTypeId, tenantId }
                });
                if (!resourceType) {
                    return res.status(400).json({
                        success: false,
                        message: 'The selected resource type does not exist or does not belong to your salon'
                    });
                }
                resource.resourceTypeId = resourceTypeId;
            }

            if (name_en !== undefined) {
                const trimmedEn = `${name_en}`.trim();
                if (!trimmedEn) {
                    return res.status(400).json({ success: false, message: 'English name cannot be empty' });
                }
                resource.name_en = trimmedEn;
            }

            if (name_ar !== undefined) {
                const trimmedAr = `${name_ar}`.trim();
                if (!trimmedAr) {
                    return res.status(400).json({ success: false, message: 'Arabic name cannot be empty' });
                }
                resource.name_ar = trimmedAr;
            }

            if (is_active !== undefined) {
                resource.is_active = is_active === true || is_active === 'true';
            }

            await resource.save();

            await resource.reload({
                include: [
                    {
                        model: db.ResourceType,
                        as: 'resourceType',
                        attributes: ['id', 'name_en', 'name_ar', 'is_active']
                    }
                ]
            });

            return res.status(200).json({
                success: true,
                message: 'Resource updated successfully',
                resource
            });
        } catch (error) {
            console.error('Error updating resource:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update resource',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Delete or deactivate resource instance
     * DELETE /api/v1/tenant/resources/:id
     * Mandatory Safeguard #1: Prefers safe deactivation
     */
    deleteResource: async (req, res) => {
        try {
            const tenantId = req.tenantId || req.tenant?.id;
            const { id } = req.params;

            const resource = await db.Resource.findOne({
                where: { id, tenantId }
            });

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            // Check if resource is allocated in any appointment
            const allocationCount = await db.AppointmentResource.count({ where: { resourceId: id } });

            if (allocationCount > 0) {
                // Safeguard: Do not hard delete if historically allocated
                resource.is_active = false;
                await resource.save();

                return res.status(200).json({
                    success: true,
                    message: 'Resource has historical bookings and was safely deactivated',
                    deactivated: true
                });
            }

            // Unreferenced: Safe to hard delete or deactivate
            await resource.destroy();

            return res.status(200).json({
                success: true,
                message: 'Resource deleted successfully',
                deleted: true
            });
        } catch (error) {
            console.error('Error deleting resource:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete resource',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = tenantResourceController;
