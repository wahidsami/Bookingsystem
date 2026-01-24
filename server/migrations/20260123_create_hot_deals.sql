-- Migration: Add Hot Deals table
-- Purpose: Support tenant promotional deals with admin approval workflow

CREATE TABLE IF NOT EXISTS hot_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Deal Content (Bilingual)
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    
    -- Pricing
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
    original_price DECIMAL(10, 2) NOT NULL,
    discounted_price DECIMAL(10, 2) NOT NULL,
    
    -- Validity
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    CHECK (valid_until > valid_from),
    
    -- Usage Limits
    max_redemptions INTEGER DEFAULT -1, -- -1 = unlimited
    current_redemptions INTEGER DEFAULT 0 CHECK (current_redemptions >= 0),
    
    -- Approval Workflow
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'active', 'expired', 'rejected', 'paused')),
    rejection_reason TEXT,
    approved_by UUID REFERENCES super_admins(id),
    approved_at TIMESTAMP,
    
    -- Visibility
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_hot_deals_tenant ON hot_deals(tenant_id);
CREATE INDEX idx_hot_deals_service ON hot_deals(service_id);
CREATE INDEX idx_hot_deals_status ON hot_deals(status);
CREATE INDEX idx_hot_deals_validity ON hot_deals(valid_from, valid_until);
CREATE INDEX idx_hot_deals_active ON hot_deals(status, is_active, valid_until) 
    WHERE status = 'active' AND is_active = true;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_hot_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hot_deals_updated_at
    BEFORE UPDATE ON hot_deals
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_deals_updated_at();

-- Comments for documentation
COMMENT ON TABLE hot_deals IS 'Tenant promotional deals with admin approval workflow';
COMMENT ON COLUMN hot_deals.discount_type IS 'percentage = discount %, fixed_amount = amount off';
COMMENT ON COLUMN hot_deals.max_redemptions IS '-1 means unlimited redemptions';
COMMENT ON COLUMN hot_deals.status IS 'pending -> approved -> active (or rejected)';
