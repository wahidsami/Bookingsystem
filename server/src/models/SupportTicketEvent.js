'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportTicketEvent extends Model {
        static associate(models) {
            SupportTicketEvent.belongsTo(models.SupportTicket, { foreignKey: 'supportTicketId', as: 'ticket' });
            SupportTicketEvent.belongsTo(models.SupportMessage, { foreignKey: 'supportMessageId', as: 'message' });
            SupportTicketEvent.belongsTo(models.SupportAttachment, { foreignKey: 'supportAttachmentId', as: 'attachment' });
            SupportTicketEvent.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            SupportTicketEvent.belongsTo(models.PlatformUser, { foreignKey: 'customerPlatformUserId', as: 'customer' });
            SupportTicketEvent.belongsTo(models.SupportAgent, { foreignKey: 'supportAgentId', as: 'supportAgent' });
        }
    }

    SupportTicketEvent.init({
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
            onDelete: 'SET NULL'
        },
        supportAttachmentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_attachments', key: 'id' },
            onDelete: 'SET NULL'
        },
        actorType: {
            type: DataTypes.ENUM('customer', 'support_agent', 'ai', 'system'),
            allowNull: false,
            defaultValue: 'system'
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
        eventType: {
            type: DataTypes.ENUM('ticket_created', 'reply_added', 'attachment_added', 'assigned', 'priority_changed', 'status_changed', 'closed', 'reopened', 'category_changed', 'note_added'),
            allowNull: false
        },
        fromStatus: {
            type: DataTypes.ENUM('draft', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'),
            allowNull: true
        },
        toStatus: {
            type: DataTypes.ENUM('draft', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'),
            allowNull: true
        },
        fromPriority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
            allowNull: true
        },
        toPriority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
            allowNull: true
        },
        payload: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        occurredAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        sequelize,
        modelName: 'SupportTicketEvent',
        tableName: 'support_ticket_events',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId', 'occurredAt'], name: 'idx_support_ticket_events_tenant_time' },
            { fields: ['supportTicketId', 'occurredAt'], name: 'idx_support_ticket_events_ticket_time' },
            { fields: ['eventType', 'occurredAt'], name: 'idx_support_ticket_events_type_time' },
            { fields: ['actorType'], name: 'idx_support_ticket_events_actor_type' }
        ],
        validate: {
            actorReferenceConsistency() {
                if (this.actorType === 'customer' && !this.customerPlatformUserId) {
                    throw new Error('customerPlatformUserId is required when actorType is customer');
                }

                if (this.actorType === 'support_agent' && !this.supportAgentId) {
                    throw new Error('supportAgentId is required when actorType is support_agent');
                }

                if ((this.actorType === 'ai' || this.actorType === 'system') && (this.customerPlatformUserId || this.supportAgentId)) {
                    throw new Error('Actor references must be null when actorType is ai or system');
                }
            }
        }
    });

    return SupportTicketEvent;
};
