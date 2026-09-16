'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Create tenant_service_categories table
        await queryInterface.createTable('tenant_service_categories', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            tenantId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'tenants',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            name_en: {
                type: Sequelize.STRING(150),
                allowNull: false
            },
            name_ar: {
                type: Sequelize.STRING(150),
                allowNull: false
            },
            description_en: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            description_ar: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            slug: {
                type: Sequelize.STRING(150),
                allowNull: true
            },
            icon: {
                type: Sequelize.STRING(50),
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
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // 2. Add tenant-scoped indexes
        await queryInterface.addIndex('tenant_service_categories', ['tenantId'], {
            name: 'tenant_service_categories_tenant_idx'
        });

        await queryInterface.addIndex('tenant_service_categories', ['tenantId', 'sortOrder'], {
            name: 'tenant_service_categories_tenant_sort_idx'
        });

        await queryInterface.addIndex('tenant_service_categories', ['tenantId', 'slug'], {
            name: 'tenant_service_categories_tenant_slug_idx'
        });

        // 3. Add tenantServiceCategoryId to services table (nullable, SET NULL on delete)
        await queryInterface.addColumn('services', 'tenantServiceCategoryId', {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
                model: 'tenant_service_categories',
                key: 'id'
            },
            onDelete: 'SET NULL'
        });

        // 4. Add tenantServiceCategoryId to service_packages table (nullable, SET NULL on delete)
        await queryInterface.addColumn('service_packages', 'tenantServiceCategoryId', {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
                model: 'tenant_service_categories',
                key: 'id'
            },
            onDelete: 'SET NULL'
        });
    },

    async down(queryInterface, Sequelize) {
        // Rollback columns first
        await queryInterface.removeColumn('service_packages', 'tenantServiceCategoryId');
        await queryInterface.removeColumn('services', 'tenantServiceCategoryId');

        // Drop table (indexes dropped automatically with table)
        await queryInterface.dropTable('tenant_service_categories');
    }
};
