-- Fix Staff table JSON columns
-- Convert from character varying[] to JSONB for skills
-- Convert from existing type to JSONB for workingHours

-- Step 1: Check current column types (run this first to see what we're working with)
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'staff' 
AND column_name IN ('skills', 'workingHours');

-- Step 2: Convert skills from character varying[] to JSONB
-- Convert PostgreSQL array to JSONB array
ALTER TABLE "staff" 
  ALTER COLUMN "skills" TYPE jsonb 
  USING CASE 
    WHEN "skills" IS NULL THEN '[]'::jsonb
    WHEN array_length("skills", 1) IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("skills")::jsonb
  END;

-- Step 3: Convert workingHours to JSONB
-- Handle different possible types (text, json, jsonb)
DO $$
BEGIN
    -- Try to convert workingHours to JSONB
    -- If it's already JSON/JSONB, this will work
    -- If it's text, it will try to parse it
    ALTER TABLE "staff" 
      ALTER COLUMN "workingHours" TYPE jsonb 
      USING CASE 
        WHEN "workingHours" IS NULL THEN '{}'::jsonb
        WHEN "workingHours"::text = '' THEN '{}'::jsonb
        ELSE COALESCE("workingHours"::text::jsonb, '{}'::jsonb)
      END;
EXCEPTION
    WHEN OTHERS THEN
        -- If conversion fails, set to empty object
        ALTER TABLE "staff" 
          ALTER COLUMN "workingHours" TYPE jsonb 
          USING '{}'::jsonb;
END $$;

-- Step 4: Verify the changes
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'staff' 
AND column_name IN ('skills', 'workingHours');

