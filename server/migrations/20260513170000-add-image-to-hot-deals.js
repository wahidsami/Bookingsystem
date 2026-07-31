'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('./_index-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('hot_deals', 'image', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Uploaded hot deal image path (relative to uploads/)'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('hot_deals', 'image');
  }
};
