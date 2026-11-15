'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE tenant_settings
      SET "bookingSettings" = jsonb_set(COALESCE("bookingSettings"::jsonb, '{}'::jsonb), '{allowCompletionWithOutstandingBalance}', 'false'::jsonb, true)
      WHERE "bookingSettings" IS NULL OR NOT ("bookingSettings"::jsonb ? 'allowCompletionWithOutstandingBalance');
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE tenant_settings
      SET "bookingSettings" = "bookingSettings"::jsonb - 'allowCompletionWithOutstandingBalance'
      WHERE "bookingSettings"::jsonb ? 'allowCompletionWithOutstandingBalance';
    `);
  }
};
