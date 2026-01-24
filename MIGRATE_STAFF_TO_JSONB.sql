-- Migration: Convert Staff table columns from array/text to JSONB
-- Run this in pgAdmin or psql

-- Step 1: Remove the default value first (we'll add it back after conversion)
ALTER TABLE "staff" 
  ALTER COLUMN "skills" DROP DEFAULT;

-- Step 2: Convert skills from character varying[] to JSONB
-- to_jsonb() converts PostgreSQL array to JSONB array
ALTER TABLE "staff" 
  ALTER COLUMN "skills" TYPE jsonb 
  USING to_jsonb("skills");

-- Step 3: Set the default value back as JSONB
ALTER TABLE "staff" 
  ALTER COLUMN "skills" SET DEFAULT '[]'::jsonb;

-- Step 4: Handle workingHours default if it exists
ALTER TABLE "staff" 
  ALTER COLUMN "workingHours" DROP DEFAULT;

-- Step 5: Convert workingHours to JSONB
-- Try to convert directly, if it fails use empty object
ALTER TABLE "staff" 
  ALTER COLUMN "workingHours" TYPE jsonb 
  USING CASE 
    WHEN "workingHours" IS NULL THEN '{}'::jsonb
    ELSE COALESCE("workingHours"::text::jsonb, '{}'::jsonb)
  END;

-- Step 6: Set the default value back as JSONB
ALTER TABLE "staff" 
  ALTER COLUMN "workingHours" SET DEFAULT '{}'::jsonb;

-- Step 7: Verify (optional - run to check)
SELECT column_name, data_type, udt_name, column_default
FROM information_schema.columns 
WHERE table_name = 'staff' 
AND column_name IN ('skills', 'workingHours');

