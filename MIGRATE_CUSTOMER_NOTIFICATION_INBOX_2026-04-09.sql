-- Migration: customer notification inbox support
-- Run once in psql against rifah_shared.

ALTER TABLE public.tenant_push_campaign_recipients
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_push_campaign_recipients_user_created
    ON public.tenant_push_campaign_recipients(platform_user_id, created_at DESC);
