/**
 * Tenant Service Controller
 * Handles service management for authenticated tenants
 */

const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

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
                        attributes: ['commissionRate', 'isPrimary', 'notes']
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
                        attributes: ['commissionRate', 'isPrimary', 'notes']
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
            rawPrice,
            taxRate,
            commissionRate,
            category,
            duration,
            includes, // JSON string or array
            benefits, // JSON string or array of {en, ar} objects
            whatToExpect, // JSON string or array of {en, ar} objects
            hasOffer,
            offerDetails,
            hasGift,
            giftType,
            giftDetails,
            employeeIds, // JSON string or array of staff IDs
            isActive = true,
            availableInCenter = true,
            availableHomeVisit = false
        } = req.body;

        // Validation
        if (!name_en || !name_ar) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Service name in both English and Arabic is required'
            });
        }

        if (!rawPrice || rawPrice < 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid raw price is required'
            });
        }

        // Get global settings for tax and commission rates (admin-controlled, ignore any tenant input)
        const tenantSettings = await getTenantSettings(tenantId);
        const finalTaxRate = tenantSettings.taxRate;
        const finalCommissionRate = tenantSettings.commissionRate;

        // Calculate final price
        const finalPrice = calculateFinalPrice(rawPrice, finalTaxRate, finalCommissionRate);

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

        // Parse benefits (can be JSON string or array)
        let benefitsArray = [];
        if (benefits) {
            try {
                benefitsArray = typeof benefits === 'string' ? JSON.parse(benefits) : benefits;
                if (!Array.isArray(benefitsArray)) {
                    benefitsArray = [];
                }
            } catch (e) {
                benefitsArray = [];
            }
        }

        // Parse whatToExpect (can be JSON string or array)
        let whatToExpectArray = [];
        if (whatToExpect) {
            try {
                whatToExpectArray = typeof whatToExpect === 'string' ? JSON.parse(whatToExpect) : whatToExpect;
                if (!Array.isArray(whatToExpectArray)) {
                    whatToExpectArray = [];
                }
            } catch (e) {
                whatToExpectArray = [];
            }
        }

        // Parse employee IDs
        let employeeIdsArray = [];
        if (employeeIds) {
            try {
                employeeIdsArray = typeof employeeIds === 'string' ? JSON.parse(employeeIds) : employeeIds;
                if (!Array.isArray(employeeIdsArray)) {
                    employeeIdsArray = [];
                }
            } catch (e) {
                employeeIdsArray = [];
            }
        }

        // Validate employees belong to tenant
        if (employeeIdsArray.length > 0) {
            const validEmployees = await db.Staff.findAll({
                where: {
                    id: { [Op.in]: employeeIdsArray },
                    tenantId
                },
                transaction
            });

            if (validEmployees.length !== employeeIdsArray.length) {
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
            rawPrice: parseFloat(rawPrice),
            taxRate: finalTaxRate,
            commissionRate: finalCommissionRate,
            finalPrice: finalPrice,
            category: category || 'general',
            duration: duration ? parseInt(duration) : 30,
            includes: includesArray,
            benefits: benefitsArray,
            whatToExpect: whatToExpectArray,
            hasOffer: hasOffer === true || hasOffer === 'true',
            offerDetails: offerDetails || null,
            hasGift: hasGift === true || hasGift === 'true',
            giftType: giftType || null,
            giftDetails: giftDetails || null,
            isActive: isActive === true || isActive === 'true',
            availableInCenter: availableInCenter === true || availableInCenter === 'true',
            availableHomeVisit: availableHomeVisit === true || availableHomeVisit === 'true'
        }, { transaction });

        // Assign employees to service
        if (employeeIdsArray.length > 0) {
            const serviceEmployeeData = employeeIdsArray.map((staffId, index) => ({
                serviceId: service.id,
                staffId: staffId,
                isPrimary: index === 0, // First employee is primary
                commissionRate: null, // Use default from staff
                notes: null
            }));

            await db.ServiceEmployee.bulkCreate(serviceEmployeeData, { transaction });
        }

        // Reload service with employees
        await service.reload({
            include: [
                {
                    model: db.Staff,
                    as: 'employees',
                    through: {
                        attributes: ['commissionRate', 'isPrimary', 'notes']
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
            rawPrice,
            // taxRate and commissionRate are ignored - always use global settings
            category,
            duration,
            includes,
            benefits,
            whatToExpect,
            hasOffer,
            offerDetails,
            hasGift,
            giftType,
            giftDetails,
            employeeIds,
            isActive,
            availableInCenter,
            availableHomeVisit
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

        // Calculate final price if rawPrice changed
        const updatedRawPrice = rawPrice !== undefined ? parseFloat(rawPrice) : (service.rawPrice || 0);
        const finalPrice = calculateFinalPrice(updatedRawPrice, finalTaxRate, finalCommissionRate);

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

        // Parse benefits
        let benefitsArray = service.benefits || [];
        if (benefits !== undefined) {
            try {
                benefitsArray = typeof benefits === 'string' ? JSON.parse(benefits) : benefits;
                if (!Array.isArray(benefitsArray)) {
                    benefitsArray = [];
                }
            } catch (e) {
                benefitsArray = service.benefits || [];
            }
        }

        // Parse whatToExpect
        let whatToExpectArray = service.whatToExpect || [];
        if (whatToExpect !== undefined) {
            try {
                whatToExpectArray = typeof whatToExpect === 'string' ? JSON.parse(whatToExpect) : whatToExpect;
                if (!Array.isArray(whatToExpectArray)) {
                    whatToExpectArray = [];
                }
            } catch (e) {
                whatToExpectArray = service.whatToExpect || [];
            }
        }

        // Parse employee IDs
        let employeeIdsArray = [];
        if (employeeIds !== undefined) {
            try {
                employeeIdsArray = typeof employeeIds === 'string' ? JSON.parse(employeeIds) : employeeIds;
                if (!Array.isArray(employeeIdsArray)) {
                    employeeIdsArray = [];
                }
            } catch (e) {
                employeeIdsArray = [];
            }
        }

        // Validate employees belong to tenant
        if (employeeIdsArray.length > 0) {
            const validEmployees = await db.Staff.findAll({
                where: {
                    id: { [Op.in]: employeeIdsArray },
                    tenantId
                },
                transaction
            });

            if (validEmployees.length !== employeeIdsArray.length) {
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
        if (rawPrice !== undefined) service.rawPrice = parseFloat(rawPrice);
        // Always update tax and commission rates from global settings (admin-controlled)
        service.taxRate = finalTaxRate;
        service.commissionRate = finalCommissionRate;
        service.finalPrice = finalPrice; // Always recalculate
        if (category !== undefined) service.category = category;
        if (duration !== undefined) service.duration = parseInt(duration);
        service.includes = includesArray;
        service.benefits = benefitsArray;
        service.whatToExpect = whatToExpectArray;
        if (hasOffer !== undefined) service.hasOffer = hasOffer === true || hasOffer === 'true';
        if (offerDetails !== undefined) service.offerDetails = offerDetails || null;
        if (hasGift !== undefined) service.hasGift = hasGift === true || hasGift === 'true';
        if (giftType !== undefined) service.giftType = giftType || null;
        if (giftDetails !== undefined) service.giftDetails = giftDetails || null;
        if (isActive !== undefined) service.isActive = isActive === true || isActive === 'true';
        if (availableInCenter !== undefined) service.availableInCenter = availableInCenter === true || availableInCenter === 'true';
        if (availableHomeVisit !== undefined) service.availableHomeVisit = availableHomeVisit === true || availableHomeVisit === 'true';

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
        if (employeeIds !== undefined) {
            // Remove existing assignments
            await db.ServiceEmployee.destroy({
                where: { serviceId: service.id },
                transaction
            });

            // Create new assignments
            if (employeeIdsArray.length > 0) {
                const serviceEmployeeData = employeeIdsArray.map((staffId, index) => ({
                    serviceId: service.id,
                    staffId: staffId,
                    isPrimary: index === 0,
                    commissionRate: null,
                    notes: null
                }));

                await db.ServiceEmployee.bulkCreate(serviceEmployeeData, { transaction });
            }
        }

        // Reload service with employees
        await service.reload({
            include: [
                {
                    model: db.Staff,
                    as: 'employees',
                    through: {
                        attributes: ['commissionRate', 'isPrimary', 'notes']
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

