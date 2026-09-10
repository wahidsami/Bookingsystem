/**
 * Audit Controller
 * 
 * Handles API requests for viewing ActivityLog records.
 */

const db = require('../models');
const { Op } = require('sequelize');

const buildListFilters = (query, baseWhere = {}) => {
    const { 
        entityType,
        entityId,
        action, 
        performedByType,
        performedById,
        operationId,
        correlationId,
        from, 
        to
    } = query;

    const where = { ...baseWhere };

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (performedByType) where.performedByType = performedByType;
    if (performedById) where.performedById = performedById;
    if (operationId) where.operationId = operationId;
    if (correlationId) where.correlationId = correlationId;

    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt[Op.gte] = new Date(from);
        if (to) where.createdAt[Op.lte] = new Date(to);
    }

    return where;
};

/**
 * Super Admin: List all audit logs
 * GET /api/v1/admin/audit
 */
exports.listAdminAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, tenantId, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
        const offset = (page - 1) * limit;

        const baseWhere = tenantId ? { tenantId } : {};
        const where = buildListFilters(req.query, baseWhere);
        
        // Safe sorting
        const safeSortBy = ['createdAt', 'action', 'entityType'].includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        const { count, rows: logs } = await db.ActivityLog.findAndCountAll({
            where,
            order: [[safeSortBy, safeSortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            attributes: { exclude: ['details', 'previousValue', 'newValue'] } // Lightweight list
        });

        res.json({
            success: true,
            logs,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('List Admin Audit Logs Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
};

/**
 * Super Admin: Get audit log details
 * GET /api/v1/admin/audit/:id
 */
exports.getAdminAuditLogDetails = async (req, res) => {
    try {
        const log = await db.ActivityLog.findByPk(req.params.id);
        if (!log) {
            return res.status(404).json({ success: false, message: 'Audit log not found.' });
        }
        res.json({ success: true, log });
    } catch (error) {
        console.error('Get Admin Audit Log Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch audit log.' });
    }
};

/**
 * Super Admin: Get entity history
 * GET /api/v1/admin/audit/entity/:entityType/:entityId
 */
exports.getAdminEntityHistory = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { limit = 50 } = req.query;

        const logs = await db.ActivityLog.findAll({
            where: { entityType, entityId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get Admin Entity History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch entity history.' });
    }
};

/**
 * Super Admin: Get operation history
 * GET /api/v1/admin/audit/operation/:operationId
 */
exports.getAdminOperationHistory = async (req, res) => {
    try {
        const { operationId } = req.params;
        const { limit = 50 } = req.query;

        const logs = await db.ActivityLog.findAll({
            where: { operationId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get Admin Operation History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch operation history.' });
    }
};

/**
 * Super Admin: Get correlation history
 * GET /api/v1/admin/audit/correlation/:correlationId
 */
exports.getAdminCorrelationHistory = async (req, res) => {
    try {
        const { correlationId } = req.params;
        const { limit = 50 } = req.query;

        const logs = await db.ActivityLog.findAll({
            where: { correlationId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get Admin Correlation History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch correlation history.' });
    }
};

/**
 * Tenant: List tenant's audit logs
 * GET /api/v1/tenant/audit
 */
exports.listTenantAuditLogs = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.tenantId;
        if (!tenantId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
        const offset = (page - 1) * limit;
        
        const where = buildListFilters(req.query, { tenantId });
        
        const safeSortBy = ['createdAt', 'action', 'entityType'].includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        const { count, rows: logs } = await db.ActivityLog.findAndCountAll({
            where,
            order: [[safeSortBy, safeSortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            attributes: { exclude: ['details', 'previousValue', 'newValue'] }
        });

        res.json({
            success: true,
            logs,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('List Tenant Audit Logs Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
};

/**
 * Tenant: Get single audit log details
 * GET /api/v1/tenant/audit/:id
 */
exports.getTenantAuditLogDetails = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.tenantId;
        const log = await db.ActivityLog.findOne({
            where: { id: req.params.id, tenantId }
        });
        
        if (!log) {
            return res.status(404).json({ success: false, message: 'Audit log not found.' });
        }
        res.json({ success: true, log });
    } catch (error) {
        console.error('Get Tenant Audit Log Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch audit log.' });
    }
};

/**
 * Tenant: Get entity history
 * GET /api/v1/tenant/audit/entity/:entityType/:entityId
 */
exports.getTenantEntityHistory = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.tenantId;
        const { entityType, entityId } = req.params;
        const { limit = 50 } = req.query;

        const logs = await db.ActivityLog.findAll({
            where: { tenantId, entityType, entityId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get Tenant Entity History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch entity history.' });
    }
};

/**
 * Tenant: Get operation history
 * GET /api/v1/tenant/audit/operation/:operationId
 */
exports.getTenantOperationHistory = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.tenantId;
        const { operationId } = req.params;
        const { limit = 50 } = req.query;

        const logs = await db.ActivityLog.findAll({
            where: { tenantId, operationId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get Tenant Operation History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch operation history.' });
    }
};

/**
 * Tenant: Get correlation history
 * GET /api/v1/tenant/audit/correlation/:correlationId
 */
exports.getTenantCorrelationHistory = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.tenantId;
        const { correlationId } = req.params;
        const { limit = 50 } = req.query;

        const logs = await db.ActivityLog.findAll({
            where: { tenantId, correlationId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get Tenant Correlation History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch correlation history.' });
    }
};
