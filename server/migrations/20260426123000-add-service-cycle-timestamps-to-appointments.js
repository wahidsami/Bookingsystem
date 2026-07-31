'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('appointments', 'serviceStartedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('appointments', 'serviceCompletedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('appointments', 'serviceCompletedAt');
    await queryInterface.removeColumn('appointments', 'serviceStartedAt');
  }
};
