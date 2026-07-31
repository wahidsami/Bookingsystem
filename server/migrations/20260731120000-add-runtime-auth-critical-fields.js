'use strict';

const { addColumnIfMissing } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface);

    await queryInterface.addColumn('tenants', 'password', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'lastLogin', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('staff', 'email', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('staff', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  async down() {}
};
