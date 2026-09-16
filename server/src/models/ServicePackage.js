'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServicePackage extends Model {
        static associate(models) {
            ServicePackage.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            ServicePackage.hasMany(models.ServicePackageItem, {
                foreignKey: 'packageId',
                as: 'items'
            });

            ServicePackage.hasMany(models.Appointment, {
                foreignKey: 'packageId',
                as: 'appointments'
            });

            // Services 2: Belongs to tenant-owned category
            ServicePackage.belongsTo(models.TenantServiceCategory, {
                foreignKey: 'tenantServiceCategoryId',
                as: 'tenantCategory'
            });
        }
    }

    ServicePackage.init({
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
        tenantServiceCategoryId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'tenant_service_categories',
                key: 'id'
            },
            comment: 'Services 2 tenant-owned category foreign key'
        },
        name_en: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name_ar: {
            type: DataTypes.STRING,
            allowNull: false
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Package thumbnail image path'
        },
        description_en: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Services 2: English bundle description'
        },
        description_ar: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Services 2: Arabic bundle description'
        },
        scheduleType: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'sequence',
            comment: 'Services 2: Execution mode: sequence or parallel'
        },
        pricingType: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'service',
            comment: 'Services 2: Pricing mode: service, custom, discount, or free'
        },
        discountPercentage: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            defaultValue: null,
            comment: 'Services 2: Percentage discount applied when pricingType is discount'
        },
        customPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: null,
            comment: 'Services 2: Custom fixed price when pricingType is custom'
        },
        allowOnlineBooking: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Services 2: Online booking visibility toggle'
        },
        targetGender: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'all',
            comment: 'Services 2: Target audience gender: all, female, or male'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        totalDuration: {
            type: DataTypes.INTEGER, // in minutes
            allowNull: false,
            defaultValue: 0,
            comment: 'Derived sum of package item durations'
        },
        totalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Effective final price of package/bundle'
        }
    }, {
        sequelize,
        modelName: 'ServicePackage',
        tableName: 'service_packages',
        schema: 'public',
        timestamps: true
    });

    return ServicePackage;
};
