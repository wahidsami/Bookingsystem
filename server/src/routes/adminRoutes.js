const express = require('express');
const router = express.Router();

const { authenticateSuperAdmin, requirePermission } = require('../middleware/authSuperAdmin');
const adminTenantsController = require('../controllers/adminTenantsController');
const adminUsersController = require('../controllers/adminUsersController');
const adminStatsController = require('../controllers/adminStatsController');
const adminPackagesController = require('../controllers/adminPackagesController');
const adminSettingsController = require('../controllers/adminSettingsController');
const adminBillsController = require('../controllers/adminBillsController');
const adminNotificationsController = require('../controllers/adminNotificationsController');
const adminFinancialController = require('../controllers/adminFinancialController');
const adminReportBuilderController = require('../controllers/adminReportBuilderController');
const adminCategoryController = require('../controllers/adminCategoryController');
const adminFeaturePricingController = require('../controllers/adminFeaturePricingController');
const adminGiftCardPackageController = require('../controllers/adminGiftCardPackageController');
const customerInvoiceController = require('../controllers/customerInvoiceController');

// All routes require super admin authentication
router.use(authenticateSuperAdmin);

// ===== FINANCIAL REPORTING =====
router.get('/bills/:id', requirePermission('financial', 'view'), adminBillsController.getBillDetails);
router.get('/financial/invoices', requirePermission('financial', 'view'), adminBillsController.listBills);
router.get('/bills/:id/invoice-pdf', requirePermission('financial', 'view'), adminBillsController.getInvoicePdf);
router.get('/bills/:id/receipt-pdf', requirePermission('financial', 'view'), adminBillsController.getReceiptPdf);
router.post('/bills/:id/reconcile-payment', requirePermission('financial', 'refund'), adminBillsController.reconcileBillPayment);
router.post('/bills/:id/void', requirePermission('financial', 'refund'), adminBillsController.voidBill);
router.get('/financial/dashboard', adminFinancialController.getDashboardOverview);
router.get('/financial/summary', adminFinancialController.getPlatformSummary);
router.get('/financial/comparison', requirePermission('financial', 'view'), adminFinancialController.getFinancialComparison);
router.get('/financial/insights', requirePermission('financial', 'view'), adminFinancialController.getOperationalInsights);
router.get('/financial/tenants', adminFinancialController.getTenantFinancials);
router.get('/financial/leaderboard', adminFinancialController.getTenantLeaderboard);
router.get('/financial/monthly-comparison', adminFinancialController.getMonthlyComparison);
router.get('/financial/commission-breakdown', adminFinancialController.getCommissionByPlan);
router.get('/financial/commission-by-package', adminFinancialController.getCommissionByPackage);
router.get('/financial/revenue-by-type', adminFinancialController.getRevenueByType);
router.get('/financial/bills-summary', adminFinancialController.getBillsSummary);
router.get('/financial/reports/general', requirePermission('financial', 'view'), adminFinancialController.getGeneralReport);
router.get('/financial/reports/detailed', requirePermission('financial', 'view'), adminFinancialController.getDetailedReport);
router.get('/financial/reports/builder/options', requirePermission('financial', 'view'), adminReportBuilderController.getReportBuilderOptions);
router.post('/financial/reports/builder/preview', requirePermission('financial', 'view'), adminReportBuilderController.previewReport);
router.get('/financial/reports/builder/saved', requirePermission('financial', 'view'), adminReportBuilderController.getSavedReports);
router.get('/financial/reports/builder/saved/:id', requirePermission('financial', 'view'), adminReportBuilderController.getSavedReport);
router.post('/financial/reports/builder/saved', requirePermission('financial', 'edit'), adminReportBuilderController.createSavedReport);
router.put('/financial/reports/builder/saved/:id', requirePermission('financial', 'edit'), adminReportBuilderController.updateSavedReport);
router.delete('/financial/reports/builder/saved/:id', requirePermission('financial', 'delete'), adminReportBuilderController.deleteSavedReport);
router.post('/financial/reports/builder/saved/:id/run', requirePermission('financial', 'view'), adminReportBuilderController.runSavedReport);
router.post('/financial/reports/builder/saved/:id/deliver', requirePermission('financial', 'view'), adminReportBuilderController.deliverSavedReport);
router.get('/financial/reports/builder/saved/:id/preview', requirePermission('financial', 'view'), adminReportBuilderController.previewSavedReport);
router.get('/financial/reports/builder/saved/:id/history', requirePermission('financial', 'view'), adminReportBuilderController.getSavedReportHistory);
router.get('/financial/customer-invoices', requirePermission('financial', 'view'), customerInvoiceController.listAdminInvoices);
router.get('/financial/customer-invoices/:id', requirePermission('financial', 'view'), customerInvoiceController.getAdminInvoiceById);
router.get('/financial/customer-invoices/:id/invoice-pdf', requirePermission('financial', 'view'), customerInvoiceController.getAdminInvoicePdf);
router.get('/financial/customer-invoices/:id/receipt-pdf', requirePermission('financial', 'view'), customerInvoiceController.getAdminReceiptPdf);
router.get('/financial/top-employees', adminFinancialController.getTopEmployees);
router.get('/financial/transactions/:tenantId', adminFinancialController.getTransactionDetails);
router.get('/financial/employee-metrics/:tenantId', adminFinancialController.getTenantEmployeeMetrics);
router.get('/financial/drilldown', requirePermission('financial', 'view'), adminFinancialController.getAnalyticsDrilldown);

// ===== DASHBOARD STATS =====
router.get('/stats/dashboard', adminStatsController.getDashboardStats);
router.get('/stats/activities', adminStatsController.getRecentActivities);
router.get('/stats/charts', adminStatsController.getChartData);

// ===== NOTIFICATIONS =====
router.get('/notifications', adminNotificationsController.listNotifications);
router.get('/notifications/unread-count', adminNotificationsController.getUnreadCount);
router.patch('/notifications/:id/read', adminNotificationsController.markNotificationAsRead);
router.patch('/notifications/read-all', adminNotificationsController.markAllNotificationsAsRead);

// ===== TENANTS MANAGEMENT =====
router.get('/tenants', requirePermission('tenants', 'view'), adminTenantsController.listTenants);
router.get('/tenants/pending', requirePermission('tenants', 'approve'), adminTenantsController.getPendingTenants);
router.get('/tenants/:id', requirePermission('tenants', 'view'), adminTenantsController.getTenantDetails);
router.get('/tenants/:tenantId/bills', requirePermission('tenants', 'view'), adminBillsController.getTenantBills);
router.get('/tenants/:id/activities', requirePermission('tenants', 'view'), adminTenantsController.getTenantActivities);
router.put('/tenants/:id', requirePermission('tenants', 'edit'), adminTenantsController.updateTenant);
router.post('/tenants/:id/approve', requirePermission('tenants', 'approve'), adminTenantsController.approveTenant);
router.post('/tenants/:id/resend-payment-email', requirePermission('tenants', 'edit'), adminTenantsController.resendTenantPaymentEmail);
router.post('/tenants/:id/reject', requirePermission('tenants', 'approve'), adminTenantsController.rejectTenant);
router.post('/tenants/:id/request-more-info', requirePermission('tenants', 'approve'), adminTenantsController.requestMoreInfo);
router.post('/tenants/:id/suspend', requirePermission('tenants', 'edit'), adminTenantsController.suspendTenant);
router.post('/tenants/:id/activate', requirePermission('tenants', 'edit'), adminTenantsController.activateTenant);
router.delete('/tenants/:id', requirePermission('tenants', 'delete'), adminTenantsController.deleteTenant);

// ===== USERS MANAGEMENT =====
router.get('/users', requirePermission('users', 'view'), adminUsersController.listUsers);
router.get('/users/:id', requirePermission('users', 'view'), adminUsersController.getUserDetails);
router.get('/users/:id/invoices', requirePermission('users', 'view'), customerInvoiceController.listAdminUserInvoices);
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

// ===== SERVICE CATEGORIES =====
router.get('/categories', requirePermission('settings', 'view'), adminCategoryController.listCategories);
router.post('/categories', requirePermission('settings', 'edit'), adminCategoryController.createCategory);
router.put('/categories/reorder', requirePermission('settings', 'edit'), adminCategoryController.reorderCategories);
router.put('/categories/:id', requirePermission('settings', 'edit'), adminCategoryController.updateCategory);
router.delete('/categories/:id', requirePermission('settings', 'edit'), adminCategoryController.deleteCategory);

// ===== FEATURE PRICING =====
router.get('/feature-pricing', requirePermission('settings', 'view'), adminFeaturePricingController.getFeaturePricings);
router.put('/feature-pricing/:key', requirePermission('settings', 'edit'), adminFeaturePricingController.updateFeaturePricing);

// ===== GIFT CARD PACKAGES =====
router.get('/gift-packages', requirePermission('settings', 'view'), adminGiftCardPackageController.listGiftPackages);
router.get('/gift-packages/:id', requirePermission('settings', 'view'), adminGiftCardPackageController.getGiftPackage);
router.post('/gift-packages', requirePermission('settings', 'edit'), adminGiftCardPackageController.uploadGiftCardImageOptional, adminGiftCardPackageController.createGiftPackage);
router.put('/gift-packages/:id', requirePermission('settings', 'edit'), adminGiftCardPackageController.uploadGiftCardImageOptional, adminGiftCardPackageController.updateGiftPackage);
router.delete('/gift-packages/:id', requirePermission('settings', 'edit'), adminGiftCardPackageController.deleteGiftPackage);
router.get('/gift-transactions', requirePermission('settings', 'view'), adminGiftCardPackageController.listGiftTransactions);
router.get('/gift-transactions/report', requirePermission('settings', 'view'), adminGiftCardPackageController.getGiftTransactionsReport);
router.get('/gift-transactions/report.csv', requirePermission('settings', 'view'), adminGiftCardPackageController.exportGiftTransactionsReportCsv);
router.get('/gift-redemptions/report', requirePermission('settings', 'view'), adminGiftCardPackageController.getGiftRedemptionsReport);

module.exports = router;

