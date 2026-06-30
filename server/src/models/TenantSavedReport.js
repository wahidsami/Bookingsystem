'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantSavedReport extends Model {
        static associate(models) {
            TenantSavedReport.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            TenantSavedReport.belongsTo(models.PlatformUser, {
                foreignKey: 'createdByUserId',
                as: 'creator'
            });
            TenantSavedReport.belongsTo(TenantSavedReport, {
                foreignKey: 'duplicatedFromId',
                as: 'duplicatedFrom'
            });
        }
    }

    TenantSavedReport.init({
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
        createdByUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'platform_users',
                key: 'id'
            }
        },
        reportType: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        sections: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        filters: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        columns: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        selectedMetrics: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        grouping: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        sorting: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        reportConfig: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        scheduleConfig: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        isFavorite: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        duplicatedFromId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'tenant_saved_reports',
                key: 'id'
            }
        },
        lastOpenedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastRunAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        nextRunAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastRunResult: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        runHistory: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        }
    }, {
        sequelize,
        modelName: 'TenantSavedReport',
        tableName: 'tenant_saved_reports',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId', 'reportType'] },
            { fields: ['tenantId', 'isFavorite'] },
            { fields: ['tenantId', 'updatedAt'] },
            { fields: ['tenantId', 'createdByUserId'] }
        ]
    });

    return TenantSavedReport;
};
