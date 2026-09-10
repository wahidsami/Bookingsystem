/**
 * Audit Service
 * 
 * Canonical writer for ActivityLog.
 * - Extracts context identifiers (requestId, operationId, correlationId).
 * - Applies audit sanitization to all metadata (details, previousValue, newValue).
 * - Uses the provided explicit Sequelize transaction (does NOT use ambient transactions).
 */

const db = require('../models');
const auditSanitizer = require('../utils/auditSanitizer');
const { getOperationId } = require('../middleware/operationContext');

/**
 * Logs an activity into the database securely and immutably.
 * 
 * @param {Object} payload - The audit data.
 * @param {String} payload.tenantId
 * @param {String} payload.entityType
 * @param {String} payload.entityId
 * @param {String} payload.action
 * @param {String} payload.performedByType
 * @param {String} payload.performedById
 * @param {String} payload.performedByName
 * @param {Object} [payload.details]
 * @param {Object} [payload.previousValue]
 * @param {Object} [payload.newValue]
 * @param {String} [payload.ipAddress]
 * @param {String} [payload.userAgent]
 * @param {Object} options - Options containing request context and explicit transaction.
 * @param {Object} [options.request] - The Express request object to extract IDs.
 * @param {Object} [options.transaction] - The explicit Sequelize transaction.
 * @returns {Promise<Object>} The created ActivityLog instance.
 */
async function logActivity(payload, options = {}) {
    const { request, transaction } = options;

    // 1. Context Identifier Extraction
    let requestId = null;
    let correlationId = null;

    if (request) {
        requestId = request.requestId || null;
        correlationId = request.supportContext?.correlationId || null;
        
        // Auto-fill IP/UserAgent if not provided
        if (!payload.ipAddress) {
            payload.ipAddress = request.ip || request.headers?.['x-forwarded-for'];
        }
        if (!payload.userAgent) {
            payload.userAgent = request.headers?.['user-agent'];
        }
    }

    const operationId = getOperationId() || (request?.supportContext?.operationId) || null;

    // 2. Sanitization
    const safeDetails = payload.details ? auditSanitizer.sanitize(payload.details) : {};
    const safePrevious = payload.previousValue ? auditSanitizer.sanitize(payload.previousValue) : null;
    const safeNew = payload.newValue ? auditSanitizer.sanitize(payload.newValue) : null;

    // 3. Persistence
    return await db.ActivityLog.create({
        tenantId: payload.tenantId || null,
        entityType: payload.entityType,
        entityId: payload.entityId || null,
        action: payload.action,
        performedByType: payload.performedByType,
        performedById: payload.performedById || null,
        performedByName: payload.performedByName || null,
        details: safeDetails,
        previousValue: safePrevious,
        newValue: safeNew,
        ipAddress: payload.ipAddress || null,
        userAgent: payload.userAgent || null,
        requestId: requestId,
        operationId: operationId,
        correlationId: correlationId
    }, {
        transaction: transaction // Explicitly use the supplied transaction (or undefined)
    });
}

module.exports = {
    logActivity
};
