-- Migration: Add slug field to tenants table (if not exists)
-- This migration adds a unique slug field for URL-friendly tenant identification

-- Step 1: Check if slug column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE "tenants" ADD COLUMN "slug" VARCHAR(100);
        
        -- Step 2: Generate slugs from existing tenant names (if any)
        UPDATE "tenants" 
        SET "slug" = LOWER(REGEXP_REPLACE(
            COALESCE("name_en", "name", 'tenant-' || "id"::text),
            '[^a-z0-9]+', '-', 'g'
        ))
        WHERE "slug" IS NULL;
        
        -- Step 3: Make slug unique and not null
        ALTER TABLE "tenants" 
        ALTER COLUMN "slug" SET NOT NULL,
        ADD CONSTRAINT "tenants_slug_unique" UNIQUE ("slug");
        
        -- Step 4: Add index for faster lookups
        CREATE INDEX IF NOT EXISTS "idx_tenants_slug" ON "tenants" ("slug");
    END IF;
END $$;

-- Step 5: Add comment
COMMENT ON COLUMN "tenants"."slug" IS 'URL-friendly identifier for tenant public pages';

