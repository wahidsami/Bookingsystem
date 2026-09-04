'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create service_packages table
        await queryInterface.createTable('service_packages', {
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
                }
            },
            name_en: {
                type: Sequelize.STRING,
                allowNull: false
            },
            name_ar: {
                type: Sequelize.STRING,
                allowNull: false
            },
            image: {
                type: Sequelize.STRING,
                allowNull: true
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            totalDuration: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            totalPrice: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00
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

        // Create service_package_items table
        await queryInterface.createTable('service_package_items', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            packageId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'service_packages',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            serviceId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'services',
                    key: 'id'
                }
            },
            variantId: {
                type: Sequelize.STRING,
                allowNull: true
            },
            defaultStaffId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'staff',
                    key: 'id'
                }
            },
            sequenceOrder: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
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

        // Add columns to appointments table
        await queryInterface.addColumn('appointments', 'packageId', {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
                model: 'service_packages',
                key: 'id'
            }
        });
        
        await queryInterface.addColumn('appointments', 'packageItemId', {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
                model: 'service_package_items',
                key: 'id'
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('appointments', 'packageItemId');
        await queryInterface.removeColumn('appointments', 'packageId');
        await queryInterface.dropTable('service_package_items');
        await queryInterface.dropTable('service_packages');
    }
};
