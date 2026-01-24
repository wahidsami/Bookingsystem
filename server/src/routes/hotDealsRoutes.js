/**
 * Hot Deals Routes
 */

const express = require('express');
const router = express.Router();
const hotDealsController = require('../controllers/hotDealsController');
const { authenticateTenant } = require('../middleware/authTenant');
const { authenticateSuperAdmin } = require('../middleware/authSuperAdmin');

// Public routes (for mobile app)
router.get('/hot-deals', hotDealsController.getActiveHotDeals);

// Tenant routes
router.get('/tenant/hot-deals/limits', authenticateTenant, hotDealsController.getHotDealsLimits);
router.get('/tenant/hot-deals', authenticateTenant, hotDealsController.getTenantHotDeals);
router.post('/tenant/hot-deals', authenticateTenant, hotDealsController.createHotDeal);
router.put('/tenant/hot-deals/:id', authenticateTenant, hotDealsController.updateHotDeal);
router.delete('/tenant/hot-deals/:id', authenticateTenant, hotDealsController.deleteHotDeal);

// Admin routes
router.get('/admin/hot-deals/pending', authenticateSuperAdmin, hotDealsController.getPendingHotDeals);
router.post('/admin/hot-deals/:id/approve', authenticateSuperAdmin, hotDealsController.approveHotDeal);
router.post('/admin/hot-deals/:id/reject', authenticateSuperAdmin, hotDealsController.rejectHotDeal);

module.exports = router;
