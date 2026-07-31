'use strict';

const { ensureIdempotentIndexing, ensureIdempotentColumnChanges } = require('./_index-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);
    await queryInterface.addColumn('tenant_settings', 'dashboardSettings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        defaultLandingPage: 'home'
      },
      comment: 'Tenant dashboard preferences such as default landing page'
    }, {
      schema: 'public'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tenant_settings', 'dashboardSettings', {
      schema: 'public'
    });
  }
};
