/**
 * Tenant Service Controller
 * Handles service management for authenticated tenants
 */

const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { normalizeServicePaymentOptions } = require('../utils/tenantPaymentSettings');

// Configure multer for service image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../uploads/tenants/services');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/webp';

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
    fileFilter: fileFilter
});

// Middleware for handling service image upload
exports.uploadImage = upload.single('image');

/**
 * Calculate final price based on raw price, tax, and commission
 */
function calculateFinalPrice(rawPrice, taxRate, commissionRate) {
    const raw = parseFloat(rawPrice || 0);
    const tax = raw * (parseFloat(taxRate || 15) / 100);
    const commission = raw * (parseFloat(commissionRate || 10) / 100);
    return parseFloat((raw + tax + commission).toFixed(2));
}

const SERVICE_TARGET_GENDERS = new Set(['all', 'female', 'male']);
const SERVICE_PRICE_TYPES = new Set(['free', 'fixed']);
const SERVICE_EMPLOYEE_COMMISSION_TYPES = new Set(['fixed', 'percentage']);

function normalizeServiceTargetGender(value) {
    const normalized = `${value ?? 'all'}`.trim().toLowerCase();
    if (!normalized) {
        return 'all';
    }

    return SERVICE_TARGET_GENDERS.has(normalized) ? normalized : 'all';
}

function normalizeServicePriceType(value) {
    const normalized = `${value ?? 'fixed'}`.trim().toLowerCase();
    if (!normalized) {
        return 'fixed';
    }

    return SERVICE_PRICE_TYPES.has(normalized) ? normalized : 'fixed';
}

function normalizeServiceVariant(variant) {
    if (!variant || typeof variant !== 'object') {
        return null;
    }

    const description = `${variant.description ?? ''}`.trim();
    const duration = parseInt(variant.duration, 10);
    const finalPrice = parseFloat(variant.finalPrice ?? variant.price ?? 0);
    const id = `${variant.id ?? ''}`.trim();
    const fallbackPayload = JSON.stringify({
        description: description.toLowerCase(),
        duration: Number.isFinite(duration) && duration > 0 ? duration : 30,
        finalPrice: Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0,
        isActive: variant.isActive === undefined || variant.isActive === null
            ? true
            : variant.isActive === true || variant.isActive === 'true'
    });
    let fallbackHash = 0;
    for (let index = 0; index < fallbackPayload.length; index += 1) {
        fallbackHash = ((fallbackHash << 5) - fallbackHash) + fallbackPayload.charCodeAt(index);
        fallbackHash |= 0;
    }

    return {
        id: id || `variant-${Math.abs(fallbackHash).toString(36)}`,
        description,
        duration: Number.isFinite(duration) && duration > 0 ? duration : 30,
        finalPrice: Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0,
        isActive: variant.isActive === undefined || variant.isActive === null
            ? true
            : variant.isActive === true || variant.isActive === 'true'
    };
}

function parseServiceVariants(input) {
    if (!input) {
        return [];
    }

    try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map(normalizeServiceVariant)
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

function parseServicePaymentOptions(input) {
    return normalizeServicePaymentOptions(input);
}

function normalizeServiceEmployeeAssignment(input, index = 0) {
    if (typeof input === 'string') {
        const employeeId = input.trim();
        if (!employeeId) {
            return null;
        }

        return {
            employeeId,
            isAssigned: true,
            hasCommission: false,
            commissionType: 'percentage',
            commissionValue: '',
            isPrimary: index === 0
        };
    }

    if (!input || typeof input !== 'object') {
        return null;
    }

    const value = input;
    const employeeId = `${value.employeeId || value.staffId || ''}`.trim();
    if (!employeeId) {
        return null;
    }

    const commissionTypeRaw = `${value.commissionType || 'percentage'}`.trim().toLowerCase();
    const commissionType = SERVICE_EMPLOYEE_COMMISSION_TYPES.has(commissionTypeRaw) ? commissionTypeRaw : 'percentage';
    const commissionValue = `${value.commissionValue ?? value.commissionRate ?? ''}`.trim();
    const isAssigned = value.isAssigned === undefined ? true : value.isAssigned === true || value.isAssigned === 'true';
    const hasCommission = value.hasCommission === true || value.hasCommission === 'true' || commissionValue !== '';

    return {
        employeeId,
        isAssigned,
        hasCommission,
        commissionType,
        commissionValue,
        isPrimary: value.isPrimary === true || value.isPrimary === 'true'
    };
}

function parseServiceEmployeeAssignments(input) {
    if (!input) {
        return [];
    }

    try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((item, index) => normalizeServiceEmployeeAssignment(item, index))
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

function buildServiceEmployeeRows(serviceId, assignments) {
    return assignments
        .filter((assignment) => assignment.isAssigned)
        .map((assignment, index) => {
            const commissionValue = parseFloat(assignment.commissionValue || 0);
            const hasCommission = assignment.hasCommission === true;
            const commissionType = hasCommission ? assignment.commissionType : null;
            const commissionValueNumber = hasCommission && Number.isFinite(commissionValue) && commissionValue >= 0
                ? parseFloat(commissionValue.toFixed(2))
                : null;

            return {
                serviceId,
                staffId: assignment.employeeId,
                isPrimary: index === 0 || assignment.isPrimary === true,
                commissionRate: hasCommission && commissionType === 'percentage' && commissionValueNumber !== null
                    ? commissionValueNumber
                    : null,
                commissionType,
                commissionValue: commissionValueNumber,
                notes: null
            };
        });
}

function calculateRawPriceFromFinalPrice(finalPrice, taxRate, commissionRate) {
    const final = parseFloat(finalPrice || 0);
    const tax = parseFloat(taxRate || 15) / 100;
    const commission = parseFloat(commissionRate || 10) / 100;
    const multiplier = 1 + tax + commission;

    if (!Number.isFinite(final) || !Number.isFinite(multiplier) || multiplier <= 0) {
        return 0;
    }

    return parseFloat((final / multiplier).toFixed(2));
}

/**
 * Get global settings for default commission and tax rates
 * Now uses admin-controlled global settings instead of tenant-specific
 */
async function getTenantSettings(tenantId) {
    try {
        // Get global settings (admin-controlled)
        const globalSettings = await db.GlobalSettings.findOne({
            order: [['updatedAt', 'DESC']]
        });
        
        if (globalSettings) {
            return {
                commissionRate: parseFloat(globalSettings.serviceCommissionRate),
                taxRate: parseFloat(globalSettings.taxRate)
            };
        }
    } catch (error) {
        console.error('Failed to fetch global settings:', error);
    }
    
    // Return defaults if not found
    return {
        commissionRate: 10.00,
        taxRate: 15.00
    };
}

/**
 * Get all active service categories for tenant service forms.
 * GET /api/v1/tenant/services/categories
 */
exports.getServiceCategories = async (req, res) => {
    try {
        const categories = await db.ServiceCategory.findAll({
            where: { isActive: true },
            order: [['sortOrder', 'ASC'], ['name_en', 'ASC']],
            attributes: ['id', 'name_en', 'name_ar', 'slug', 'icon', 'sortOrder']
        });

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get service categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch service categories',
            error: error.message
        });
    }
};

/**
 * Get all services for the authenticated tenant
 * GET /api/v1/tenant/services
 */
exports.getServices = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { isActive, category, search } = req.query;

        const where = { tenantId };
        
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        if (category) {
            where.category = category;
        }

        if (search) {
            where[Op.or] = [
                { name_en: { [Op.iLike]: `%${search}%` } },
                { name_ar: { [Op.iLike]: `%${search}%` } },
                { description_en: { [Op.iLike]: `%${search}%` } },
                { description_ar: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const services = await db.Service.findAll({
            where,
            include: [
                {
                    model: db.Staff,
                    as: 'employees',
                    through: {
                        attributes: ['commissionRate', 'commissionType', 'commissionValue', 'isPrimary', 'notes']
                    },
                    attributes: ['id', 'name', 'photo', 'isActive']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            services,
            count: services.length
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services',
            error: error.message
        });
    }
};

/**
 * Get a single service by ID
 * GET /api/v1/tenant/services/:id
 */
exports.getService = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const service = await db.Service.findOne({
            where: {
                id,
                tenantId
            },
            include: [
                {
                    model: db.Staff,
                    as: 'employees',
                    through: {
                        attributes: ['commissionRate', 'commissionType', 'commissionValue', 'isPrimary', 'notes']
                    },
                    attributes: ['id', 'name', 'photo', 'isActive']
                }
            ]
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        res.json({
            success: true,
            service
        });
    } catch (error) {
        console.error('Get service error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch service',
            error: error.message
        });
    }
};

/**
 * Create a new service
 * POST /api/v1/tenant/services
 */
exports.createService = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const {
            name_en,
            name_ar,
            description_en,
            description_ar,
            finalPrice,
            rawPrice,
            taxRate,
            commissionRate,
            priceType,
            targetGender,
            category,
            duration,
            includes, // JSON string or array
            variants,
            paymentOptions,
            employeeAssignments,
            hasOffer,
            offerDetails,
            hasGift,
            giftType,
            giftDetails,
            employeeIds, // JSON string or array of staff IDs
            isActive = true,
            availableInCenter = true,
            availableHomeVisit = false,
            allowReschedule = false
        } = req.body;

        // Validation
        if (!name_en || !name_ar) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Service name in both English and Arabic is required'
            });
        }

        const targetGenderValue = normalizeServiceTargetGender(targetGender);
        const priceTypeValue = normalizeServicePriceType(priceType);
        const rawPriceValue = rawPrice !== undefined && `${rawPrice}`.trim() !== '' ? parseFloat(rawPrice) : null;
        const finalPriceValue = finalPrice !== undefined && `${finalPrice}`.trim() !== '' ? parseFloat(finalPrice) : null;
        const hasValidRawPrice = rawPriceValue !== null && !Number.isNaN(rawPriceValue) && rawPriceValue >= 0;
        const hasValidFinalPrice = finalPriceValue !== null && !Number.isNaN(finalPriceValue) && finalPriceValue >= 0;

        if (priceTypeValue !== 'free' && !hasValidRawPrice && !hasValidFinalPrice) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid final price is required'
            });
        }

        // Get global settings for tax and commission rates (admin-controlled, ignore any tenant input)
        const tenantSettings = await getTenantSettings(tenantId);
        const finalTaxRate = tenantSettings.taxRate;
        const finalCommissionRate = tenantSettings.commissionRate;

        let derivedRawPrice;
        let derivedFinalPrice;

        if (priceTypeValue === 'free') {
            derivedRawPrice = 0;
            derivedFinalPrice = 0;
        } else if (hasValidFinalPrice) {
            derivedFinalPrice = parseFloat(finalPriceValue.toFixed(2));
            derivedRawPrice = calculateRawPriceFromFinalPrice(derivedFinalPrice, finalTaxRate, finalCommissionRate);
        } else {
            derivedRawPrice = parseFloat(rawPriceValue.toFixed(2));
            derivedFinalPrice = calculateFinalPrice(derivedRawPrice, finalTaxRate, finalCommissionRate);
        }

        // Parse includes (can be JSON string or array)
        let includesArray = [];
        if (includes) {
            try {
                includesArray = typeof includes === 'string' ? JSON.parse(includes) : includes;
                if (!Array.isArray(includesArray)) {
                    includesArray = [];
                }
            } catch (e) {
                includesArray = [];
            }
        }

        const variantsArray = parseServiceVariants(variants);
        const paymentOptionsArray = parseServicePaymentOptions(paymentOptions);

        const parsedEmployeeAssignments = parseServiceEmployeeAssignments(employeeAssignments || employeeIds);
        const selectedEmployeeAssignments = parsedEmployeeAssignments.filter((assignment) => assignment.isAssigned);

        // Validate employees belong to tenant
        if (selectedEmployeeAssignments.length > 0) {
            const validEmployees = await db.Staff.findAll({
                where: {
                    id: { [Op.in]: selectedEmployeeAssignments.map((assignment) => assignment.employeeId) },
                    tenantId
                },
                transaction
            });

            if (validEmployees.length !== selectedEmployeeAssignments.length) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'One or more selected employees do not belong to your tenant'
                });
            }
        }

        // Get image path if uploaded
        let imagePath = null;
        if (req.file) {
            imagePath = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        }

        // Create service
        const service = await db.Service.create({
            tenantId,
            name_en,
            name_ar,
            description_en: description_en || null,
            description_ar: description_ar || null,
            image: imagePath,
            rawPrice: derivedRawPrice,
            taxRate: finalTaxRate,
            commissionRate: finalCommissionRate,
            finalPrice: derivedFinalPrice,
            priceType: priceTypeValue,
            targetGender: targetGenderValue,
            category: category || 'general',
            duration: duration ? parseInt(duration) : 30,
            includes: includesArray,
            variants: variantsArray,
            paymentOptions: paymentOptionsArray,
            hasOffer: hasOffer === true || hasOffer === 'true',
            offerDetails: offerDetails || null,
            hasGift: hasGift === true || hasGift === 'true',
            giftType: giftType || null,
            giftDetails: giftDetails || null,
            isActive: isActive === true || isActive === 'true',
            availableInCenter: availableInCenter === true || availableInCenter === 'true',
            availableHomeVisit: availableHomeVisit === true || availableHomeVisit === 'true',
            allowReschedule: allowReschedule === true || allowReschedule === 'true'
        }, { transaction });

        // Assign employees to service
        if (selectedEmployeeAssignments.length > 0) {
            await db.ServiceEmployee.bulkCreate(buildServiceEmployeeRows(service.id, selectedEmployeeAssignments), { transaction });
        }

        // Reload service with employees
        await service.reload({
            include: [
                {
                    model: db.Staff,
                    as: 'employees',
                    through: {
                        attributes: ['commissionRate', 'commissionType', 'commissionValue', 'isPrimary', 'notes']
                    }
                }
            ],
            transaction
        });

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            service
        });
    } catch (error) {
        await transaction.rollback();
        
        // Clean up uploaded file if service creation fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('Create service error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create service',
            error: error.message
        });
    }
};

/**
 * Update a service
 * PUT /api/v1/tenant/services/:id
 */
exports.updateService = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const {
            name_en,
            name_ar,
            description_en,
            description_ar,
            finalPrice,
            rawPrice,
            // taxRate and commissionRate are ignored - always use global settings
            priceType,
            targetGender,
            category,
            duration,
            includes,
            variants,
            paymentOptions,
            employeeAssignments,
            hasOffer,
            offerDetails,
            hasGift,
            giftType,
            giftDetails,
            employeeIds,
            isActive,
            availableInCenter,
            availableHomeVisit,
            allowReschedule
        } = req.body;

        // Find service
        const service = await db.Service.findOne({
            where: {
                id,
                tenantId
            },
            transaction
        });

        if (!service) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Get global settings for tax and commission rates (admin-controlled, ignore any tenant input)
        const tenantSettings = await getTenantSettings(tenantId);
        const finalTaxRate = tenantSettings.taxRate;
        const finalCommissionRate = tenantSettings.commissionRate;

        const targetGenderValue = normalizeServiceTargetGender(targetGender || service.targetGender || 'all');
        const priceTypeValue = normalizeServicePriceType(priceType || service.priceType || 'fixed');

        const rawPriceValue = rawPrice !== undefined && `${rawPrice}`.trim() !== '' ? parseFloat(rawPrice) : null;
        const finalPriceValue = finalPrice !== undefined && `${finalPrice}`.trim() !== '' ? parseFloat(finalPrice) : null;
        const hasValidRawPrice = rawPriceValue !== null && !Number.isNaN(rawPriceValue) && rawPriceValue >= 0;
        const hasValidFinalPrice = finalPriceValue !== null && !Number.isNaN(finalPriceValue) && finalPriceValue >= 0;

        if (priceTypeValue !== 'free' && !hasValidRawPrice && !hasValidFinalPrice) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid final price is required'
            });
        }

        let updatedRawPrice;
        let derivedFinalPrice;

        if (priceTypeValue === 'free') {
            updatedRawPrice = 0;
            derivedFinalPrice = 0;
        } else if (hasValidFinalPrice) {
            derivedFinalPrice = parseFloat(finalPriceValue.toFixed(2));
            updatedRawPrice = calculateRawPriceFromFinalPrice(derivedFinalPrice, finalTaxRate, finalCommissionRate);
        } else {
            updatedRawPrice = parseFloat(rawPriceValue.toFixed(2));
            derivedFinalPrice = calculateFinalPrice(updatedRawPrice, finalTaxRate, finalCommissionRate);
        }

        // Parse includes
        let includesArray = service.includes || [];
        if (includes !== undefined) {
            try {
                includesArray = typeof includes === 'string' ? JSON.parse(includes) : includes;
                if (!Array.isArray(includesArray)) {
                    includesArray = [];
                }
            } catch (e) {
                includesArray = service.includes || [];
            }
        }

        let variantsArray = service.variants || [];
        if (variants !== undefined) {
            variantsArray = parseServiceVariants(variants);
        }
        const paymentOptionsArray = paymentOptions !== undefined
            ? parseServicePaymentOptions(paymentOptions)
            : normalizeServicePaymentOptions(service.paymentOptions || []);

        const parsedEmployeeAssignments = employeeAssignments !== undefined
            ? parseServiceEmployeeAssignments(employeeAssignments)
            : parseServiceEmployeeAssignments(employeeIds);
        const selectedEmployeeAssignments = parsedEmployeeAssignments.filter((assignment) => assignment.isAssigned);

        // Validate employees belong to tenant
        if (selectedEmployeeAssignments.length > 0) {
            const validEmployees = await db.Staff.findAll({
                where: {
                    id: { [Op.in]: selectedEmployeeAssignments.map((assignment) => assignment.employeeId) },
                    tenantId
                },
                transaction
            });

            if (validEmployees.length !== selectedEmployeeAssignments.length) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'One or more selected employees do not belong to your tenant'
                });
            }
        }

        // Update fields
        if (name_en !== undefined) service.name_en = name_en;
        if (name_ar !== undefined) service.name_ar = name_ar;
        if (description_en !== undefined) service.description_en = description_en || null;
        if (description_ar !== undefined) service.description_ar = description_ar || null;
        if (rawPrice !== undefined || finalPrice !== undefined) service.rawPrice = updatedRawPrice;
        if (priceType !== undefined) service.priceType = priceTypeValue;
        // Always update tax and commission rates from global settings (admin-controlled)
        service.taxRate = finalTaxRate;
        service.commissionRate = finalCommissionRate;
        service.finalPrice = derivedFinalPrice; // Always recalculate
        if (targetGender !== undefined) service.targetGender = targetGenderValue;
        if (category !== undefined) service.category = category;
        if (duration !== undefined) service.duration = parseInt(duration);
        service.includes = includesArray;
        if (variants !== undefined) service.variants = variantsArray;
        if (paymentOptions !== undefined) service.paymentOptions = paymentOptionsArray;
        if (hasOffer !== undefined) service.hasOffer = hasOffer === true || hasOffer === 'true';
        if (offerDetails !== undefined) service.offerDetails = offerDetails || null;
        if (hasGift !== undefined) service.hasGift = hasGift === true || hasGift === 'true';
        if (giftType !== undefined) service.giftType = giftType || null;
        if (giftDetails !== undefined) service.giftDetails = giftDetails || null;
        if (isActive !== undefined) service.isActive = isActive === true || isActive === 'true';
        if (availableInCenter !== undefined) service.availableInCenter = availableInCenter === true || availableInCenter === 'true';
        if (availableHomeVisit !== undefined) service.availableHomeVisit = availableHomeVisit === true || availableHomeVisit === 'true';
        if (allowReschedule !== undefined) service.allowReschedule = allowReschedule === true || allowReschedule === 'true';

        // Handle image upload
        if (req.file) {
            // Delete old image if exists
            if (service.image) {
                const oldImagePath = path.join(__dirname, '../../uploads', service.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            
            // Set new image path
            service.image = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        }

        await service.save({ transaction });

        // Update employee assignments
        if (employeeAssignments !== undefined || employeeIds !== undefined) {
            // Remove existing assignments
            await db.ServiceEmployee.destroy({
                where: { serviceId: service.id },
                transaction
            });

            // Create new assignments
            if (selectedEmployeeAssignments.length > 0) {
                await db.ServiceEmployee.bulkCreate(buildServiceEmployeeRows(service.id, selectedEmployeeAssignments), { transaction });
            }
        }

        // Reload service with employees
        await service.reload({
            include: [
                {
                    model: db.Staff,
                    as: 'employees',
                    through: {
                        attributes: ['commissionRate', 'commissionType', 'commissionValue', 'isPrimary', 'notes']
                    }
                }
            ],
            transaction
        });

        await transaction.commit();

        res.json({
            success: true,
            message: 'Service updated successfully',
            service
        });
    } catch (error) {
        await transaction.rollback();
        
        // Clean up uploaded file if update fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('Update service error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update service',
            error: error.message
        });
    }
};

/**
 * Delete a service
 * DELETE /api/v1/tenant/services/:id
 */
exports.deleteService = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const service = await db.Service.findOne({
            where: {
                id,
                tenantId
            },
            transaction
        });

        if (!service) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if service has active appointments (optional - can be added later)
        // For now, we'll allow deletion

        // Delete image if exists
        if (service.image) {
            const imagePath = path.join(__dirname, '../../uploads', service.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Delete service (ServiceEmployee records will be deleted via CASCADE)
        await service.destroy({ transaction });
        await transaction.commit();

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Delete service error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete service',
            error: error.message
        });
    }
};

