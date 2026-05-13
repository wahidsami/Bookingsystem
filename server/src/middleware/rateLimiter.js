/**
 * Rate Limiting Middleware
 * Protects API endpoints from brute force and abuse attacks
 */
const rateLimit = require('express-rate-limit');

const parseLimit = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseLimit(process.env.RATE_LIMIT_GENERAL_MAX, 300),
    skip: (req) => {
        const path = `${req.originalUrl || req.url || ''}`;
        const hasAuthHeader = typeof req.headers?.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');

        // Tenant dashboard and subscription widgets can burst many small requests.
        // We handle those with tenant-scoped middleware after authentication.
        if (hasAuthHeader && (path.startsWith('/api/v1/tenant/') || path.startsWith('/api/v1/subscription/'))) {
            return true;
        }

        return false;
    },
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false // Disable X-RateLimit-* headers
});

/**
 * Authentication rate limiter
 * Limits: 5 attempts per 15 minutes per IP
 * Prevents brute force attacks on login/register
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseLimit(process.env.RATE_LIMIT_AUTH_MAX, process.env.NODE_ENV === 'production' ? 10 : 50),
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again after 15 minutes.'
    },
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Password reset rate limiter
 * Limits: 3 attempts per hour per IP
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseLimit(process.env.RATE_LIMIT_PASSWORD_RESET_MAX, 3),
    message: {
        success: false,
        message: 'Too many password reset attempts. Please try again later.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Payment rate limiter
 * Limits: 10 payment attempts per 30 minutes per user
 * More generous but still protective
 */
const paymentLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: parseLimit(process.env.RATE_LIMIT_PAYMENT_MAX, 10),
    message: {
        success: false,
        message: 'Too many payment attempts. Please try again later.'
    },
    skip: (req, res) => {
        // Default store is memory - this is safe for development
        return false;
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Email verification rate limiter
 * Limits: 5 attempts per hour per IP
 */
const emailVerificationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseLimit(process.env.RATE_LIMIT_EMAIL_VERIFICATION_MAX, 5),
    message: {
        success: false,
        message: 'Too many email verification attempts. Please try again later.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Phone verification rate limiter
 * Limits: 5 attempts per hour per user
 */
const phoneVerificationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseLimit(process.env.RATE_LIMIT_PHONE_VERIFICATION_MAX, 5),
    message: {
        success: false,
        message: 'Too many phone verification attempts. Please try again later.'
    },
    skip: (req, res) => {
        // Allow if request successful
        return res.statusCode < 400;
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * File upload rate limiter
 * Limits: 20 uploads per hour per user
 */
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseLimit(process.env.RATE_LIMIT_UPLOAD_MAX, 20),
    message: {
        success: false,
        message: 'Too many file uploads. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Create endpoint-specific rate limiter
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Rate limit middleware
 */
const createLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    return rateLimit({
        windowMs,
        max: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: 'Too many requests. Please try again later.'
        }
    });
};

module.exports = {
    generalLimiter,
    authLimiter,
    passwordResetLimiter,
    paymentLimiter,
    emailVerificationLimiter,
    phoneVerificationLimiter,
    uploadLimiter,
    createLimiter
};
