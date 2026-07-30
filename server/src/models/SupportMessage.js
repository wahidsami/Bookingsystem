'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportMessage extends Model {
        static associate(models) {
            SupportMessage.belongsTo(models.SupportTicket, { foreignKey: 'supportTicketId', as: 'ticket' });
            SupportMessage.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            SupportMessage.belongsTo(models.PlatformUser, { foreignKey: 'customerPlatformUserId', as: 'customer' });
            SupportMessage.belongsTo(models.SupportAgent, { foreignKey: 'supportAgentId', as: 'supportAgent' });
            SupportMessage.belongsTo(SupportMessage, { foreignKey: 'replyToMessageId', as: 'replyToMessage' });
            SupportMessage.hasMany(models.SupportAttachment, { foreignKey: 'supportMessageId', as: 'attachments' });
            SupportMessage.hasMany(SupportMessage, { foreignKey: 'replyToMessageId', as: 'replies' });
        }
    }

    SupportMessage.init({
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
        replyToMessageId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_messages', key: 'id' },
            onDelete: 'SET NULL'
        },
        senderType: {
            type: DataTypes.ENUM('customer', 'support_agent', 'ai', 'system'),
            allowNull: false
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
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        language: {
            type: DataTypes.ENUM('ar', 'en'),
            allowNull: false,
            defaultValue: 'ar'
        },
        contentFormat: {
            type: DataTypes.ENUM('plain', 'markdown', 'html'),
            allowNull: false,
            defaultValue: 'plain'
        },
        visibility: {
            type: DataTypes.ENUM('public', 'internal'),
            allowNull: false,
            defaultValue: 'public'
        },
        isEdited: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        editedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'SupportMessage',
        tableName: 'support_messages',
        schema: 'public',
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['tenantId', 'supportTicketId', 'createdAt'], name: 'idx_support_messages_ticket_created_at' },
            { fields: ['tenantId', 'senderType'], name: 'idx_support_messages_sender_type' },
            { fields: ['replyToMessageId'], name: 'idx_support_messages_reply_to' }
        ],
        validate: {
            senderReferenceConsistency() {
                if (this.senderType === 'customer') {
                    if (!this.customerPlatformUserId) {
                        throw new Error('customerPlatformUserId is required when senderType is customer');
                    }
                    if (this.supportAgentId) {
                        throw new Error('supportAgentId must be null when senderType is customer');
                    }
                }

                if (this.senderType === 'support_agent' && !this.supportAgentId) {
                    throw new Error('supportAgentId is required when senderType is support_agent');
                }

                if ((this.senderType === 'ai' || this.senderType === 'system') && (this.customerPlatformUserId || this.supportAgentId)) {
                    throw new Error('Sender references must be null when senderType is ai or system');
                }
            }
        }
    });

    return SupportMessage;
};
