-- Migration: Add invoice snapshot/payment metadata fields for subscription billing
-- Safe to run once on existing production DB before deploying Phase 1 billing code.

BEGIN;

ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS "subtotalAmount" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "platformMarkupRate" DECIMAL(5, 2),
    ADD COLUMN IF NOT EXISTS "platformMarkupAmount" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5, 2),
    ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "invoiceIssuedAt" TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS "invoiceTitle" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "invoiceTemplateMode" VARCHAR(32) NOT NULL DEFAULT 'bilingual_ar_en',
    ADD COLUMN IF NOT EXISTS "sellerSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "buyerSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "lineItemsSnapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "invoicePdfPath" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "receiptPdfPath" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "paymentProvider" VARCHAR(64),
    ADD COLUMN IF NOT EXISTS "paymentReference" VARCHAR(128),
    ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(64),
    ADD COLUMN IF NOT EXISTS "paymentCapturedAmount" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "paymentFailureReason" TEXT;

UPDATE bills
SET
    "subtotalAmount" = COALESCE("subtotalAmount", amount),
    "totalAmount" = COALESCE("totalAmount", amount),
    "invoiceIssuedAt" = COALESCE("invoiceIssuedAt", "createdAt"),
    "invoiceTitle" = COALESCE("invoiceTitle", 'Refah Subscription Invoice | فاتورة اشتراك رفاه'),
    "sellerSnapshot" = COALESCE("sellerSnapshot", '{}'::jsonb),
    "buyerSnapshot" = COALESCE("buyerSnapshot", '{}'::jsonb),
    "lineItemsSnapshot" = COALESCE("lineItemsSnapshot", '[]'::jsonb),
    "paymentCapturedAmount" = COALESCE("paymentCapturedAmount", amount)
WHERE "totalAmount" IS NULL
   OR "subtotalAmount" IS NULL
   OR "invoiceIssuedAt" IS NULL
   OR "invoiceTitle" IS NULL
   OR "paymentCapturedAmount" IS NULL;

CREATE INDEX IF NOT EXISTS idx_bills_invoice_issued_at ON bills ("invoiceIssuedAt");
CREATE INDEX IF NOT EXISTS idx_bills_paid_at ON bills ("paidAt");

ALTER TABLE global_settings
    ADD COLUMN IF NOT EXISTS "invoiceSellerNameAr" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "invoiceSellerNameEn" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "invoiceVatNumber" VARCHAR(64),
    ADD COLUMN IF NOT EXISTS "invoiceCrNumber" VARCHAR(64),
    ADD COLUMN IF NOT EXISTS "invoiceAddressAr" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceAddressEn" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceCity" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "invoiceCountry" VARCHAR(255) NOT NULL DEFAULT 'Saudi Arabia',
    ADD COLUMN IF NOT EXISTS "invoiceEmail" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "invoicePhone" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "invoicePrefix" VARCHAR(16) NOT NULL DEFAULT 'INV',
    ADD COLUMN IF NOT EXISTS "invoiceFooterNoteAr" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceFooterNoteEn" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceLogoPath" VARCHAR(255);

UPDATE global_settings
SET
    "invoiceSellerNameAr" = COALESCE("invoiceSellerNameAr", 'رفاه'),
    "invoiceSellerNameEn" = COALESCE("invoiceSellerNameEn", 'Refah'),
    "invoiceCity" = COALESCE("invoiceCity", 'Riyadh'),
    "invoiceCountry" = COALESCE("invoiceCountry", 'Saudi Arabia'),
    "invoicePrefix" = COALESCE("invoicePrefix", 'INV');

COMMENT ON COLUMN bills."subtotalAmount" IS 'Taxable subtotal before VAT';
COMMENT ON COLUMN bills."platformMarkupRate" IS 'Refah package markup rate captured at invoice issuance time';
COMMENT ON COLUMN bills."platformMarkupAmount" IS 'Refah markup amount included in taxable subtotal';
COMMENT ON COLUMN bills."vatRate" IS 'VAT rate captured at invoice issuance time';
COMMENT ON COLUMN bills."vatAmount" IS 'VAT amount captured at invoice issuance time';
COMMENT ON COLUMN bills."totalAmount" IS 'Final invoice amount including VAT';
COMMENT ON COLUMN bills."invoiceTemplateMode" IS 'Invoice document rendering mode, default bilingual_ar_en';
COMMENT ON COLUMN bills."sellerSnapshot" IS 'Frozen Refah seller snapshot used for invoice generation';
COMMENT ON COLUMN bills."buyerSnapshot" IS 'Frozen tenant buyer snapshot used for invoice generation';
COMMENT ON COLUMN bills."lineItemsSnapshot" IS 'Frozen invoice line items and period details';
COMMENT ON COLUMN global_settings."invoiceSellerNameAr" IS 'Refah Arabic legal/business name for invoice rendering';
COMMENT ON COLUMN global_settings."invoiceSellerNameEn" IS 'Refah English legal/business name for invoice rendering';
COMMENT ON COLUMN global_settings."invoiceVatNumber" IS 'Refah VAT number for official invoices';
COMMENT ON COLUMN global_settings."invoiceCrNumber" IS 'Refah commercial registration number';
COMMENT ON COLUMN global_settings."invoicePrefix" IS 'Invoice number prefix used by bill number generator';

COMMIT;
