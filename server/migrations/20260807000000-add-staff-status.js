'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'staff';
    const column = 'status';
    const tableDefinition = await queryInterface.describeTable(table);

    if (!tableDefinition[column]) {
      await queryInterface.addColumn(table, column, {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active',
        comment: 'Operational status for scheduler visibility and booking rules'
      });
    }

    await queryInterface.sequelize.query(
      `UPDATE public.staff
       SET status = CASE
         WHEN "isActive" = false THEN 'off'
         ELSE COALESCE(NULLIF(TRIM(status), ''), 'active')
       END
       WHERE status IS NULL OR TRIM(status) = '' OR status NOT IN ('active', 'break', 'off')`
    );

    await queryInterface.changeColumn(table, column, {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'active',
      comment: 'Operational status for scheduler visibility and booking rules'
    });
  },

  async down(queryInterface, Sequelize) {
    const table = 'staff';
    const tableDefinition = await queryInterface.describeTable(table);

    if (tableDefinition.status) {
      await queryInterface.removeColumn(table, 'status');
    }
  }
};
