-- Migration: Extend Appointments table for split payments
-- Purpose: Support deposit online + remainder at salon workflow

-- Add new columns to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS remainder_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remainder_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10, 2) DEFAULT 0;

-- Update existing appointments (backward compatibility)
-- Treat existing 'paid' appointments as fully paid
UPDATE appointments 
SET 
    deposit_paid = true,
    remainder_paid = true,
    total_paid = price,
    deposit_amount = 0,
    remainder_amount = 0
WHERE payment_status = 'paid';

-- Add CHECK constraint (total_paid should not exceed price)
ALTER TABLE appointments 
ADD CONSTRAINT chk_appointments_total_paid 
    CHECK (total_paid <= price);

-- Add CHECK constraint (deposit + remainder = price when both defined)
ALTER TABLE appointments
ADD CONSTRAINT chk_appointments_payment_split
    CHECK (
        (deposit_amount + remainder_amount = price) OR
        (deposit_amount = 0 AND remainder_amount = 0)
    );

-- Update payment_status enum to include new status
ALTER TABLE appointments 
ALTER COLUMN payment_status TYPE VARCHAR(20);

-- Update payment_status values
UPDATE appointments SET payment_status = 'fully_paid' WHERE payment_status = 'paid';

-- Add index for payment queries
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status 
    ON appointments(payment_status, deposit_paid, remainder_paid);

-- Comments
COMMENT ON COLUMN appointments.deposit_amount IS 'Amount paid as deposit (online)';
COMMENT ON COLUMN appointments.remainder_amount IS 'Amount to be paid at salon';
COMMENT ON COLUMN appointments.total_paid IS 'Total amount paid so far (deposit + remainder)';
COMMENT ON COLUMN appointments.deposit_paid IS 'Whether deposit has been paid';
COMMENT ON COLUMN appointments.remainder_paid IS 'Whether remainder has been paid at salon';
