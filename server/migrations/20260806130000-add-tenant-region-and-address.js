'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('tenants');

    if (!tableInfo.region) {
      await queryInterface.addColumn('tenants', 'region', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Administrative Region'
      });
    }

    if (!tableInfo.nationalAddressDocument) {
      await queryInterface.addColumn('tenants', 'nationalAddressDocument', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'National Address document file path'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('tenants');

    if (tableInfo.region) {
      await queryInterface.removeColumn('tenants', 'region');
    }

    if (tableInfo.nationalAddressDocument) {
      await queryInterface.removeColumn('tenants', 'nationalAddressDocument');
    }
  }
};
