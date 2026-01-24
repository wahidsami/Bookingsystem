const userAuthService = require('../services/userAuthService');
const db = require('../models');

/**
 * Middleware to authenticate platform users via JWT
 */
const authenticateUser = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided. Please login.'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer '

        // Verify token
        const decoded = userAuthService.verifyToken(token);

        // Get user from database
        const user = await db.PlatformUser.findByPk(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive'
            });
        }

        // Check if user is banned
        if (user.isBanned) {
            return res.status(403).json({
                success: false,
                message: 'Account is banned'
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = user.id;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            error: error.message
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = userAuthService.verifyToken(token);
            const user = await db.PlatformUser.findByPk(decoded.userId);

            if (user && user.isActive && !user.isBanned) {
                req.user = user;
                req.userId = user.id;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

/**
 * Check if email is verified
 */
const requireEmailVerified = (req, res, next) => {
    if (!req.user.emailVerified) {
        return res.status(403).json({
            success: false,
            message: 'Please verify your email first'
        });
    }
    next();
};

/**
 * Check if phone is verified
 */
const requirePhoneVerified = (req, res, next) => {
    if (!req.user.phoneVerified) {
        return res.status(403).json({
            success: false,
            message: 'Please verify your phone number first'
        });
    }
    next();
};

module.exports = {
    authenticateUser,
    optionalAuth,
    requireEmailVerified,
    requirePhoneVerified
};
