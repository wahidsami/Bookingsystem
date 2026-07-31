'use strict';

const { ensureIdempotentIndexing } = require('./_index-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
        await queryInterface.createTable('tenant_saved_reports', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            tenantId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'tenants',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            createdByUserId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'platform_users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            reportType: {
                type: Sequelize.STRING(64),
                allowNull: false
            },
            title: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            sections: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: []
            },
            filters: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            selectedMetrics: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: []
            },
            grouping: {
                type: Sequelize.STRING(64),
                allowNull: true
            },
            sorting: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            reportConfig: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            isFavorite: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            duplicatedFromId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'tenant_saved_reports',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            lastOpenedAt: {
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
            }
        });

        await queryInterface.addIndex('tenant_saved_reports', ['tenantId', 'reportType'], {
            name: 'idx_tenant_saved_reports_tenant_type'
        });

        await queryInterface.addIndex('tenant_saved_reports', ['tenantId', 'isFavorite'], {
            name: 'idx_tenant_saved_reports_tenant_favorite'
        });

        await queryInterface.addIndex('tenant_saved_reports', ['tenantId', 'updatedAt'], {
            name: 'idx_tenant_saved_reports_tenant_updated_at'
        });

        await queryInterface.addIndex('tenant_saved_reports', ['tenantId', 'createdByUserId'], {
            name: 'idx_tenant_saved_reports_tenant_creator'
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tenant_saved_reports', 'idx_tenant_saved_reports_tenant_creator');
        await queryInterface.removeIndex('tenant_saved_reports', 'idx_tenant_saved_reports_tenant_updated_at');
        await queryInterface.removeIndex('tenant_saved_reports', 'idx_tenant_saved_reports_tenant_favorite');
        await queryInterface.removeIndex('tenant_saved_reports', 'idx_tenant_saved_reports_tenant_type');
        await queryInterface.dropTable('tenant_saved_reports');
    }
};
