/**
 * Hot Deals Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const hotDealsController = require('../controllers/hotDealsController');
const { authenticateTenant, checkTenantFeature } = require('../middleware/authTenant');
const { authenticateSuperAdmin } = require('../middleware/authSuperAdmin');

const hotDealImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/tenants/hot-deals');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const tenantId = req.tenant?.id || 'tenant';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${tenantId}-hot-deal-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const hotDealImageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/webp';

    if (mimetype && extname) {
        return cb(null, true);
    }

    return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed!'));
};

const hotDealUpload = multer({
    storage: hotDealImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: hotDealImageFilter
});

// Public routes (for mobile app)
router.get('/hot-deals', hotDealsController.getActiveHotDeals);

// Tenant routes
router.get('/tenant/hot-deals/limits', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealsController.getHotDealsLimits);
router.get('/tenant/hot-deals', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealsController.getTenantHotDeals);
router.get('/tenant/hot-deals/:id', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealsController.getTenantHotDealById);
router.post('/tenant/hot-deals', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealUpload.single('image'), hotDealsController.createHotDeal);
router.put('/tenant/hot-deals/:id', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealUpload.single('image'), hotDealsController.updateHotDeal);
router.post('/tenant/hot-deals/:id/pause', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealsController.pauseHotDeal);
router.post('/tenant/hot-deals/:id/resume', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealsController.resumeHotDeal);
router.delete('/tenant/hot-deals/:id', authenticateTenant, checkTenantFeature('maxHotDeals'), hotDealsController.deleteHotDeal);

// Admin routes
router.get('/admin/hot-deals', authenticateSuperAdmin, hotDealsController.getAdminHotDeals);
router.get('/admin/hot-deals/pending', authenticateSuperAdmin, hotDealsController.getPendingHotDeals);
router.post('/admin/hot-deals/:id/approve', authenticateSuperAdmin, hotDealsController.approveHotDeal);
router.post('/admin/hot-deals/:id/reject', authenticateSuperAdmin, hotDealsController.rejectHotDeal);

module.exports = router;
