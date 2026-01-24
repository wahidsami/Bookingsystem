-- Migration: Add page banner columns to public_page_data table
-- This follows the same pattern as aboutUs_heroImage (VARCHAR(500) for image paths)

-- Add page banner columns
ALTER TABLE "public_page_data"
ADD COLUMN IF NOT EXISTS "pageBanner_services" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "pageBanner_products" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "pageBanner_about" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "pageBanner_contact" VARCHAR(500);

-- Add comments for documentation
COMMENT ON COLUMN "public_page_data"."pageBanner_services" IS 'Banner image for Services page (recommended: 1920x400px)';
COMMENT ON COLUMN "public_page_data"."pageBanner_products" IS 'Banner image for Products page (recommended: 1920x400px)';
COMMENT ON COLUMN "public_page_data"."pageBanner_about" IS 'Banner image for About Us page (recommended: 1920x400px)';
COMMENT ON COLUMN "public_page_data"."pageBanner_contact" IS 'Banner image for Contact page (recommended: 1920x400px)';

