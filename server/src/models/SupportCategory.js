'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportCategory extends Model {
        static associate(models) {
            SupportCategory.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            SupportCategory.belongsTo(models.SupportCategory, {
                foreignKey: 'parentId',
                as: 'parent'
            });

            SupportCategory.hasMany(models.SupportCategory, {
                foreignKey: 'parentId',
                as: 'children'
            });

            SupportCategory.hasMany(models.SupportTicket, {
                foreignKey: 'supportCategoryId',
                as: 'tickets'
            });
        }
    }

    SupportCategory.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'tenants', key: 'id' },
            onDelete: 'CASCADE'
        },
        slug: {
            type: DataTypes.STRING(120),
            allowNull: false,
            unique: true
        },
        parentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_categories', key: 'id' },
            onDelete: 'SET NULL'
        },
        scope: {
            type: DataTypes.ENUM('global', 'tenant'),
            allowNull: false,
            defaultValue: 'global'
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        nameAr: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        descriptionAr: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        icon: {
            type: DataTypes.STRING(120),
            allowNull: true
        },
        color: {
            type: DataTypes.STRING(32),
            allowNull: true
        },
        featureKey: {
            type: DataTypes.STRING(160),
            allowNull: true
        },
        featureRoute: {
            type: DataTypes.STRING(255),
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
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'SupportCategory',
        tableName: 'support_categories',
        schema: 'public',
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['tenantId'], name: 'idx_support_categories_tenant' },
            { fields: ['parentId'], name: 'idx_support_categories_parent' },
            { fields: ['scope'], name: 'idx_support_categories_scope' },
            { fields: ['featureKey'], name: 'idx_support_categories_feature_key' },
            { fields: ['featureRoute'], name: 'idx_support_categories_feature_route' },
            { fields: ['isActive'], name: 'idx_support_categories_is_active' }
        ]
    });

    return SupportCategory;
};
