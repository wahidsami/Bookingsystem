'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportTicketReadState extends Model {
        static associate(models) {
            SupportTicketReadState.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            SupportTicketReadState.belongsTo(models.SupportTicket, { foreignKey: 'supportTicketId', as: 'ticket' });
            SupportTicketReadState.belongsTo(models.SupportMessage, { foreignKey: 'lastReadMessageId', as: 'lastReadMessage' });
        }
    }

    SupportTicketReadState.init({
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
        participantType: {
            type: DataTypes.STRING(40),
            allowNull: false
        },
        participantId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        lastReadMessageId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'support_messages', key: 'id' },
            onDelete: 'SET NULL'
        },
        lastReadAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        unreadCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'SupportTicketReadState',
        tableName: 'support_ticket_read_states',
        schema: 'public',
        timestamps: true,
        paranoid: false,
        indexes: [
            { fields: ['tenantId', 'supportTicketId'], name: 'idx_support_ticket_read_states_ticket' },
            { fields: ['tenantId', 'participantType'], name: 'idx_support_ticket_read_states_participant_type' },
            { fields: ['participantId'], name: 'idx_support_ticket_read_states_participant_id' },
            { fields: ['lastReadMessageId'], name: 'idx_support_ticket_read_states_last_read_message' },
            { fields: ['tenantId', 'supportTicketId', 'participantType', 'participantId'], unique: true, name: 'uidx_support_ticket_read_states_participant' }
        ],
        validate: {
            participantReferenceConsistency() {
                if (!this.participantType || !this.participantType.toString().trim()) {
                    throw new Error('participantType is required');
                }

                if (['customer', 'support_agent', 'super_admin'].includes(this.participantType) && !this.participantId) {
                    throw new Error(`participantId is required when participantType is ${this.participantType}`);
                }
            }
        }
    });

    return SupportTicketReadState;
};
