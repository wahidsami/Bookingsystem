-- Migration: Create public_page_data table for tenant public website content
-- This table stores all public-facing page data including About Us, Home Page, etc.

-- Step 1: Create the public_page_data table
CREATE TABLE IF NOT EXISTS "public_page_data" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    
    -- About Us Section
    "aboutUs_heroImage" VARCHAR(500),
    "aboutUs_storyTitle" VARCHAR(100) DEFAULT 'ourStory',
    "aboutUs_storyEn" TEXT,
    "aboutUs_storyAr" TEXT,
    
    -- Missions (stored as JSONB array)
    "aboutUs_missions" JSONB DEFAULT '[]'::jsonb,
    -- Format: [{"titleEn": "...", "titleAr": "...", "detailsEn": "...", "detailsAr": "...", "type": "icon|image", "iconName": "...", "imageUrl": "..."}, ...]
    
    -- Visions (stored as JSONB array)
    "aboutUs_visions" JSONB DEFAULT '[]'::jsonb,
    -- Format: same as missions
    
    -- Values (stored as JSONB array)
    "aboutUs_values" JSONB DEFAULT '[]'::jsonb,
    -- Format: same as missions
    
    -- Facilities
    "aboutUs_facilitiesDescriptionEn" TEXT,
    "aboutUs_facilitiesDescriptionAr" TEXT,
    "aboutUs_facilitiesImages" JSONB DEFAULT '[]'::jsonb,
    -- Format: ["image1.jpg", "image2.jpg", ...] (up to 10 images)
    
    -- Final Word
    "aboutUs_finalWordTitleEn" VARCHAR(200),
    "aboutUs_finalWordTitleAr" VARCHAR(200),
    "aboutUs_finalWordTextEn" TEXT,
    "aboutUs_finalWordTextAr" TEXT,
    "aboutUs_finalWordType" VARCHAR(20) DEFAULT 'image',
    "aboutUs_finalWordImageUrl" VARCHAR(500),
    "aboutUs_finalWordIconName" VARCHAR(100),
    
    -- Home Page Section (for future use)
    "homePage_data" JSONB DEFAULT '{}'::jsonb,
    
    -- Contact Us Section (for future use)
    "contactUs_data" JSONB DEFAULT '{}'::jsonb,
    
    -- General Settings
    "generalSettings" JSONB DEFAULT '{}'::jsonb,
    
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per tenant
    UNIQUE("tenantId")
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS "idx_public_page_data_tenantId" ON "public_page_data"("tenantId");

-- Step 3: Add comments
COMMENT ON TABLE "public_page_data" IS 'Stores public-facing website content for each tenant';
COMMENT ON COLUMN "public_page_data"."aboutUs_heroImage" IS 'Hero section banner image (recommended: 1920x600px)';
COMMENT ON COLUMN "public_page_data"."aboutUs_storyTitle" IS 'Title for story section: ourStory, aboutUs, whoWeAre, ourJourney';
COMMENT ON COLUMN "public_page_data"."aboutUs_missions" IS 'Array of mission objects with bilingual content, icon/image support';
COMMENT ON COLUMN "public_page_data"."aboutUs_visions" IS 'Array of vision objects with bilingual content, icon/image support';
COMMENT ON COLUMN "public_page_data"."aboutUs_values" IS 'Array of value objects with bilingual content, icon/image support';
COMMENT ON COLUMN "public_page_data"."aboutUs_facilitiesImages" IS 'Array of facility image URLs (up to 10 images, FHD landscape)';

-- Step 4: Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_public_page_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_public_page_data_updated_at
    BEFORE UPDATE ON "public_page_data"
    FOR EACH ROW
    EXECUTE FUNCTION update_public_page_data_updated_at();

