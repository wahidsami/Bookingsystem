'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('platform_users', 'auth_provider', {
      type: Sequelize.ENUM('local', 'google'),
      allowNull: false,
      defaultValue: 'local'
    });

    await queryInterface.addColumn('platform_users', 'google_sub', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn('platform_users', 'google_email', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.changeColumn('platform_users', 'password', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('platform_users', 'password', {
      type: Sequelize.STRING,
      allowNull: false
    });

    await queryInterface.removeColumn('platform_users', 'google_email');
    await queryInterface.removeColumn('platform_users', 'google_sub');
    await queryInterface.removeColumn('platform_users', 'auth_provider');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_platform_users_auth_provider";');
  }
};
