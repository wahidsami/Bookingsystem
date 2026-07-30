'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportCategory extends Model {
        static associate(models) {
            SupportCategory.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
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
            { fields: ['scope'], name: 'idx_support_categories_scope' },
            { fields: ['isActive'], name: 'idx_support_categories_is_active' }
        ]
    });

    return SupportCategory;
};
