const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = '';

        // Determine upload path based on field name
        if (file.fieldname === 'logo') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/logos');
        } else if (file.fieldname === 'crDocument') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/documents/cr');
        } else if (file.fieldname === 'taxDocument') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/documents/tax');
        } else if (file.fieldname === 'licenseDocument') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/documents/license');
        } else {
            uploadPath = path.join(__dirname, '../../uploads/tenants/misc');
        }

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images, PDFs, and WEBP
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/webp';

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images (JPEG, PNG, GIF, WEBP) and PDF files are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
    fileFilter: fileFilter
});

// Middleware for handling registration file uploads
exports.uploadMiddleware = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'crDocument', maxCount: 1 },
    { name: 'taxDocument', maxCount: 1 },
    { name: 'licenseDocument', maxCount: 1 }
]);

/**
 * @route POST /api/v1/auth/tenant/register
 * @desc Register a new tenant (salon/spa/barbershop)
 * @access Public
 */
exports.register = async (req, res) => {
    try {
        const {
            // Step 1: Entity Details
            name_en,
            name_ar,
            businessType,
            phone,
            mobile,
            email,
            website,
            buildingNumber,
            district,
            street,
            city,
            country,
            googleMapLink,

            // Step 2: Official Documentation
            crNumber,
            taxNumber,
            licenseNumber,

            // Step 3: Contact Person
            contactPersonNameAr,
            contactPersonNameEn,
            contactPersonEmail,
            contactPersonMobile,
            contactPersonPosition,

            // Step 4: Owner Details
            ownerNameAr,
            ownerNameEn,
            ownerPhone,
            ownerEmail,
            ownerNationalId,

            // Step 5: Business Details
            providesHomeServices,
            staffCount,
            mainService,
            sellsProducts,
            hasOwnPaymentGateway,
            serviceRanking,
            advertiseOnSocialMedia,
            wantsRifahPromotion,

            // Step 5: Service Agreement
            acceptedServiceAgreement,

            // Step 6: Subscription Package
            selectedPackageId,
            selectedBillingPeriod,

            // Password
            password,

            // Language preference
            preferredLanguage
        } = req.body;

        // Validation (before transaction to avoid unnecessary DB calls)
        if (!name_en || !name_ar) {
            return res.status(400).json({
                success: false,
                message: 'Business name in English and Arabic is required'
            });
        }

        if (!businessType) {
            return res.status(400).json({
                success: false,
                message: 'Business type is required'
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required'
            });
        }

        if (!acceptedServiceAgreement) {
            return res.status(400).json({
                success: false,
                message: 'You must accept the service agreement to continue'
            });
        }

        // Check if tenant with this email already exists (before transaction)
        const existingTenant = await db.Tenant.findOne({ where: { email } });
        if (existingTenant) {
            return res.status(400).json({
                success: false,
                message: 'A business with this email already exists'
            });
        }

        // Start transaction for database operations
        const transaction = await db.sequelize.transaction();

        // Get uploaded file paths
        const logo = req.files?.logo?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;
        const crDocument = req.files?.crDocument?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;
        const taxDocument = req.files?.taxDocument?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;
        const licenseDocument = req.files?.licenseDocument?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;

        // Generate slug from English name
        const slug = name_en
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        // Check if slug exists, if so append random string (within transaction)
        let finalSlug = slug;
        let slugExists = await db.Tenant.findOne({ where: { slug: finalSlug }, transaction });
        if (slugExists) {
            finalSlug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
            // Double-check uniqueness within transaction
            slugExists = await db.Tenant.findOne({ where: { slug: finalSlug }, transaction });
            let attempts = 0;
            while (slugExists && attempts < 5) {
                finalSlug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
                slugExists = await db.Tenant.findOne({ where: { slug: finalSlug }, transaction });
                attempts++;
            }
        }

        // Generate dbSchema name
        const dbSchema = `tenant_${finalSlug.replace(/-/g, '_')}`;

        // Create tenant (within transaction)
        const tenant = await db.Tenant.create({
            // Basic Info
            name: name_en, // Legacy field
            name_en,
            name_ar,
            nameAr: name_ar, // Legacy field
            slug: finalSlug,
            dbSchema,
            businessType,
            password,

            // Contact Info
            email,
            phone,
            mobile,
            website,

            // Location
            buildingNumber,
            street,
            district,
            city,
            country: country || 'Saudi Arabia',
            googleMapLink,

            // Documents
            logo,
            crNumber,
            crDocument,
            taxNumber,
            taxDocument,
            licenseNumber,
            licenseDocument,

            // Contact Person
            contactPersonNameAr,
            contactPersonNameEn,
            contactPersonEmail,
            contactPersonMobile,
            contactPersonPosition,

            // Owner Details
            ownerName: ownerNameEn, // Legacy field
            ownerNameAr,
            ownerNameEn,
            ownerPhone,
            ownerEmail,
            ownerNationalId,

            // Business Details
            providesHomeServices: providesHomeServices === 'true' || providesHomeServices === true,
            staffCount: staffCount && staffCount !== '' && staffCount !== '0' ? parseInt(staffCount) : null,
            mainService,
            sellsProducts: sellsProducts === 'true' || sellsProducts === true,
            hasOwnPaymentGateway: hasOwnPaymentGateway === 'true' || hasOwnPaymentGateway === true,
            serviceRanking: serviceRanking && serviceRanking !== '' && serviceRanking !== '0' ? parseInt(serviceRanking) : null,
            advertiseOnSocialMedia: advertiseOnSocialMedia === 'true' || advertiseOnSocialMedia === true,
            wantsRifahPromotion: wantsRifahPromotion === 'true' || wantsRifahPromotion === true,

            // Status
            status: 'pending', // Requires admin approval

            // Settings
            settings: {
                currency: 'SAR',
                timezone: 'Asia/Riyadh',
                language: preferredLanguage || 'ar',
                bookingBuffer: 15,
                maxAdvanceBooking: 30,
                cancellationPolicy: 24,
                autoConfirmBookings: false,
                requireDeposit: false,
                depositPercentage: 0
            }
        }, { transaction });

        // Create pending subscription if package selected
        let subscriptionPackage = null;
        if (selectedPackageId) {
            subscriptionPackage = await db.SubscriptionPackage.findByPk(selectedPackageId);

            if (subscriptionPackage) {
                // Calculate price based on billing period
                let priceToPay = 0;
                if (selectedBillingPeriod === 'monthly') {
                    priceToPay = subscriptionPackage.monthlyPrice;
                } else if (selectedBillingPeriod === 'sixMonth') {
                    priceToPay = subscriptionPackage.sixMonthPrice;
                } else if (selectedBillingPeriod === 'annual') {
                    priceToPay = subscriptionPackage.annualPrice;
                }

                // Calculate period dates
                const now = new Date();
                let periodEnd = new Date(now);
                if (selectedBillingPeriod === 'monthly') {
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                } else if (selectedBillingPeriod === 'sixMonth') {
                    periodEnd.setMonth(periodEnd.getMonth() + 6);
                } else if (selectedBillingPeriod === 'annual') {
                    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                }

                // Create subscription (status: 'trial' for pending approval, will be activated when approved)
                await db.TenantSubscription.create({
                    tenantId: tenant.id,
                    packageId: selectedPackageId,
                    billingCycle: selectedBillingPeriod || 'monthly', // Fixed: billingCycle not billingPeriod
                    amount: priceToPay, // Fixed: amount not pricePaid
                    currency: 'SAR', // Added: required field
                    status: 'trial', // Fixed: 'trial' instead of 'pending' (will be activated when tenant is approved)
                    currentPeriodStart: now, // Added: required field
                    currentPeriodEnd: periodEnd, // Added: required field
                    nextBillingDate: periodEnd, // Added: for tracking
                    autoRenew: true
                    // Removed: featuresSnapshot and limitsSnapshot (fields don't exist in model)
                }, { transaction });
            }
        }

        // Log activity (within transaction)
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'created',
            performedByType: 'system',
            performedByName: 'Registration System',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: {
                businessName: name_en,
                businessType,
                email,
                status: 'pending',
                selectedPackage: subscriptionPackage?.name || 'None'
            }
        }, { transaction });

        // Commit transaction
        await transaction.commit();

        // Generate JWT token (for immediate login after registration)
        const accessToken = jwt.sign(
            {
                tenantId: tenant.id,
                email: tenant.email,
                type: 'tenant'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            {
                tenantId: tenant.id,
                type: 'tenant'
            },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        // Set refresh token as HTTP-only cookie
        res.cookie('tenant_refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        // Send welcome email (don't wait for it, don't fail if it errors)
        const { sendWelcomeEmail } = require('../utils/emailService');
        sendWelcomeEmail(tenant).catch(err => {
            console.error('[Registration] Failed to send welcome email:', err.message);
            // Don't throw - email failure shouldn't affect registration
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful! Your account is pending admin approval.',
            tenant: {
                id: tenant.id,
                name_en: tenant.name_en,
                name_ar: tenant.name_ar,
                businessType: tenant.businessType,
                email: tenant.email,
                slug: tenant.slug,
                status: tenant.status,
                logo: tenant.logo,
                createdAt: tenant.createdAt
            },
            accessToken
        });

    } catch (error) {
        // Rollback transaction if it exists
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Registration error:', error);

        // Clean up uploaded files if registration fails
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            });
        }

        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

