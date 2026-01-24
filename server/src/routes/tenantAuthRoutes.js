/**
 * Tenant Authentication Routes
 * Routes for tenant login, logout, and token management
 */

const express = require('express');
const router = express.Router();
const tenantAuthController = require('../controllers/tenantAuthController');
const tenantRegistrationController = require('../controllers/tenantRegistrationController');
const { authenticateTenant } = require('../middleware/authTenant');

// Public routes (no authentication required)
router.post('/register', tenantRegistrationController.uploadMiddleware, tenantRegistrationController.register);
router.post('/login', tenantAuthController.login);
router.post('/refresh-token', tenantAuthController.refreshToken);

// Protected routes (authentication required)
router.post('/logout', authenticateTenant, tenantAuthController.logout);

module.exports = router;

