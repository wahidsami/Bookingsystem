const db = require('../models');
const { ServicePackage, ServicePackageItem, Service, Staff } = db;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
        const packages = await ServicePackage.findAll({
            where: {
                tenantId: req.tenantId,
                isActive: true
            },
            include: [{
                model: ServicePackageItem,
                as: 'items',
                include: [
                    { model: Service, as: 'service' },
                    { model: Staff, as: 'defaultStaff' }
                ]
            }],
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
            include: [{
                model: ServicePackageItem,
                as: 'items',
                include: [
                    { model: Service, as: 'service' },
                    { model: Staff, as: 'defaultStaff' }
                ]
            }]
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
        const { name_en, name_ar, image, items } = req.body;

        if (!name_en || !name_ar || !Array.isArray(items) || items.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name_en, name_ar, or items'
            });
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
        const { name_en, name_ar, image, items } = req.body;

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

        // Update header
        if (name_en !== undefined) pkg.name_en = name_en;
        if (name_ar !== undefined) pkg.name_ar = name_ar;
        if (image !== undefined) pkg.image = image;

        // If items are provided, replace them entirely
        if (Array.isArray(items)) {
            // First destroy old items
            await ServicePackageItem.destroy({
                where: { packageId: pkg.id },
                transaction
            });

            // Calculate new totals
            let totalPrice = 0;
            let totalDuration = 0;
            
            const serviceIds = items.map(item => item.serviceId);
            const services = await Service.findAll({
                where: { id: serviceIds, tenantId: req.tenantId }
            });
            
            const serviceMap = services.reduce((acc, srv) => {
                acc[srv.id] = srv;
                return acc;
            }, {});

            const packageItems = [];
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

                packageItems.push({
                    packageId: pkg.id,
                    serviceId: item.serviceId,
                    variantId: item.variantId || null,
                    defaultStaffId: item.defaultStaffId || null,
                    sequenceOrder: item.sequenceOrder !== undefined ? item.sequenceOrder : i
                });
            }

            pkg.totalPrice = totalPrice;
            pkg.totalDuration = totalDuration;

            await ServicePackageItem.bulkCreate(packageItems, { transaction });
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
