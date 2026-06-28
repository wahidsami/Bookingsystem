'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ConsultantConversation extends Model {
        static associate(models) {
            ConsultantConversation.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            ConsultantConversation.belongsTo(models.PlatformUser, {
                foreignKey: 'createdByUserId',
                as: 'creator'
            });

            ConsultantConversation.belongsTo(models.ConsultantSnapshot, {
                foreignKey: 'snapshotId',
                as: 'snapshot'
            });

            ConsultantConversation.belongsTo(models.ConsultantReport, {
                foreignKey: 'reportId',
                as: 'report'
            });
        }
    }

    ConsultantConversation.init({
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
        snapshotId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'consultant_snapshots',
                key: 'id'
            }
        },
        reportId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'consultant_reports',
                key: 'id'
            }
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        topic: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('open', 'paused', 'closed'),
            allowNull: false,
            defaultValue: 'open'
        },
        messages: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        searchText: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        summary: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        lastMessageAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'ConsultantConversation',
        tableName: 'consultant_conversations',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['tenantId', 'lastMessageAt'],
                name: 'idx_consultant_conversations_last_message'
            },
            {
                fields: ['tenantId', 'status'],
                name: 'idx_consultant_conversations_status'
            },
            {
                fields: ['snapshotId'],
                name: 'idx_consultant_conversations_snapshot'
            }
        ]
    });

    return ConsultantConversation;
};
