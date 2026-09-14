'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_addresses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      platformUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'platform_user_id',
        references: {
          model: { tableName: 'platform_users', schema: 'public' },
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Home',
      },
      street: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      building: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      floor: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      apartment: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        field: 'updated_at',
      },
    }, {
      schema: 'public',
    });

    // Index for fast lookup by user
    await queryInterface.addIndex('user_addresses', ['platform_user_id'], {
      name: 'user_addresses_platform_user_id_idx',
      schema: 'public',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'user_addresses', schema: 'public' });
  },
};
