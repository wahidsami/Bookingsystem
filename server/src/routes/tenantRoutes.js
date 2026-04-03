/**
 * Tenant Routes
 * Routes for tenant profile and dashboard management
 */

const express = require('express');
const router = express.Router();
const tenantAuthController = require('../controllers/tenantAuthController');
const tenantDashboardController = require('../controllers/tenantDashboardController');
const tenantEmployeeController = require('../controllers/tenantEmployeeController');
const tenantProductController = require('../controllers/tenantProductController');
const tenantServiceController = require('../controllers/tenantServiceController');
const tenantAppointmentController = require('../controllers/tenantAppointmentController');
const tenantFinancialController = require('../controllers/tenantFinancialController');
const tenantCustomerController = require('../controllers/tenantCustomerController');
const tenantOrderController = require('../controllers/tenantOrderController');
const tenantSettingsController = require('../controllers/tenantSettingsController');
const tenantReportsController = require('../controllers/tenantReportsController');
const tenantPublicPageController = require('../controllers/tenantPublicPageController');
const tenantScheduleController = require('../controllers/tenantScheduleController');
const tenantRegistrationController = require('../controllers/tenantRegistrationController');
const tenantBillsController = require('../controllers/tenantBillsController');
const tenantPosController = require('../controllers/tenantPosController');
const tenantMessagesController = require('../controllers/tenantMessagesController');
const tenantPayrollController = require('../controllers/tenantPayrollController');
const tenantNotificationController = require('../controllers/tenantNotificationController');
const aiController = require('../controllers/tenant/aiController');
const { authenticateTenant, checkTenantFeature } = require('../middleware/authTenant');
const {
    requireActiveSubscription,
    checkResourceLimit
} = require('../middleware/checkSubscription');
const multer = require('multer');
const path = require('path');

// Configure multer for settings uploads
const settingsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/tenants'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${req.tenant.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const settingsUpload = multer({ storage: settingsStorage });

// All routes require authentication
router.use(authenticateTenant);

// Onboarding: resubmit after more_info_required
router.put('/resubmit-request', tenantRegistrationController.resubmitRequest);

// Profile management
router.get('/profile', tenantAuthController.getProfile);
router.put('/profile', tenantAuthController.updateProfile);

// Dashboard stats and data
router.get('/dashboard/stats', tenantDashboardController.getDashboardStats);
router.get('/dashboard/todays-appointments', tenantDashboardController.getTodaysAppointments);
router.get('/dashboard/revenue-chart', tenantDashboardController.getRevenueChartData);

// Employee management
router.get('/employees', tenantEmployeeController.getEmployees);
router.get('/employees/:id', tenantEmployeeController.getEmployee);
router.get('/employees/:id/permissions', tenantEmployeeController.getEmployeePermissions);
router.post(
    '/employees',
    requireActiveSubscription,
    checkResourceLimit('staff'),
    tenantEmployeeController.uploadPhoto,
    tenantEmployeeController.createEmployee
);
router.put('/employees/:id', tenantEmployeeController.uploadPhoto, tenantEmployeeController.updateEmployee);
router.put('/employees/:id/permissions', tenantEmployeeController.updateEmployeePermissions);
router.put('/employees/:id/app-access', tenantEmployeeController.updateEmployeeAppAccess);
router.post('/employees/:id/send-invite', tenantEmployeeController.sendEmployeeInvite);
router.post('/employees/:id/reset-password', tenantEmployeeController.resetEmployeePassword);
router.delete('/employees/:id', tenantEmployeeController.deleteEmployee);

// Product management
router.get('/products', checkTenantFeature('hasProductsAndOrders'), tenantProductController.getProducts);
router.get('/products/:id', checkTenantFeature('hasProductsAndOrders'), tenantProductController.getProduct);
router.post(
    '/products',
    checkTenantFeature('hasProductsAndOrders'),
    requireActiveSubscription,
    checkResourceLimit('product'),
    tenantProductController.uploadImages,
    tenantProductController.createProduct
);
router.put('/products/:id', checkTenantFeature('hasProductsAndOrders'), tenantProductController.uploadImages, tenantProductController.updateProduct);
router.delete('/products/:id', checkTenantFeature('hasProductsAndOrders'), tenantProductController.deleteProduct);

// Service management
router.get('/services', tenantServiceController.getServices);
router.get('/services/categories', tenantServiceController.getServiceCategories);
router.get('/services/:id', tenantServiceController.getService);
router.post(
    '/services',
    requireActiveSubscription,
    checkResourceLimit('service'),
    tenantServiceController.uploadImage,
    tenantServiceController.createService
);
router.put('/services/:id', tenantServiceController.uploadImage, tenantServiceController.updateService);
router.delete('/services/:id', tenantServiceController.deleteService);

// Appointment management
router.get('/appointments', tenantAppointmentController.getAppointments);
router.get('/appointments/calendar', tenantAppointmentController.getCalendarAppointments);
router.get('/appointments/stats', tenantAppointmentController.getAppointmentStats);
router.get('/appointments/:id', tenantAppointmentController.getAppointment);
router.patch('/appointments/:id/status', tenantAppointmentController.updateAppointmentStatus);
router.patch('/appointments/:id/payment', tenantAppointmentController.updatePaymentStatus);
router.patch('/appointments/:id/reschedule', tenantAppointmentController.rescheduleAppointment);

// Financial management
router.get('/financial/overview', tenantFinancialController.getFinancialOverview);
router.get('/financial/employees', tenantFinancialController.getEmployeeRevenue);
router.get('/financial/employees/:id', tenantFinancialController.getEmployeeFinancialDetails);
router.get('/financial/services', tenantFinancialController.getServiceRevenue);
router.get('/financial/products', tenantFinancialController.getProductRevenue);
router.get('/financial/daily', tenantFinancialController.getDailyRevenue);

// Customer management
router.get('/customers', tenantCustomerController.getCustomers);
router.get('/customers/stats', tenantCustomerController.getCustomerStats);
router.get('/customers/export', tenantCustomerController.exportCustomers);
router.get('/customers/:id', tenantCustomerController.getCustomer);
router.get('/customers/:id/history', tenantCustomerController.getCustomerHistory);
router.patch('/customers/:id/notes', tenantCustomerController.updateCustomerNotes);

// Order management
router.get('/orders', checkTenantFeature('hasProductsAndOrders'), tenantOrderController.getOrders);
router.get('/orders/:id', checkTenantFeature('hasProductsAndOrders'), tenantOrderController.getOrder);
router.patch('/orders/:id/status', checkTenantFeature('hasProductsAndOrders'), tenantOrderController.updateOrderStatus);
router.patch('/orders/:id/payment', checkTenantFeature('hasProductsAndOrders'), tenantOrderController.updatePaymentStatus);

// Billing
router.get('/bills/current-unpaid', tenantBillsController.getCurrentUnpaidBill);
router.get('/bills', tenantBillsController.getBills);
router.get('/bills/:id', tenantBillsController.getBillDetails);
router.get('/bills/:id/invoice-pdf', tenantBillsController.getInvoicePdf);
router.get('/bills/:id/receipt-pdf', tenantBillsController.getReceiptPdf);

// POS / Collections
router.get('/pos/queue', tenantPosController.getCollectionQueue);
router.get('/pos/alerts', tenantPosController.getOperationalAlerts);
router.get('/pos/transactions', tenantPosController.getTransactions);
router.get('/pos/transactions/:id/receipt-pdf', tenantPosController.downloadTransactionReceiptPdf);
router.get('/pos/closing', tenantPosController.getClosingSummary);
router.get('/pos/closing/export', tenantPosController.exportClosingSummaryCsv);

// Messaging
router.get('/messages', checkTenantFeature('hasInternalMessaging'), tenantMessagesController.getMessages);
router.post('/messages', checkTenantFeature('hasInternalMessaging'), tenantMessagesController.sendMessage);
router.delete('/messages/:id', checkTenantFeature('hasInternalMessaging'), tenantMessagesController.deleteMessage);

// Payroll
router.get('/payroll', checkTenantFeature('payroll'), tenantPayrollController.getPayrollRecords);
router.post('/payroll/generate', checkTenantFeature('payroll'), tenantPayrollController.generatePayroll);
router.put('/payroll/:id/status', checkTenantFeature('payroll'), tenantPayrollController.updatePayrollStatus);

// Reviews
router.get('/reviews', tenantPayrollController.getAllReviews);
router.patch('/reviews/:id', tenantPayrollController.updateReview);

// Customer push notifications
router.get('/notifications/usage', checkTenantFeature('inAppMarketingNotifications'), tenantNotificationController.getPushUsage);
router.post('/notifications/send', checkTenantFeature('inAppMarketingNotifications'), tenantNotificationController.sendMarketingPush);
router.get('/notifications/history', checkTenantFeature('inAppMarketingNotifications'), tenantNotificationController.getPushHistory);
router.get('/notifications/history/:id', checkTenantFeature('inAppMarketingNotifications'), tenantNotificationController.getPushHistoryDetail);
router.get('/notifications/history/:id/recipients', checkTenantFeature('inAppMarketingNotifications'), tenantNotificationController.getPushHistoryRecipients);

// Settings management
router.get('/settings/limits', tenantSettingsController.getSubscriptionLimits);
router.get('/settings', tenantSettingsController.getSettings);
router.put('/settings/business', tenantSettingsController.updateBusinessInfo);
router.put('/settings/working-hours', tenantSettingsController.updateWorkingHours);
router.put('/settings/booking', tenantSettingsController.updateBookingSettings);
router.put('/settings/notifications', tenantSettingsController.updateNotificationSettings);
router.put('/settings/payment', tenantSettingsController.updatePaymentSettings);
router.put('/settings/localization', tenantSettingsController.updateLocalizationSettings);
router.put('/settings/appearance', tenantSettingsController.updateAppearanceSettings);
router.post('/settings/logo', settingsUpload.single('logo'), tenantSettingsController.uploadLogo);
router.post('/settings/cover', settingsUpload.single('coverImage'), tenantSettingsController.uploadCoverImage);

// Reports and analytics
router.get('/reports/summary', checkTenantFeature('reports'), tenantReportsController.getDashboardSummary);
router.get('/reports/full', checkTenantFeature('reports'), tenantReportsController.getFullReport);
router.get('/reports/booking-trends', checkTenantFeature('reports'), tenantReportsController.getBookingTrends);
router.get('/reports/service-performance', checkTenantFeature('reports'), tenantReportsController.getServicePerformance);
router.get('/reports/employee-performance', checkTenantFeature('reports'), tenantReportsController.getEmployeePerformance);
router.get('/reports/peak-hours', checkTenantFeature('reports'), tenantReportsController.getPeakHoursAnalysis);
router.get('/reports/customer-analytics', checkTenantFeature('reports'), tenantReportsController.getCustomerAnalytics);

// Public Page Data
router.get('/public-page', checkTenantFeature('publicPageCustomization'), tenantPublicPageController.getPublicPageData);
router.put('/public-page', checkTenantFeature('publicPageCustomization'), tenantPublicPageController.uploadMiddleware, tenantPublicPageController.updatePublicPageData);
router.put('/public-page/hero-slider', checkTenantFeature('publicPageCustomization'), tenantPublicPageController.uploadMiddleware, tenantPublicPageController.updateHeroSlider);

// Schedule Management (Phase 3)
// Shifts
router.get('/employees/:id/shifts', tenantScheduleController.getShifts);
router.post('/employees/:id/shifts', tenantScheduleController.createShift);
router.put('/employees/:id/shifts/:shiftId', tenantScheduleController.updateShift);
router.delete('/employees/:id/shifts/:shiftId', tenantScheduleController.deleteShift);

// Breaks
router.get('/employees/:id/breaks', tenantScheduleController.getBreaks);
router.post('/employees/:id/breaks', tenantScheduleController.createBreak);
router.put('/employees/:id/breaks/:breakId', tenantScheduleController.updateBreak);
router.delete('/employees/:id/breaks/:breakId', tenantScheduleController.deleteBreak);

// Time Off
router.get('/employees/:id/time-off', tenantScheduleController.getTimeOff);
router.post('/employees/:id/time-off', tenantScheduleController.createTimeOff);
router.put('/employees/:id/time-off/:timeOffId', tenantScheduleController.updateTimeOff);
router.delete('/employees/:id/time-off/:timeOffId', tenantScheduleController.deleteTimeOff);

// Schedule Overrides
router.get('/employees/:id/overrides', tenantScheduleController.getOverrides);
router.post('/employees/:id/overrides', tenantScheduleController.createOverride);
router.put('/employees/:id/overrides/:overrideId', tenantScheduleController.updateOverride);
router.delete('/employees/:id/overrides/:overrideId', tenantScheduleController.deleteOverride);

// AI helper
router.post('/ai/generate-product', checkTenantFeature('hasAIContentAssistant'), aiController.generateProduct);
router.post('/ai/generate-service', checkTenantFeature('hasAIContentAssistant'), aiController.generateService);
router.post('/ai/generate-about-us', checkTenantFeature('hasAIContentAssistant'), aiController.generateAboutUs);
router.post('/ai/translate', checkTenantFeature('hasAIContentAssistant'), aiController.translateText);

module.exports = router;
