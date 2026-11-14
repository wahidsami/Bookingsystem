/**
 * Tenant Payment Routes
 * Handle in-person payment recording, bank transfer verification, and financial adjustments
 */

const express = require('express');
const router = express.Router();
const tenantPaymentController = require('../controllers/tenantPaymentController');
const { authenticateTenant } = require('../middleware/authTenant');

// All routes require tenant authentication
router.get('/tenant/appointments/:id/payment', authenticateTenant, tenantPaymentController.getPaymentSummary);
router.post('/tenant/appointments/:id/record-payment', authenticateTenant, tenantPaymentController.recordPayment);
router.post('/tenant/appointments/:id/refund', authenticateTenant, tenantPaymentController.refundPayment);

// Bank-transfer verification lifecycle
router.get('/tenant/appointments/:id/bank-transfers', authenticateTenant, tenantPaymentController.listBankTransfers);
router.post('/tenant/appointments/:id/bank-transfers/:transactionId/verify', authenticateTenant, tenantPaymentController.verifyBankTransfer);
router.post('/tenant/appointments/:id/bank-transfers/:transactionId/reject', authenticateTenant, tenantPaymentController.rejectBankTransfer);

// Authorized Auditable Financial Exception / Adjustment
router.post('/tenant/appointments/:id/financial-exception', authenticateTenant, tenantPaymentController.applyFinancialException);

module.exports = router;
