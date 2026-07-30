'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportTicketNotificationEvent extends Model {
        static associate(models) {
            SupportTicketNotificationEvent.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            SupportTicketNotificationEvent.belongsTo(models.SupportTicket, { foreignKey: 'supportTicketId', as: 'ticket' });
            SupportTicketNotificationEvent.belongsTo(models.SupportMessage, { foreignKey: 'supportMessageId', as: 'message' });
        }
    }

    SupportTicketNotificationEvent.init({
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
        eventType: {
            type: DataTypes.STRING(120),
            allowNull: false
        },
        recipientType: {
            type: DataTypes.STRING(40),
            allowNull: false
        },
        recipientId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        payload: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        deliveryState: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        processedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        failedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        failureReason: {
            type: DataTypes.STRING(255),
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'SupportTicketNotificationEvent',
        tableName: 'support_ticket_notification_events',
        schema: 'public',
        timestamps: true,
        paranoid: false,
        indexes: [
            { fields: ['tenantId', 'supportTicketId', 'createdAt'], name: 'idx_support_ticket_notification_events_ticket_created_at' },
            { fields: ['supportMessageId'], name: 'idx_support_ticket_notification_events_message' },
            { fields: ['eventType'], name: 'idx_support_ticket_notification_events_type' },
            { fields: ['recipientType', 'recipientId'], name: 'idx_support_ticket_notification_events_recipient' },
            { fields: ['processedAt'], name: 'idx_support_ticket_notification_events_processed_at' }
        ],
        validate: {
            recipientReferenceConsistency() {
                if (!this.eventType || !this.eventType.toString().trim()) {
                    throw new Error('eventType is required');
                }

                if (!this.recipientType || !this.recipientType.toString().trim()) {
                    throw new Error('recipientType is required');
                }

                if (['customer', 'support_agent', 'super_admin'].includes(this.recipientType) && !this.recipientId) {
                    throw new Error(`recipientId is required when recipientType is ${this.recipientType}`);
                }
            }
        }
    });

    return SupportTicketNotificationEvent;
};
