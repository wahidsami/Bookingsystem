const db = require('../models');
const { ServicePackage, ServicePackageItem, Service, Staff, TenantServiceCategory, Appointment } = db;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer for bundle image upload (standard pattern)
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
        cb(null, 'bundle-' + uniqueSuffix + path.extname(file.originalname));
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

/**
 * Helper to parse items payload whether sent as JSON array or multipart JSON string
 */
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

/**
 * Helper to calculate bundle effective price and total duration
 */
async function calculateBundlePricingAndDuration(items, pricingType, customPrice, discountPercentage, tenantId, transaction) {
    let baseSumPrice = 0;
    let totalDuration = 0;

    const uniqueServiceIds = [...new Set(items.map(item => item.serviceId))];
    const services = await Service.findAll({
        where: {
            id: uniqueServiceIds,
            tenantId
        },
        transaction
    });

    const serviceMap = services.reduce((acc, srv) => {
        acc[srv.id] = srv;
        return acc;
    }, {});

    // Loop through all items (duplicate services supported as approved)
    for (const item of items) {
        const srv = serviceMap[item.serviceId];
        if (!srv) {
            throw new Error(`Service ${item.serviceId} not found or does not belong to your salon.`);
        }

        let itemPrice = parseFloat(srv.finalPrice ?? (typeof srv.calculateFinalPrice === 'function' ? srv.calculateFinalPrice() : srv.rawPrice ?? 0));
        let itemDuration = parseInt(srv.duration, 10) || 0;

        if (item.variantId && srv.variants && Array.isArray(srv.variants)) {
            const variant = srv.variants.find(v => v.id === item.variantId);
            if (variant) {
                itemPrice = parseFloat(variant.price ?? variant.finalPrice ?? itemPrice);
                itemDuration = parseInt(variant.duration, 10) || itemDuration;
            }
        }

        baseSumPrice += itemPrice;
        totalDuration += itemDuration;
    }

    let effectiveTotalPrice = baseSumPrice;

    if (pricingType === 'custom') {
        effectiveTotalPrice = Math.max(0, parseFloat(customPrice) || 0);
    } else if (pricingType === 'discount') {
        const pct = Math.min(100, Math.max(0, parseFloat(discountPercentage) || 0));
        effectiveTotalPrice = Math.max(0, Math.round(baseSumPrice * (1 - pct / 100) * 100) / 100);
    } else if (pricingType === 'free') {
        effectiveTotalPrice = 0.00;
    } else {
        // 'service' pricing
        effectiveTotalPrice = Math.round(baseSumPrice * 100) / 100;
    }

    return {
        baseSumPrice: Math.round(baseSumPrice * 100) / 100,
        effectiveTotalPrice,
        totalDuration
    };
}

/**
 * GET /api/v1/tenant/services2/bundles
 */
exports.getBundles = async (req, res) => {
    try {
        const where = {
            tenantId: req.tenantId,
            isActive: true
        };

        if (req.query.tenantServiceCategoryId) {
            where.tenantServiceCategoryId = req.query.tenantServiceCategoryId;
        }

        const bundles = await ServicePackage.findAll({
            where,
            include: [
                {
                    model: ServicePackageItem,
                    as: 'items',
                    include: [
                        { model: Service, as: 'service' },
                        { model: Staff, as: 'defaultStaff', attributes: ['id', 'name'] }
                    ]
                },
                {
                    model: TenantServiceCategory,
                    as: 'tenantCategory',
                    attributes: ['id', 'name_en', 'name_ar', 'slug', 'icon', 'sortOrder']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Ensure item ordering inside each bundle
        bundles.forEach(b => {
            if (b.items && b.items.length) {
                b.items.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
            }
        });

        res.json({
            success: true,
            bundles
        });
    } catch (error) {
        console.error('Error fetching Services 2 bundles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bundles'
        });
    }
};

/**
 * GET /api/v1/tenant/services2/bundles/:id
 */
exports.getBundle = async (req, res) => {
    try {
        const bundle = await ServicePackage.findOne({
            where: {
                id: req.params.id,
                tenantId: req.tenantId,
                isActive: true
            },
            include: [
                {
                    model: ServicePackageItem,
                    as: 'items',
                    include: [
                        { model: Service, as: 'service' },
                        { model: Staff, as: 'defaultStaff', attributes: ['id', 'name'] }
                    ]
                },
                {
                    model: TenantServiceCategory,
                    as: 'tenantCategory',
                    attributes: ['id', 'name_en', 'name_ar', 'slug', 'icon', 'sortOrder']
                }
            ]
        });

        if (!bundle) {
            return res.status(404).json({
                success: false,
                message: 'Bundle not found'
            });
        }

        if (bundle.items && bundle.items.length) {
            bundle.items.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        }

        res.json({
            success: true,
            bundle
        });
    } catch (error) {
        console.error('Error fetching bundle:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bundle'
        });
    }
};

/**
 * POST /api/v1/tenant/services2/bundles
 */
exports.createBundle = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const {
            name_en,
            name_ar,
            description_en,
            description_ar,
            tenantServiceCategoryId,
            scheduleType = 'sequence',
            pricingType = 'service',
            discountPercentage,
            customPrice,
            allowOnlineBooking = true,
            targetGender = 'all'
        } = req.body;

        const items = parseItemsPayload(req.body.items);

        let image = req.body.image || null;
        if (req.file) {
            image = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        }

        // Validate basic required fields
        if (!name_en || !name_ar) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Missing required bundle names (both Arabic and English are required)'
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Bundle must include at least one service'
            });
        }

        // Validate scheduleType
        const validScheduleTypes = ['sequence', 'parallel'];
        const resolvedScheduleType = validScheduleTypes.includes(scheduleType) ? scheduleType : 'sequence';

        // Validate pricingType
        const validPricingTypes = ['service', 'custom', 'discount', 'free'];
        const resolvedPricingType = validPricingTypes.includes(pricingType) ? pricingType : 'service';

        // Validate targetGender
        const validGenders = ['all', 'female', 'male'];
        const resolvedTargetGender = validGenders.includes(targetGender) ? targetGender : 'all';

        // Validate Tenant Category if provided
        let validTenantCategoryId = null;
        if (tenantServiceCategoryId) {
            const categoryMatch = await TenantServiceCategory.findOne({
                where: { id: tenantServiceCategoryId, tenantId: req.tenantId },
                transaction
            });
            if (!categoryMatch) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Selected tenant category does not exist or does not belong to your salon'
                });
            }
            validTenantCategoryId = categoryMatch.id;
        }

        // Calculate pricing and durations
        const pricing = await calculateBundlePricingAndDuration(
            items,
            resolvedPricingType,
            customPrice,
            discountPercentage,
            req.tenantId,
            transaction
        );

        // Create bundle (ServicePackage)
        const bundle = await ServicePackage.create({
            tenantId: req.tenantId,
            tenantServiceCategoryId: validTenantCategoryId,
            name_en: name_en.trim(),
            name_ar: name_ar.trim(),
            description_en: description_en ? description_en.trim() : null,
            description_ar: description_ar ? description_ar.trim() : null,
            image,
            scheduleType: resolvedScheduleType,
            pricingType: resolvedPricingType,
            discountPercentage: resolvedPricingType === 'discount' ? parseFloat(discountPercentage) || 0 : null,
            customPrice: resolvedPricingType === 'custom' ? parseFloat(customPrice) || 0 : null,
            allowOnlineBooking: String(allowOnlineBooking) !== 'false',
            targetGender: resolvedTargetGender,
            totalPrice: pricing.effectiveTotalPrice,
            totalDuration: pricing.totalDuration,
            isActive: true
        }, { transaction });

        // Create package items with sequenceOrder
        const packageItems = items.map((item, index) => ({
            packageId: bundle.id,
            serviceId: item.serviceId,
            variantId: item.variantId || null,
            defaultStaffId: item.defaultStaffId || null,
            sequenceOrder: item.sequenceOrder !== undefined ? Number(item.sequenceOrder) : index
        }));

        await ServicePackageItem.bulkCreate(packageItems, { transaction });

        await transaction.commit();

        // Fetch full created bundle
        const createdBundle = await ServicePackage.findOne({
            where: { id: bundle.id },
            include: [
                {
                    model: ServicePackageItem,
                    as: 'items',
                    include: [
                        { model: Service, as: 'service' },
                        { model: Staff, as: 'defaultStaff', attributes: ['id', 'name'] }
                    ]
                },
                {
                    model: TenantServiceCategory,
                    as: 'tenantCategory',
                    attributes: ['id', 'name_en', 'name_ar', 'slug', 'icon', 'sortOrder']
                }
            ]
        });

        res.status(201).json({
            success: true,
            bundle: createdBundle
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try { await transaction.rollback(); } catch (_) {}
        }
        console.error('Error creating Services 2 bundle:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create bundle'
        });
    }
};

/**
 * PUT /api/v1/tenant/services2/bundles/:id
 */
exports.updateBundle = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const bundleId = req.params.id;
        const {
            name_en,
            name_ar,
            description_en,
            description_ar,
            tenantServiceCategoryId,
            scheduleType,
            pricingType,
            discountPercentage,
            customPrice,
            allowOnlineBooking,
            targetGender,
            isActive
        } = req.body;

        const bundle = await ServicePackage.findOne({
            where: {
                id: bundleId,
                tenantId: req.tenantId
            },
            transaction
        });

        if (!bundle) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Bundle not found'
            });
        }

        // Validate Category if provided
        if (tenantServiceCategoryId !== undefined) {
            if (tenantServiceCategoryId) {
                const categoryMatch = await TenantServiceCategory.findOne({
                    where: { id: tenantServiceCategoryId, tenantId: req.tenantId },
                    transaction
                });
                if (!categoryMatch) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'Selected tenant category does not exist or does not belong to your salon'
                    });
                }
                bundle.tenantServiceCategoryId = categoryMatch.id;
            } else {
                bundle.tenantServiceCategoryId = null;
            }
        }

        if (name_en !== undefined) bundle.name_en = name_en.trim();
        if (name_ar !== undefined) bundle.name_ar = name_ar.trim();
        if (description_en !== undefined) bundle.description_en = description_en ? description_en.trim() : null;
        if (description_ar !== undefined) bundle.description_ar = description_ar ? description_ar.trim() : null;

        if (scheduleType !== undefined) {
            const validScheduleTypes = ['sequence', 'parallel'];
            if (validScheduleTypes.includes(scheduleType)) {
                bundle.scheduleType = scheduleType;
            }
        }

        if (targetGender !== undefined) {
            const validGenders = ['all', 'female', 'male'];
            if (validGenders.includes(targetGender)) {
                bundle.targetGender = targetGender;
            }
        }

        if (allowOnlineBooking !== undefined) {
            bundle.allowOnlineBooking = String(allowOnlineBooking) !== 'false';
        }

        if (isActive !== undefined) {
            bundle.isActive = Boolean(isActive);
        }

        if (req.file) {
            bundle.image = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        } else if (req.body.image !== undefined) {
            bundle.image = req.body.image || null;
        }

        const effectivePricingType = pricingType !== undefined ? pricingType : bundle.pricingType;
        const effectiveCustomPrice = customPrice !== undefined ? customPrice : bundle.customPrice;
        const effectiveDiscountPct = discountPercentage !== undefined ? discountPercentage : bundle.discountPercentage;

        bundle.pricingType = effectivePricingType;
        bundle.customPrice = effectivePricingType === 'custom' ? parseFloat(effectiveCustomPrice) || 0 : null;
        bundle.discountPercentage = effectivePricingType === 'discount' ? parseFloat(effectiveDiscountPct) || 0 : null;

        // Check if items are provided to replace
        const items = req.body.items ? parseItemsPayload(req.body.items) : null;
        if (Array.isArray(items) && items.length > 0) {
            // Load existing active items for this package
            const existingItems = await ServicePackageItem.findAll({
                where: { packageId: bundle.id, isActive: true },
                transaction
            });

            // Calculate pricing
            const pricing = await calculateBundlePricingAndDuration(
                items,
                effectivePricingType,
                effectiveCustomPrice,
                effectiveDiscountPct,
                req.tenantId,
                transaction
            );

            bundle.totalPrice = pricing.effectiveTotalPrice;
            bundle.totalDuration = pricing.totalDuration;

            // In-place reconciliation to preserve historical ServicePackageItem IDs and appointment FK integrity
            // SAFETY: Operates exclusively on currently active package items.
            // Inactive historical items are never matched, reactivated, or deleted.
            const matchedExistingIds = new Set();
            const itemPlans = items.map((item, index) => ({
                rawItem: item,
                targetSequenceOrder: item.sequenceOrder !== undefined ? Number(item.sequenceOrder) : index,
                matchedExisting: null
            }));

            // Pass 1: Incoming item with a valid existing active package-item ID
            // Match and update that exact existing row in place
            for (const plan of itemPlans) {
                const rawId = plan.rawItem.id;
                if (rawId) {
                    const found = existingItems.find(e => e.id === rawId && !matchedExistingIds.has(e.id));
                    if (found) {
                        plan.matchedExisting = found;
                        matchedExistingIds.add(found.id);
                    }
                }
            }

            // Pass 2: Incoming item without an ID matches only against an unmatched existing active row
            // when the serviceId + variantId combination is unambiguous
            for (const plan of itemPlans) {
                if (!plan.matchedExisting) {
                    const targetServiceId = plan.rawItem.serviceId;
                    const targetVariantId = plan.rawItem.variantId || null;

                    const candidateMatches = existingItems.filter(e =>
                        !matchedExistingIds.has(e.id) &&
                        e.serviceId === targetServiceId &&
                        (e.variantId || null) === targetVariantId
                    );

                    if (candidateMatches.length === 1) {
                        plan.matchedExisting = candidateMatches[0];
                        matchedExistingIds.add(candidateMatches[0].id);
                    }
                }
            }

            // Execute in-place updates for matched items or create new items (Rule 3)
            for (const plan of itemPlans) {
                if (plan.matchedExisting) {
                    plan.matchedExisting.serviceId = plan.rawItem.serviceId;
                    plan.matchedExisting.variantId = plan.rawItem.variantId || null;
                    plan.matchedExisting.defaultStaffId = plan.rawItem.defaultStaffId || null;
                    plan.matchedExisting.sequenceOrder = plan.targetSequenceOrder;
                    plan.matchedExisting.isActive = true;
                    await plan.matchedExisting.save({ transaction });
                } else {
                    await ServicePackageItem.create({
                        packageId: bundle.id,
                        serviceId: plan.rawItem.serviceId,
                        variantId: plan.rawItem.variantId || null,
                        defaultStaffId: plan.rawItem.defaultStaffId || null,
                        sequenceOrder: plan.targetSequenceOrder,
                        isActive: true
                    }, { transaction });
                }
            }

            // Removed items: For existing active package items missing from incoming list
            const unmatchedExisting = existingItems.filter(e => !matchedExistingIds.has(e.id));
            for (const orphan of unmatchedExisting) {
                const appointmentCount = await Appointment.count({
                    where: { packageItemId: orphan.id },
                    transaction
                });

                if (appointmentCount === 0) {
                    // Safe to delete because no appointments reference it
                    await orphan.destroy({ transaction });
                } else {
                    // Referenced by existing appointments; NEVER delete to preserve historical FK references
                    // Deactivate so it is excluded from current bundle reads, UI, and future bookings
                    orphan.isActive = false;
                    await orphan.save({ transaction });
                }
            }
        } else if (pricingType !== undefined || customPrice !== undefined || discountPercentage !== undefined) {
            // Recalculate price on existing active items if pricing parameters changed
            const existingItems = await ServicePackageItem.findAll({
                where: { packageId: bundle.id, isActive: true },
                transaction
            });

            if (existingItems.length > 0) {
                const pricing = await calculateBundlePricingAndDuration(
                    existingItems,
                    effectivePricingType,
                    effectiveCustomPrice,
                    effectiveDiscountPct,
                    req.tenantId,
                    transaction
                );
                bundle.totalPrice = pricing.effectiveTotalPrice;
                bundle.totalDuration = pricing.totalDuration;
            }
        }

        await bundle.save({ transaction });
        await transaction.commit();

        const updatedBundle = await ServicePackage.findOne({
            where: { id: bundle.id },
            include: [
                {
                    model: ServicePackageItem,
                    as: 'items',
                    include: [
                        { model: Service, as: 'service' },
                        { model: Staff, as: 'defaultStaff', attributes: ['id', 'name'] }
                    ]
                },
                {
                    model: TenantServiceCategory,
                    as: 'tenantCategory',
                    attributes: ['id', 'name_en', 'name_ar', 'slug', 'icon', 'sortOrder']
                }
            ]
        });

        res.json({
            success: true,
            bundle: updatedBundle
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try { await transaction.rollback(); } catch (_) {}
        }
        console.error('Error updating Services 2 bundle:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update bundle'
        });
    }
};

/**
 * DELETE /api/v1/tenant/services2/bundles/:id
 */
exports.deleteBundle = async (req, res) => {
    try {
        const bundle = await ServicePackage.findOne({
            where: {
                id: req.params.id,
                tenantId: req.tenantId
            }
        });

        if (!bundle) {
            return res.status(404).json({
                success: false,
                message: 'Bundle not found'
            });
        }

        // Soft delete
        bundle.isActive = false;
        await bundle.save();

        res.json({
            success: true,
            message: 'Bundle deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting bundle:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete bundle'
        });
    }
};
