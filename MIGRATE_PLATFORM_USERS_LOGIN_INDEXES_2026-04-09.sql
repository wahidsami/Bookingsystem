-- Migration: Harden platform user login lookup performance
-- Run this once in psql during a low-traffic window.
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_users_email_lower
    ON public.platform_users (LOWER(email));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_users_phone
    ON public.platform_users (phone);

ANALYZE public.platform_users;
