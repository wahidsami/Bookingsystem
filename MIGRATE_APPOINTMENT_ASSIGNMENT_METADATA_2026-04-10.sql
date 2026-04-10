-- Migration: add assignment metadata for tenant appointment board improvements
-- Run this once in psql before deploying the updated appointments calendar.

BEGIN;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS "requestedStaffId" UUID REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS "assignmentMode" VARCHAR(32) NOT NULL DEFAULT 'unknown';

UPDATE public.appointments
SET "assignmentMode" = 'unknown'
WHERE "assignmentMode" IS NULL
   OR "assignmentMode" NOT IN ('unknown', 'customer_selected', 'auto_assigned', 'tenant_reassigned');

CREATE INDEX IF NOT EXISTS idx_appointments_requested_staff
    ON public.appointments ("requestedStaffId");

COMMIT;
