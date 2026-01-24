/**
 * Rate Limiting Middleware
 * Protects API endpoints from brute force and abuse attacks
 */
const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
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
    max: 5, // 5 attempts per window
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
    max: 3, // 3 attempts per window
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
    max: 10, // 10 attempts per window
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
    max: 5, // 5 attempts per window
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
    max: 5, // 5 attempts per window
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
    max: 20, // 20 uploads per window
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
