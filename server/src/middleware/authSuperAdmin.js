const jwt = require('jsonwebtoken');
const db = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'rifah-super-admin-secret-key-2024';

/**
 * Authenticate Super Admin
 * Verifies JWT token and attaches admin info to request
 */
const authenticateSuperAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check token type
        if (decoded.type !== 'super_admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token type'
            });
        }

        // Find admin and verify still active
        const admin = await db.SuperAdmin.findByPk(decoded.adminId);

        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Admin not found or deactivated'
            });
        }

        // Attach admin info to request
        req.adminId = admin.id;
        req.adminEmail = admin.email;
        req.adminRole = admin.role;
        req.adminPermissions = admin.permissions;
        req.adminName = `${admin.firstName} ${admin.lastName}`;

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        console.error('Super Admin auth error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

/**
 * Check specific permission
 */
const requirePermission = (resource, action) => {
    return (req, res, next) => {
        const permissions = req.adminPermissions;

        // Super admin has all permissions
        if (req.adminRole === 'super_admin') {
            return next();
        }

        // Check specific permission
        if (permissions && permissions[resource] && permissions[resource][action]) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: `Permission denied: ${action} on ${resource}`
        });
    };
};

/**
 * Require super_admin role
 */
const requireSuperAdmin = (req, res, next) => {
    if (req.adminRole !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Super Admin access required'
        });
    }
    next();
};

module.exports = {
    authenticateSuperAdmin,
    requirePermission,
    requireSuperAdmin
};

