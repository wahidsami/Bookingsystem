-- Migration: add view_booking_notes to staff permission payloads
-- Run once in psql against rifah_shared.

UPDATE public.staff_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
    'view_booking_notes',
    COALESCE((permissions ->> 'view_booking_notes')::boolean, false)
)
WHERE permissions IS NULL
   OR NOT (permissions ? 'view_booking_notes');
