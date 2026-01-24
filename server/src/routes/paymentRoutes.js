const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateUser } = require('../middleware/authUser');
const { paymentLimiter } = require('../middleware/rateLimiter');

// Process payment for booking - with rate limiting
router.post('/process', authenticateUser, paymentLimiter, paymentController.processPayment);

// Top up wallet - with rate limiting
router.post('/wallet/topup', authenticateUser, paymentLimiter, paymentController.topUpWallet);

// Get payment history
router.get('/history', authenticateUser, paymentController.getPaymentHistory);

module.exports = router;

