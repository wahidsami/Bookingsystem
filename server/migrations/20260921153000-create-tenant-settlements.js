'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Create tenant_settlements table
        const tableExists = await queryInterface.tableExists('tenant_settlements');
        if (!tableExists) {
            await queryInterface.createTable('tenant_settlements', {
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
                sourceTransactionId: {
                    type: Sequelize.UUID,
                    allowNull: true,
                    references: {
                        model: 'transactions',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                sourceType: {
                    type: Sequelize.STRING(50),
                    allowNull: false
                },
                grossAmount: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: false
                },
                platformFeeAmount: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                gatewayFeeAmount: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                refundAmount: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                adjustmentAmount: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: false,
                    defaultValue: 0.00
                },
                netPayableAmount: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: false
                },
                status: {
                    type: Sequelize.STRING(30),
                    allowNull: false,
                    defaultValue: 'pending'
                },
                settlementPeriod: {
                    type: Sequelize.STRING(50),
                    allowNull: false
                },
                settlementReference: {
                    type: Sequelize.STRING(100),
                    allowNull: true
                },
                settledAt: {
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
                    defaultValue: Sequelize.fn('NOW')
                },
                updatedAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.fn('NOW')
                }
            });

            await queryInterface.addIndex('tenant_settlements', ['tenantId', 'status']);
            await queryInterface.addIndex('tenant_settlements', ['settlementPeriod']);
            await queryInterface.addIndex('tenant_settlements', ['sourceTransactionId']);
            await queryInterface.addIndex('tenant_settlements', ['sourceType']);
        }
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('tenant_settlements');
    }
};
