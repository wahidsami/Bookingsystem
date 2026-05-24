DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_gift_card_transactions_status') THEN
        CREATE TYPE public.enum_gift_card_transactions_status AS ENUM (
            'purchased',
            'sent_pending_claim',
            'sent_completed',
            'redeemed',
            'cancelled',
            'expired'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_gift_card_transactions_delivery_channel') THEN
        CREATE TYPE public.enum_gift_card_transactions_delivery_channel AS ENUM (
            'in_app',
            'email',
            'sms_whatsapp_future'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.gift_card_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT NULL,
    description_ar TEXT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "priceAmount" NUMERIC(10,2) NOT NULL,
    "walletCreditAmount" NUMERIC(10,2) NOT NULL,
    "bonusAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "imageUrl" VARCHAR(1000) NULL,
    "startsAt" TIMESTAMPTZ NULL,
    "endsAt" TIMESTAMPTZ NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdByAdminId" UUID NULL REFERENCES public.super_admins(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderPlatformUserId" UUID NULL REFERENCES public.platform_users(id) ON DELETE SET NULL,
    "recipientPlatformUserId" UUID NULL REFERENCES public.platform_users(id) ON DELETE SET NULL,
    "recipientEmail" VARCHAR(255) NULL,
    "recipientPhone" VARCHAR(64) NULL,
    "packageId" UUID NOT NULL REFERENCES public.gift_card_packages(id) ON DELETE RESTRICT,
    "purchaseAmount" NUMERIC(10,2) NOT NULL,
    "creditAmount" NUMERIC(10,2) NOT NULL,
    "bonusAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "totalCreditAmount" NUMERIC(10,2) NOT NULL,
    status public.enum_gift_card_transactions_status NOT NULL DEFAULT 'purchased',
    "deliveryChannel" public.enum_gift_card_transactions_delivery_channel NOT NULL DEFAULT 'in_app',
    "claimToken" VARCHAR(255) NULL,
    "claimedAt" TIMESTAMPTZ NULL,
    "expiresAt" TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_card_packages_active ON public.gift_card_packages("isActive");
CREATE INDEX IF NOT EXISTS idx_gift_card_packages_display_order ON public.gift_card_packages("displayOrder");
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_package ON public.gift_card_transactions("packageId");
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_sender ON public.gift_card_transactions("senderPlatformUserId");
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_recipient ON public.gift_card_transactions("recipientPlatformUserId");
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_status ON public.gift_card_transactions(status);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_claim_token ON public.gift_card_transactions("claimToken");

