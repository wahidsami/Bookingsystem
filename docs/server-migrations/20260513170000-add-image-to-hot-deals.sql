-- Migration: Add image column for Hot Deals
-- Purpose: Persist uploaded deal image path so tenant/admin/mobile UIs can render it.

ALTER TABLE hot_deals
ADD COLUMN IF NOT EXISTS image VARCHAR(500);

COMMENT ON COLUMN hot_deals.image IS 'Uploaded hot deal image path (relative to uploads/)';
