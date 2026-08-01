'use strict';

const { addColumnIfMissing } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface);

    await queryInterface.addColumn('staff', 'workingHours', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('staff', 'workingHours').catch(() => {});
  }
};
