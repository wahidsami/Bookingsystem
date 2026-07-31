'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('staff', 'spokenLanguages', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });

    await queryInterface.addColumn('staff', 'serviceCommissionEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('staff', 'productCommissionEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('staff', 'productCommissionEnabled');
    await queryInterface.removeColumn('staff', 'serviceCommissionEnabled');
    await queryInterface.removeColumn('staff', 'spokenLanguages');
  }
};
