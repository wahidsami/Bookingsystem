/**
 * Public Routes
 * No authentication required - for public tenant websites
 */

const express = require('express');
const router = express.Router();
const publicTenantController = require('../controllers/publicTenantController');

// Get all active tenants (for browse/discovery)
router.get('/tenants', publicTenantController.getAllTenants);

// Get tenant by slug
router.get('/tenant/:slug', publicTenantController.getTenantBySlug);

// Get public page data
router.get('/tenant/:tenantId/page-data', publicTenantController.getPublicPageData);

// Services
router.get('/tenant/:tenantId/services', publicTenantController.getPublicServices);
// Staff by service - MUST come before /services/:id to avoid route conflict
router.get('/tenant/:tenantId/services/:serviceId/staff', publicTenantController.getPublicStaffByService);
router.get('/tenant/:tenantId/services/:id', publicTenantController.getPublicService);

// Products
router.get('/tenant/:tenantId/products', publicTenantController.getPublicProducts);
router.get('/tenant/:tenantId/products/:id', publicTenantController.getPublicProduct);

// Staff
router.get('/tenant/:tenantId/staff', publicTenantController.getPublicStaff);

// Bookings (public, no auth)
router.post('/tenant/:tenantId/bookings', publicTenantController.createPublicBooking);

// Orders (public, no auth)
router.post('/tenant/:tenantId/orders', publicTenantController.createPublicOrder);

// Contact form
router.post('/tenant/:tenantId/contact', publicTenantController.submitContactForm);

module.exports = router;

