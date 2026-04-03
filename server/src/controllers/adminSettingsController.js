/**
 * Admin Settings Controller
 * Manages global platform settings (commission rates, tax rates, etc.)
 */

const db = require('../models');

function serializeSettings(settings) {
    return {
        serviceCommissionRate: parseFloat(settings.serviceCommissionRate),
        productCommissionRate: parseFloat(settings.productCommissionRate),
        taxRate: parseFloat(settings.taxRate),
        invoiceSellerNameAr: settings.invoiceSellerNameAr || null,
        invoiceSellerNameEn: settings.invoiceSellerNameEn || null,
        invoiceVatNumber: settings.invoiceVatNumber || null,
        invoiceCrNumber: settings.invoiceCrNumber || null,
        invoiceAddressAr: settings.invoiceAddressAr || null,
        invoiceAddressEn: settings.invoiceAddressEn || null,
        invoiceCity: settings.invoiceCity || null,
        invoiceCountry: settings.invoiceCountry || 'Saudi Arabia',
        invoiceEmail: settings.invoiceEmail || null,
        invoicePhone: settings.invoicePhone || null,
        invoicePrefix: settings.invoicePrefix || 'INV',
        invoiceFooterNoteAr: settings.invoiceFooterNoteAr || null,
        invoiceFooterNoteEn: settings.invoiceFooterNoteEn || null,
        invoiceLogoPath: settings.invoiceLogoPath || null,
        updatedAt: settings.updatedAt
    };
}

function defaultSettingsPayload(overrides = {}) {
    return {
        serviceCommissionRate: 10.00,
        productCommissionRate: 10.00,
        taxRate: 15.00,
        invoiceSellerNameAr: 'رفاه',
        invoiceSellerNameEn: 'Refah',
        invoiceVatNumber: null,
        invoiceCrNumber: null,
        invoiceAddressAr: null,
        invoiceAddressEn: null,
        invoiceCity: 'Riyadh',
        invoiceCountry: 'Saudi Arabia',
        invoiceEmail: null,
        invoicePhone: null,
        invoicePrefix: 'INV',
        invoiceFooterNoteAr: null,
        invoiceFooterNoteEn: null,
        invoiceLogoPath: null,
        ...overrides
    };
}

/**
 * Get global settings
 * GET /api/v1/admin/settings
 */
exports.getSettings = async (req, res) => {
    try {
        // Try to find existing settings
        let settings = await db.GlobalSettings.findOne({
            order: [['updatedAt', 'DESC']]
        });

        // If no settings exist, create default ones
        if (!settings) {
            try {
                settings = await db.GlobalSettings.create({
                    serviceCommissionRate: 10.00,
                    productCommissionRate: 10.00,
                    taxRate: 15.00
                });
            } catch (createError) {
                // If table doesn't exist, return defaults
                console.error('GlobalSettings table may not exist:', createError.message);
                return res.json({
                    success: true,
                    settings: defaultSettingsPayload({ updatedAt: new Date().toISOString() })
                });
            }
        }

        res.json({
            success: true,
            settings: serializeSettings(settings)
        });
    } catch (error) {
        console.error('Get global settings error:', error);
        // Return defaults if there's an error
        res.json({
            success: true,
            settings: defaultSettingsPayload({ updatedAt: new Date().toISOString() })
        });
    }
};

/**
 * Update global settings
 * PUT /api/v1/admin/settings
 */
exports.updateSettings = async (req, res) => {
    try {
        const {
            serviceCommissionRate,
            productCommissionRate,
            taxRate,
            invoiceSellerNameAr,
            invoiceSellerNameEn,
            invoiceVatNumber,
            invoiceCrNumber,
            invoiceAddressAr,
            invoiceAddressEn,
            invoiceCity,
            invoiceCountry,
            invoiceEmail,
            invoicePhone,
            invoicePrefix,
            invoiceFooterNoteAr,
            invoiceFooterNoteEn,
            invoiceLogoPath
        } = req.body;
        const adminId = req.adminId; // Get admin ID from auth middleware

        // Validation
        if (serviceCommissionRate !== undefined && (serviceCommissionRate < 0 || serviceCommissionRate > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Service commission rate must be between 0 and 100'
            });
        }

        if (productCommissionRate !== undefined && (productCommissionRate < 0 || productCommissionRate > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Product commission rate must be between 0 and 100'
            });
        }

        if (taxRate !== undefined && (taxRate < 0 || taxRate > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Tax rate must be between 0 and 100'
            });
        }

        if (invoiceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invoice email must be a valid email address'
            });
        }

        // Get or create settings
        let settings = await db.GlobalSettings.findOne({
            order: [['updatedAt', 'DESC']]
        });

        if (!settings) {
            try {
                settings = await db.GlobalSettings.create({
                    ...defaultSettingsPayload({
                        serviceCommissionRate: serviceCommissionRate !== undefined ? serviceCommissionRate : 10.00,
                        productCommissionRate: productCommissionRate !== undefined ? productCommissionRate : 10.00,
                        taxRate: taxRate !== undefined ? taxRate : 15.00
                    }),
                    updatedBy: adminId || null
                });
            } catch (createError) {
                // If table doesn't exist, return error with instructions
                console.error('Failed to create global settings:', createError);
                return res.status(500).json({
                    success: false,
                    message: 'Global settings table does not exist. Please run the database migration first.',
                    error: createError.message
                });
            }
        } else {
            // Update only provided fields
            const updateData = {
                updatedBy: adminId || null
            };
            
            if (serviceCommissionRate !== undefined) {
                updateData.serviceCommissionRate = serviceCommissionRate;
            }
            if (productCommissionRate !== undefined) {
                updateData.productCommissionRate = productCommissionRate;
            }
            if (taxRate !== undefined) {
                updateData.taxRate = taxRate;
            }
            if (invoiceSellerNameAr !== undefined) updateData.invoiceSellerNameAr = invoiceSellerNameAr;
            if (invoiceSellerNameEn !== undefined) updateData.invoiceSellerNameEn = invoiceSellerNameEn;
            if (invoiceVatNumber !== undefined) updateData.invoiceVatNumber = invoiceVatNumber;
            if (invoiceCrNumber !== undefined) updateData.invoiceCrNumber = invoiceCrNumber;
            if (invoiceAddressAr !== undefined) updateData.invoiceAddressAr = invoiceAddressAr;
            if (invoiceAddressEn !== undefined) updateData.invoiceAddressEn = invoiceAddressEn;
            if (invoiceCity !== undefined) updateData.invoiceCity = invoiceCity;
            if (invoiceCountry !== undefined) updateData.invoiceCountry = invoiceCountry;
            if (invoiceEmail !== undefined) updateData.invoiceEmail = invoiceEmail;
            if (invoicePhone !== undefined) updateData.invoicePhone = invoicePhone;
            if (invoicePrefix !== undefined) updateData.invoicePrefix = invoicePrefix;
            if (invoiceFooterNoteAr !== undefined) updateData.invoiceFooterNoteAr = invoiceFooterNoteAr;
            if (invoiceFooterNoteEn !== undefined) updateData.invoiceFooterNoteEn = invoiceFooterNoteEn;
            if (invoiceLogoPath !== undefined) updateData.invoiceLogoPath = invoiceLogoPath;

            await settings.update(updateData);
        }

        // Reload settings to get updated values
        await settings.reload();

        res.json({
            success: true,
            message: 'Global settings updated successfully',
            settings: serializeSettings(settings)
        });
    } catch (error) {
        console.error('Update global settings error:', error);
        
        // Check if it's a table doesn't exist error
        if (error.message && error.message.includes('does not exist')) {
            return res.status(500).json({
                success: false,
                message: 'Global settings table does not exist. Please run the database migration (MIGRATE_GLOBAL_SETTINGS.sql) first.',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update global settings',
            error: error.message
        });
    }
};

/**
 * Get global settings (public endpoint for tenants)
 * GET /api/v1/settings/global
 */
exports.getGlobalSettings = async (req, res) => {
    try {
        const settings = await db.GlobalSettings.findOne({
            order: [['updatedAt', 'DESC']]
        });

        if (!settings) {
            // Return defaults if not set
            return res.json({
                success: true,
                settings: defaultSettingsPayload()
            });
        }

        res.json({
            success: true,
            settings: serializeSettings(settings)
        });
    } catch (error) {
        console.error('Get global settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch global settings',
            error: error.message
        });
    }
};

