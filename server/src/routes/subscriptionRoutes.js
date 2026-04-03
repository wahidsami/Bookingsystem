const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticateTenant } = require('../middleware/authTenant');

// Public routes (no authentication required)
// Get available packages for registration/browsing
router.get('/packages', subscriptionController.getAvailablePackages);

// All routes below require tenant authentication
router.use(authenticateTenant);

// Get current subscription
router.get('/current', subscriptionController.getCurrentSubscription);

// Get usage statistics
router.get('/usage', subscriptionController.getUsageStats);

// Get package consumption table and near-limit alerts
router.get('/consumption', subscriptionController.getConsumption);

// Get usage alerts
router.get('/alerts', subscriptionController.getUsageAlerts);

// Acknowledge alert
router.patch('/alerts/:alertId/acknowledge', subscriptionController.acknowledgeAlert);

// Request subscription change (upgrade/downgrade)
router.post('/change-request', subscriptionController.requestSubscriptionChange);
router.post('/request-upgrade', subscriptionController.requestUpgrade);

module.exports = router;

