-- Migration: Create global_settings table
-- This table stores admin-controlled commission and tax rates

-- Create the table
CREATE TABLE IF NOT EXISTS global_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "serviceCommissionRate" DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    "productCommissionRate" DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE global_settings IS 'Global platform settings controlled by admin';
COMMENT ON COLUMN global_settings."serviceCommissionRate" IS 'Platform commission rate for services (%)';
COMMENT ON COLUMN global_settings."productCommissionRate" IS 'Platform commission rate for products (%)';
COMMENT ON COLUMN global_settings."taxRate" IS 'Global tax rate (VAT) (%)';
COMMENT ON COLUMN global_settings."updatedBy" IS 'Super admin who last updated these settings';

-- Insert default settings if table is empty
INSERT INTO global_settings (id, "serviceCommissionRate", "productCommissionRate", "taxRate")
SELECT gen_random_uuid(), 10.00, 10.00, 15.00
WHERE NOT EXISTS (SELECT 1 FROM global_settings);

