const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// Validate environment variables FIRST
const validateEnvironment = require('./middleware/validateEnvironment');
validateEnvironment();

const db = require('./models');
const redisService = require('./services/redisService');
const { getTenantDashboardBaseUrl } = require('./utils/url');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const parsedTrustProxy = Number.parseInt(process.env.TRUST_PROXY || '1', 10);
const trustProxyValue = Number.isNaN(parsedTrustProxy) ? process.env.TRUST_PROXY : parsedTrustProxy;
let server = null;
let expiryInterval = null;

app.disable('x-powered-by');
app.set('trust proxy', trustProxyValue);

// ========================================
// CORS Configuration - Environment-based
// ========================================
const getCorsOrigins = () => {
    const env = process.env.NODE_ENV || 'development';

    // Parse environment variable if it exists
    if (process.env.CORS_ORIGINS) {
        const parsed = process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
        if (parsed.length > 0) return parsed;
    }

    const defaultProdOrigins = [
        'https://rifah.sa',
        'https://www.rifah.sa',
        'https://admin.rifah.sa',
        'https://tenant.rifah.sa',
        'https://public.rifah.sa',
        'https://radmin.unifinitylab.com',
        'https://rtenant.unifinitylab.com'
    ];

    if (env === 'production') {
        return defaultProdOrigins;
    }

    // Development fallback (includes prod domains just in case NODE_ENV isn't set right)
    return [
        ...defaultProdOrigins,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3003',
        'http://127.0.0.1:3004'
    ];
};

// Initialize Redis
redisService.initRedis();

const PORT = process.env.PORT || 5000;

// Middleware - CORS with environment-based origins
app.use(cors({
    origin: getCorsOrigins(),
    credentials: true
}));

// Serve uploaded files FIRST (before helmet) with proper CORS headers
app.use('/uploads', (req, res, next) => {
    // Set CORS headers explicitly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.removeHeader('Cross-Origin-Resource-Policy'); // Remove if exists
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
}, express.static(path.join(__dirname, '../uploads'), {
    setHeaders: (res, filePath) => {
        // Ensure images are served with correct content type
        if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.gif')) {
            res.setHeader('Content-Type', 'image/gif');
        } else if (filePath.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp');
        }
        // Explicitly set CORP to cross-origin and remove any blocking headers
        res.removeHeader('Cross-Origin-Resource-Policy');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// Configure helmet AFTER static files - DISABLE CORP completely
// Only enable helmet in production, or configure it to not block images
if (isProduction) {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
            },
        },
        crossOriginResourcePolicy: false
    }));
} else {
    // Development: Use minimal helmet without CORP
    app.use(helmet({
        contentSecurityPolicy: false, // Disable CSP in dev
        crossOriginResourcePolicy: false
    }));
}

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// Rate limiting middleware
const {
    generalLimiter,
    authLimiter,
    passwordResetLimiter,
    paymentLimiter,
    uploadLimiter
} = require('./middleware/rateLimiter');

// Apply general rate limiting to all API requests
app.use('/api/v1/', generalLimiter);

// Routes
const userAuthRoutes = require('./routes/userAuthRoutes');
const tenantAuthRoutes = require('./routes/tenantAuthRoutes'); // New: Tenant auth
const bookingRoutes = require('./routes/bookingRoutes');
const staffRoutes = require('./routes/staffRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const tenantRoutes = require('./routes/tenantRoutes'); // Tenant dashboard APIs (protected)
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const superAdminAuthRoutes = require('./routes/superAdminAuthRoutes');
const adminRoutes = require('./routes/adminRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const adminSettingsController = require('./controllers/adminSettingsController');

// Apply strict auth limiting to user authentication
app.use('/api/v1/auth/user', authLimiter, userAuthRoutes); // End user auth
// Apply strict auth limiting to tenant authentication
app.use('/api/v1/auth/tenant', authLimiter, tenantAuthRoutes); // New: Tenant auth
// Apply strict auth limiting to admin authentication
app.use('/api/v1/auth/admin', authLimiter, superAdminAuthRoutes); // Super Admin auth
app.use('/api/v1/admin', adminRoutes); // Admin APIs
// Tenant subscription payment (link token or Bearer; must be before /api/v1/tenant)
app.use('/api/v1/tenant/subscription', require('./routes/tenantSubscriptionPaymentRoutes'));
app.use('/api/v1/tenant', tenantRoutes); // Tenant dashboard APIs (protected)
app.use('/api/v1', require('./routes/tenantPaymentRoutes'));
app.get('/api/v1/settings/global', adminSettingsController.getGlobalSettings); // Public global settings endpoint
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/orders', require('./routes/orderRoutes')); // Order management
app.use('/api/v1/subscription', subscriptionRoutes); // Subscription management (singular for authenticated routes)
app.use('/api/v1/subscriptions', subscriptionRoutes); // Subscription management (plural for public routes)

// Public routes (no authentication required)
const publicRoutes = require('./routes/publicRoutes');
app.use('/api/v1/public', publicRoutes);

// Hot Deals routes (public + tenant + admin)
const hotDealsRoutes = require('./routes/hotDealsRoutes');
app.use('/api/v1', hotDealsRoutes);

// Featured tenants routes
const featuredRoutes = require('./routes/featuredRoutes');
app.use('/api/v1', featuredRoutes);

// Public tenant listing (for client app discovery)
const publicTenantController = require('./controllers/publicTenantController');
app.get('/api/v1/tenants', publicTenantController.getAllTenants);
app.get('/api/v1/categories', publicTenantController.getPublicCategories);

// Cleanup routes (temporary - for one-time operations)
// Cleanup routes removed - one-time operations completed
// Health Check
app.get('/', (req, res) => {
    res.json({ message: 'Rifah API is running' });
});

if (!isProduction && process.env.ENABLE_DIAGNOSTIC_ROUTES === 'true') {
    app.get('/test-uploads', (req, res) => {
        const uploadsPath = path.join(__dirname, '../uploads');
        const fs = require('fs');

        try {
            const exists = fs.existsSync(uploadsPath);
            const files = exists ? fs.readdirSync(path.join(uploadsPath, 'profiles')) : [];
            res.json({
                uploadsPath,
                exists,
                files: files.slice(0, 5)
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to inspect uploads directory',
                uploadsPath
            });
        }
    });
}

// Create default super admin
const createDefaultSuperAdmin = async () => {
    try {
        const existingAdmin = await db.SuperAdmin.findOne({ where: { role: 'super_admin' } });
        if (existingAdmin) {
            return;
        }

        const shouldSeedDefaultSuperAdmin = process.env.ENABLE_DEFAULT_SUPER_ADMIN === 'true';

        if (!shouldSeedDefaultSuperAdmin) {
            console.warn('⚠️  No super admin exists. Set ENABLE_DEFAULT_SUPER_ADMIN=true with seed credentials to create one intentionally.');
            return;
        }

        const defaultAdminEmail = process.env.DEFAULT_SUPER_ADMIN_EMAIL;
        const defaultAdminPassword = process.env.DEFAULT_SUPER_ADMIN_PASSWORD;

        if (!defaultAdminEmail || !defaultAdminPassword) {
            throw new Error('DEFAULT_SUPER_ADMIN_EMAIL and DEFAULT_SUPER_ADMIN_PASSWORD are required when ENABLE_DEFAULT_SUPER_ADMIN=true');
        }

        if (defaultAdminPassword.length < 12) {
            throw new Error('DEFAULT_SUPER_ADMIN_PASSWORD must be at least 12 characters long');
        }

        await db.SuperAdmin.create({
            email: defaultAdminEmail.toLowerCase(),
            password: defaultAdminPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'super_admin',
            permissions: {
                tenants: { view: true, create: true, edit: true, delete: true, approve: true },
                users: { view: true, create: true, edit: true, delete: true },
                financial: { view: true, export: true, refund: true },
                settings: { view: true, edit: true }
            }
        });
        console.log(`✅ Default Super Admin created for ${defaultAdminEmail}`);
    } catch (error) {
        console.log('Super admin setup:', error.message);
    }
};

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Database Connection and Server Start
const startServer = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Sync models in dependency order
        await db.SuperAdmin.sync({ force: false });
        await db.ActivityLog.sync({ force: false });
        await db.AdminNotification.sync({ force: false });
        await db.GlobalSettings.sync({ force: false });

        // Subscription System (must be before Tenant sync for foreign keys)
        await db.SubscriptionPackage.sync({ force: false }); // Base packages
        await db.FeaturePricing.sync({ force: false }); // Package builder pricing master list
        await db.ServiceCategory.sync({ force: false }); // Global service categories

        await db.Tenant.sync({ force: false });

        // Subscription relationships (after Tenant)
        await db.TenantSubscription.sync({ force: false }); // Tenant subscriptions
        await db.Bill.sync({ force: false }); // Subscription invoices
        await db.TenantUsage.sync({ force: false }); // Usage tracking
        await db.UsageAlert.sync({ force: false }); // Usage alerts
        await db.TenantPushUsage.sync({ force: false }); // Marketing push quota usage
        await db.TenantPushCampaign.sync({ force: false }); // Marketing push campaign history
        await db.StaffMessage.sync({ force: false }); // Internal tenant-to-staff messages

        await db.PlatformUser.sync({ force: false }); // Must be before PaymentMethod, Transaction, CustomerInsight
        await db.PaymentMethod.sync({ force: false });
        await db.User.sync({ force: false });
        await db.Service.sync({ force: false });
        await db.Product.sync({ force: false }); // New: Product catalog
        await db.Customer.sync({ force: false });
        await db.Staff.sync({ force: false });
        await db.StaffPermission.sync({ force: false });
        await db.MobilePushToken.sync({ force: false });
        await db.ServiceEmployee.sync({ force: false }); // New: Service-Employee junction
        await db.StaffSchedule.sync({ force: false }); // Legacy schedule (kept for backward compatibility)
        // New scheduling models (Phase 3)
        try {
            await db.StaffShift.sync({ force: false });
        } catch (err) {
            console.warn('⚠️  StaffShift sync warning:', err.message);
        }
        try {
            await db.StaffBreak.sync({ force: false });
        } catch (err) {
            console.warn('⚠️  StaffBreak sync warning:', err.message);
        }
        try {
            await db.StaffTimeOff.sync({ force: false });
        } catch (err) {
            console.warn('⚠️  StaffTimeOff sync warning:', err.message);
        }
        try {
            await db.StaffScheduleOverride.sync({ force: false });
        } catch (err) {
            console.warn('⚠️  StaffScheduleOverride sync warning:', err.message);
        }
        await db.Appointment.sync({ force: false });
        await db.Review.sync({ force: false }); // Customer reviews
        await db.CustomerInsight.sync({ force: false });
        await db.Transaction.sync({ force: false });
        await db.TenantPushCampaignRecipient.sync({ force: false }); // Marketing push recipients
        await db.StaffPayroll.sync({ force: false }); // Payroll records
        await db.Order.sync({ force: false }); // Order system
        await db.OrderItem.sync({ force: false }); // Order items
        await db.PublicPageData.sync({ force: false }); // Public page data

        console.log('✅ Database synced successfully.');

        // Create default super admin if none exists
        await createDefaultSuperAdmin();

        // Seed default subscription packages
        const { seedDefaultPackages } = require('./utils/seedPackages');
        await seedDefaultPackages();
        const { seedFeaturePricing } = require('./utils/seedFeaturePricing');
        await seedFeaturePricing();
        const { seedServiceCategories } = require('./utils/seedServiceCategories');
        await seedServiceCategories();

        if (isProduction && !getTenantDashboardBaseUrl()) {
            console.warn('⚠️  Tenant dashboard base URL is not configured. Email-generated links may be incomplete.');
        }

        server = app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            // Expire payment_pending tenants every hour (48h window)
            const { expirePaymentPendingTenants } = require('./utils/initializeTenantSubscription');
            expiryInterval = setInterval(() => expirePaymentPendingTenants().catch(() => {}), 60 * 60 * 1000);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};

const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    if (expiryInterval) {
        clearInterval(expiryInterval);
        expiryInterval = null;
    }

    try {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve();
                });
            });
        }

        await redisService.closeRedis();
        await db.sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('Graceful shutdown failed:', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
