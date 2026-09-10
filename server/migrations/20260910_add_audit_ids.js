// 20260910_add_audit_ids.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('activity_logs', 'tenantId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('activity_logs', 'requestId', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('activity_logs', 'operationId', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('activity_logs', 'correlationId', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    // Indexes for new columns
    await queryInterface.addIndex('activity_logs', ['tenantId']);
    await queryInterface.addIndex('activity_logs', ['requestId']);
    await queryInterface.addIndex('activity_logs', ['operationId']);
    await queryInterface.addIndex('activity_logs', ['correlationId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('activity_logs', ['correlationId']);
    await queryInterface.removeIndex('activity_logs', ['operationId']);
    await queryInterface.removeIndex('activity_logs', ['requestId']);
    await queryInterface.removeIndex('activity_logs', ['tenantId']);
    await queryInterface.removeColumn('activity_logs', 'correlationId');
    await queryInterface.removeColumn('activity_logs', 'operationId');
    await queryInterface.removeColumn('activity_logs', 'requestId');
    await queryInterface.removeColumn('activity_logs', 'tenantId');
  },
};
