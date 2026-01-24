-- Migration: Add pricing fields to products table
-- This migration adds rawPrice, taxRate, and commissionRate fields to products
-- and migrates existing price data to rawPrice

-- Step 1: Add new columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS "rawPrice" DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5, 2);

-- Step 2: Migrate existing price data to rawPrice
-- For existing products, set rawPrice = price (we'll recalculate final price later)
UPDATE products 
SET "rawPrice" = price 
WHERE "rawPrice" IS NULL;

-- Step 3: Set default tax and commission rates from admin settings (or defaults)
-- Note: These will be updated by the application when products are created/updated
-- For now, set defaults: taxRate = 15%, commissionRate = 10%
UPDATE products 
SET 
    "taxRate" = 15.00,
    "commissionRate" = 10.00
WHERE "taxRate" IS NULL OR "commissionRate" IS NULL;

-- Step 4: Recalculate final price for existing products
-- Final price = rawPrice + (rawPrice * taxRate/100) + (rawPrice * commissionRate/100)
UPDATE products 
SET price = (
    "rawPrice" + 
    ("rawPrice" * COALESCE("taxRate", 15.00) / 100) + 
    ("rawPrice" * COALESCE("commissionRate", 10.00) / 100)
)
WHERE "rawPrice" IS NOT NULL;

-- Step 5: Make rawPrice NOT NULL (after migration)
ALTER TABLE products 
ALTER COLUMN "rawPrice" SET NOT NULL;

-- Step 6: Add comments
COMMENT ON COLUMN products."rawPrice" IS 'Base product price before tax and commission';
COMMENT ON COLUMN products."taxRate" IS 'Tax rate applied (read-only, from admin settings)';
COMMENT ON COLUMN products."commissionRate" IS 'Commission rate applied (read-only, from admin settings)';

