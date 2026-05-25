-- Tenant-scoped gift cards foundation
-- Run this in VPS PostgreSQL against rifah_shared

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tenant_gift_card_transactions_status') THEN
        CREATE TYPE public.enum_tenant_gift_card_transactions_status AS ENUM (
            'purchased',
            'sent_pending_claim',
            'sent_completed',
            'redeemed',
            'cancelled',
            'expired'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tenant_gift_card_transactions_delivery_channel') THEN
        CREATE TYPE public.enum_tenant_gift_card_transactions_delivery_channel AS ENUM (
            'in_app',
            'email',
            'sms_whatsapp_future'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tenant_wallet_ledger_entries_type') THEN
        CREATE TYPE public.enum_tenant_wallet_ledger_entries_type AS ENUM (
            'tenant_gift_credit',
            'tenant_gift_redeem_debit',
            'tenant_gift_refund_credit',
            'tenant_gift_admin_adjustment'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tenant_wallet_ledger_entries_direction') THEN
        CREATE TYPE public.enum_tenant_wallet_ledger_entries_direction AS ENUM ('credit', 'debit');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tenant_gift_card_settlements_status') THEN
        CREATE TYPE public.enum_tenant_gift_card_settlements_status AS ENUM (
            'pending',
            'partially_settled',
            'settled'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenant_gift_card_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT NULL,
    description_ar TEXT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "priceAmount" NUMERIC(10,2) NOT NULL,
    "walletCreditAmount" NUMERIC(10,2) NOT NULL,
    "bonusAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "imageUrl" VARCHAR(1000) NULL,
    "thumbnailUrl" VARCHAR(1000) NULL,
    "startsAt" TIMESTAMPTZ NULL,
    "endsAt" TIMESTAMPTZ NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdByTenantUserId" UUID NULL REFERENCES public.tenant_dashboard_accounts(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    "packageId" UUID NOT NULL REFERENCES public.tenant_gift_card_packages(id) ON DELETE RESTRICT,
    "senderPlatformUserId" UUID NULL REFERENCES public.platform_users(id) ON DELETE SET NULL,
    "recipientPlatformUserId" UUID NULL REFERENCES public.platform_users(id) ON DELETE SET NULL,
    "recipientEmail" VARCHAR(255) NULL,
    "recipientPhone" VARCHAR(64) NULL,
    "purchaseAmount" NUMERIC(10,2) NOT NULL,
    "creditAmount" NUMERIC(10,2) NOT NULL,
    "bonusAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "totalCreditAmount" NUMERIC(10,2) NOT NULL,
    status public.enum_tenant_gift_card_transactions_status NOT NULL DEFAULT 'purchased',
    "deliveryChannel" public.enum_tenant_gift_card_transactions_delivery_channel NOT NULL DEFAULT 'in_app',
    "claimToken" VARCHAR(255) NULL,
    "claimedAt" TIMESTAMPTZ NULL,
    "expiresAt" TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_wallet_balances (
    "platformUserId" UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("platformUserId", "tenantId")
);

CREATE TABLE IF NOT EXISTS public.tenant_wallet_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "platformUserId" UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type public.enum_tenant_wallet_ledger_entries_type NOT NULL,
    direction public.enum_tenant_wallet_ledger_entries_direction NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
    "balanceBefore" NUMERIC(10,2) NOT NULL,
    "balanceAfter" NUMERIC(10,2) NOT NULL,
    "referenceType" VARCHAR(64) NULL,
    "referenceId" VARCHAR(128) NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_gift_card_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    "transactionId" UUID NOT NULL REFERENCES public.tenant_gift_card_transactions(id) ON DELETE CASCADE,
    "packageId" UUID NOT NULL REFERENCES public.tenant_gift_card_packages(id) ON DELETE RESTRICT,
    "grossAmount" NUMERIC(10,2) NOT NULL,
    "platformFeeAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "netTenantPayableAmount" NUMERIC(10,2) NOT NULL,
    "settledAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    status public.enum_tenant_gift_card_settlements_status NOT NULL DEFAULT 'pending',
    "settledAt" TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("transactionId")
);

CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_packages_tenant_active ON public.tenant_gift_card_packages("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_packages_tenant_order ON public.tenant_gift_card_packages("tenantId", "displayOrder");
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_packages_active_window ON public.tenant_gift_card_packages("startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_transactions_tenant_status ON public.tenant_gift_card_transactions("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_transactions_sender ON public.tenant_gift_card_transactions("senderPlatformUserId");
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_transactions_recipient ON public.tenant_gift_card_transactions("recipientPlatformUserId");
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_transactions_claim_token ON public.tenant_gift_card_transactions("claimToken");
CREATE INDEX IF NOT EXISTS idx_tenant_gift_card_transactions_created_at ON public.tenant_gift_card_transactions("createdAt");

CREATE INDEX IF NOT EXISTS idx_tenant_wallet_ledger_user_tenant ON public.tenant_wallet_ledger_entries("platformUserId", "tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_tenant_wallet_ledger_tenant_type ON public.tenant_wallet_ledger_entries("tenantId", type);
CREATE INDEX IF NOT EXISTS idx_tenant_wallet_ledger_reference ON public.tenant_wallet_ledger_entries("referenceType", "referenceId");

CREATE INDEX IF NOT EXISTS idx_tenant_gift_settlements_tenant_status ON public.tenant_gift_card_settlements("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_tenant_gift_settlements_transaction ON public.tenant_gift_card_settlements("transactionId");
