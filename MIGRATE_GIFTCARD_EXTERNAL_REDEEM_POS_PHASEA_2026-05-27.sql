-- ==========================================================
-- Refah Gift Cards External Redeem + POS Payment (Phase A)
-- Safe to run multiple times where possible
-- Database: rifah_shared
-- Date: 2026-05-27
-- ==========================================================

-- 1) Extend existing status enums (admin + tenant gift transactions)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_gift_card_transactions_status'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_gift_card_transactions_status'
              AND e.enumlabel = 'sent_completed_auto_wallet'
        ) THEN
            ALTER TYPE public.enum_gift_card_transactions_status ADD VALUE 'sent_completed_auto_wallet';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_gift_card_transactions_status'
              AND e.enumlabel = 'sent_pending_external_redeem'
        ) THEN
            ALTER TYPE public.enum_gift_card_transactions_status ADD VALUE 'sent_pending_external_redeem';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_gift_card_transactions_status'
              AND e.enumlabel = 'partially_redeemed'
        ) THEN
            ALTER TYPE public.enum_gift_card_transactions_status ADD VALUE 'partially_redeemed';
        END IF;
    END IF;
END$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_tenant_gift_card_transactions_status'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_tenant_gift_card_transactions_status'
              AND e.enumlabel = 'sent_completed_auto_wallet'
        ) THEN
            ALTER TYPE public.enum_tenant_gift_card_transactions_status ADD VALUE 'sent_completed_auto_wallet';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_tenant_gift_card_transactions_status'
              AND e.enumlabel = 'sent_pending_external_redeem'
        ) THEN
            ALTER TYPE public.enum_tenant_gift_card_transactions_status ADD VALUE 'sent_pending_external_redeem';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_tenant_gift_card_transactions_status'
              AND e.enumlabel = 'partially_redeemed'
        ) THEN
            ALTER TYPE public.enum_tenant_gift_card_transactions_status ADD VALUE 'partially_redeemed';
        END IF;
    END IF;
END$$;

-- 2) Add transaction columns for delivery mode + gift code linking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_gift_card_delivery_mode') THEN
        CREATE TYPE public.enum_gift_card_delivery_mode AS ENUM ('auto_wallet', 'external_code');
    END IF;
END$$;

ALTER TABLE public.gift_card_transactions
    ADD COLUMN IF NOT EXISTS "deliveryMode" public.enum_gift_card_delivery_mode NULL,
    ADD COLUMN IF NOT EXISTS "giftCardCodeId" UUID NULL,
    ADD COLUMN IF NOT EXISTS "recipientResolvedPlatformUserId" UUID NULL;

ALTER TABLE public.tenant_gift_card_transactions
    ADD COLUMN IF NOT EXISTS "deliveryMode" public.enum_gift_card_delivery_mode NULL,
    ADD COLUMN IF NOT EXISTS "giftCardCodeId" UUID NULL,
    ADD COLUMN IF NOT EXISTS "recipientResolvedPlatformUserId" UUID NULL;

CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_code_id
    ON public.gift_card_transactions("giftCardCodeId");
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_resolved_recipient
    ON public.gift_card_transactions("recipientResolvedPlatformUserId");
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_transactions_gift_code_id
    ON public.tenant_gift_card_transactions("giftCardCodeId");
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_transactions_resolved_recipient
    ON public.tenant_gift_card_transactions("recipientResolvedPlatformUserId");

-- 3) New enums for external gift code tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_gift_card_codes_scope_type') THEN
        CREATE TYPE public.enum_gift_card_codes_scope_type AS ENUM ('admin_global', 'tenant_scoped');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_gift_card_codes_status') THEN
        CREATE TYPE public.enum_gift_card_codes_status AS ENUM ('issued', 'partially_redeemed', 'redeemed', 'expired', 'cancelled');
    END IF;
END$$;

-- 4) Create gift_card_codes
CREATE TABLE IF NOT EXISTS public.gift_card_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) NOT NULL UNIQUE,
    "scopeType" public.enum_gift_card_codes_scope_type NOT NULL,
    "tenantId" UUID NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
    "sourceGiftCardTransactionId" UUID NULL REFERENCES public.gift_card_transactions(id) ON DELETE SET NULL,
    "sourceTenantGiftCardTransactionId" UUID NULL REFERENCES public.tenant_gift_card_transactions(id) ON DELETE SET NULL,
    "initialAmount" NUMERIC(10,2) NOT NULL,
    "remainingAmount" NUMERIC(10,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
    "recipientEmail" VARCHAR(255) NULL,
    "recipientPhone" VARCHAR(64) NULL,
    status public.enum_gift_card_codes_status NOT NULL DEFAULT 'issued',
    "expiresAt" TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_card_codes_status ON public.gift_card_codes(status);
CREATE INDEX IF NOT EXISTS idx_gift_card_codes_tenant_id ON public.gift_card_codes("tenantId");
CREATE INDEX IF NOT EXISTS idx_gift_card_codes_expires_at ON public.gift_card_codes("expiresAt");
CREATE INDEX IF NOT EXISTS idx_gift_card_codes_source_admin_tx ON public.gift_card_codes("sourceGiftCardTransactionId");
CREATE INDEX IF NOT EXISTS idx_gift_card_codes_source_tenant_tx ON public.gift_card_codes("sourceTenantGiftCardTransactionId");

-- 5) Create gift_card_code_redemptions
CREATE TABLE IF NOT EXISTS public.gift_card_code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "giftCardCodeId" UUID NOT NULL REFERENCES public.gift_card_codes(id) ON DELETE CASCADE,
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    "appointmentId" UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
    "orderId" UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    "posInvoiceId" UUID NULL,
    "redeemedAmount" NUMERIC(10,2) NOT NULL,
    "remainingAfter" NUMERIC(10,2) NOT NULL,
    "redeemedByStaffId" UUID NULL REFERENCES public.staff(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_card_code_redemptions_code_id ON public.gift_card_code_redemptions("giftCardCodeId");
CREATE INDEX IF NOT EXISTS idx_gift_card_code_redemptions_tenant_id ON public.gift_card_code_redemptions("tenantId");
CREATE INDEX IF NOT EXISTS idx_gift_card_code_redemptions_appointment_id ON public.gift_card_code_redemptions("appointmentId");
CREATE INDEX IF NOT EXISTS idx_gift_card_code_redemptions_order_id ON public.gift_card_code_redemptions("orderId");
CREATE INDEX IF NOT EXISTS idx_gift_card_code_redemptions_pos_invoice_id ON public.gift_card_code_redemptions("posInvoiceId");

-- 6) Verification
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('gift_card_codes', 'gift_card_code_redemptions')
ORDER BY table_name;

