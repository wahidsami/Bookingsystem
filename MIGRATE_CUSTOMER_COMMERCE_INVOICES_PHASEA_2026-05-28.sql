-- ==========================================================
-- Refah Customer Commerce Invoices (Appointments + Orders)
-- Phase A Foundation
-- Safe to run multiple times where possible
-- ==========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_customer_invoices_entity_type') THEN
        CREATE TYPE public.enum_customer_invoices_entity_type AS ENUM ('appointment', 'order');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_customer_invoices_status') THEN
        CREATE TYPE public.enum_customer_invoices_status AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'VOID');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_customer_invoice_items_item_type') THEN
        CREATE TYPE public.enum_customer_invoice_items_item_type AS ENUM ('service', 'product');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.customer_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceNumber" VARCHAR(64) NOT NULL UNIQUE,
    "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    "platformUserId" UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
    "entityType" public.enum_customer_invoices_entity_type NOT NULL,
    "entityId" UUID NOT NULL,
    status public.enum_customer_invoices_status NOT NULL DEFAULT 'UNPAID',
    currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
    "subtotalAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "vatAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "totalAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "paidAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "dueAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "paymentMethodSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "paymentStatusSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "invoicePdfPath" VARCHAR(1000) NULL,
    "receiptPdfPath" VARCHAR(1000) NULL,
    "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "paidAt" TIMESTAMPTZ NULL,
    "lastEmailedAt" TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_customer_invoices_entity
    ON public.customer_invoices("entityType", "entityId");

CREATE INDEX IF NOT EXISTS idx_customer_invoices_tenant_date
    ON public.customer_invoices("tenantId", "issuedAt");

CREATE INDEX IF NOT EXISTS idx_customer_invoices_platform_user_date
    ON public.customer_invoices("platformUserId", "issuedAt");

CREATE INDEX IF NOT EXISTS idx_customer_invoices_status
    ON public.customer_invoices(status);

CREATE TABLE IF NOT EXISTS public.customer_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
    "itemType" public.enum_customer_invoice_items_item_type NOT NULL,
    "itemRefId" UUID NULL,
    "nameEn" VARCHAR(255) NOT NULL,
    "nameAr" VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    "unitPrice" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "lineTotal" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "taxAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_invoice_items_invoice
    ON public.customer_invoice_items("invoiceId");

CREATE INDEX IF NOT EXISTS idx_customer_invoice_items_item_ref
    ON public.customer_invoice_items("itemRefId");

CREATE TABLE IF NOT EXISTS public.customer_invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
    "eventType" VARCHAR(64) NOT NULL,
    "fromStatus" public.enum_customer_invoices_status NULL,
    "toStatus" public.enum_customer_invoices_status NULL,
    "triggerSource" VARCHAR(64) NOT NULL,
    "actorType" VARCHAR(32) NULL,
    "actorId" UUID NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_invoice_events_invoice
    ON public.customer_invoice_events("invoiceId");

CREATE INDEX IF NOT EXISTS idx_customer_invoice_events_type
    ON public.customer_invoice_events("eventType");

-- Verification helpers
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public'
--   AND table_name IN ('customer_invoices','customer_invoice_items','customer_invoice_events');
