/**
 * Admin Settings Controller
 * Manages global platform settings (commission rates, tax rates, etc.)
 */

const db = require('../models');

function normalizeOptionalText(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = value.toString().trim();
    return normalized || null;
}

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
                    ...defaultSettingsPayload()
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

        const normalizedInvoicePrefix = normalizeOptionalText(invoicePrefix);
        if (
            normalizedInvoicePrefix !== undefined &&
            normalizedInvoicePrefix !== null &&
            !/^[A-Za-z0-9-]{1,16}$/.test(normalizedInvoicePrefix)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invoice prefix must use only letters, numbers, and dashes, with max length 16'
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
                        taxRate: taxRate !== undefined ? taxRate : 15.00,
                        invoiceSellerNameAr: normalizeOptionalText(invoiceSellerNameAr) || 'رفاه',
                        invoiceSellerNameEn: normalizeOptionalText(invoiceSellerNameEn) || 'Refah',
                        invoiceVatNumber: normalizeOptionalText(invoiceVatNumber),
                        invoiceCrNumber: normalizeOptionalText(invoiceCrNumber),
                        invoiceAddressAr: normalizeOptionalText(invoiceAddressAr),
                        invoiceAddressEn: normalizeOptionalText(invoiceAddressEn),
                        invoiceCity: normalizeOptionalText(invoiceCity) || 'Riyadh',
                        invoiceCountry: normalizeOptionalText(invoiceCountry) || 'Saudi Arabia',
                        invoiceEmail: normalizeOptionalText(invoiceEmail),
                        invoicePhone: normalizeOptionalText(invoicePhone),
                        invoicePrefix: normalizedInvoicePrefix || 'INV',
                        invoiceFooterNoteAr: normalizeOptionalText(invoiceFooterNoteAr),
                        invoiceFooterNoteEn: normalizeOptionalText(invoiceFooterNoteEn),
                        invoiceLogoPath: normalizeOptionalText(invoiceLogoPath)
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
            if (invoiceSellerNameAr !== undefined) updateData.invoiceSellerNameAr = normalizeOptionalText(invoiceSellerNameAr);
            if (invoiceSellerNameEn !== undefined) updateData.invoiceSellerNameEn = normalizeOptionalText(invoiceSellerNameEn);
            if (invoiceVatNumber !== undefined) updateData.invoiceVatNumber = normalizeOptionalText(invoiceVatNumber);
            if (invoiceCrNumber !== undefined) updateData.invoiceCrNumber = normalizeOptionalText(invoiceCrNumber);
            if (invoiceAddressAr !== undefined) updateData.invoiceAddressAr = normalizeOptionalText(invoiceAddressAr);
            if (invoiceAddressEn !== undefined) updateData.invoiceAddressEn = normalizeOptionalText(invoiceAddressEn);
            if (invoiceCity !== undefined) updateData.invoiceCity = normalizeOptionalText(invoiceCity);
            if (invoiceCountry !== undefined) updateData.invoiceCountry = normalizeOptionalText(invoiceCountry) || 'Saudi Arabia';
            if (invoiceEmail !== undefined) updateData.invoiceEmail = normalizeOptionalText(invoiceEmail);
            if (invoicePhone !== undefined) updateData.invoicePhone = normalizeOptionalText(invoicePhone);
            if (invoicePrefix !== undefined) updateData.invoicePrefix = normalizedInvoicePrefix || 'INV';
            if (invoiceFooterNoteAr !== undefined) updateData.invoiceFooterNoteAr = normalizeOptionalText(invoiceFooterNoteAr);
            if (invoiceFooterNoteEn !== undefined) updateData.invoiceFooterNoteEn = normalizeOptionalText(invoiceFooterNoteEn);
            if (invoiceLogoPath !== undefined) updateData.invoiceLogoPath = normalizeOptionalText(invoiceLogoPath);

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

