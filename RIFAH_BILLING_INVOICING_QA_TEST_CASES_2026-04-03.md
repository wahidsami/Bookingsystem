# Refah Billing and Invoicing QA Test Cases

Document date: 2026-04-03  
System under test: Refah subscription billing and invoicing  
Apps under test: `server`, `tenant`, `admin`  
Primary objective: validate invoice generation, payment flow, reconciliation, notification, and PDF access end to end without breaking existing tenant onboarding and subscriptions.

## QA Execution Rules

- Test both Arabic and English tenant dashboard locales.
- Use one tenant in each state: `pending_approval`, `payment_pending`, `active` on paid package, `active` on free package, `suspended`.
- Use at least one paid package with VAT and platform markup > 0, and one free package.
- Use one invoice in each status: `UNPAID`, `PAID`, `EXPIRED`.
- Validate invoices after one API redeploy to confirm `/app/uploads` persistence.
- For each failed test record test ID, env URL, browser/device, exact steps, expected vs actual, screenshot/video, console output, backend log snippet, and request/response payload.

## Status Legend

| Status | Meaning |
| --- | --- |
| Not Run | Not executed yet |
| Pass | Expected behavior confirmed |
| Fail | Bug found |
| Blocked | Could not execute due to dependency/environment/data issue |
| Retest | Fix deployed, test pending rerun |

## Backend and Migration Smoke

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-MIG-001 | DB migration | P0 | Production-like DB with existing bills and global settings | Run `MIGRATE_BILLING_INVOICE_SNAPSHOT.sql`, then restart `refha api` | Migration succeeds, API starts, old bills remain accessible | Columns exist on `bills` and `global_settings`; no table drop |
| BI-MIG-002 | New table auto-create | P0 | API redeployed after Phase 7 | Restart `refha api` | `bill_payment_attempts` and `admin_notifications` exist after startup | Sequelize startup logs show no sync errors |
| BI-MIG-003 | Legacy bill fallback | P0 | Existing old bill created before snapshot fields | Open old bill in tenant and admin billing UIs | Old bill page does not crash; unknown snapshot fields render as `—`; PDF action either regenerates from available fields or fails gracefully | `GET /tenant/bills/:id`, `GET /admin/bills/:id` |
| BI-MIG-004 | Upload persistence | P0 | `/app/uploads` mounted to persistent volume | Generate invoice and receipt PDFs, redeploy API, then reopen same PDF URLs | PDFs still open after redeploy | Check files remain under `/app/uploads/bills/...` |

## Admin Settings and Invoice Identity

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-SET-001 | Settings load | P0 | Super admin logged in | Open Admin `Settings` page | Commission/tax fields and official invoice identity fields load | `GET /admin/settings` returns invoice fields |
| BI-SET-002 | Save invoice identity | P0 | Admin Settings open | Save seller name AR/EN, VAT number, CR number, address AR/EN, city, country, invoice email, phone, prefix, footer notes, logo path | Success message appears and values persist after refresh | `PUT /admin/settings`; values stored in `global_settings` |
| BI-SET-003 | Invoice prefix validation | P1 | Admin Settings open | Save invalid prefix with spaces/symbols or >16 chars | Save is rejected with clear validation and old value remains | `PUT /admin/settings` returns 400 |
| BI-SET-004 | Invoice email validation | P1 | Admin Settings open | Save malformed invoice email | Save rejected with clear validation | `PUT /admin/settings` returns 400 |
| BI-SET-005 | New bill picks current invoice identity | P0 | Invoice identity saved in settings | Approve new paid tenant or request upgrade | Generated bill snapshot uses latest seller identity and prefix | `GET /admin/bills/:id` sellerSnapshot + billNumber prefix |

## Admin Approval and Initial Invoice Flow

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-APR-001 | Paid tenant approval creates invoice | P0 | Tenant registered with paid package and status `pending_approval` | Approve tenant from admin dashboard | Tenant becomes `payment_pending`, one `UNPAID` initial bill is created, notification appears, approval email is sent with payment and invoice PDF links | `POST /admin/tenants/:id/approve`, `GET /admin/tenants/:id/bills` |
| BI-APR-002 | Free tenant approval activates immediately | P0 | Tenant registered with free package | Approve tenant | Tenant becomes `active`; no payment-required block in tenant dashboard | `tenant.status='active'`; no blocking unpaid initial invoice |
| BI-APR-003 | Initial invoice snapshot integrity | P0 | Newly generated initial bill | Open bill details in admin | Snapshot contains plan name, billing cycle, subtotal, platform markup rate/amount, VAT rate/amount, total, seller snapshot, buyer snapshot, line item period, invoice UUID, ZATCA QR payload metadata | `GET /admin/bills/:id` |
| BI-APR-004 | Approval email content | P1 | Email delivery configured | Approve paid tenant and inspect inbox | Email uses tenant-preferred language, displays package/cycle/invoice number/subtotal/VAT/total, payment button, invoice PDF link, and Refah branding | Resend logs + email HTML |

## Tenant My Bills and Payment Flow

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-TEN-001 | My Bills list | P0 | Tenant with at least one bill | Open `/ar/dashboard/bills` then `/en/dashboard/bills` | Bills list, totals, status, dates, amount breakdown, and document/payment actions render correctly in both locales | `GET /tenant/bills` |
| BI-TEN-002 | Bill detail modal | P0 | Bill exists | Open bill details modal | Seller/buyer info, line item, VAT/subtotal/total, payment metadata, and status are shown; no runtime errors | `GET /tenant/bills/:id` |
| BI-TEN-003 | Open unpaid invoice PDF | P0 | `UNPAID` bill exists | Click Open Invoice PDF | PDF opens in browser with logo, bilingual content, seller/buyer info, VAT breakdown, QR panel, and unpaid instructions | `GET /tenant/bills/:id/invoice-pdf` |
| BI-TEN-004 | Pay Now from My Bills | P0 | `UNPAID` bill with token exists | Click Pay Now, complete test success payment | Bill becomes `PAID`, tenant subscription updates, tenant status becomes `active` if it was `payment_pending`, success email sent, admin notification created, receipt PDF available | `POST /public/bills/by-token/:token/pay`, `GET /subscription/current` |
| BI-TEN-005 | Test payment failure is recorded | P0 | `UNPAID` bill payment page open | Click simulated payment failure | User sees failure message, invoice stays unpaid, a failed payment attempt is stored and visible in admin bill details | `POST /public/bills/by-token/:token/pay`; `bill_payment_attempts.status='failed'` |
| BI-TEN-006 | Already-paid idempotency | P0 | Bill has already been paid | Reload payment URL or click success twice | Backend returns already-paid/duplicate response and does not double-update tenant subscription period or amount | `POST /public/bills/by-token/:token/pay` response + one succeeded attempt |
| BI-TEN-007 | Expired payment link | P0 | Bill token already expired | Open payment URL or bill payment page | User sees clear expired message; bill status becomes `EXPIRED`; admin notification and expired email are sent once | `GET /public/bills/by-token/:token`, `POST /public/bills/by-token/:token/pay` |
| BI-TEN-008 | Paid receipt PDF | P0 | `PAID` bill exists | Open Paid Receipt PDF | Receipt PDF opens with paid stamp, payment metadata, VAT breakdown, and QR panel | `GET /tenant/bills/:id/receipt-pdf` |
| BI-TEN-009 | Tenant subscription reflects payment | P0 | Bill paid through test flow | Open `/ar/dashboard/subscription` and `/en/dashboard/subscription` | Current package name, amount, cycle, period dates, status, limits/features, and usage render correctly | `GET /subscription/current`, `GET /tenant/settings/limits` |

## Upgrade and Renewal Billing

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-UPG-001 | Upgrade invoice creation | P0 | Active tenant on lower package | Request upgrade to higher package and choose billing cycle | One `UNPAID` upgrade bill is created, invoice PDF available, package is not switched until payment succeeds | `POST /subscription/request-upgrade`, `GET /tenant/bills` |
| BI-UPG-002 | Renewal invoice creation | P0 | Active tenant requests same package and cycle renewal | Submit renewal request | One `UNPAID` renewal bill is created with correct package snapshot and cycle | `POST /subscription/request-upgrade` |
| BI-UPG-003 | Upgrade activation after payment | P0 | Unpaid upgrade bill exists | Pay upgrade bill | Subscription packageId, billingCycle, amount, period, and nextBillingDate update to requested package/cycle after payment | `GET /subscription/current`; bill metadata requestedPackageId/cycle |
| BI-UPG-004 | Renewal after payment | P0 | Unpaid renewal bill exists | Pay renewal bill | Subscription remains on same package, period extends from payment date per cycle, last payment metadata updates | `GET /subscription/current` |
| BI-UPG-005 | Admin notifications for upgrade/renewal | P1 | Admin notification center enabled | Request upgrade/renewal and pay invoice | Admin receives invoice-issued and bill-paid notifications with route to tenant details | `GET /admin/notifications` |

## Admin Billing Visibility and Reconciliation

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-ADM-001 | Billing tab load | P0 | Tenant has one or more bills | Open Admin tenant details > Billing | Summary cards, invoice list, status, package/cycle, amount breakdown, payment metadata, and document buttons load | `GET /admin/tenants/:tenantId/bills` |
| BI-ADM-002 | Admin invoice detail modal | P0 | Bill exists | Click View Details | Modal shows status, dates, seller/buyer data, line items, subtotal/VAT/total, provider/method/reference, and payment attempt history | `GET /admin/bills/:id` |
| BI-ADM-003 | Payment attempt timeline | P0 | At least one failed and one successful attempt exist | Open bill detail modal | Timeline shows status, source, provider, method, reference, gateway status, captured amount, actor, time, notes, and failure reason | `bill_payment_attempts` rows serialized in admin bill API |
| BI-ADM-004 | Manual reconciliation happy path | P0 | Bill is `UNPAID` but provider has external proof of payment | Click Reconcile Payment, enter provider/reference/method/session/status/note, submit | Bill becomes `PAID`, subscription activates/updates, receipt PDF generated, tenant payment success email sent, admin notification emitted, attempt history logs `admin_manual_reconciliation` | `POST /admin/bills/:id/reconcile-payment` |
| BI-ADM-005 | Manual reconciliation idempotency | P0 | Same bill manually reconciled once | Submit same reconciliation reference again | Backend returns already-processed/already-paid or duplicate without double-changing subscription | One `succeeded` or `already_paid` result, no double period extension |
| BI-ADM-006 | Expired invoice admin override | P1 | Bill is `EXPIRED` but provider proves payment later | Reconcile manually from admin | Admin reconciliation succeeds with audit note, even though public payment link remains expired | `POST /admin/bills/:id/reconcile-payment`; ActivityLog event `invoice_manually_reconciled` |
| BI-ADM-007 | Permission guard | P0 | Non-super admin without finance reconcile permission | Try calling reconcile endpoint | Request is denied with 403 | `POST /admin/bills/:id/reconcile-payment` |

## ZATCA Readiness and PDF Validation

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-ZAT-001 | QR metadata snapshot | P1 | New bill generated after Phase 8 | Open admin bill JSON | Bill metadata contains invoice UUID, Saudi timestamp, TLV Base64 QR payload, phase marker, and `clearanceStatus='not_integrated'` | `GET /admin/bills/:id` metadata.zatca |
| BI-ZAT-002 | QR visible on invoice PDF | P1 | New invoice PDF generated | Open invoice/receipt PDF | QR panel appears with QR image, invoice UUID, issue timestamp, and “Phase 1 TLV-ready metadata only” wording | Visual PDF check |
| BI-ZAT-003 | Empty VAT number behavior | P1 | Admin Settings invoice VAT number blank | Generate invoice | PDF and QR still render; seller VAT number is blank/missing; no server crash | PDF opens; metadata.zatca.sellerVatNumber = null |
| BI-ZAT-004 | Filled VAT number behavior | P1 | Enter VAT number in Admin Settings and generate a new invoice | Open new invoice JSON/PDF | New snapshot and QR payload use the saved VAT number; old invoices retain previous snapshot | Seller snapshot immutable per bill |
| BI-ZAT-005 | No false compliance claim | P1 | New invoice PDF generated | Inspect QR panel and UI wording | UI/PDF do not claim full ZATCA clearance/reporting integration while credentials are not configured | Text review |

## Negative/Security Checks

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| BI-SEC-001 | Tenant cannot access another tenant's bill by auth API | P0 | Bill belongs to Tenant A; logged in as Tenant B | Request `/tenant/bills/:id` for Tenant A bill | 404 or forbidden, no data leakage | Tenant ownership enforced |
| BI-SEC-002 | Public receipt unavailable before payment | P0 | `UNPAID` bill token exists | Open `/public/bills/by-token/:token/receipt-pdf` | 400 with clear message, no PDF served | Receipt endpoint checks bill status |
| BI-SEC-003 | Invalid payment token | P0 | Random token | Open payment page or public bill API | 404/invalid link state shown, no sensitive data leaked | `GET /public/bills/by-token/:token` |
| BI-SEC-004 | Tampered admin reconciliation payload | P1 | Admin reconcile modal/API available | Submit missing provider/reference/method or malformed payload | Backend rejects with 400 and bill remains unchanged | Validation in `POST /admin/bills/:id/reconcile-payment` |

## Final Sign-Off Template

| Item | Value |
| --- | --- |
| Build / Commit SHA |  |
| Environment URL |  |
| API service version |  |
| Admin build version |  |
| Tenant build version |  |
| Browsers / devices |  |
| QA owner |  |
| Execution start / end |  |
| Total test cases |  |
| Passed |  |
| Failed |  |
| Blocked |  |
| Severity summary | P0: / P1: / P2: |
| Release recommendation | Go / No-Go |
| Notes |  |
