'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Product extends Model {
        static associate(models) {
            // Product belongs to a Tenant
            Product.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    Product.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        name_en: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Product name in English'
        },
        name_ar: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Product name in Arabic'
        },
        description_en: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Product description in English'
        },
        description_ar: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Product description in Arabic'
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Product image path/URL (legacy - use images array instead)'
        },
        images: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
            comment: 'Array of product image paths/URLs (up to 5 images, minimum 1)'
        },
        rawPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Base product price before tax and commission'
        },
        taxRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Tax rate applied (read-only, from admin settings)'
        },
        commissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Commission rate applied (read-only, from admin settings)'
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Final product price (rawPrice + tax + commission)'
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'general',
            comment: 'Product category (e.g., "Hair Care", "Skin Care")'
        },
        stock: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Available quantity in inventory'
        },
        sku: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
            comment: 'Stock Keeping Unit (unique identifier)'
        },
        brand: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Product brand name'
        },
        size: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Product size (e.g., "100ml", "Medium")'
        },
        color: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Product color if applicable'
        },
        ingredients: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Product ingredients or materials (legacy - use ingredients_en/ingredients_ar instead)'
        },
        ingredients_en: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Product ingredients in English'
        },
        ingredients_ar: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Product ingredients in Arabic'
        },
        howToUse_en: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'How to use instructions in English'
        },
        howToUse_ar: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'How to use instructions in Arabic'
        },
        features_en: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Product features in English (can be JSON array or text)'
        },
        features_ar: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Product features in Arabic (can be JSON array or text)'
        },
        isAvailable: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Whether product is available for sale/gift'
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Featured products display prominently'
        },
        soldCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Total units sold (for analytics)'
        },
        usedAsGiftCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Times used as gift in services'
        }
    }, {
        sequelize,
        modelName: 'Product',
        tableName: 'products',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['tenantId']
            },
            {
                fields: ['category']
            },
            {
                fields: ['isAvailable']
            },
            {
                fields: ['sku'],
                unique: true
            }
        ]
    });

    return Product;
};

