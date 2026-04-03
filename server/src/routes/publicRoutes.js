/**
 * Public Routes
 * No authentication required - for public tenant websites
 */

const express = require('express');
const router = express.Router();
const publicTenantController = require('../controllers/publicTenantController');
const publicBillPaymentController = require('../controllers/publicBillPaymentController');
const { optionalAuth } = require('../middleware/authUser');

// Get all active tenants (for browse/discovery)
router.get('/tenants', publicTenantController.getAllTenants);
router.get('/providers/top', publicTenantController.getTopProviders);

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
router.get('/tenant/:tenantId/bookings/:bookingNumber/qr', publicTenantController.getBookingQrCode);

// Orders (public, no auth)
router.post('/tenant/:tenantId/orders', optionalAuth, publicTenantController.createPublicOrder);

// Contact form
router.post('/tenant/:tenantId/contact', publicTenantController.submitContactForm);

// Bill payment links
router.get('/bills/by-token/:token', publicBillPaymentController.getBillByToken);
router.get('/bills/by-token/:token/invoice-pdf', publicBillPaymentController.getInvoicePdfByToken);
router.get('/bills/by-token/:token/receipt-pdf', publicBillPaymentController.getReceiptPdfByToken);
router.post('/bills/by-token/:token/pay', publicBillPaymentController.payBillByToken);

module.exports = router;

