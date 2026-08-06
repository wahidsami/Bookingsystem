'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Tenants');

    if (!tableInfo.region) {
      await queryInterface.addColumn('Tenants', 'region', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Administrative Region'
      });
    }

    if (!tableInfo.nationalAddressDocument) {
      await queryInterface.addColumn('Tenants', 'nationalAddressDocument', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'National Address document file path'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Tenants');

    if (tableInfo.region) {
      await queryInterface.removeColumn('Tenants', 'region');
    }

    if (tableInfo.nationalAddressDocument) {
      await queryInterface.removeColumn('Tenants', 'nationalAddressDocument');
    }
  }
};
