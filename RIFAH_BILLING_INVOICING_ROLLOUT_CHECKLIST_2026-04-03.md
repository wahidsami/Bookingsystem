# Refah Billing and Invoicing Rollout Checklist

Document date: 2026-04-03  
Scope: Production rollout and rollback checklist for Refah billing/invoicing phases 1-8  
Target services: `refha api`, `refha admin`, `refha tenant`

## Rollout Principles

- Do not deploy UI changes before the backend migration and API rollout are complete.
- Do not run destructive SQL against `bills`, `tenant_subscriptions`, or `tenants`.
- Treat existing historical bills as immutable accounting records. Fill missing snapshot fields only with safe defaults; do not recalculate old paid amounts.
- Do not claim full ZATCA integration in customer-facing wording. Current implementation is Phase 1 TLV QR readiness only.
- Confirm `/app/uploads` is backed by persistent storage before relying on invoice/receipt PDFs.

## Phase 9 Production Rollout Order

1. Back up the production database.
2. Verify `refha api` has persistent volume mounted from host path such as `/data/rifah-uploads` to container path `/app/uploads`.
3. Back up current uploads folder to host storage.
4. Run `MIGRATE_BILLING_INVOICE_SNAPSHOT.sql` on production Postgres.
5. Redeploy `refha api`.
6. Confirm new tables/columns exist.
7. Redeploy `refha admin`.
8. Redeploy `refha tenant`.
9. Open Admin Settings and fill official invoice identity fields.
10. Run the billing QA smoke subset, then the full `RIFAH_BILLING_INVOICING_QA_TEST_CASES_2026-04-03.md` matrix.

## Required Database Migration

Run:

```sql
\i MIGRATE_BILLING_INVOICE_SNAPSHOT.sql
```

### Post-Migration Validation Queries

Run these checks in production Postgres:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bills'
  AND column_name IN (
    'subtotalAmount',
    'platformMarkupRate',
    'platformMarkupAmount',
    'vatRate',
    'vatAmount',
    'discountAmount',
    'totalAmount',
    'invoiceIssuedAt',
    'invoiceTitle',
    'invoiceTemplateMode',
    'sellerSnapshot',
    'buyerSnapshot',
    'lineItemsSnapshot',
    'planSnapshot',
    'invoicePdfPath',
    'receiptPdfPath',
    'paymentProvider',
    'paymentReference',
    'paymentMethod',
    'paymentCapturedAmount',
    'paymentFailureReason'
  )
ORDER BY column_name;
```

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'global_settings'
  AND column_name IN (
    'invoiceSellerNameAr',
    'invoiceSellerNameEn',
    'invoiceVatNumber',
    'invoiceCrNumber',
    'invoiceAddressAr',
    'invoiceAddressEn',
    'invoiceCity',
    'invoiceCountry',
    'invoiceEmail',
    'invoicePhone',
    'invoicePrefix',
    'invoiceFooterNoteAr',
    'invoiceFooterNoteEn',
    'invoiceLogoPath'
  )
ORDER BY column_name;
```

```sql
SELECT to_regclass('public.bill_payment_attempts') AS bill_payment_attempts_table,
       to_regclass('public.admin_notifications') AS admin_notifications_table;
```

Expected result: all listed bill/global settings columns exist, and both tables resolve to their public schema names.

## Required Environment Variables

Confirm these are set in Coolify before testing:

### `refha api`

```env
SERVER_PUBLIC_URL=https://rapi.unifinitylab.com
TENANT_DASHBOARD_BASE_URL=<your-tenant-dashboard-domain>
RESEND_API_KEY=<your-resend-key>
RESEND_FROM_EMAIL=<your-sender-identity>
SUPPORT_EMAIL=<your-support-email>
```

### `refha admin`

```env
NEXT_PUBLIC_API_URL=https://rapi.unifinitylab.com/api/v1
```

### `refha tenant`

```env
NEXT_PUBLIC_API_URL=https://rapi.unifinitylab.com/api/v1
NEXT_PUBLIC_PUBLIC_PAGE_URL=<your-public-page-domain>
```

## Persistent Uploads Validation

On the host server:

```bash
ls /data/rifah-uploads/bills
```

Inside the API container:

```bash
ls /app/uploads/bills
```

Expected result: both paths expose the same generated invoice/receipt files. If the host folder is empty but the container has files, copy existing `/app/uploads/.` into the host mount before attaching the volume.

## Admin Settings Post-Deploy Tasks

Open `Admin Dashboard -> Settings` and save:

- Refah Arabic legal seller name
- Refah English legal seller name
- VAT number once issued
- Commercial registration number
- National address in Arabic and English
- Invoice city/country
- Billing support email and phone
- Invoice prefix
- Invoice footer notes
- Invoice logo path
- Tax rate and commission rates

Expected behavior: these values affect **newly generated invoices only** through each bill snapshot. Old invoices should keep their original stored snapshots.

## Legacy Bill Backfill Decision

### Recommended default

Do **not** mass-regenerate old historical invoices immediately.

Why:

- Old bills created before snapshot fields may not have reliable seller/buyer/package snapshots.
- Package names, prices, and tenant legal fields may have changed after the original billing event.
- Reconstructing historical invoices from current package tables risks creating documents that do not match what the tenant actually owed or paid.

### Safe handling policy

- For old bills with complete enough snapshot fields after migration, allow on-demand PDF generation through current invoice endpoints.
- For old bills with incomplete snapshot data, keep the bill visible in Admin/Tenant UI but treat the PDF as a legacy invoice with graceful fallback if generation fails.
- Never overwrite original `amount`, `paidAt`, `status`, or existing payment metadata during backfill.
- If a manual historical correction is required, record it through admin reconciliation and ActivityLog rather than direct SQL updates.

### Optional SQL audit for legacy bills

```sql
SELECT id,
       "billNumber",
       status,
       amount,
       "totalAmount",
       "invoiceIssuedAt",
       CASE
         WHEN "sellerSnapshot" IS NULL OR "sellerSnapshot" = '{}'::jsonb THEN 'missing_seller'
         WHEN "buyerSnapshot" IS NULL OR "buyerSnapshot" = '{}'::jsonb THEN 'missing_buyer'
         WHEN "lineItemsSnapshot" IS NULL OR "lineItemsSnapshot" = '[]'::jsonb THEN 'missing_line_items'
         WHEN "planSnapshot" IS NULL OR "planSnapshot" = '{}'::jsonb THEN 'missing_plan'
         ELSE 'snapshot_ready'
       END AS snapshot_status
FROM bills
ORDER BY "createdAt" DESC
LIMIT 200;
```

Use this report to estimate how many legacy invoices can safely regenerate PDFs on demand.

## Production Smoke Checklist After Deploy

| Test | Expected Result |
| --- | --- |
| Approve one paid tenant | Initial unpaid invoice created; approval email contains payment and invoice PDF links |
| Open Admin tenant Billing tab | Invoice list and totals load; invoice PDF opens |
| Pay one invoice through tenant payment page | Bill becomes paid; subscription activates; receipt PDF opens; admin notification appears |
| Trigger simulated failed payment | Failed attempt recorded in admin bill details; bill remains unpaid |
| Reconcile one unpaid bill manually in admin | Bill becomes paid; attempt trail shows `admin_manual_reconciliation`; tenant gets payment success email |
| Request package upgrade | Upgrade invoice created and package changes only after payment succeeds |
| Generate a fresh invoice after filling VAT settings | New PDF shows seller identity, VAT fields, and QR panel |
| Redeploy API once | Previously generated invoice/receipt PDFs remain accessible |

## Monitoring Checklist

After rollout, watch:

- API logs for `Failed to generate invoice PDF`, `Success email failed`, `Expired email failed`, `payBillByToken error`, `reconcileBillPayment error`
- Resend delivery logs for approval/payment emails
- Admin notification bell for invoice issued / bill paid / invoice expired events
- Growth of `/app/uploads/bills` under persistent storage
- Duplicate payment attempt spikes in `bill_payment_attempts`

Useful query:

```sql
SELECT source, status, COUNT(*)
FROM bill_payment_attempts
WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
GROUP BY source, status
ORDER BY source, status;
```

## Rollback Plan

If billing pages or invoice APIs break after deployment:

1. Keep the DB migration in place; do not roll back bill columns unless absolutely necessary.
2. Roll back `refha admin` and `refha tenant` to the previous stable image first if the issue is UI-only.
3. If API behavior is broken, roll back `refha api` to the previous stable image while preserving `/app/uploads`.
4. Disable public payment testing temporarily at the UI layer if duplicate payments or stale states are detected.
5. Review `activity_logs`, `admin_notifications`, and `bill_payment_attempts` before deciding on manual invoice corrections.

## Go / No-Go Gate

Release can be marked **Go** only if:

- `BI-MIG-*`, `BI-APR-*`, `BI-TEN-*`, `BI-ADM-*` P0 tests pass.
- At least one fresh unpaid invoice PDF and one paid receipt PDF remain accessible after API redeploy.
- Admin can identify that a tenant has paid from Billing tab, notifications, and payment attempt history.
- No tenant package is activated by an unpaid bill.
- Manual reconciliation is auditable and idempotent.

If any P0 item fails, mark release **No-Go**, fix, redeploy, and retest.
