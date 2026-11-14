const db = require('../models');
const { ServicePackage, ServicePackageItem, Service, Staff, Appointment } = db;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function parseItemsPayload(rawItems) {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === 'string') {
        try {
            const parsed = JSON.parse(rawItems);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

// Setup multer for image upload (using standard pattern)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/tenants/services');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'package-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

exports.uploadImage = upload.single('image');

exports.getPackages = async (req, res) => {
    try {
        const where = {
            tenantId: req.tenantId,
            isActive: true
        };

        if (req.query.tenantServiceCategoryId) {
            where.tenantServiceCategoryId = req.query.tenantServiceCategoryId;
        }

        const packages = await ServicePackage.findAll({
            where,
            include: [
                {
                    model: ServicePackageItem,
                    as: 'items',
                    include: [
                        { model: Service, as: 'service' },
                        { model: Staff, as: 'defaultStaff' }
                    ]
                },
                {
                    model: db.TenantServiceCategory,
                    as: 'tenantCategory',
                    attributes: ['id', 'name_en', 'name_ar', 'slug', 'icon', 'sortOrder']
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        // Sort items by sequenceOrder inside each package
        packages.forEach(pkg => {
            if (pkg.items && pkg.items.length) {
                pkg.items.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
            }
        });

        res.json({
            success: true,
            packages
        });
    } catch (error) {
        console.error('Error fetching packages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch packages'
        });
    }
};

exports.getPackage = async (req, res) => {
    try {
        const packageId = req.params.id;
        const pkg = await ServicePackage.findOne({
            where: {
                id: packageId,
                tenantId: req.tenantId,
                isActive: true
            },
            include: [
                {
                    model: ServicePackageItem,
                    as: 'items',
                    include: [
                        { model: Service, as: 'service' },
                        { model: Staff, as: 'defaultStaff' }
                    ]
                },
                {
                    model: db.TenantServiceCategory,
                    as: 'tenantCategory',
                    attributes: ['id', 'name_en', 'name_ar', 'slug', 'icon', 'sortOrder']
                }
            ]
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }
        
        if (pkg.items && pkg.items.length) {
            pkg.items.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        }

        res.json({
            success: true,
            package: pkg
        });
    } catch (error) {
        console.error('Error fetching package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch package'
        });
    }
};

exports.createPackage = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { name_en, name_ar, tenantServiceCategoryId, tenantCategoryId } = req.body;
        const items = parseItemsPayload(req.body.items);
        let image = req.body.image;
        if (req.file) {
            image = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        }

        if (!name_en || !name_ar || !Array.isArray(items) || items.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name_en, name_ar, or items'
            });
        }

        // Validate Services 2 tenant category if provided
        let validTenantCategoryId = null;
        const requestedTenantCatId = tenantServiceCategoryId || tenantCategoryId;
        if (requestedTenantCatId) {
            const categoryMatch = await db.TenantServiceCategory.findOne({
                where: { id: requestedTenantCatId, tenantId: req.tenantId },
                transaction
            });
            if (!categoryMatch) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'The selected tenant service category does not exist or does not belong to your salon'
                });
            }
            validTenantCategoryId = categoryMatch.id;
        }

        // Calculate totals based on the items provided
        let totalPrice = 0;
        let totalDuration = 0;
        
        const serviceIds = items.map(item => item.serviceId);
        const services = await Service.findAll({
            where: {
                id: serviceIds,
                tenantId: req.tenantId
            }
        });
        
        const serviceMap = services.reduce((acc, srv) => {
            acc[srv.id] = srv;
            return acc;
        }, {});

        for (const item of items) {
            const srv = serviceMap[item.serviceId];
            if (!srv) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Service ${item.serviceId} not found or does not belong to this tenant.`
                });
            }
            
            // For now, assuming simple price/duration. If variant overrides, apply here.
            let itemPrice = parseFloat(srv.finalPrice || srv.calculateFinalPrice());
            let itemDuration = parseInt(srv.duration, 10) || 0;
            
            if (item.variantId && srv.variants && Array.isArray(srv.variants)) {
                const variant = srv.variants.find(v => v.id === item.variantId);
                if (variant) {
                    itemPrice = parseFloat(variant.price || itemPrice);
                    itemDuration = parseInt(variant.duration, 10) || itemDuration;
                }
            }
            
            totalPrice += itemPrice;
            totalDuration += itemDuration;
        }

        const pkg = await ServicePackage.create({
            tenantId: req.tenantId,
            tenantServiceCategoryId: validTenantCategoryId,
            name_en,
            name_ar,
            image,
            totalPrice,
            totalDuration,
            isActive: true
        }, { transaction });

        const packageItems = items.map((item, index) => ({
            packageId: pkg.id,
            serviceId: item.serviceId,
            variantId: item.variantId || null,
            defaultStaffId: item.defaultStaffId || null,
            sequenceOrder: item.sequenceOrder !== undefined ? item.sequenceOrder : index
        }));

        await ServicePackageItem.bulkCreate(packageItems, { transaction });

        await transaction.commit();

        res.status(201).json({
            success: true,
            package: pkg
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create package'
        });
    }
};

exports.updatePackage = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const packageId = req.params.id;
        const { name_en, name_ar, image, tenantServiceCategoryId, tenantCategoryId } = req.body;
        const rawItems = req.body.items;
        const items = rawItems !== undefined ? parseItemsPayload(rawItems) : undefined;

        const pkg = await ServicePackage.findOne({
            where: {
                id: packageId,
                tenantId: req.tenantId,
                isActive: true
            }
        });

        if (!pkg) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        // Validate Services 2 tenant category if provided
        if (tenantServiceCategoryId !== undefined || tenantCategoryId !== undefined) {
            const requestedTenantCatId = tenantServiceCategoryId !== undefined ? tenantServiceCategoryId : tenantCategoryId;
            if (requestedTenantCatId) {
                const categoryMatch = await db.TenantServiceCategory.findOne({
                    where: { id: requestedTenantCatId, tenantId: req.tenantId },
                    transaction
                });
                if (!categoryMatch) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'The selected tenant service category does not exist or does not belong to your salon'
                    });
                }
                pkg.tenantServiceCategoryId = categoryMatch.id;
            } else {
                pkg.tenantServiceCategoryId = null;
            }
        }

        // Update header
        if (name_en !== undefined) pkg.name_en = name_en;
        if (name_ar !== undefined) pkg.name_ar = name_ar;
        if (image !== undefined) pkg.image = image;

        // If items are provided, reconcile them in-place to protect foreign key constraints
        if (Array.isArray(items) && items.length > 0) {
            const existingItems = await ServicePackageItem.findAll({
                where: { packageId: pkg.id },
                transaction
            });

            // Calculate new totals
            let totalPrice = 0;
            let totalDuration = 0;
            
            const serviceIds = items.map(item => item.serviceId);
            const services = await Service.findAll({
                where: { id: serviceIds, tenantId: req.tenantId },
                transaction
            });
            
            const serviceMap = services.reduce((acc, srv) => {
                acc[srv.id] = srv;
                return acc;
            }, {});

            const matchedExistingIds = new Set();
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const srv = serviceMap[item.serviceId];
                if (!srv) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Service ${item.serviceId} not found or does not belong to this tenant.`
                    });
                }
                
                let itemPrice = parseFloat(srv.finalPrice || (typeof srv.calculateFinalPrice === 'function' ? srv.calculateFinalPrice() : srv.rawPrice || 0));
                let itemDuration = parseInt(srv.duration, 10) || 0;
                
                if (item.variantId && srv.variants && Array.isArray(srv.variants)) {
                    const variant = srv.variants.find(v => v.id === item.variantId);
                    if (variant) {
                        itemPrice = parseFloat(variant.price || itemPrice);
                        itemDuration = parseInt(variant.duration, 10) || itemDuration;
                    }
                }
                
                totalPrice += itemPrice;
                totalDuration += itemDuration;

                const existing = (item.id && existingItems.find(e => e.id === item.id)) ||
                    existingItems.find(e => !matchedExistingIds.has(e.id) && e.serviceId === item.serviceId && (e.variantId || null) === (item.variantId || null));

                if (existing) {
                    matchedExistingIds.add(existing.id);
                    await existing.update({
                        serviceId: item.serviceId,
                        variantId: item.variantId || null,
                        defaultStaffId: item.defaultStaffId || null,
                        sequenceOrder: item.sequenceOrder !== undefined ? item.sequenceOrder : i,
                        isActive: item.isActive !== false
                    }, { transaction });
                } else {
                    await ServicePackageItem.create({
                        packageId: pkg.id,
                        serviceId: item.serviceId,
                        variantId: item.variantId || null,
                        defaultStaffId: item.defaultStaffId || null,
                        sequenceOrder: item.sequenceOrder !== undefined ? item.sequenceOrder : i,
                        isActive: item.isActive !== false
                    }, { transaction });
                }
            }

            for (const existing of existingItems) {
                if (!matchedExistingIds.has(existing.id)) {
                    const apptCount = await Appointment.count({
                        where: { packageItemId: existing.id },
                        transaction
                    });
                    if (apptCount === 0) {
                        await existing.destroy({ transaction });
                    } else {
                        await existing.update({ isActive: false }, { transaction });
                    }
                }
            }

            pkg.totalPrice = totalPrice;
            pkg.totalDuration = totalDuration;
        }

        await pkg.save({ transaction });
        await transaction.commit();

        res.json({
            success: true,
            package: pkg
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update package'
        });
    }
};

exports.deletePackage = async (req, res) => {
    try {
        const packageId = req.params.id;
        const pkg = await ServicePackage.findOne({
            where: {
                id: packageId,
                tenantId: req.tenantId
            }
        });

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        // Soft delete
        pkg.isActive = false;
        await pkg.save();

        res.json({
            success: true,
            message: 'Package deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete package'
        });
    }
};
