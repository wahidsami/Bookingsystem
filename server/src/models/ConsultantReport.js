'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ConsultantReport extends Model {
        static associate(models) {
            ConsultantReport.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            ConsultantReport.belongsTo(models.ConsultantSnapshot, {
                foreignKey: 'snapshotId',
                as: 'snapshot'
            });

            ConsultantReport.belongsTo(models.PlatformUser, {
                foreignKey: 'createdByUserId',
                as: 'creator'
            });
        }
    }

    ConsultantReport.init({
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
        snapshotId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'consultant_snapshots',
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
            allowNull: false,
            defaultValue: 'business_snapshot'
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        periodType: {
            type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
            allowNull: false,
            defaultValue: 'daily'
        },
        periodStart: {
            type: DataTypes.DATE,
            allowNull: false
        },
        periodEnd: {
            type: DataTypes.DATE,
            allowNull: false
        },
        outputFormat: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'json'
        },
        sections: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        reportData: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        generatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        status: {
            type: DataTypes.STRING(24),
            allowNull: false,
            defaultValue: 'ready'
        }
    }, {
        sequelize,
        modelName: 'ConsultantReport',
        tableName: 'consultant_reports',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['tenantId', 'periodType', 'generatedAt'],
                name: 'idx_consultant_reports_period'
            },
            {
                fields: ['tenantId', 'snapshotId'],
                name: 'idx_consultant_reports_snapshot'
            }
        ]
    });

    return ConsultantReport;
};
