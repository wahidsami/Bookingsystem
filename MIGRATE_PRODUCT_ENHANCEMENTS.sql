-- Migration: Add enhanced product fields
-- This migration adds:
-- 1. Separate ingredients fields (English and Arabic)
-- 2. How to use fields (English and Arabic)
-- 3. Product features fields (English and Arabic)
-- 4. Multiple images support (up to 5 images, minimum 1)

-- Step 1: Add new columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS "ingredients_en" TEXT,
ADD COLUMN IF NOT EXISTS "ingredients_ar" TEXT,
ADD COLUMN IF NOT EXISTS "howToUse_en" TEXT,
ADD COLUMN IF NOT EXISTS "howToUse_ar" TEXT,
ADD COLUMN IF NOT EXISTS "features_en" TEXT,
ADD COLUMN IF NOT EXISTS "features_ar" TEXT,
ADD COLUMN IF NOT EXISTS "images" JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing ingredients data
-- If old ingredients field has data, copy it to both English and Arabic fields
UPDATE products 
SET 
    "ingredients_en" = COALESCE("ingredients", ''),
    "ingredients_ar" = COALESCE("ingredients", '')
WHERE "ingredients" IS NOT NULL AND "ingredients" != '';

-- Step 3: Migrate existing image to images array
-- Convert single image to images array format
UPDATE products 
SET "images" = CASE 
    WHEN "image" IS NOT NULL AND "image" != '' THEN 
        jsonb_build_array("image")
    ELSE 
        '[]'::jsonb
END
WHERE "images" IS NULL OR "images" = '[]'::jsonb;

-- Step 4: Add comments
COMMENT ON COLUMN products."ingredients_en" IS 'Product ingredients in English';
COMMENT ON COLUMN products."ingredients_ar" IS 'Product ingredients in Arabic';
COMMENT ON COLUMN products."howToUse_en" IS 'How to use instructions in English';
COMMENT ON COLUMN products."howToUse_ar" IS 'How to use instructions in Arabic';
COMMENT ON COLUMN products."features_en" IS 'Product features in English (can be JSON array or text)';
COMMENT ON COLUMN products."features_ar" IS 'Product features in Arabic (can be JSON array or text)';
COMMENT ON COLUMN products."images" IS 'Array of product image paths/URLs (up to 5 images, minimum 1)';

