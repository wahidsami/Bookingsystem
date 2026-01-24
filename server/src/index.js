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

const app = express();

// ========================================
// CORS Configuration - Environment-based
// ========================================
const getCorsOrigins = () => {
    const env = process.env.NODE_ENV || 'development';

    if (env === 'production') {
        return (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean) || [
            'https://rifah.sa',
            'https://www.rifah.sa',
            'https://admin.rifah.sa',
            'https://tenant.rifah.sa',
            'https://public.rifah.sa'
        ];
    }

    // Development
    return [
        'http://localhost:3000',   // Client App
        'http://localhost:3001',   // Legacy
        'http://localhost:3002',   // Admin Dashboard
        'http://localhost:3003',   // Tenant Dashboard
        'http://localhost:3004',   // Public Page
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
if (process.env.NODE_ENV === 'production') {
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

app.use(express.json());

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
app.use('/api/v1/tenant', tenantRoutes); // Tenant dashboard APIs (protected)
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

// Cleanup routes (temporary - for one-time operations)
// Cleanup routes removed - one-time operations completed
// Health Check
app.get('/', (req, res) => {
    res.json({ message: 'Rifah API is running' });
});

// Test endpoint to verify uploads directory
app.get('/test-uploads', (req, res) => {
    const uploadsPath = path.join(__dirname, '../uploads');
    const fs = require('fs');
    try {
        const exists = fs.existsSync(uploadsPath);
        const files = exists ? fs.readdirSync(path.join(uploadsPath, 'profiles')) : [];
        res.json({
            uploadsPath,
            exists,
            files: files.slice(0, 5) // First 5 files
        });
    } catch (error) {
        res.json({ error: error.message, uploadsPath });
    }
});

// Create default super admin
const createDefaultSuperAdmin = async () => {
    try {
        const existingAdmin = await db.SuperAdmin.findOne({ where: { role: 'super_admin' } });
        if (!existingAdmin) {
            await db.SuperAdmin.create({
                email: 'admin@rifah.sa',
                password: 'RifahAdmin@2024', // Will be hashed automatically
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
            console.log('✅ Default Super Admin created: admin@rifah.sa / RifahAdmin@2024');
        }
    } catch (error) {
        console.log('Super admin setup:', error.message);
    }
};

// Database Connection and Server Start
const startServer = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Sync models in dependency order (FAST MODE - no alterations)
        await db.SuperAdmin.sync({ force: false });
        await db.ActivityLog.sync({ force: false }); // Changed from alter: true for faster startup

        // Subscription System (must be before Tenant sync for foreign keys)
        await db.SubscriptionPackage.sync({ force: false }); // Base packages

        await db.Tenant.sync({ force: false }); // Changed from alter: true for faster startup

        // Subscription relationships (after Tenant)
        await db.TenantSubscription.sync({ force: false }); // Tenant subscriptions
        await db.TenantUsage.sync({ force: false }); // Usage tracking
        await db.UsageAlert.sync({ force: false }); // Usage alerts

        // TenantSettings - SKIP for now (will add later when needed)
        // await db.TenantSettings.sync({ force: false });

        await db.PlatformUser.sync({ force: false }); // Must be before PaymentMethod, Transaction, CustomerInsight
        await db.PaymentMethod.sync({ force: false });
        await db.User.sync({ force: false });
        await db.Service.sync({ force: false }); // Columns already exist in DB
        await db.Product.sync({ force: false }); // New: Product catalog
        await db.Customer.sync({ force: false });
        await db.Staff.sync({ force: false }); // Don't alter to avoid issues with existing data
        await db.ServiceEmployee.sync({ force: false }); // New: Service-Employee junction
        await db.StaffSchedule.sync({ force: false }); // Legacy schedule (kept for backward compatibility)
        // New scheduling models (Phase 3) - use force: false to create if missing, but don't alter existing
        // Note: If tables already exist with different schema, they won't be modified
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
        await db.Appointment.sync({ force: false }); // Don't alter to avoid issues with existing data
        await db.CustomerInsight.sync({ force: false });
        await db.Transaction.sync({ force: false });
        await db.Order.sync({ force: false }); // Order system
        await db.OrderItem.sync({ force: false }); // Order items
        await db.PublicPageData.sync({ force: false }); // Public page data

        console.log('✅ Database synced successfully.');

        // Create default super admin if none exists
        await createDefaultSuperAdmin();

        // Seed default subscription packages
        const { seedDefaultPackages } = require('./utils/seedPackages');
        await seedDefaultPackages();

        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();
