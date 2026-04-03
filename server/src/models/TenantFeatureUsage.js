'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantFeatureUsage extends Model {
        static associate(models) {
            TenantFeatureUsage.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    TenantFeatureUsage.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'tenant_id',
            references: {
                model: 'tenants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        featureKey: {
            type: DataTypes.STRING(64),
            allowNull: false,
            field: 'feature_key'
        },
        month: {
            type: DataTypes.STRING(7),
            allowNull: false,
            comment: 'Usage month in YYYY-MM format'
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'updated_at'
        }
    }, {
        sequelize,
        modelName: 'TenantFeatureUsage',
        tableName: 'tenant_feature_usage',
        schema: 'public',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['tenant_id', 'feature_key', 'month'],
                name: 'idx_tenant_feature_usage_tenant_feature_month'
            },
            { fields: ['tenant_id'] },
            { fields: ['feature_key'] },
            { fields: ['month'] }
        ]
    });

    return TenantFeatureUsage;
};
