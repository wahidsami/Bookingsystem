'use strict';

const { ensureIdempotentIndexing } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                CREATE TYPE "public"."enum_support_tickets_source" AS ENUM ('dashboard', 'ai', 'api', 'email', 'mobile', 'system');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.support_tickets
            ADD COLUMN IF NOT EXISTS source "public"."enum_support_tickets_source" NOT NULL DEFAULT 'dashboard';
        `);

        await queryInterface.sequelize.query(`
            UPDATE support_tickets
            SET "source" = CASE "sourceChannel"
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
            END::public."enum_support_tickets_source"
            WHERE "source" IS NULL OR "source"::text = '';
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

        await queryInterface.sequelize.query(`
            ALTER TABLE public.support_tickets
            DROP COLUMN IF EXISTS source;
        `);

        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "public"."enum_support_tickets_source";');
    }
};
