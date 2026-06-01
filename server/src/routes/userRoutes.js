const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const paymentMethodController = require('../controllers/paymentMethodController');
const reviewController = require('../controllers/reviewController');
const userGiftController = require('../controllers/userGiftController');
const userTenantGiftController = require('../controllers/userTenantGiftController');
const customerInvoiceController = require('../controllers/customerInvoiceController');
const userWalletSummaryController = require('../controllers/userWalletSummaryController');
const { authenticateUser } = require('../middleware/authUser');

// Get user profile
router.get('/profile', authenticateUser, userController.getProfile);

// Update user profile
router.put('/profile', authenticateUser, userController.updateProfile);

// Upload profile photo
router.post('/profile/photo', authenticateUser, userController.uploadMiddleware, userController.uploadPhoto);

// Change password
router.put('/password', authenticateUser, userController.changePassword);

// Mobile push tokens
router.post('/push-token', authenticateUser, userController.registerPushToken);
router.delete('/push-token', authenticateUser, userController.unregisterPushToken);

// Customer notification inbox
router.get('/notifications', authenticateUser, userController.getNotifications);
router.get('/notifications/campaign/:campaignId', authenticateUser, userController.getNotificationByCampaign);
router.get('/notifications/:id', authenticateUser, userController.getNotificationDetail);
router.post('/notifications/:id/read', authenticateUser, userController.markNotificationRead);

// Get user bookings
router.get('/bookings', authenticateUser, userController.getUserBookings);

// Get services history
router.get('/services-history', authenticateUser, userController.getServicesHistory);
router.post('/reviews', authenticateUser, reviewController.createCustomerReview);
router.get('/reviews', authenticateUser, reviewController.getCustomerReviews);

// Payment Methods
router.get('/payment-methods', authenticateUser, paymentMethodController.getPaymentMethods);
router.post('/payment-methods', authenticateUser, paymentMethodController.addPaymentMethod);
router.put('/payment-methods/:id/set-default', authenticateUser, paymentMethodController.setDefaultPaymentMethod);
router.delete('/payment-methods/:id', authenticateUser, paymentMethodController.deletePaymentMethod);

// Gifts & wallet packages
router.get('/wallet/summary', authenticateUser, userWalletSummaryController.getWalletSummary);
router.get('/gifts/packages', authenticateUser, userGiftController.getGiftPackages);
router.post('/gifts/recharge', authenticateUser, userGiftController.rechargeFromGiftPackage);
router.get('/gifts/recipient-check', authenticateUser, userGiftController.checkGiftRecipient);
router.post('/gifts/send', authenticateUser, userGiftController.sendGiftPackage);
router.post('/gifts/claim', authenticateUser, userGiftController.claimGift);
router.get('/gifts/history', authenticateUser, userGiftController.listMyGiftTransactions);
router.get('/gifts/claim/open', userGiftController.openGiftClaimLink);

// Tenant-scoped gifts & wallet
router.post('/tenant-gifts/purchase', authenticateUser, userTenantGiftController.purchaseForSelf);
router.get('/tenant-gifts/recipient-check', authenticateUser, userTenantGiftController.checkTenantGiftRecipient);
router.post('/tenant-gifts/send', authenticateUser, userTenantGiftController.sendGift);
router.post('/tenant-gifts/claim', authenticateUser, userTenantGiftController.claimGift);
router.get('/tenant-gifts/history', authenticateUser, userTenantGiftController.listMyTenantGiftTransactions);
router.get('/tenant-gifts/wallet', authenticateUser, userTenantGiftController.getTenantWalletBalance);
router.get('/tenant-gifts/claim/open', userTenantGiftController.openGiftClaimLink);

// Customer commerce invoices
router.get('/invoices', authenticateUser, customerInvoiceController.listUserInvoices);
router.get('/invoices/:id', authenticateUser, customerInvoiceController.getUserInvoiceById);
router.get('/invoices/:id/invoice-pdf', authenticateUser, customerInvoiceController.getUserInvoicePdf);
router.get('/invoices/:id/receipt-pdf', authenticateUser, customerInvoiceController.getUserReceiptPdf);

module.exports = router;

