'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportTicket extends Model {
        static associate(models) {
            SupportTicket.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            SupportTicket.belongsTo(models.PlatformUser, { foreignKey: 'customerPlatformUserId', as: 'customer' });
            SupportTicket.belongsTo(models.SupportCategory, { foreignKey: 'supportCategoryId', as: 'category' });
            SupportTicket.belongsTo(models.SupportAgent, { foreignKey: 'assignedSupportAgentId', as: 'assignedAgent' });
            SupportTicket.hasMany(models.SupportMessage, { foreignKey: 'supportTicketId', as: 'messages' });
            SupportTicket.hasMany(models.SupportAttachment, { foreignKey: 'supportTicketId', as: 'attachments' });
            SupportTicket.hasMany(models.SupportTicketEvent, { foreignKey: 'supportTicketId', as: 'events' });
        }

        static async generateTicketNumber(options = {}) {
            const transaction = options?.transaction || null;
            const year = new Date().getFullYear();
            const prefix = `SUP-${year}-`;
            const lastTicket = await SupportTicket.findOne({
                where: {
                    ticketNumber: {
                        [sequelize.Sequelize.Op.like]: `${prefix}%`
                    }
                },
                order: [['createdAt', 'DESC']],
                transaction
            });

            let sequence = 1;
            if (lastTicket?.ticketNumber) {
                const lastSequence = parseInt(lastTicket.ticketNumber.split('-')[2], 10);
                if (Number.isFinite(lastSequence)) {
                    sequence = lastSequence + 1;
                }
            }

            return `${prefix}${sequence.toString().padStart(6, '0')}`;
        }
    }

    SupportTicket.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        ticketNumber: {
            type: DataTypes.STRING(40),
            allowNull: false,
            unique: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' },
            onDelete: 'CASCADE'
        },
        customerPlatformUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'platform_users', key: 'id' },
            onDelete: 'SET NULL'
        },
        supportCategoryId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_categories', key: 'id' },
            onDelete: 'SET NULL'
        },
        assignedSupportAgentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_agents', key: 'id' },
            onDelete: 'SET NULL'
        },
        sourceChannel: {
            type: DataTypes.ENUM('customer_app', 'tenant_dashboard', 'support_portal', 'email', 'chat', 'live_chat', 'ai_assistant', 'api', 'system'),
            allowNull: false,
            defaultValue: 'customer_app'
        },
        status: {
            type: DataTypes.ENUM('draft', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'),
            allowNull: false,
            defaultValue: 'draft'
        },
        priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
            allowNull: false,
            defaultValue: 'medium'
        },
        language: {
            type: DataTypes.ENUM('ar', 'en'),
            allowNull: false,
            defaultValue: 'ar'
        },
        subject: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        subjectAr: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        descriptionAr: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        lastMessageAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        firstResponseAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        resolvedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        closedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        reopenedAt: {
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
        modelName: 'SupportTicket',
        tableName: 'support_tickets',
        schema: 'public',
        timestamps: true,
        paranoid: true,
        validate: {
            customerReferenceConsistency() {
                if (this.sourceChannel === 'customer_app' && !this.customerPlatformUserId) {
                    throw new Error('customerPlatformUserId is required when sourceChannel is customer_app');
                }
            }
        },
        indexes: [
            { fields: ['ticketNumber'], unique: true, name: 'uidx_support_tickets_ticket_number' },
            { fields: ['tenantId', 'status'], name: 'idx_support_tickets_tenant_status' },
            { fields: ['tenantId', 'priority'], name: 'idx_support_tickets_tenant_priority' },
            { fields: ['tenantId', 'lastMessageAt'], name: 'idx_support_tickets_tenant_last_message' },
            { fields: ['customerPlatformUserId'], name: 'idx_support_tickets_customer' },
            { fields: ['assignedSupportAgentId'], name: 'idx_support_tickets_assigned_agent' },
            { fields: ['supportCategoryId'], name: 'idx_support_tickets_category' }
        ]
    });

    SupportTicket.beforeCreate(async (ticket, options) => {
        if (!ticket.ticketNumber) {
            ticket.ticketNumber = await SupportTicket.generateTicketNumber({ transaction: options?.transaction });
        }
    });

    return SupportTicket;
};
