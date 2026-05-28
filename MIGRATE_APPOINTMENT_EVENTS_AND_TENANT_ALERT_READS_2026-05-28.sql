-- ==========================================================
-- Refah Appointment Events + Tenant Operational Alert Reads
-- Phase 4 Foundation
-- Safe to run multiple times where possible
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.appointment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "appointmentId" UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    "platformUserId" UUID NULL REFERENCES public.platform_users(id) ON DELETE SET NULL,
    "actorType" VARCHAR(32) NOT NULL DEFAULT 'customer',
    "actorId" UUID NULL,
    "eventType" VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_events_tenant_time
    ON public.appointment_events("tenantId", "occurredAt");

CREATE INDEX IF NOT EXISTS idx_appointment_events_appointment_time
    ON public.appointment_events("appointmentId", "occurredAt");

CREATE INDEX IF NOT EXISTS idx_appointment_events_type_time
    ON public.appointment_events("eventType", "occurredAt");

CREATE TABLE IF NOT EXISTS public.tenant_operational_alert_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    "readerId" UUID NOT NULL,
    "alertKey" VARCHAR(255) NOT NULL,
    "readAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_tenant_operational_alert_reads_reader_key
    ON public.tenant_operational_alert_reads("tenantId", "readerId", "alertKey");

CREATE INDEX IF NOT EXISTS idx_tenant_operational_alert_reads_reader_time
    ON public.tenant_operational_alert_reads("tenantId", "readerId", "readAt");

-- Verification helpers
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public'
--   AND table_name IN ('appointment_events','tenant_operational_alert_reads');
