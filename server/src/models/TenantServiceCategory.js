'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantServiceCategory extends Model {
        static associate(models) {
            // Category belongs to a specific Tenant
            TenantServiceCategory.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            // Category has many Services in Services 2
            TenantServiceCategory.hasMany(models.Service, {
                foreignKey: 'tenantServiceCategoryId',
                as: 'services'
            });

            // Category has many ServicePackages (Bundles) in Services 2
            TenantServiceCategory.hasMany(models.ServicePackage, {
                foreignKey: 'tenantServiceCategoryId',
                as: 'packages'
            });
        }
    }

    TenantServiceCategory.init({
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
            type: DataTypes.STRING(150),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        name_ar: {
            type: DataTypes.STRING(150),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        description_en: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        description_ar: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        slug: {
            type: DataTypes.STRING(150),
            allowNull: true
        },
        icon: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'TenantServiceCategory',
        tableName: 'tenant_service_categories',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                name: 'tenant_service_categories_tenant_idx',
                fields: ['tenantId']
            },
            {
                name: 'tenant_service_categories_tenant_sort_idx',
                fields: ['tenantId', 'sortOrder']
            },
            {
                name: 'tenant_service_categories_tenant_slug_idx',
                fields: ['tenantId', 'slug']
            }
        ]
    });

    return TenantServiceCategory;
};
