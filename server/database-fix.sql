-- Fix: Make customerId nullable in appointments table
-- This allows the new unified booking system to work without customerId

ALTER TABLE public.appointments 
ALTER COLUMN "customerId" DROP NOT NULL;

-- Verify the change
\d appointments
