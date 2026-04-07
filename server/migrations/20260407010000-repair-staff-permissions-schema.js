'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'staff_permissions'
          ) THEN
              RETURN;
          END IF;

          ALTER TABLE public.staff_permissions
              ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

          ALTER TABLE public.staff_permissions
              ADD COLUMN IF NOT EXISTS "staffId" UUID;

          ALTER TABLE public.staff_permissions
              ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT
              '{"view_earnings": false, "view_reviews": true, "reply_reviews": false, "view_clients": false}'::jsonb;

          ALTER TABLE public.staff_permissions
              ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

          ALTER TABLE public.staff_permissions
              ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

          IF EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'staff_permissions'
                AND column_name = 'permissions'
                AND data_type IN ('text', 'character varying', 'json')
          ) THEN
              ALTER TABLE public.staff_permissions
                  ALTER COLUMN permissions TYPE JSONB
                  USING CASE
                      WHEN permissions IS NULL OR permissions::text = '' THEN
                          '{"view_earnings": false, "view_reviews": true, "reply_reviews": false, "view_clients": false}'::jsonb
                      ELSE permissions::jsonb
                  END;
          END IF;

          ALTER TABLE public.staff_permissions
              ALTER COLUMN permissions SET DEFAULT
              '{"view_earnings": false, "view_reviews": true, "reply_reviews": false, "view_clients": false}'::jsonb;

          UPDATE public.staff_permissions
          SET permissions = '{"view_earnings": false, "view_reviews": true, "reply_reviews": false, "view_clients": false}'::jsonb
          WHERE permissions IS NULL;
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
              WHERE table_schema = 'public' AND table_name = 'staff_permissions'
          ) THEN
              ALTER TABLE public.staff_permissions DROP COLUMN IF EXISTS "updatedAt";
              ALTER TABLE public.staff_permissions DROP COLUMN IF EXISTS "createdAt";
          END IF;
      END $$;
    `);
  }
};
