'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Service extends Model {
        static associate(models) {
            // Service belongs to a Tenant
            Service.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            // Services belong to many Staff through ServiceEmployee junction table
            Service.belongsToMany(models.Staff, {
                through: 'ServiceEmployee',
                foreignKey: 'serviceId',
                otherKey: 'staffId',
                as: 'employees'
            });

            // Legacy: Keep StaffServices for backward compatibility
            Service.belongsToMany(models.Staff, {
                through: 'StaffServices',
                foreignKey: 'serviceId',
                otherKey: 'staffId',
                as: 'legacyStaff'
            });
        }

        /**
         * Calculate final price based on raw price, tax, and commission
         */
        calculateFinalPrice() {
            const raw = parseFloat(this.rawPrice || 0);
            const taxRate = parseFloat(this.taxRate || 15);
            const commissionRate = parseFloat(this.commissionRate || 10);
            
            const tax = raw * (taxRate / 100);
            const commission = raw * (commissionRate / 100);
            
            return (raw + tax + commission).toFixed(2);
        }
    }

    Service.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true, // Allow null for legacy data
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        name_en: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name_ar: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description_en: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        description_ar: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Service thumbnail image path'
        },
        includes: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: [],
            comment: 'Array of sub-service items (e.g., ["Shampoo", "Blow-dry"])'
        },
        benefits: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
            comment: 'Array of benefit objects with en and ar properties: [{en: "Benefit 1", ar: "فائدة 1"}, ...]'
        },
        whatToExpect: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
            comment: 'Array of "What to Expect" items with en and ar properties: [{en: "Expectation 1", ar: "توقع 1"}, ...]'
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'general'
        },
        duration: {
            type: DataTypes.INTEGER, // in minutes
            allowNull: false,
            defaultValue: 30
        },
        // Pricing fields
        rawPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true, // Allow null for existing data
            defaultValue: 0.00,
            comment: 'Base service price before tax and commission'
        },
        taxRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true, // Allow null for existing data
            defaultValue: 15.00,
            comment: 'Tax rate percentage (default 15% Saudi VAT)'
        },
        commissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true, // Allow null for existing data
            defaultValue: 10.00,
            comment: 'System commission rate percentage'
        },
        finalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true, // Allow null for existing data
            defaultValue: 0.00,
            comment: 'Final price = rawPrice + (rawPrice * taxRate/100) + (rawPrice * commissionRate/100)'
        },
        // Legacy pricing (for backward compatibility)
        basePrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        minPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        maxPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        // Offers
        hasOffer: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        offerDetails: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Offer description (e.g., "20% off this month")'
        },
        // Gifts
        hasGift: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        giftType: {
            type: DataTypes.ENUM('text', 'product'),
            allowNull: true,
            comment: 'Gift type: free text description or product selection'
        },
        giftDetails: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Gift description or product ID'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        availableInCenter: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Service available at the center/salon location'
        },
        availableHomeVisit: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Service available as home visit'
        }
    }, {
        sequelize,
        modelName: 'Service',
        tableName: 'services',
        schema: 'public',
        timestamps: true
    });

    return Service;
};
