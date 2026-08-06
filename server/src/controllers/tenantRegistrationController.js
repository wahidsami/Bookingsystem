const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { notifyTenantRegistered } = require('../services/adminNotificationService');

const VALID_BUSINESS_TYPES = ['salon', 'spa', 'barbershop', 'beauty_center', 'clinic', 'nail_studio', 'other'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{8,15}$/;

const normalizeBusinessTypes = (businessTypeInput) => {
    if (businessTypeInput == null) {
        return [];
    }

    if (Array.isArray(businessTypeInput)) {
        return businessTypeInput
            .map((type) => String(type).trim())
            .filter((type) => VALID_BUSINESS_TYPES.includes(type));
    }

    const rawValue = String(businessTypeInput).trim();
    if (!rawValue) {
        return [];
    }

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        try {
            const parsed = JSON.parse(rawValue);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((type) => String(type).trim())
                    .filter((type) => VALID_BUSINESS_TYPES.includes(type));
            }
        } catch (error) {
            // Fall back to comma-separated parsing below.
        }
    }

    return rawValue
        .split(',')
        .map((type) => type.trim())
        .filter((type) => VALID_BUSINESS_TYPES.includes(type));
};

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
        } else if (file.fieldname === 'nationalAddressDocument') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/documents/national_address');
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
    { name: 'nationalAddressDocument', maxCount: 1 }
]);

/**
 * @route POST /api/v1/auth/tenant/register
 * @desc Register a new tenant (salon/spa/barbershop)
 * @access Public
 */
exports.register = async (req, res) => {
    let transaction;
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
            region,
            city,
            country,
            googleMapLink,

            // Step 2: Official Documentation
            crNumber,
            taxNumber,

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

        const normalizedBusinessTypes = normalizeBusinessTypes(businessType);
        const primaryBusinessType = normalizedBusinessTypes[0];

        // Validation (before transaction to avoid unnecessary DB calls)
        if (!name_en || !name_ar) {
            return res.status(400).json({
                success: false,
                message: 'Business name in English and Arabic is required'
            });
        }

        if (!primaryBusinessType) {
            return res.status(400).json({
                success: false,
                message: 'At least one valid business type is required'
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        if (!EMAIL_REGEX.test(String(email).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid business email format'
            });
        }
        if (contactPersonEmail && !EMAIL_REGEX.test(String(contactPersonEmail).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact person email format'
            });
        }
        if (ownerEmail && !EMAIL_REGEX.test(String(ownerEmail).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid owner email format'
            });
        }
        if (phone && !PHONE_REGEX.test(String(phone).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid business phone number format'
            });
        }
        if (!mobile || !PHONE_REGEX.test(String(mobile).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid business mobile number format'
            });
        }
        if (!contactPersonMobile || !PHONE_REGEX.test(String(contactPersonMobile).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact person mobile number format'
            });
        }
        if (!ownerPhone || !PHONE_REGEX.test(String(ownerPhone).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid owner phone number format'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required'
            });
        }
        if (String(password).length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        if (!acceptedServiceAgreement) {
            return res.status(400).json({
                success: false,
                message: 'You must accept the service agreement to continue'
            });
        }

        if (!selectedPackageId) {
            return res.status(400).json({
                success: false,
                message: 'A subscription package must be selected'
            });
        }

        if (!selectedBillingPeriod || !['monthly', 'sixMonth', 'annual'].includes(selectedBillingPeriod)) {
            return res.status(400).json({
                success: false,
                message: 'A valid billing period is required'
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
        transaction = await db.sequelize.transaction();

        // Get uploaded file paths
        const logo = req.files?.logo?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;
        const crDocument = req.files?.crDocument?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;
        const taxDocument = req.files?.taxDocument?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;
        const nationalAddressDocument = req.files?.nationalAddressDocument?.[0]?.path?.replace(/\\/g, '/').split('uploads/')[1] || null;

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
            businessType: normalizedBusinessTypes,
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
            region,
            city,
            country: country || 'Saudi Arabia',
            googleMapLink,

            // Documents
            logo,
            crNumber,
            crDocument,
            taxNumber,
            taxDocument,
            nationalAddressDocument,

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

            // Status (Option A: single submit → pending_approval)
            status: 'pending_approval',

            // Settings
            settings: {
                currency: 'SAR',
                timezone: 'Asia/Riyadh',
                language: preferredLanguage || 'ar',
                businessTypes: normalizedBusinessTypes,
                bookingBuffer: 15,
                maxAdvanceBooking: 30,
                cancellationPolicy: 24,
                autoConfirmBookings: false,
                requireDeposit: false,
                depositPercentage: 0
            }
        }, { transaction });

        let subscriptionPackage = await db.SubscriptionPackage.findOne({
            where: {
                id: selectedPackageId,
                isActive: true
            },
            transaction
        });

        if (!subscriptionPackage) {
            throw new Error('Selected subscription package was not found or is inactive');
        }

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

        // Create subscription draft that will be activated after approval + payment
        await db.TenantSubscription.create({
            tenantId: tenant.id,
            packageId: selectedPackageId,
            billingCycle: selectedBillingPeriod,
            amount: priceToPay,
            currency: 'SAR',
            status: 'trial',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
            autoRenew: true
        }, { transaction });

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
                businessType: primaryBusinessType,
                businessTypes: normalizedBusinessTypes,
                email,
                status: 'pending_approval',
                selectedPackage: subscriptionPackage?.name || 'None'
            }
        }, { transaction });

        await notifyTenantRegistered(tenant, transaction);

        // Commit transaction
        await transaction.commit();

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
                businessTypes: normalizedBusinessTypes,
                email: tenant.email,
                slug: tenant.slug,
                status: tenant.status,
                logo: tenant.logo,
                createdAt: tenant.createdAt
            }
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

/**
 * Resubmit request after more_info_required (tenant must be authenticated)
 * PUT /api/v1/tenant/resubmit-request
 */
exports.resubmitRequest = async (req, res) => {
    try {
        const tenant = req.tenant;
        if (!tenant) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        if (tenant.status !== 'more_info_required') {
            return res.status(400).json({
                success: false,
                message: `Resubmit only allowed when status is more_info_required (current: ${tenant.status})`
            });
        }

        await tenant.update({
            status: 'pending_approval',
            moreInfoMessage: null
        });

        const { db } = require('../models');
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'resubmitted',
            performedByType: 'tenant',
            performedById: tenant.id,
            details: {},
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Application resubmitted for review.',
            tenant: {
                id: tenant.id,
                status: tenant.status
            }
        });
    } catch (error) {
        console.error('Resubmit request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resubmit',
            error: error.message
        });
    }
};

