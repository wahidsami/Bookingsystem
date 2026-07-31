'use strict';

const { ensureIdempotentIndexing } = require('./_index-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

        await queryInterface.createTable('support_ticket_notification_events', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'tenants', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            supportTicketId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'support_tickets', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            supportMessageId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_messages', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            eventType: {
                type: Sequelize.STRING(120),
                allowNull: false
            },
            recipientType: {
                type: Sequelize.STRING(40),
                allowNull: false
            },
            recipientId: {
                type: Sequelize.UUID,
                allowNull: true
            },
            payload: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            deliveryState: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            processedAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            failedAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            failureReason: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex('support_ticket_notification_events', ['tenantId', 'supportTicketId', 'createdAt'], {
            name: 'idx_support_ticket_notification_events_ticket_created_at'
        });
        await queryInterface.addIndex('support_ticket_notification_events', ['supportMessageId'], {
            name: 'idx_support_ticket_notification_events_message'
        });
        await queryInterface.addIndex('support_ticket_notification_events', ['eventType'], {
            name: 'idx_support_ticket_notification_events_type'
        });
        await queryInterface.addIndex('support_ticket_notification_events', ['recipientType', 'recipientId'], {
            name: 'idx_support_ticket_notification_events_recipient'
        });
        await queryInterface.addIndex('support_ticket_notification_events', ['processedAt'], {
            name: 'idx_support_ticket_notification_events_processed_at'
        });

        await queryInterface.createTable('support_ticket_read_states', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'tenants', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            supportTicketId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'support_tickets', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            participantType: {
                type: Sequelize.STRING(40),
                allowNull: false
            },
            participantId: {
                type: Sequelize.UUID,
                allowNull: true
            },
            lastReadMessageId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_messages', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            lastReadAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            unreadCount: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex('support_ticket_read_states', ['tenantId', 'supportTicketId'], {
            name: 'idx_support_ticket_read_states_ticket'
        });
        await queryInterface.addIndex('support_ticket_read_states', ['tenantId', 'participantType'], {
            name: 'idx_support_ticket_read_states_participant_type'
        });
        await queryInterface.addIndex('support_ticket_read_states', ['participantId'], {
            name: 'idx_support_ticket_read_states_participant_id'
        });
        await queryInterface.addIndex('support_ticket_read_states', ['lastReadMessageId'], {
            name: 'idx_support_ticket_read_states_last_read_message'
        });
        await queryInterface.addIndex('support_ticket_read_states', ['tenantId', 'supportTicketId', 'participantType', 'participantId'], {
            unique: true,
            name: 'uidx_support_ticket_read_states_participant'
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('support_ticket_read_states');
        await queryInterface.dropTable('support_ticket_notification_events');
    }
};
