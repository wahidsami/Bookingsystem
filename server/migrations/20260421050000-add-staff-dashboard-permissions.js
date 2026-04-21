'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.staff
      ADD COLUMN IF NOT EXISTS "dashboardPermissions" JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.staff
      DROP COLUMN IF EXISTS "dashboardPermissions";
    `);
  }
};
