'use strict';

const { ensureIdempotentIndexing } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

        await queryInterface.createTable('support_agents', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false
            },
            superAdminId: {
                type: Sequelize.UUID,
                allowNull: true,
                unique: true,
                references: { model: 'super_admins', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            displayName: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            displayNameAr: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            title: {
                type: Sequelize.STRING(128),
                allowNull: true
            },
            avatarUrl: {
                type: Sequelize.STRING(1000),
                allowNull: true
            },
            status: {
                type: Sequelize.ENUM('active', 'inactive', 'suspended'),
                allowNull: false,
                defaultValue: 'active'
            },
            presenceStatus: {
                type: Sequelize.ENUM('offline', 'online', 'away', 'busy'),
                allowNull: false,
                defaultValue: 'offline'
            },
            supportedLanguages: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: ['ar', 'en']
            },
            skills: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: []
            },
            metadata: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            lastSeenAt: {
                type: Sequelize.DATE,
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
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        await queryInterface.addIndex('support_agents', ['superAdminId'], {
            unique: true,
            name: 'uidx_support_agents_super_admin'
        });
        await queryInterface.addIndex('support_agents', ['status'], {
            name: 'idx_support_agents_status'
        });
        await queryInterface.addIndex('support_agents', ['presenceStatus'], {
            name: 'idx_support_agents_presence_status'
        });

        await queryInterface.createTable('support_categories', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'tenants', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            slug: {
                type: Sequelize.STRING(120),
                allowNull: false,
                unique: true
            },
            scope: {
                type: Sequelize.ENUM('global', 'tenant'),
                allowNull: false,
                defaultValue: 'global'
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            nameAr: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            descriptionAr: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            icon: {
                type: Sequelize.STRING(120),
                allowNull: true
            },
            color: {
                type: Sequelize.STRING(32),
                allowNull: true
            },
            sortOrder: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
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
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        await queryInterface.addIndex('support_categories', ['tenantId'], {
            name: 'idx_support_categories_tenant'
        });
        await queryInterface.addIndex('support_categories', ['scope'], {
            name: 'idx_support_categories_scope'
        });
        await queryInterface.addIndex('support_categories', ['isActive'], {
            name: 'idx_support_categories_is_active'
        });

        await queryInterface.createTable('support_tickets', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false
            },
            ticketNumber: {
                type: Sequelize.STRING(40),
                allowNull: false,
                unique: true
            },
            tenantId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'tenants', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            customerPlatformUserId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'platform_users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            supportCategoryId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_categories', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            assignedSupportAgentId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_agents', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            sourceChannel: {
                type: Sequelize.ENUM('customer_app', 'tenant_dashboard', 'support_portal', 'email', 'chat', 'live_chat', 'ai_assistant', 'api', 'system'),
                allowNull: false,
                defaultValue: 'customer_app'
            },
            status: {
                type: Sequelize.ENUM('draft', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'),
                allowNull: false,
                defaultValue: 'draft'
            },
            priority: {
                type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
                allowNull: false,
                defaultValue: 'medium'
            },
            language: {
                type: Sequelize.ENUM('ar', 'en'),
                allowNull: false,
                defaultValue: 'ar'
            },
            subject: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            subjectAr: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            descriptionAr: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            lastMessageAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            firstResponseAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            resolvedAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            closedAt: {
                type: Sequelize.DATE,
                allowNull: true
            },
            reopenedAt: {
                type: Sequelize.DATE,
                allowNull: true
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
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        await queryInterface.addIndex('support_tickets', ['ticketNumber'], {
            unique: true,
            name: 'uidx_support_tickets_ticket_number'
        });
        await queryInterface.addIndex('support_tickets', ['tenantId', 'status'], {
            name: 'idx_support_tickets_tenant_status'
        });
        await queryInterface.addIndex('support_tickets', ['tenantId', 'priority'], {
            name: 'idx_support_tickets_tenant_priority'
        });
        await queryInterface.addIndex('support_tickets', ['tenantId', 'lastMessageAt'], {
            name: 'idx_support_tickets_tenant_last_message'
        });
        await queryInterface.addIndex('support_tickets', ['customerPlatformUserId'], {
            name: 'idx_support_tickets_customer'
        });
        await queryInterface.addIndex('support_tickets', ['assignedSupportAgentId'], {
            name: 'idx_support_tickets_assigned_agent'
        });
        await queryInterface.addIndex('support_tickets', ['supportCategoryId'], {
            name: 'idx_support_tickets_category'
        });

        await queryInterface.createTable('support_messages', {
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
            replyToMessageId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_messages', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            senderType: {
                type: Sequelize.ENUM('customer', 'support_agent', 'ai', 'system'),
                allowNull: false
            },
            customerPlatformUserId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'platform_users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            supportAgentId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_agents', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            language: {
                type: Sequelize.ENUM('ar', 'en'),
                allowNull: false,
                defaultValue: 'ar'
            },
            contentFormat: {
                type: Sequelize.ENUM('plain', 'markdown', 'html'),
                allowNull: false,
                defaultValue: 'plain'
            },
            visibility: {
                type: Sequelize.ENUM('public', 'internal'),
                allowNull: false,
                defaultValue: 'public'
            },
            isEdited: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            editedAt: {
                type: Sequelize.DATE,
                allowNull: true
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
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        await queryInterface.addIndex('support_messages', ['tenantId', 'supportTicketId', 'createdAt'], {
            name: 'idx_support_messages_ticket_created_at'
        });
        await queryInterface.addIndex('support_messages', ['tenantId', 'senderType'], {
            name: 'idx_support_messages_sender_type'
        });
        await queryInterface.addIndex('support_messages', ['replyToMessageId'], {
            name: 'idx_support_messages_reply_to'
        });

        await queryInterface.createTable('support_attachments', {
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
                onDelete: 'CASCADE'
            },
            uploadedByType: {
                type: Sequelize.ENUM('customer', 'support_agent', 'ai', 'system'),
                allowNull: false,
                defaultValue: 'customer'
            },
            customerPlatformUserId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'platform_users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            supportAgentId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_agents', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            fileName: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            originalName: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            mimeType: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            fileCategory: {
                type: Sequelize.ENUM('image', 'pdf', 'office', 'zip'),
                allowNull: false
            },
            storageProvider: {
                type: Sequelize.STRING(64),
                allowNull: false,
                defaultValue: 'local'
            },
            storagePath: {
                type: Sequelize.STRING(1000),
                allowNull: false
            },
            storageUrl: {
                type: Sequelize.STRING(1000),
                allowNull: true
            },
            fileSize: {
                type: Sequelize.BIGINT,
                allowNull: false,
                defaultValue: 0
            },
            checksum: {
                type: Sequelize.STRING(128),
                allowNull: true
            },
            caption: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            isInline: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        await queryInterface.addIndex('support_attachments', ['tenantId', 'supportTicketId', 'createdAt'], {
            name: 'idx_support_attachments_ticket_created_at'
        });
        await queryInterface.addIndex('support_attachments', ['supportMessageId'], {
            name: 'idx_support_attachments_message'
        });
        await queryInterface.addIndex('support_attachments', ['fileCategory'], {
            name: 'idx_support_attachments_file_category'
        });

        await queryInterface.createTable('support_ticket_events', {
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
            supportAttachmentId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_attachments', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            actorType: {
                type: Sequelize.ENUM('customer', 'support_agent', 'ai', 'system'),
                allowNull: false,
                defaultValue: 'system'
            },
            customerPlatformUserId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'platform_users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            supportAgentId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'support_agents', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            eventType: {
                type: Sequelize.ENUM('ticket_created', 'reply_added', 'attachment_added', 'assigned', 'priority_changed', 'status_changed', 'closed', 'reopened', 'category_changed', 'note_added'),
                allowNull: false
            },
            fromStatus: {
                type: Sequelize.ENUM('draft', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'),
                allowNull: true
            },
            toStatus: {
                type: Sequelize.ENUM('draft', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'),
                allowNull: true
            },
            fromPriority: {
                type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
                allowNull: true
            },
            toPriority: {
                type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
                allowNull: true
            },
            payload: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            occurredAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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

        await queryInterface.addIndex('support_ticket_events', ['tenantId', 'occurredAt'], {
            name: 'idx_support_ticket_events_tenant_time'
        });
        await queryInterface.addIndex('support_ticket_events', ['supportTicketId', 'occurredAt'], {
            name: 'idx_support_ticket_events_ticket_time'
        });
        await queryInterface.addIndex('support_ticket_events', ['eventType', 'occurredAt'], {
            name: 'idx_support_ticket_events_type_time'
        });
        await queryInterface.addIndex('support_ticket_events', ['actorType'], {
            name: 'idx_support_ticket_events_actor_type'
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('support_ticket_events');
        await queryInterface.dropTable('support_attachments');
        await queryInterface.dropTable('support_messages');
        await queryInterface.dropTable('support_tickets');
        await queryInterface.dropTable('support_categories');
        await queryInterface.dropTable('support_agents');

        await queryInterface.sequelize.query(`
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN
                    SELECT typname
                    FROM pg_type
                    WHERE typname LIKE 'enum_support_%'
                LOOP
                    EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', r.typname);
                END LOOP;
            END $$;
        `);
    }
};
