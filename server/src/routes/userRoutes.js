const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const paymentMethodController = require('../controllers/paymentMethodController');
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

// Payment Methods
router.get('/payment-methods', authenticateUser, paymentMethodController.getPaymentMethods);
router.post('/payment-methods', authenticateUser, paymentMethodController.addPaymentMethod);
router.put('/payment-methods/:id/set-default', authenticateUser, paymentMethodController.setDefaultPaymentMethod);
router.delete('/payment-methods/:id', authenticateUser, paymentMethodController.deletePaymentMethod);

module.exports = router;

