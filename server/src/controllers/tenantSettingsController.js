/**
 * Tenant Settings Controller
 * Manages business settings, working hours, notifications, and payment configurations
 */

const db = require('../models');
const { Op } = require('sequelize');
const { checkResourceLimit } = require('../utils/tenantLimitsUtil');
const { ACTIVE_SUBSCRIPTION_STATUSES, getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');
const { normalizePackageEntitlements } = require('../utils/packageEntitlements');
const {
    normalizeTenantPaymentSettings,
    validateTenantPaymentSettings
} = require('../utils/tenantPaymentSettings');
const {
    normalizeAppointmentNotificationSettings
} = require('../services/appointmentAutomationService');
const {
    normalizeConsultantWorkflowSettings,
    DEFAULT_CONSULTANT_WORKFLOW_SETTINGS,
    getDefaultConsultantCommunicationPreferences
} = require('../services/consultantWorkflowService');

const DASHBOARD_LANDING_PAGES = new Set([
    'home',
    'appointments',
    'customers',
    'messages',
    'pos',
    'employees',
    'services',
    'products',
    'inventory',
    'marketing',
    'giftcards',
    'loyalty',
    'financial',
    'reports',
    'subscription',
    'billing',
    'settings'
]);

const normalizeDashboardSettings = (value = {}) => ({
    defaultLandingPage: DASHBOARD_LANDING_PAGES.has(value?.defaultLandingPage)
        ? value.defaultLandingPage
        : 'home'
});

const normalizeNotificationSettings = (value = {}, communicationFallback = undefined) => ({
    ...normalizeAppointmentNotificationSettings(value),
    consultantWorkflow: normalizeConsultantWorkflowSettings(
        value?.consultantWorkflow || {},
        communicationFallback
    )
});

const DEFAULT_SCHEDULER_BOARD_SETTINGS = {
    gridWidth: 100,
    gridHeight: 760,
    timeSlotHeight: 10,
    staffColumnWidth: 240,
    showCurrentTimeIndicator: true,
    showLunchBreaks: true,
    showStaffPhotos: true,
    showAppointmentStatusBadges: true
};

const normalizeSchedulerBoardSettings = (value = {}) => ({
    gridWidth: Math.max(80, Math.min(160, Number(value?.gridWidth ?? DEFAULT_SCHEDULER_BOARD_SETTINGS.gridWidth))),
    gridHeight: Math.max(420, Math.min(1400, Number(value?.gridHeight ?? DEFAULT_SCHEDULER_BOARD_SETTINGS.gridHeight))),
    timeSlotHeight: Math.max(8, Math.min(24, Number(value?.timeSlotHeight ?? DEFAULT_SCHEDULER_BOARD_SETTINGS.timeSlotHeight))),
    staffColumnWidth: Math.max(180, Math.min(360, Number(value?.staffColumnWidth ?? DEFAULT_SCHEDULER_BOARD_SETTINGS.staffColumnWidth))),
    showCurrentTimeIndicator: value?.showCurrentTimeIndicator !== undefined
        ? Boolean(value.showCurrentTimeIndicator)
        : DEFAULT_SCHEDULER_BOARD_SETTINGS.showCurrentTimeIndicator,
    showLunchBreaks: value?.showLunchBreaks !== undefined
        ? Boolean(value.showLunchBreaks)
        : DEFAULT_SCHEDULER_BOARD_SETTINGS.showLunchBreaks,
    showStaffPhotos: value?.showStaffPhotos !== undefined
        ? Boolean(value.showStaffPhotos)
        : DEFAULT_SCHEDULER_BOARD_SETTINGS.showStaffPhotos,
    showAppointmentStatusBadges: value?.showAppointmentStatusBadges !== undefined
        ? Boolean(value.showAppointmentStatusBadges)
        : DEFAULT_SCHEDULER_BOARD_SETTINGS.showAppointmentStatusBadges
});

/**
 * Get subscription limits and current usage for the tenant.
 */
exports.getSubscriptionLimits = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const settings = await db.TenantSettings.findOne({ where: { tenantId } });
        const tenantFeatures = settings?.features || {};

        const subResult = await getActiveSubscriptionForTenant(tenantId, {
            statuses: ACTIVE_SUBSCRIPTION_STATUSES
        });
        const packageLimits = subResult?.package?.limits || {};
        // Package limits are the canonical source of truth. Tenant settings may
        // add supplemental aliases, but they must never override the live plan.
        const mergedFeatures = normalizePackageEntitlements(tenantFeatures, packageLimits);

        const [staff, services, products, bookings] = await Promise.all([
            checkResourceLimit(tenantId, 'maxStaff', async () => db.Staff.count({ where: { tenantId } })),
            checkResourceLimit(tenantId, 'maxServices', async () => db.Service.count({ where: { tenantId } })),
            checkResourceLimit(tenantId, 'maxProducts', async () => db.Product.count({ where: { tenantId } })),
            checkResourceLimit(tenantId, 'maxBookingsPerMonth', async () => db.Appointment.count({
                where: {
                    tenantId,
                    createdAt: { [Op.gte]: startOfMonth }
                }
            }))
        ]);

        const packageName = subResult?.package?.name || staff.packageName;

        res.json({
            success: true,
            limits: mergedFeatures,
            data: {
                packageName,
                staff: { current: staff.current, limit: staff.limit, allowed: staff.allowed },
                services: { current: services.current, limit: services.limit, allowed: services.allowed },
                products: { current: products.current, limit: products.limit, allowed: products.allowed },
                bookings: { current: bookings.current, limit: bookings.limit, allowed: bookings.allowed }
            }
        });
    } catch (error) {
        console.error('Get subscription limits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription limits'
        });
    }
};

/**
 * Get all settings for the tenant
 */
exports.getSettings = async (req, res) => {
    try {
        const tenantId = req.tenant.id;

        // Get tenant basic info
        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: [
                'id', 'name', 'name_en', 'name_ar', 'businessType', 'slug',
                'email', 'phone', 'mobile', 'website', 'whatsapp',
                'buildingNumber', 'street', 'district', 'city', 'country', 'googleMapLink', 'postalCode', 'coordinates',
                'logo', 'coverImage', 'description', 'descriptionAr',
                'workingHours', 'layoutTemplate', 'themeColors',
                'facebookUrl', 'instagramUrl', 'twitterUrl', 'linkedinUrl',
                'tiktokUrl', 'youtubeUrl', 'snapchatUrl', 'pinterestUrl'
            ]
        });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Get or create tenant settings
        let [settings, created] = await db.TenantSettings.findOrCreate({
            where: { tenantId },
            defaults: {
                tenantId,
                commissionRate: 2.5,
                taxRate: 15.00,
                currency: 'SAR',
                businessHours: tenant.workingHours || {},
                timezone: 'Asia/Riyadh',
                autoApproveBookings: true,
                bufferTime: 15,
                bookingSettings: {
                    minimumAdvanceBookingMinutes: 15,
                    slotInterval: 15,
                    defaultBufferBefore: 5,
                    defaultBufferAfter: 5,
                    allowAnyStaff: true,
                    maxBookingsPerCustomerPerDay: null,
                    allowWalkInBooking: true,
                    schedulerBoard: DEFAULT_SCHEDULER_BOARD_SETTINGS
                },
                maxAdvanceBookingDays: 30,
                cancellationHours: 24,
                acceptCash: true,
                acceptCard: true,
                acceptWallet: true,
                paymentSettings: normalizeTenantPaymentSettings(),
                enableEmailNotifications: true,
                enableSmsNotifications: false,
                enableWhatsAppNotifications: false,
                enableVoiceAlerts: true,
                defaultLanguage: 'ar',
                supportedLanguages: ['ar', 'en'],
                dashboardSettings: normalizeDashboardSettings(),
                notificationSettings: normalizeNotificationSettings({
                    consultantWorkflow: {
                        ...DEFAULT_CONSULTANT_WORKFLOW_SETTINGS,
                        communicationPreferences: getDefaultConsultantCommunicationPreferences(tenant)
                    }
                }, getDefaultConsultantCommunicationPreferences(tenant))
            }
        });

        const normalizedPaymentSettings = normalizeTenantPaymentSettings(settings.paymentSettings, {
            acceptCash: settings.acceptCash,
            acceptCard: settings.acceptCard,
            acceptWallet: settings.acceptWallet
        });
        const normalizedDashboardSettings = normalizeDashboardSettings(settings.dashboardSettings);
        const defaultCommunicationPreferences = getDefaultConsultantCommunicationPreferences({
            country: tenant.country,
            defaultLanguage: settings.defaultLanguage
        });
        const normalizedNotificationSettings = normalizeNotificationSettings(
            settings.notificationSettings,
            defaultCommunicationPreferences
        );

        res.json({
            success: true,
            data: {
                business: tenant,
                settings: {
                    ...settings.toJSON(),
                    paymentSettings: normalizedPaymentSettings,
                    notificationSettings: normalizedNotificationSettings,
                    dashboardSettings: normalizedDashboardSettings,
                    defaultDeliveryFee: normalizedPaymentSettings.defaultDeliveryFee
                }
            }
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings',
            error: error.message
        });
    }
};

/**
 * Update business information
 */
exports.updateBusinessInfo = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const {
            name_en, name_ar, businessType,
            email, phone, mobile, website, whatsapp,
            buildingNumber, street, district, city, country, googleMapLink, postalCode,
            description, descriptionAr,
            facebookUrl, instagramUrl, twitterUrl, linkedinUrl,
            tiktokUrl, youtubeUrl, snapchatUrl, pinterestUrl,
            latitude, longitude
        } = req.body;

        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Update business info
        await tenant.update({
            name_en: name_en !== undefined ? name_en : tenant.name_en,
            name_ar: name_ar !== undefined ? name_ar : tenant.name_ar,
            businessType: businessType || tenant.businessType,
            email: email !== undefined ? email : tenant.email,
            phone: phone !== undefined ? phone : tenant.phone,
            mobile: mobile !== undefined ? mobile : tenant.mobile,
            website: website !== undefined ? website : tenant.website,
            whatsapp: whatsapp !== undefined ? whatsapp : tenant.whatsapp,
            buildingNumber: buildingNumber !== undefined ? buildingNumber : tenant.buildingNumber,
            street: street !== undefined ? street : tenant.street,
            district: district !== undefined ? district : tenant.district,
            city: city !== undefined ? city : tenant.city,
            country: country !== undefined ? country : tenant.country,
            googleMapLink: googleMapLink !== undefined ? googleMapLink : tenant.googleMapLink,
            postalCode: postalCode !== undefined ? postalCode : tenant.postalCode,
            description: description !== undefined ? description : tenant.description,
            descriptionAr: descriptionAr !== undefined ? descriptionAr : tenant.descriptionAr,
            // Social media
            facebookUrl: facebookUrl !== undefined ? facebookUrl : tenant.facebookUrl,
            instagramUrl: instagramUrl !== undefined ? instagramUrl : tenant.instagramUrl,
            twitterUrl: twitterUrl !== undefined ? twitterUrl : tenant.twitterUrl,
            linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : tenant.linkedinUrl,
            tiktokUrl: tiktokUrl !== undefined ? tiktokUrl : tenant.tiktokUrl,
            youtubeUrl: youtubeUrl !== undefined ? youtubeUrl : tenant.youtubeUrl,
            snapchatUrl: snapchatUrl !== undefined ? snapchatUrl : tenant.snapchatUrl,
            pinterestUrl: pinterestUrl !== undefined ? pinterestUrl : tenant.pinterestUrl,
            coordinates: (latitude !== undefined && longitude !== undefined && latitude !== '' && longitude !== '')
                ? { lat: Number(latitude), lng: Number(longitude) }
                : tenant.coordinates
        });

        res.json({
            success: true,
            message: 'Business information updated',
            data: tenant
        });

    } catch (error) {
        console.error('Update business info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update business information',
            error: error.message
        });
    }
};

/**
 * Update working hours
 */
exports.updateWorkingHours = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { workingHours } = req.body;

        // Update in Tenant model
        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        await tenant.update({ workingHours });

        // Also update in TenantSettings
        const settings = await db.TenantSettings.findOne({ where: { tenantId } });
        if (settings) {
            await settings.update({ businessHours: workingHours });
        }

        res.json({
            success: true,
            message: 'Working hours updated',
            data: { workingHours }
        });

    } catch (error) {
        console.error('Update working hours error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update working hours',
            error: error.message
        });
    }
};

/**
 * Update booking settings
 * Includes new Phase 2+ settings: slotInterval, buffers, allowAnyStaff, etc.
 */
exports.updateBookingSettings = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const {
            // Legacy fields
            autoApproveBookings,
            bufferTime,
            maxAdvanceBookingDays,
            cancellationHours,
            cancellationPolicy,
            // New Phase 2+ fields
            slotInterval,
            defaultBufferBefore,
            defaultBufferAfter,
            allowAnyStaff,
            maxBookingsPerCustomerPerDay,
            allowWalkInBooking,
            minimumAdvanceBookingMinutes,
            schedulerBoard,
            rescheduleHours
        } = req.body;

        let [settings] = await db.TenantSettings.findOrCreate({
            where: { tenantId },
            defaults: { tenantId }
        });

        // Update legacy fields
        const updateData = {};
        if (autoApproveBookings !== undefined) updateData.autoApproveBookings = autoApproveBookings;
        if (bufferTime !== undefined) updateData.bufferTime = bufferTime;
        if (maxAdvanceBookingDays !== undefined) updateData.maxAdvanceBookingDays = maxAdvanceBookingDays;
        if (cancellationHours !== undefined) updateData.cancellationHours = cancellationHours;
        if (cancellationPolicy !== undefined) updateData.cancellationPolicy = cancellationPolicy;

        // Update bookingSettings JSONB field
        const currentBookingSettings = settings.bookingSettings || {};
        const newBookingSettings = { ...currentBookingSettings };

        if (slotInterval !== undefined) {
            // Validate slot interval (5, 10, or 15)
            if (![5, 10, 15].includes(slotInterval)) {
                return res.status(400).json({
                    success: false,
                    message: 'slotInterval must be 5, 10, or 15 minutes'
                });
            }
            newBookingSettings.slotInterval = slotInterval;
        }
        if (defaultBufferBefore !== undefined) {
            newBookingSettings.defaultBufferBefore = Math.max(0, defaultBufferBefore);
        }
        if (defaultBufferAfter !== undefined) {
            newBookingSettings.defaultBufferAfter = Math.max(0, defaultBufferAfter);
        }
        if (allowAnyStaff !== undefined) {
            newBookingSettings.allowAnyStaff = allowAnyStaff;
        }
        if (maxBookingsPerCustomerPerDay !== undefined) {
            newBookingSettings.maxBookingsPerCustomerPerDay = maxBookingsPerCustomerPerDay === null || maxBookingsPerCustomerPerDay === '' 
                ? null 
                : Math.max(1, parseInt(maxBookingsPerCustomerPerDay));
        }
        if (allowWalkInBooking !== undefined) {
            newBookingSettings.allowWalkInBooking = allowWalkInBooking;
        }
        if (minimumAdvanceBookingMinutes !== undefined) {
            const parsedAdvance = Math.max(0, parseInt(minimumAdvanceBookingMinutes, 10));
            if (!Number.isFinite(parsedAdvance)) {
                return res.status(400).json({
                    success: false,
                    message: 'minimumAdvanceBookingMinutes must be a valid number'
                });
            }
            newBookingSettings.minimumAdvanceBookingMinutes = parsedAdvance;
        }

        if (rescheduleHours !== undefined) {
            const parsedReschedule = Math.max(0, parseInt(rescheduleHours, 10));
            if (!Number.isFinite(parsedReschedule)) {
                return res.status(400).json({
                    success: false,
                    message: 'rescheduleHours must be a valid number'
                });
            }
            newBookingSettings.rescheduleHours = parsedReschedule;
        }

        if (schedulerBoard !== undefined) {
            newBookingSettings.schedulerBoard = normalizeSchedulerBoardSettings({
                ...(currentBookingSettings.schedulerBoard || {}),
                ...(schedulerBoard || {})
            });
        }

        updateData.bookingSettings = newBookingSettings;

        await settings.update(updateData);

        res.json({
            success: true,
            message: 'Booking settings updated',
            data: settings
        });

    } catch (error) {
        console.error('Update booking settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update booking settings',
            error: error.message
        });
    }
};

/**
 * Update notification settings
 */
exports.updateNotificationSettings = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const {
            enableEmailNotifications,
            enableSmsNotifications,
            enableWhatsAppNotifications,
            enableVoiceAlerts,
            consultantWorkflow,
            remindRemainderToCollect,
            appointmentGracePeriodMinutes,
            autoMarkNoShowAfterGracePeriod,
            customerReminderEnabled,
            customerReminderMinutesBefore
        } = req.body;

        let [settings] = await db.TenantSettings.findOrCreate({
            where: { tenantId },
            defaults: { tenantId }
        });

        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['id', 'country']
        });
        const defaultCommunicationPreferences = getDefaultConsultantCommunicationPreferences({
            country: tenant?.country,
            defaultLanguage: settings.defaultLanguage
        });
        const currentNotificationSettings = normalizeNotificationSettings(
            settings.notificationSettings,
            defaultCommunicationPreferences
        );
        const nextNotificationSettings = normalizeNotificationSettings({
            ...currentNotificationSettings,
            consultantWorkflow: normalizeConsultantWorkflowSettings(
                consultantWorkflow || currentNotificationSettings.consultantWorkflow || {},
                defaultCommunicationPreferences
            ),
            remindRemainderToCollect,
            appointmentGracePeriodMinutes,
            autoMarkNoShowAfterGracePeriod,
            customerReminderEnabled,
            customerReminderMinutesBefore
        }, defaultCommunicationPreferences);

        await settings.update({
            enableEmailNotifications: enableEmailNotifications !== undefined ? enableEmailNotifications : settings.enableEmailNotifications,
            enableSmsNotifications: enableSmsNotifications !== undefined ? enableSmsNotifications : settings.enableSmsNotifications,
            enableWhatsAppNotifications: enableWhatsAppNotifications !== undefined ? enableWhatsAppNotifications : settings.enableWhatsAppNotifications,
            enableVoiceAlerts: enableVoiceAlerts !== undefined ? enableVoiceAlerts : settings.enableVoiceAlerts,
            notificationSettings: nextNotificationSettings
        });

        res.json({
            success: true,
            message: 'Notification settings updated',
            data: {
                ...settings.toJSON(),
                notificationSettings: nextNotificationSettings
            }
        });

    } catch (error) {
        console.error('Update notification settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification settings',
            error: error.message
        });
    }
};

/**
 * Update payment settings
 */
exports.updatePaymentSettings = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const normalizedPaymentSettings = normalizeTenantPaymentSettings(
            req.body?.paymentSettings || req.body || {},
            {
                acceptCash: req.body?.acceptCash,
                acceptCard: req.body?.acceptCard,
                acceptWallet: req.body?.acceptWallet
            }
        );

        validateTenantPaymentSettings(normalizedPaymentSettings);

        let [settings] = await db.TenantSettings.findOrCreate({
            where: { tenantId },
            defaults: {
                tenantId,
                paymentSettings: normalizedPaymentSettings
            }
        });

        await settings.update({
            acceptCash: normalizedPaymentSettings.acceptCash,
            acceptCard: normalizedPaymentSettings.acceptCard,
            acceptWallet: normalizedPaymentSettings.acceptWallet,
            paymentSettings: normalizedPaymentSettings,
            payoutBankAccount: req.body?.payoutBankAccount !== undefined
                ? req.body.payoutBankAccount
                : settings.payoutBankAccount
        });

        res.json({
            success: true,
            message: 'Payment settings updated',
            data: {
                ...settings.toJSON(),
                paymentSettings: normalizedPaymentSettings,
                defaultDeliveryFee: normalizedPaymentSettings.defaultDeliveryFee
            }
        });

    } catch (error) {
        console.error('Update payment settings error:', error);
        const isValidationError = [
            'At least one service booking payment option must be enabled',
            'At least one product payment option must be enabled',
            'Service deposit fixed amount must be greater than 0',
            'Service deposit percentage must be between 1 and 100'
        ].includes(error.message);

        res.status(isValidationError ? 400 : 500).json({
            success: false,
            message: isValidationError ? error.message : 'Failed to update payment settings',
            error: error.message
        });
    }
};

/**
 * Update localization settings
 */
exports.updateLocalizationSettings = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const {
            defaultLanguage,
            supportedLanguages,
            timezone,
            currency
        } = req.body;

        let [settings] = await db.TenantSettings.findOrCreate({
            where: { tenantId },
            defaults: { tenantId }
        });

        await settings.update({
            defaultLanguage: defaultLanguage || settings.defaultLanguage,
            supportedLanguages: supportedLanguages || settings.supportedLanguages,
            timezone: timezone || settings.timezone,
            currency: currency || settings.currency
        });

        res.json({
            success: true,
            message: 'Localization settings updated',
            data: settings
        });

    } catch (error) {
        console.error('Update localization settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update localization settings',
            error: error.message
        });
    }
};

/**
 * Update dashboard settings
 */
exports.updateDashboardSettings = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const incomingSettings = req.body?.dashboardSettings || req.body || {};

        if (incomingSettings.defaultLandingPage !== undefined && !DASHBOARD_LANDING_PAGES.has(incomingSettings.defaultLandingPage)) {
            return res.status(400).json({
                success: false,
                message: 'defaultLandingPage must be one of: home, appointments, customers, messages, pos, employees, services, products, inventory, marketing, giftcards, loyalty, financial, reports, subscription, billing, settings'
            });
        }

        const [settings] = await db.TenantSettings.findOrCreate({
            where: { tenantId },
            defaults: {
                tenantId,
                dashboardSettings: normalizeDashboardSettings()
            }
        });

        const dashboardSettings = normalizeDashboardSettings({
            ...(settings.dashboardSettings || {}),
            ...incomingSettings
        });

        await settings.update({
            dashboardSettings
        });

        res.json({
            success: true,
            message: 'Dashboard settings updated',
            data: {
                ...settings.toJSON(),
                dashboardSettings
            }
        });
    } catch (error) {
        console.error('Update dashboard settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update dashboard settings',
            error: error.message
        });
    }
};

/**
 * Update theme/appearance settings
 */
exports.updateAppearanceSettings = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { layoutTemplate, themeColors } = req.body;

        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        await tenant.update({
            layoutTemplate: layoutTemplate || tenant.layoutTemplate,
            themeColors: themeColors || tenant.themeColors
        });

        res.json({
            success: true,
            message: 'Appearance settings updated',
            data: {
                layoutTemplate: tenant.layoutTemplate,
                themeColors: tenant.themeColors
            }
        });

    } catch (error) {
        console.error('Update appearance settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update appearance settings',
            error: error.message
        });
    }
};

/**
 * Upload logo
 */
exports.uploadLogo = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const logoPath = `/uploads/tenants/${req.file.filename}`;

        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        await tenant.update({ logo: logoPath });

        res.json({
            success: true,
            message: 'Logo uploaded successfully',
            data: { logo: logoPath }
        });

    } catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload logo',
            error: error.message
        });
    }
};

/**
 * Upload cover image
 */
exports.uploadCoverImage = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const coverImagePath = `/uploads/tenants/${req.file.filename}`;

        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        await tenant.update({ coverImage: coverImagePath });

        res.json({
            success: true,
            message: 'Cover image uploaded successfully',
            data: { coverImage: coverImagePath }
        });

    } catch (error) {
        console.error('Upload cover image error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload cover image',
            error: error.message
        });
    }
};

