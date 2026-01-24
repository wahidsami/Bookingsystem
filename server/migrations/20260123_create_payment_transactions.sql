-- Migration: Add Payment Transactions table
-- Purpose: Track all payment transactions (deposits, remainders, refunds) for bookings and orders

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference (one of these will be set)
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    CHECK (
        (appointment_id IS NOT NULL AND order_id IS NULL) OR 
        (appointment_id IS NULL AND order_id IS NOT NULL)
    ),
    
    -- Transaction Details
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'remainder', 'full', 'refund')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Payment Method
    payment_method VARCHAR(20) NOT NULL 
        CHECK (payment_method IN ('online', 'cash', 'card_pos', 'wallet', 'bank_transfer')),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'completed'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded' 'cancelled')),
    
    -- External References
    transaction_ref VARCHAR(255), -- Payment gateway transaction ID
    gateway_response JSONB, -- Full response from payment gateway
    
    -- Processing
    processed_by UUID, -- Staff member who processed (for in-person payments)
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}', -- Additional payment details (notes, receipt URL, etc.)
    notes TEXT, -- Admin/staff notes
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_payment_transactions_appointment ON payment_transactions(appointment_id);
CREATE INDEX idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_type ON payment_transactions(type);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_processed ON payment_transactions(processed_at);
CREATE INDEX idx_payment_transactions_ref ON payment_transactions(transaction_ref) 
    WHERE transaction_ref IS NOT NULL;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transactions_updated_at();

-- Comments for documentation
COMMENT ON TABLE payment_transactions IS 'All payment transactions for appointments and orders';
COMMENT ON COLUMN payment_transactions.type IS 'deposit = booking fee, remainder = at salon, full = paid in full, refund = money back';
COMMENT ON COLUMN payment_transactions.payment_method IS 'online = credit card, cash = at salon, card_pos = POS terminal, wallet = digital wallet';
COMMENT ON COLUMN payment_transactions.processed_by IS 'Staff member who processed payment (for in-person payments)';
