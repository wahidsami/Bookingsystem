'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportTicketLink extends Model {
        static associate(models) {
            SupportTicketLink.belongsTo(models.SupportTicket, { foreignKey: 'ticketId', as: 'ticket' });
        }
    }

    SupportTicketLink.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        ticketId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'support_tickets', key: 'id' },
            onDelete: 'CASCADE'
        },
        entityType: {
            type: DataTypes.STRING(120),
            allowNull: false
        },
        entityId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        createdBy: {
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'SupportTicketLink',
        tableName: 'support_ticket_links',
        schema: 'public',
        timestamps: true,
        paranoid: false,
        validate: {
            canonicalLinkShape() {
                if (!this.ticketId) {
                    throw new Error('ticketId is required');
                }

                if (!this.entityType || !this.entityType.toString().trim()) {
                    throw new Error('entityType is required');
                }

                if (!this.entityId) {
                    throw new Error('entityId is required');
                }
            }
        },
        indexes: [
            { fields: ['ticketId'], name: 'idx_support_ticket_links_ticket' },
            { fields: ['entityType'], name: 'idx_support_ticket_links_entity_type' },
            { fields: ['entityId'], name: 'idx_support_ticket_links_entity_id' },
            { fields: ['ticketId', 'entityType', 'entityId'], unique: true, name: 'uidx_support_ticket_links_ticket_entity' }
        ]
    });

    return SupportTicketLink;
};
