'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ConsultantSnapshot extends Model {
        static associate(models) {
            ConsultantSnapshot.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            ConsultantSnapshot.belongsTo(models.PlatformUser, {
                foreignKey: 'createdByUserId',
                as: 'creator'
            });

            ConsultantSnapshot.hasMany(models.ConsultantReport, {
                foreignKey: 'snapshotId',
                as: 'reports'
            });

            ConsultantSnapshot.hasMany(models.ConsultantConversation, {
                foreignKey: 'snapshotId',
                as: 'conversations'
            });
        }
    }

    ConsultantSnapshot.init({
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
        generatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        datasetVersion: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'v1'
        },
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'SAR'
        },
        summary: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        financial: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        customers: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        operations: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        employees: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        products: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        sourceCounts: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'ConsultantSnapshot',
        tableName: 'consultant_snapshots',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['tenantId', 'periodType', 'periodStart'],
                unique: true,
                name: 'idx_consultant_snapshots_period'
            },
            {
                fields: ['tenantId', 'generatedAt'],
                name: 'idx_consultant_snapshots_generated_at'
            }
        ]
    });

    return ConsultantSnapshot;
};
