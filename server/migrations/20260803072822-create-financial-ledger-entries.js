'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('financial_ledger_entries', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
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
      customerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platform_users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      entityType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      entityId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: 'SAR'
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'completed'
      },
      paymentMethod: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
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

    await queryInterface.addIndex('financial_ledger_entries', ['tenantId']);
    await queryInterface.addIndex('financial_ledger_entries', ['entityType', 'entityId']);
    await queryInterface.addIndex('financial_ledger_entries', ['createdAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('financial_ledger_entries');
  }
};

