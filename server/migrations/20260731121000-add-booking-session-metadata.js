'use strict';

const { ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);

    await queryInterface.addColumn('booking_sessions', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });
  },

  async down() {}
};
