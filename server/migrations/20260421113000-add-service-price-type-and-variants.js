'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('services', 'priceType', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'fixed'
    });

    await queryInterface.addColumn('services', 'variants', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('services', 'variants');
    await queryInterface.removeColumn('services', 'priceType');
  }
};
