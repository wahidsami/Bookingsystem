-- Simple fix for Staff table JSON columns
-- Run these commands one at a time in pgAdmin or psql

-- 1. Convert skills from character varying[] to JSONB
-- This converts the PostgreSQL array to a JSONB array
ALTER TABLE "staff" 
  ALTER COLUMN "skills" TYPE jsonb 
  USING to_jsonb("skills");

-- 2. Convert workingHours to JSONB (if it exists and is not already JSONB)
-- If workingHours is text/varchar, convert it
-- If it's already JSON/JSONB, this will work too
ALTER TABLE "staff" 
  ALTER COLUMN "workingHours" TYPE jsonb 
  USING CASE 
    WHEN "workingHours" IS NULL THEN '{}'::jsonb
    WHEN "workingHours"::text = '' THEN '{}'::jsonb
    ELSE "workingHours"::text::jsonb
  END;

-- 3. Verify the changes
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'staff' 
AND column_name IN ('skills', 'workingHours');

