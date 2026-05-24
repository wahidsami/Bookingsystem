DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_wallet_ledger_entries_type') THEN
        CREATE TYPE public.enum_wallet_ledger_entries_type AS ENUM (
            'topup',
            'gift_purchase',
            'gift_sent_debit',
            'gift_received_credit',
            'service_payment_debit',
            'product_payment_debit',
            'refund_credit',
            'admin_adjustment'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_wallet_ledger_entries_direction') THEN
        CREATE TYPE public.enum_wallet_ledger_entries_direction AS ENUM ('credit', 'debit');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.wallet_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "platformUserId" UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    type public.enum_wallet_ledger_entries_type NOT NULL,
    direction public.enum_wallet_ledger_entries_direction NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_platform_user ON public.wallet_ledger_entries("platformUserId");
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_type ON public.wallet_ledger_entries(type);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_created_at ON public.wallet_ledger_entries("createdAt");
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_entries_reference ON public.wallet_ledger_entries("referenceType", "referenceId");

