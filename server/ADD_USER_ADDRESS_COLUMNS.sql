-- Migration: Add address columns to platform_users table
-- Run this script to add address fields for POD orders

ALTER TABLE platform_users
ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS address_building VARCHAR(100),
ADD COLUMN IF NOT EXISTS address_floor VARCHAR(50),
ADD COLUMN IF NOT EXISTS address_apartment VARCHAR(50),
ADD COLUMN IF NOT EXISTS address_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS address_notes TEXT;

-- Add comments
COMMENT ON COLUMN platform_users.address_street IS 'Street address';
COMMENT ON COLUMN platform_users.address_city IS 'City';
COMMENT ON COLUMN platform_users.address_building IS 'Building number/name';
COMMENT ON COLUMN platform_users.address_floor IS 'Floor number';
COMMENT ON COLUMN platform_users.address_apartment IS 'Apartment number';
COMMENT ON COLUMN platform_users.address_phone IS 'Phone number for delivery';
COMMENT ON COLUMN platform_users.address_notes IS 'Additional delivery notes';
