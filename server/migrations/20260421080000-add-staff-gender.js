'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.staff
      ADD COLUMN IF NOT EXISTS gender VARCHAR(32);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_tenant_gender
      ON public.staff ("tenantId", gender);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS public.idx_staff_tenant_gender;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.staff
      DROP COLUMN IF EXISTS gender;
    `);
  }
};
