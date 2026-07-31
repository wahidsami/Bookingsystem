'use strict';

const { ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);

    await queryInterface.addColumn('staff', 'bio', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('staff', 'commission', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00
    });

    await queryInterface.addColumn('staff', 'commissionRate', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00
    });

    await queryInterface.addColumn('staff', 'experience', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('staff', 'nationality', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('staff', 'phone', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('staff', 'photo', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('staff', 'rating', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 5.00
    });

    await queryInterface.addColumn('staff', 'salary', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    });

    await queryInterface.addColumn('staff', 'scheduleVisibilityWeeks', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });

    await queryInterface.addColumn('staff', 'skills', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });

    await queryInterface.addColumn('staff', 'totalBookings', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  },

  async down() {}
};
