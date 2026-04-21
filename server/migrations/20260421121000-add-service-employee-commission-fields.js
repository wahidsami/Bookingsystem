'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('service_employees', 'commissionType', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Commission type for this service assignment: fixed or percentage'
    });

    await queryInterface.addColumn('service_employees', 'commissionValue', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Commission value for this service assignment'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_employees', 'commissionValue');
    await queryInterface.removeColumn('service_employees', 'commissionType');
  }
};
