'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('support_tickets', 'source', {
            type: Sequelize.ENUM('dashboard', 'ai', 'api', 'email', 'mobile', 'system'),
            allowNull: false,
            defaultValue: 'dashboard'
        });

        await queryInterface.sequelize.query(`
            UPDATE support_tickets
            SET source = CASE sourceChannel
                WHEN 'customer_app' THEN 'mobile'
                WHEN 'tenant_dashboard' THEN 'dashboard'
                WHEN 'support_portal' THEN 'dashboard'
                WHEN 'email' THEN 'email'
                WHEN 'chat' THEN 'dashboard'
                WHEN 'live_chat' THEN 'dashboard'
                WHEN 'ai_assistant' THEN 'ai'
                WHEN 'api' THEN 'api'
                WHEN 'system' THEN 'system'
                ELSE 'dashboard'
            END
            WHERE source IS NULL OR source = '';
        `);

        await queryInterface.createTable('support_ticket_links', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false
            },
            ticketId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'support_tickets', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            entityType: {
                type: Sequelize.STRING(120),
                allowNull: false
            },
            entityId: {
                type: Sequelize.UUID,
                allowNull: false
            },
            createdBy: {
                type: Sequelize.UUID,
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

        await queryInterface.addIndex('support_ticket_links', ['ticketId'], {
            name: 'idx_support_ticket_links_ticket'
        });
        await queryInterface.addIndex('support_ticket_links', ['entityType'], {
            name: 'idx_support_ticket_links_entity_type'
        });
        await queryInterface.addIndex('support_ticket_links', ['entityId'], {
            name: 'idx_support_ticket_links_entity_id'
        });
        await queryInterface.addIndex('support_ticket_links', ['ticketId', 'entityType', 'entityId'], {
            unique: true,
            name: 'uidx_support_ticket_links_ticket_entity'
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('support_ticket_links');

        await queryInterface.removeColumn('support_tickets', 'source');

        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_support_tickets_source";');
    }
};
