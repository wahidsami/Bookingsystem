/**
 * Tenant subscription payment (fake gateway) – payment link + pay
 * Auth: Bearer (tenant payment_pending) or query.token from email link
 */
const express = require('express');
const router = express.Router();
const tenantSubscriptionPaymentController = require('../controllers/tenantSubscriptionPaymentController');

router.use(tenantSubscriptionPaymentController.subscriptionPaymentAuth);

router.get('/payment', tenantSubscriptionPaymentController.getPaymentSession);
router.post('/pay', tenantSubscriptionPaymentController.submitPayment);

module.exports = router;
