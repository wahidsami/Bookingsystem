/**
 * Tenant Authentication Routes
 * Routes for tenant login, logout, and token management
 */

const express = require('express');
const router = express.Router();
const tenantAuthController = require('../controllers/tenantAuthController');
const tenantRegistrationController = require('../controllers/tenantRegistrationController');
const { authenticateTenant } = require('../middleware/authTenant');
const { passwordResetLimiter } = require('../middleware/rateLimiter');

// Public routes (no authentication required)
router.post('/register', tenantRegistrationController.uploadMiddleware, tenantRegistrationController.register);
router.post('/login', tenantAuthController.login);
router.post('/refresh-token', tenantAuthController.refreshToken);
router.post('/forgot-password', passwordResetLimiter, tenantAuthController.forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, tenantAuthController.resetPassword);

// Protected routes (authentication required)
router.post('/logout', authenticateTenant, tenantAuthController.logout);
router.post('/change-password', authenticateTenant, tenantAuthController.changePassword);

module.exports = router;

