'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.service_employees
      ADD COLUMN IF NOT EXISTS "commissionType" VARCHAR(20);
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN public.service_employees."commissionType"
      IS 'Commission type for this service assignment: fixed or percentage';
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.service_employees
      ADD COLUMN IF NOT EXISTS "commissionValue" DECIMAL(10, 2);
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN public.service_employees."commissionValue"
      IS 'Commission value for this service assignment';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.service_employees
      DROP COLUMN IF EXISTS "commissionValue";
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.service_employees
      DROP COLUMN IF EXISTS "commissionType";
    `);
  }
};
