/**
 * Featured Tenants Routes
 */

const express = require('express');
const router = express.Router();
const featuredController = require('../controllers/featuredController');
const { authenticateTenant } = require('../middleware/authTenant');

// Public routes
router.get('/featured-tenants', featuredController.getFeaturedTenants);

// Tenant routes
router.get('/tenant/featured-status', authenticateTenant, featuredController.getTenantFeaturedStatus);

module.exports = router;
