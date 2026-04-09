-- Migration: Add employee schedule visibility weeks
-- Run this once in psql before using week-limited schedule visibility in RifahStaff.

BEGIN;

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS "scheduleVisibilityWeeks" INTEGER NOT NULL DEFAULT 1;

UPDATE public.staff
SET "scheduleVisibilityWeeks" = 1
WHERE "scheduleVisibilityWeeks" IS NULL
   OR "scheduleVisibilityWeeks" NOT IN (1, 2, 3, 4);

COMMIT;
