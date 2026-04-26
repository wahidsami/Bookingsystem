'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
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
