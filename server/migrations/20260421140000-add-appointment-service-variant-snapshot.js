'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentIndexing(queryInterface);
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('appointments', 'serviceVariantId', {
      type: Sequelize.STRING(120),
      allowNull: true
    });

    await queryInterface.addColumn('appointments', 'serviceVariantName', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('appointments', 'serviceVariantDescription', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('appointments', 'serviceVariantDuration', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addIndex('appointments', ['serviceVariantId'], {
      name: 'appointments_service_variant_id_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('appointments', 'appointments_service_variant_id_idx');
    await queryInterface.removeColumn('appointments', 'serviceVariantDuration');
    await queryInterface.removeColumn('appointments', 'serviceVariantDescription');
    await queryInterface.removeColumn('appointments', 'serviceVariantName');
    await queryInterface.removeColumn('appointments', 'serviceVariantId');
  }
};
