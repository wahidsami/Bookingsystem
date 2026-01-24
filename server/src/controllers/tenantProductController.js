/**
 * Tenant Product Controller
 * Handles product management for authenticated tenants
 */

const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

/**
 * Get global settings for tax and commission rates
 */
async function getGlobalSettings() {
    try {
        const settings = await db.GlobalSettings.findOne({
            order: [['updatedAt', 'DESC']]
        });
        
        if (settings) {
            return {
                productCommissionRate: parseFloat(settings.productCommissionRate),
                taxRate: parseFloat(settings.taxRate)
            };
        }
    } catch (error) {
        console.error('Failed to fetch global settings:', error);
    }
    // Return defaults if not found
    return {
        productCommissionRate: 10.00,
        taxRate: 15.00
    };
}

/**
 * Calculate final price for product
 */
function calculateProductPrice(rawPrice, taxRate, commissionRate) {
    const raw = parseFloat(rawPrice || 0);
    const tax = raw * (parseFloat(taxRate || 15) / 100);
    const commission = raw * (parseFloat(commissionRate || 10) / 100);
    return parseFloat((raw + tax + commission).toFixed(2));
}

// Configure multer for product image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../uploads/tenants/products');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
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

// Middleware for handling single product image upload (legacy)
exports.uploadImage = upload.single('image');

// Middleware for handling multiple product images (up to 5)
exports.uploadImages = upload.array('images', 5);

/**
 * Get all products for the authenticated tenant
 * GET /api/v1/tenant/products
 */
exports.getProducts = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { isAvailable, category, search } = req.query;

        const where = { tenantId };
        
        if (isAvailable !== undefined) {
            where.isAvailable = isAvailable === 'true';
        }

        if (category) {
            where.category = category;
        }

        if (search) {
            where[Op.or] = [
                { name_en: { [Op.iLike]: `%${search}%` } },
                { name_ar: { [Op.iLike]: `%${search}%` } },
                { description_en: { [Op.iLike]: `%${search}%` } },
                { description_ar: { [Op.iLike]: `%${search}%` } },
                { sku: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const products = await db.Product.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            products,
            count: products.length
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
            error: error.message
        });
    }
};

/**
 * Get a single product by ID
 * GET /api/v1/tenant/products/:id
 */
exports.getProduct = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const product = await db.Product.findOne({
            where: {
                id,
                tenantId
            }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            product
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product',
            error: error.message
        });
    }
};

/**
 * Create a new product
 * POST /api/v1/tenant/products
 */
exports.createProduct = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const {
            name_en,
            name_ar,
            description_en,
            description_ar,
            rawPrice, // Changed from price to rawPrice
            category,
            stock,
            sku,
            brand,
            size,
            color,
            ingredients, // Legacy field
            ingredients_en,
            ingredients_ar,
            howToUse_en,
            howToUse_ar,
            features_en,
            features_ar,
            isAvailable = true,
            isFeatured = false
        } = req.body;

        // Validation
        if (!name_en || !name_ar) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Product name in both English and Arabic is required'
            });
        }

        if (!rawPrice || rawPrice < 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid raw price is required'
            });
        }

        // Get global settings for tax and commission rates
        const globalSettings = await getGlobalSettings();
        const taxRate = globalSettings.taxRate;
        const commissionRate = globalSettings.productCommissionRate;

        // Calculate final price
        const finalPrice = calculateProductPrice(rawPrice, taxRate, commissionRate);

        if (stock === undefined || stock < 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid stock quantity is required'
            });
        }

        // Check SKU uniqueness if provided
        if (sku) {
            const existingProduct = await db.Product.findOne({
                where: { sku },
                transaction
            });
            if (existingProduct) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'SKU already exists'
                });
            }
        }

        // Handle multiple images (up to 5, minimum 1)
        let imagePaths = [];
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file => file.path.replace(/\\/g, '/').split('uploads/')[1]);
        } else if (req.file) {
            // Legacy single image support
            imagePaths = [req.file.path.replace(/\\/g, '/').split('uploads/')[1]];
        }

        // Validation: At least 1 image is required
        if (imagePaths.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'At least one product image is required'
            });
        }

        // Validation: Maximum 5 images
        if (imagePaths.length > 5) {
            await transaction.rollback();
            // Clean up uploaded files
            req.files?.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            return res.status(400).json({
                success: false,
                message: 'Maximum 5 images allowed per product'
            });
        }

        // Set legacy image field to first image for backward compatibility
        const imagePath = imagePaths[0];

        // Create product
        const product = await db.Product.create({
            tenantId,
            name_en,
            name_ar,
            description_en: description_en || null,
            description_ar: description_ar || null,
            image: imagePath, // Legacy field (first image)
            images: imagePaths, // New field (array of all images)
            rawPrice: parseFloat(rawPrice),
            taxRate: taxRate,
            commissionRate: commissionRate,
            price: finalPrice,
            category: category || 'general',
            stock: parseInt(stock),
            sku: sku || null,
            brand: brand || null,
            size: size || null,
            color: color || null,
            ingredients: ingredients || null, // Legacy field
            ingredients_en: ingredients_en || null,
            ingredients_ar: ingredients_ar || null,
            howToUse_en: howToUse_en || null,
            howToUse_ar: howToUse_ar || null,
            features_en: features_en || null,
            features_ar: features_ar || null,
            isAvailable: isAvailable === true || isAvailable === 'true',
            isFeatured: isFeatured === true || isFeatured === 'true'
        }, { transaction });

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product
        });
    } catch (error) {
        await transaction.rollback();
        
        // Clean up uploaded files if product creation fails
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        } else if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create product',
            error: error.message
        });
    }
};

/**
 * Update a product
 * PUT /api/v1/tenant/products/:id
 */
exports.updateProduct = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const {
            name_en,
            name_ar,
            description_en,
            description_ar,
            rawPrice, // Changed from price to rawPrice
            category,
            stock,
            sku,
            brand,
            size,
            color,
            ingredients, // Legacy field
            ingredients_en,
            ingredients_ar,
            howToUse_en,
            howToUse_ar,
            features_en,
            features_ar,
            isAvailable,
            isFeatured
        } = req.body;

        // Find product
        const product = await db.Product.findOne({
            where: {
                id,
                tenantId
            },
            transaction
        });

        if (!product) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Get global settings for tax and commission rates
        const globalSettings = await getGlobalSettings();
        const taxRate = globalSettings.taxRate;
        const commissionRate = globalSettings.productCommissionRate;

        // Calculate final price if rawPrice is provided
        let finalPrice = product.price;
        if (rawPrice !== undefined) {
            finalPrice = calculateProductPrice(rawPrice, taxRate, commissionRate);
        }

        // Check SKU uniqueness if changed
        if (sku && sku !== product.sku) {
            const existingProduct = await db.Product.findOne({
                where: { sku },
                transaction
            });
            if (existingProduct) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'SKU already exists'
                });
            }
        }

        // Handle multiple images if uploaded
        let imagePaths = product.images || (product.image ? [product.image] : []);
        if (req.files && req.files.length > 0) {
            const newImagePaths = req.files.map(file => file.path.replace(/\\/g, '/').split('uploads/')[1]);
            
            // Validation: Maximum 5 images total
            const totalImages = imagePaths.length + newImagePaths.length;
            if (totalImages > 5) {
                await transaction.rollback();
                // Clean up uploaded files
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 5 images allowed per product'
                });
            }
            
            // Add new images to existing ones
            imagePaths = [...imagePaths, ...newImagePaths];
        } else if (req.file) {
            // Legacy single image support
            const newImagePath = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
            if (imagePaths.length < 5) {
                imagePaths = [...imagePaths, newImagePath];
            }
        }

        // Validation: At least 1 image is required
        if (imagePaths.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'At least one product image is required'
            });
        }

        // Update fields
        if (name_en !== undefined) product.name_en = name_en;
        if (name_ar !== undefined) product.name_ar = name_ar;
        if (description_en !== undefined) product.description_en = description_en || null;
        if (description_ar !== undefined) product.description_ar = description_ar || null;
        if (rawPrice !== undefined) {
            product.rawPrice = parseFloat(rawPrice);
            product.taxRate = taxRate;
            product.commissionRate = commissionRate;
            product.price = finalPrice;
        }
        if (category !== undefined) product.category = category;
        if (stock !== undefined) product.stock = parseInt(stock);
        if (sku !== undefined) product.sku = sku || null;
        if (brand !== undefined) product.brand = brand || null;
        if (size !== undefined) product.size = size || null;
        if (color !== undefined) product.color = color || null;
        if (ingredients !== undefined) product.ingredients = ingredients || null; // Legacy
        if (ingredients_en !== undefined) product.ingredients_en = ingredients_en || null;
        if (ingredients_ar !== undefined) product.ingredients_ar = ingredients_ar || null;
        if (howToUse_en !== undefined) product.howToUse_en = howToUse_en || null;
        if (howToUse_ar !== undefined) product.howToUse_ar = howToUse_ar || null;
        if (features_en !== undefined) product.features_en = features_en || null;
        if (features_ar !== undefined) product.features_ar = features_ar || null;
        
        // Update images
        product.images = imagePaths;
        product.image = imagePaths[0] || product.image; // Legacy field (first image)
        
        if (isAvailable !== undefined) product.isAvailable = isAvailable === true || isAvailable === 'true';
        if (isFeatured !== undefined) product.isFeatured = isFeatured === true || isFeatured === 'true';

        await product.save({ transaction });
        await transaction.commit();

        res.json({
            success: true,
            message: 'Product updated successfully',
            product
        });
    } catch (error) {
        await transaction.rollback();
        
        // Clean up uploaded files if update fails
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        } else if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product',
            error: error.message
        });
    }
};

/**
 * Delete a product
 * DELETE /api/v1/tenant/products/:id
 */
exports.deleteProduct = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const product = await db.Product.findOne({
            where: {
                id,
                tenantId
            },
            transaction
        });

        if (!product) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if product is used as gift in services
        // Note: This check would require a Service model relationship
        // For now, we'll allow deletion but can add this check later

        // Delete image if exists
        if (product.image) {
            const imagePath = path.join(__dirname, '../../uploads', product.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Delete product
        await product.destroy({ transaction });
        await transaction.commit();

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product',
            error: error.message
        });
    }
};

