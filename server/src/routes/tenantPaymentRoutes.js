/**
 * Tenant Payment Routes
 * Handle in-person payment recording
 */

const express = require('express');
const router = express.Router();
const tenantPaymentController = require('../controllers/tenantPaymentController');
const { authenticateTenant } = require('../middleware/authTenant');

// All routes require tenant authentication
router.get('/tenant/appointments/:id/payment', authenticateTenant, tenantPaymentController.getPaymentSummary);
router.post('/tenant/appointments/:id/record-payment', authenticateTenant, tenantPaymentController.recordPayment);
router.post('/tenant/appointments/:id/refund', authenticateTenant, tenantPaymentController.refundPayment);

module.exports = router;
