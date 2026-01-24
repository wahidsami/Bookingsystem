-- Migration: Add Benefits List and What to Expect fields to services table
-- This migration adds:
-- 1. Benefits List (bilingual: English and Arabic) - JSONB array
-- 2. What to Expect (bilingual: English and Arabic) - JSONB array

-- Step 1: Add new columns
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS "benefits" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "whatToExpect" JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add comments
COMMENT ON COLUMN services."benefits" IS 'Array of benefit objects with en and ar properties: [{en: "Benefit 1", ar: "فائدة 1"}, ...]';
COMMENT ON COLUMN services."whatToExpect" IS 'Array of "What to Expect" items with en and ar properties: [{en: "Expectation 1", ar: "توقع 1"}, ...]';

