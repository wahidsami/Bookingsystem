'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;
    if (sequelize.getDialect() !== 'postgres') return;

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_tenants_status" AS ENUM('pending', 'approved', 'rejected', 'suspended', 'inactive');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_tenants_plan" AS ENUM('free_trial', 'basic', 'pro', 'enterprise');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await sequelize.query(`
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status "enum_tenants_status" DEFAULT 'pending';
    `);

    await sequelize.query(`
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS city VARCHAR(255);
    `);

    await sequelize.query(`
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan "enum_tenants_plan" DEFAULT 'free_trial';
    `);
  },

  async down() {}
};
