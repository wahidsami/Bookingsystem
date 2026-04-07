'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
          IF EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'hot_deals'
          ) THEN
              ALTER TABLE public.hot_deals
                  ADD COLUMN IF NOT EXISTS image TEXT;
          END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
          IF EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'hot_deals'
          ) THEN
              ALTER TABLE public.hot_deals
                  DROP COLUMN IF EXISTS image;
          END IF;
      END $$;
    `);
  }
};
