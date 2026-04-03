-- Migration: Add human-friendly booking numbers for appointments
-- Run this once in psql before redeploying the API service for POS-5.

BEGIN;

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS "bookingNumber" VARCHAR(255);

DO $$
DECLARE
    year_row RECORD;
    year_start INTEGER;
BEGIN
    FOR year_row IN
        SELECT DISTINCT EXTRACT(YEAR FROM "createdAt")::INTEGER AS booking_year
        FROM appointments
        WHERE "bookingNumber" IS NULL
        ORDER BY booking_year
    LOOP
        SELECT COALESCE(
            MAX(split_part("bookingNumber", '-', 3)::INTEGER),
            0
        )
        INTO year_start
        FROM appointments
        WHERE "bookingNumber" ~ ('^BKG-' || year_row.booking_year || '-[0-9]{6}$');

        WITH ranked_missing AS (
            SELECT
                id,
                ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS booking_sequence
            FROM appointments
            WHERE "bookingNumber" IS NULL
              AND EXTRACT(YEAR FROM "createdAt")::INTEGER = year_row.booking_year
        )
        UPDATE appointments AS appointment
        SET "bookingNumber" =
            'BKG-' ||
            year_row.booking_year ||
            '-' ||
            LPAD((year_start + ranked_missing.booking_sequence)::TEXT, 6, '0')
        FROM ranked_missing
        WHERE appointment.id = ranked_missing.id;
    END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_booking_number
    ON appointments ("bookingNumber");

COMMIT;
