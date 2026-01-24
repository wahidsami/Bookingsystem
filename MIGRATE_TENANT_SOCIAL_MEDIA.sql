-- Migration: Add social media fields to tenants table
-- This migration adds social media links and WhatsApp number fields to the tenants table

-- Step 1: Add social media columns
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS "facebookUrl" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "instagramUrl" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "twitterUrl" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "linkedinUrl" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "tiktokUrl" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "youtubeUrl" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "snapchatUrl" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "pinterestUrl" VARCHAR(500);

-- Step 2: Add comments
COMMENT ON COLUMN tenants."facebookUrl" IS 'Facebook page/profile URL';
COMMENT ON COLUMN tenants."instagramUrl" IS 'Instagram profile URL';
COMMENT ON COLUMN tenants."twitterUrl" IS 'Twitter/X profile URL';
COMMENT ON COLUMN tenants."linkedinUrl" IS 'LinkedIn company/profile URL';
COMMENT ON COLUMN tenants."tiktokUrl" IS 'TikTok profile URL';
COMMENT ON COLUMN tenants."youtubeUrl" IS 'YouTube channel URL';
COMMENT ON COLUMN tenants."snapchatUrl" IS 'Snapchat username or URL';
COMMENT ON COLUMN tenants."pinterestUrl" IS 'Pinterest profile URL';

-- Note: WhatsApp number already exists in the tenants table as "whatsapp" column
-- This migration only adds social media URL fields

