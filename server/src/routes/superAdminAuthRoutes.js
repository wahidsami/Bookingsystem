const express = require('express');
const router = express.Router();
const superAdminAuthController = require('../controllers/superAdminAuthController');
const { authenticateSuperAdmin } = require('../middleware/authSuperAdmin');

// Public routes
router.post('/login', superAdminAuthController.login);
router.post('/refresh-token', superAdminAuthController.refreshToken);

// Protected routes
router.get('/profile', authenticateSuperAdmin, superAdminAuthController.getProfile);
router.post('/logout', authenticateSuperAdmin, superAdminAuthController.logout);
router.put('/change-password', authenticateSuperAdmin, superAdminAuthController.changePassword);

module.exports = router;

