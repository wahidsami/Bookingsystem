-- Migration: Add hero slider field to public_page_data table
-- This migration adds heroSliders JSONB field to store hero slider configurations

-- Step 1: Add heroSliders column
ALTER TABLE "public_page_data" 
ADD COLUMN IF NOT EXISTS "heroSliders" JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add comment
COMMENT ON COLUMN "public_page_data"."heroSliders" IS 'Array of hero slider objects with background image, text content, CTA buttons, and alignment settings';

-- Note: Each slider object format:
-- {
--   "id": "unique-id",
--   "backgroundImage": "path/to/image.jpg",
--   "taglineEn": "Optional tagline in English",
--   "taglineAr": "Optional tagline in Arabic",
--   "heroTitleEn": "Main headline in English",
--   "heroTitleAr": "Main headline in Arabic",
--   "heroTitleColor": "#FFFFFF",
--   "subtitleEn": "Optional subtitle in English",
--   "subtitleAr": "Optional subtitle in Arabic",
--   "subtitleColor": "#FFFFFF",
--   "ctaButtonTextEn": "Button text in English",
--   "ctaButtonTextAr": "Button text in Arabic",
--   "ctaButtonType": "service|product",
--   "ctaButtonItemId": "uuid-of-selected-item",
--   "textAlignment": "left|center|right",
--   "order": 0
-- }

