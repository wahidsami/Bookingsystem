-- Migration: Add service availability fields (in center and home visit)
-- This migration adds:
-- 1. availableInCenter - Boolean (default: true)
-- 2. availableHomeVisit - Boolean (default: false)

-- Step 1: Add new columns
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS "availableInCenter" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "availableHomeVisit" BOOLEAN DEFAULT false;

-- Step 2: Update existing services to have in-center available by default
UPDATE services 
SET 
    "availableInCenter" = true,
    "availableHomeVisit" = false
WHERE "availableInCenter" IS NULL OR "availableHomeVisit" IS NULL;

-- Step 3: Add comments
COMMENT ON COLUMN services."availableInCenter" IS 'Service available at the center/salon location';
COMMENT ON COLUMN services."availableHomeVisit" IS 'Service available as home visit';

