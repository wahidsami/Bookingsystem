'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantPushUsage extends Model {
        static associate(models) {
            TenantPushUsage.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
        }
    }

    TenantPushUsage.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'tenant_id',
            references: { model: 'tenants', key: 'id' },
            onDelete: 'CASCADE'
        },
        month: {
            type: DataTypes.STRING(7),
            allowNull: false
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
        modelName: 'TenantPushUsage',
        tableName: 'tenant_push_usage',
        schema: 'public',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['tenant_id', 'month'], name: 'idx_tenant_push_usage_tenant_month' }
        ]
    });

    return TenantPushUsage;
};
