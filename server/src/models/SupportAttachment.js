'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportAttachment extends Model {
        static associate(models) {
            SupportAttachment.belongsTo(models.SupportTicket, { foreignKey: 'supportTicketId', as: 'ticket' });
            SupportAttachment.belongsTo(models.SupportMessage, { foreignKey: 'supportMessageId', as: 'message' });
            SupportAttachment.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            SupportAttachment.belongsTo(models.PlatformUser, { foreignKey: 'customerPlatformUserId', as: 'customer' });
            SupportAttachment.belongsTo(models.SupportAgent, { foreignKey: 'supportAgentId', as: 'supportAgent' });
        }
    }

    SupportAttachment.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' },
            onDelete: 'CASCADE'
        },
        supportTicketId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'support_tickets', key: 'id' },
            onDelete: 'CASCADE'
        },
        supportMessageId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_messages', key: 'id' },
            onDelete: 'CASCADE'
        },
        uploadedByType: {
            type: DataTypes.ENUM('customer', 'support_agent', 'ai', 'system'),
            allowNull: false,
            defaultValue: 'customer'
        },
        customerPlatformUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'platform_users', key: 'id' },
            onDelete: 'SET NULL'
        },
        supportAgentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_agents', key: 'id' },
            onDelete: 'SET NULL'
        },
        fileName: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        originalName: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        mimeType: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        fileCategory: {
            type: DataTypes.ENUM('image', 'pdf', 'office', 'zip'),
            allowNull: false
        },
        storageProvider: {
            type: DataTypes.STRING(64),
            allowNull: false,
            defaultValue: 'local'
        },
        storagePath: {
            type: DataTypes.STRING(1000),
            allowNull: false
        },
        storageUrl: {
            type: DataTypes.STRING(1000),
            allowNull: true
        },
        fileSize: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0
        },
        checksum: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        caption: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        isInline: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'SupportAttachment',
        tableName: 'support_attachments',
        schema: 'public',
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['tenantId', 'supportTicketId', 'createdAt'], name: 'idx_support_attachments_ticket_created_at' },
            { fields: ['supportMessageId'], name: 'idx_support_attachments_message' },
            { fields: ['fileCategory'], name: 'idx_support_attachments_file_category' }
        ],
        validate: {
            uploaderReferenceConsistency() {
                if (this.uploadedByType === 'customer') {
                    if (!this.customerPlatformUserId) {
                        throw new Error('customerPlatformUserId is required when uploadedByType is customer');
                    }
                    if (this.supportAgentId) {
                        throw new Error('supportAgentId must be null when uploadedByType is customer');
                    }
                }

                if (this.uploadedByType === 'support_agent' && !this.supportAgentId) {
                    throw new Error('supportAgentId is required when uploadedByType is support_agent');
                }

                if ((this.uploadedByType === 'ai' || this.uploadedByType === 'system') && (this.customerPlatformUserId || this.supportAgentId)) {
                    throw new Error('Uploader references must be null when uploadedByType is ai or system');
                }
            }
        }
    });

    return SupportAttachment;
};
