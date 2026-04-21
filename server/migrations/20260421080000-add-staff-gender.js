'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('staff', 'gender', {
      type: Sequelize.STRING(32),
      allowNull: true,
      comment: 'Employee gender for filtering and sorting'
    });

    await queryInterface.addIndex('staff', ['tenantId', 'gender'], {
      name: 'idx_staff_tenant_gender'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('staff', 'idx_staff_tenant_gender');
    await queryInterface.removeColumn('staff', 'gender');
  }
};
