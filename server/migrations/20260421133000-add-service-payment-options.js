'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('services', 'paymentOptions', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of allowed booking payment methods for the service'
    }, {
      schema: 'public'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('services', 'paymentOptions', {
      schema: 'public'
    });
  }
};
