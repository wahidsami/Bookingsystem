'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('services', 'targetGender', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'all',
      comment: 'Who the service is intended for: all, female, or male'
    });

    await queryInterface.addIndex('services', ['targetGender'], {
      name: 'idx_services_target_gender'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('services', 'idx_services_target_gender');
    await queryInterface.removeColumn('services', 'targetGender');
  }
};
