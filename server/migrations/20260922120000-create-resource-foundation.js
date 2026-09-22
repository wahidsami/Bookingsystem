'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Create resource_types table
        await queryInterface.createTable('resource_types', {
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
            name_ar: {
                type: Sequelize.STRING(150),
                allowNull: false
            },
            name_en: {
                type: Sequelize.STRING(150),
                allowNull: false
            },
            is_active: {
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

        await queryInterface.addIndex('resource_types', ['tenantId'], {
            name: 'resource_types_tenant_idx'
        });
        await queryInterface.addIndex('resource_types', ['tenantId', 'is_active'], {
            name: 'resource_types_tenant_active_idx'
        });

        // 2. Create resources table (physical instances)
        await queryInterface.createTable('resources', {
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
            resourceTypeId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'resource_types',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            name_ar: {
                type: Sequelize.STRING(150),
                allowNull: false
            },
            name_en: {
                type: Sequelize.STRING(150),
                allowNull: false
            },
            is_active: {
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

        await queryInterface.addIndex('resources', ['tenantId'], {
            name: 'resources_tenant_idx'
        });
        await queryInterface.addIndex('resources', ['resourceTypeId'], {
            name: 'resources_type_idx'
        });
        await queryInterface.addIndex('resources', ['tenantId', 'is_active'], {
            name: 'resources_tenant_active_idx'
        });
        await queryInterface.addIndex('resources', ['tenantId', 'resourceTypeId', 'is_active'], {
            name: 'resources_tenant_type_active_idx'
        });

        // 3. Create service_resource_requirements table
        await queryInterface.createTable('service_resource_requirements', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            serviceId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'services',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            variantId: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            resourceTypeId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'resource_types',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
            },
            quantity: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1
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

        await queryInterface.addIndex('service_resource_requirements', ['serviceId'], {
            name: 'srv_res_req_service_idx'
        });
        await queryInterface.addIndex('service_resource_requirements', ['serviceId', 'variantId'], {
            name: 'srv_res_req_srv_variant_idx'
        });
        await queryInterface.addIndex('service_resource_requirements', ['resourceTypeId'], {
            name: 'srv_res_req_type_idx'
        });

        // Add partial unique indexes for duplicate requirement protection
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX srv_res_req_parent_unique 
            ON service_resource_requirements ("serviceId", "resourceTypeId") 
            WHERE "variantId" IS NULL;
        `);

        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX srv_res_req_variant_unique 
            ON service_resource_requirements ("serviceId", "variantId", "resourceTypeId") 
            WHERE "variantId" IS NOT NULL;
        `);

        // 4. Create appointment_resources table (allocation records)
        await queryInterface.createTable('appointment_resources', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            appointmentId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'appointments',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            resourceId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'resources',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
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

        await queryInterface.addIndex('appointment_resources', ['appointmentId'], {
            name: 'appt_res_appointment_idx'
        });
        await queryInterface.addIndex('appointment_resources', ['resourceId'], {
            name: 'appt_res_resource_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('appointment_resources');
        await queryInterface.dropTable('service_resource_requirements');
        await queryInterface.dropTable('resources');
        await queryInterface.dropTable('resource_types');
    }
};
