'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
          bills_table_exists BOOLEAN;
          status_udt_name TEXT;
      BEGIN
          SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'bills'
          ) INTO bills_table_exists;

          IF NOT bills_table_exists THEN
              RETURN;
          END IF;

          SELECT c.udt_name
          INTO status_udt_name
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'bills'
            AND c.column_name = 'status';

          IF status_udt_name IS NOT NULL
             AND status_udt_name NOT IN ('varchar', 'text', 'bpchar') THEN
              BEGIN
                  EXECUTE 'ALTER TYPE "' || status_udt_name || '" ADD VALUE IF NOT EXISTS ''VOID''';
              EXCEPTION
                  WHEN duplicate_object THEN NULL;
              END;
          END IF;

          ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
          ALTER TABLE public.bills
              ADD CONSTRAINT bills_status_check
              CHECK (status::text = ANY (ARRAY['DRAFT', 'UNPAID', 'FAILED', 'PAID', 'EXPIRED', 'VOID']));
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
              WHERE table_schema = 'public' AND table_name = 'bills'
          ) THEN
              ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
              ALTER TABLE public.bills
                  ADD CONSTRAINT bills_status_check
                  CHECK (status::text = ANY (ARRAY['DRAFT', 'UNPAID', 'FAILED', 'PAID', 'EXPIRED']));
          END IF;
      END $$;
    `);
  }
};
