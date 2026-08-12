'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('platform_users', 'phone', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true // PostgreSQL unique constraints allow multiple NULLs automatically
    });

    await queryInterface.changeColumn('platform_users', 'lastName', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('platform_users', 'phone', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    });

    await queryInterface.changeColumn('platform_users', 'lastName', {
      type: Sequelize.STRING,
      allowNull: false
    });
  }
};
