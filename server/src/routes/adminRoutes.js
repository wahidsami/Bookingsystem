const express = require('express');
const router = express.Router();

const { authenticateSuperAdmin, requirePermission } = require('../middleware/authSuperAdmin');
const adminTenantsController = require('../controllers/adminTenantsController');
const adminUsersController = require('../controllers/adminUsersController');
const adminStatsController = require('../controllers/adminStatsController');
const adminPackagesController = require('../controllers/adminPackagesController');
const adminSettingsController = require('../controllers/adminSettingsController');
const adminFinancialController = require('../controllers/adminFinancialController');

// All routes require super admin authentication
router.use(authenticateSuperAdmin);

// ===== FINANCIAL REPORTING =====
router.get('/financial/dashboard', adminFinancialController.getDashboardOverview);
router.get('/financial/summary', adminFinancialController.getPlatformSummary);
router.get('/financial/tenants', adminFinancialController.getTenantFinancials);
router.get('/financial/leaderboard', adminFinancialController.getTenantLeaderboard);
router.get('/financial/monthly-comparison', adminFinancialController.getMonthlyComparison);
router.get('/financial/commission-breakdown', adminFinancialController.getCommissionByPlan);
router.get('/financial/top-employees', adminFinancialController.getTopEmployees);
router.get('/financial/transactions/:tenantId', adminFinancialController.getTransactionDetails);
router.get('/financial/employee-metrics/:tenantId', adminFinancialController.getTenantEmployeeMetrics);

// ===== DASHBOARD STATS =====
router.get('/stats/dashboard', adminStatsController.getDashboardStats);
router.get('/stats/activities', adminStatsController.getRecentActivities);
router.get('/stats/charts', adminStatsController.getChartData);

// ===== TENANTS MANAGEMENT =====
router.get('/tenants', requirePermission('tenants', 'view'), adminTenantsController.listTenants);
router.get('/tenants/pending', requirePermission('tenants', 'approve'), adminTenantsController.getPendingTenants);
router.get('/tenants/:id', requirePermission('tenants', 'view'), adminTenantsController.getTenantDetails);
router.get('/tenants/:id/activities', requirePermission('tenants', 'view'), adminTenantsController.getTenantActivities);
router.put('/tenants/:id', requirePermission('tenants', 'edit'), adminTenantsController.updateTenant);
router.post('/tenants/:id/approve', requirePermission('tenants', 'approve'), adminTenantsController.approveTenant);
router.post('/tenants/:id/reject', requirePermission('tenants', 'approve'), adminTenantsController.rejectTenant);
router.post('/tenants/:id/suspend', requirePermission('tenants', 'edit'), adminTenantsController.suspendTenant);
router.post('/tenants/:id/activate', requirePermission('tenants', 'edit'), adminTenantsController.activateTenant);

// ===== USERS MANAGEMENT =====
router.get('/users', requirePermission('users', 'view'), adminUsersController.listUsers);
router.get('/users/:id', requirePermission('users', 'view'), adminUsersController.getUserDetails);
router.put('/users/:id', requirePermission('users', 'edit'), adminUsersController.updateUser);
router.post('/users/:id/toggle-status', requirePermission('users', 'edit'), adminUsersController.toggleUserStatus);
router.post('/users/:id/adjust-balance', requirePermission('users', 'edit'), adminUsersController.adjustUserBalance);

// ===== SUBSCRIPTION PACKAGES =====
router.get('/packages', requirePermission('settings', 'view'), adminPackagesController.listPackages);
router.get('/packages/stats', requirePermission('settings', 'view'), adminPackagesController.getPackageStats);
router.get('/packages/:id', requirePermission('settings', 'view'), adminPackagesController.getPackage);
router.post('/packages', requirePermission('settings', 'edit'), adminPackagesController.createPackage);
router.put('/packages/:id', requirePermission('settings', 'edit'), adminPackagesController.updatePackage);
router.delete('/packages/:id', requirePermission('settings', 'edit'), adminPackagesController.deletePackage);

// ===== GLOBAL SETTINGS =====
router.get('/settings', requirePermission('settings', 'view'), adminSettingsController.getSettings);
router.put('/settings', requirePermission('settings', 'edit'), adminSettingsController.updateSettings);

module.exports = router;

