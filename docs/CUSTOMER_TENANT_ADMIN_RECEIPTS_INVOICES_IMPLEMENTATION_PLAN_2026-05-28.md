# Customer/Tenant/Admin Receipts & Invoices Implementation Plan (2026-05-28)

## Objective
- Ensure every customer is informed by email with a receipt/invoice after service or product purchase lifecycle events.
- Support both unpaid and paid scenarios (including pay-on-arrival and split payments).
- Make invoices accessible in:
- Customer app (`My Invoices` history).
- Tenant dashboard (per customer, appointment, and order context).
- Admin dashboard (global customer history and compliance view).

## Current System Audit Summary
- Already exists:
- Subscription billing invoices/receipts (`bills`) for tenant subscriptions only.
- POS receipt PDF endpoint in tenant dashboard (`/pos/transactions/:id/receipt-pdf`).
- Appointment/order payment transactions (`payment_transactions`) and gateway `transactions`.
- Customer notification orchestration exists; customer email infra exists (`emailService` + templates).
- Missing for this requirement:
- No unified customer-facing invoice entity for appointments/orders.
- No customer `My Invoices` API/screen.
- No tenant/admin unified invoice explorer for customer commerce.
- No automatic unpaid+paid document lifecycle for service/order flows.

## Business Rules (Source of Truth)
- Service/Order created with pay-later (`pay_on_visit`, `cash_on_delivery`, `pay_on_arrival`):
- Generate and email `UNPAID` invoice immediately.
- Payment later confirmed:
- Generate/update and email `PAID` receipt (linked to same invoice reference).
- Split payment (`deposit_paid` then remainder):
- First document: `PARTIALLY_PAID` receipt/invoice snapshot.
- Final document after remainder: `PAID` receipt.
- Refunds:
- Generate refund receipt/credit note style document and email it.
- Every document must be retrievable by customer, tenant admin, and super admin.

## Proposed Data Model
## 1) `customer_invoices` (new)
- `id`, `invoiceNumber`, `tenantId`, `platformUserId`
- `entityType` (`appointment` | `order`)
- `entityId` (appointmentId or orderId)
- `status` (`UNPAID` | `PARTIALLY_PAID` | `PAID` | `REFUNDED` | `VOID`)
- `currency`, `subtotalAmount`, `vatAmount`, `totalAmount`
- `paidAmount`, `dueAmount`
- `paymentMethodSnapshot`, `paymentStatusSnapshot`
- `invoicePdfPath`, `receiptPdfPath`
- `issuedAt`, `paidAt`, `lastEmailedAt`
- `metadata` (JSONB)

## 2) `customer_invoice_items` (new)
- `id`, `invoiceId`
- `itemType` (`service` | `product`)
- `itemRefId`
- `nameEn`, `nameAr`, `quantity`, `unitPrice`, `lineTotal`, `taxAmount`

## 3) `customer_invoice_events` (new audit trail)
- `id`, `invoiceId`, `eventType`
- `fromStatus`, `toStatus`
- `triggerSource` (`customer_payment`, `tenant_pos`, `tenant_manual`, `system`)
- `actorType`, `actorId`
- `payload`

## 4) Optional idempotency table
- `invoice_dispatch_locks` for safe retries and no duplicate emails.

## Status Matrix (Scenario Coverage)
- Appointment created, pending payment:
- Create invoice `UNPAID`, email unpaid invoice.
- Appointment deposit paid:
- Update to `PARTIALLY_PAID`, generate partial receipt, email.
- Appointment fully paid:
- Update to `PAID`, generate paid receipt, email.
- Order created with online pending:
- Create `UNPAID` invoice.
- Order payment success:
- Update to `PAID`, email paid receipt.
- Order created COD/POV:
- Create `UNPAID` invoice on order creation; paid receipt on settlement.
- Refund full/partial:
- Update `REFUNDED`/partial with event and refund document email.

## API Plan
## Customer APIs
- `GET /api/v1/users/invoices`
- Filters: type, status, date range, tenantId, pagination.
- `GET /api/v1/users/invoices/:id`
- Detailed lines, payment timeline, download URLs.
- `GET /api/v1/users/invoices/:id/invoice-pdf`
- `GET /api/v1/users/invoices/:id/receipt-pdf`

## Tenant APIs
- `GET /api/v1/tenant/invoices`
- Tenant-scoped customer invoices with filters (status/date/customer/entity).
- `GET /api/v1/tenant/invoices/:id`
- `GET /api/v1/tenant/invoices/:id/invoice-pdf`
- `GET /api/v1/tenant/invoices/:id/receipt-pdf`
- Extend existing customer detail endpoint payload with latest invoice summary.

## Admin APIs
- `GET /api/v1/admin/customer-invoices`
- Cross-tenant search with customer and tenant filters.
- `GET /api/v1/admin/users/:id/invoices`
- Per-customer invoice list.
- PDF endpoints same pattern as above with admin permission gates.

## Document Generation Plan
- Reuse existing PDF generation strategy used for subscription bills.
- New `customerInvoiceDocumentService`:
- `ensureCustomerInvoicePdf(invoice)`
- `ensureCustomerReceiptPdf(invoice)`
- Use stored snapshots (customer/tenant/service/product names, prices) to keep historical integrity.

## Email Plan
- New templates:
- `customer_invoice_unpaid.html`
- `customer_invoice_paid.html`
- `customer_invoice_partial.html`
- `customer_invoice_refund.html`
- New service function:
- `sendCustomerCommerceInvoiceEmail({ invoiceId, templateType })`
- Attach or link invoice/receipt PDFs.
- Locale from customer preferred language.

## Trigger & Orchestration Plan
- Centralize in `customerInvoiceOrchestratorService` called from:
- `paymentService` (online wallet/card payment success/failure).
- `orderService.updatePaymentStatus`.
- `tenantAppointmentController.updatePaymentStatus`.
- `tenantPosController` collection paths.
- Guarantee idempotency:
- One open invoice per (`entityType`,`entityId`).
- State transitions are monotonic and event-logged.

## UI Plan
## Customer App (`RifahMobile`)
- New screen: `MyInvoicesScreen`.
- Entry points:
- Profile/More menu.
- From appointment/purchase detail cards.
- Card includes: invoice number, tenant, amount, status badge, date, actions.
- Actions: `Open Invoice PDF`, `Open Receipt PDF`.

## Tenant Dashboard
- New section: `Customers > Invoices` (or tab in customer details).
- Add invoice widget in:
- Appointment details page.
- Order details page.
- Customer detail page history cards.
- Filters + export CSV.

## Admin Dashboard
- New tab under users/customer profile:
- `Invoices`.
- Global page under financial:
- `Customer Commerce Invoices`.
- Keep subscription `bills` separate from customer commerce invoices to avoid confusion.

## Security & Permissions
- Customer: only own invoices (`platformUserId`).
- Tenant: only invoices for own `tenantId`.
- Admin: full access with existing permission model.
- All PDF routes must enforce role scopes and signed URL/token strategy if publicly exposed.

## Migration Plan
## Phase A (DB)
- Add new tables + enums + indexes.
- Add unique constraints for one invoice per entity baseline.

## Phase B (Backend Core)
- Add models + associations.
- Implement orchestrator + document service + email service.
- Wire triggers at all payment update points.

## Phase C (APIs)
- Customer/tenant/admin invoice endpoints + PDF endpoints.

## Phase D (Frontend)
- Customer `My Invoices` screen.
- Tenant invoice explorer + customer detail integration.
- Admin user invoice history + global explorer.

## Phase E (Backfill + QA)
- Backfill script for recent appointments/orders from `transactions` + `payment_transactions`.
- E2E testing matrix and staged rollout.

## QA Test Matrix (Must Pass)
- Unpaid invoice email on pay-later creation (service + order).
- Paid receipt email on settlement.
- Partial payment transition correctness.
- Refund document correctness.
- PDF links accessible by correct roles only.
- Customer app shows complete invoice history.
- Tenant sees only own customer invoices.
- Admin sees cross-tenant customer invoice history.
- No duplicate invoices on retries/webhook repeats.

## Rollout Strategy
- Feature flags:
- `CUSTOMER_COMMERCE_INVOICES_ENABLED`
- `CUSTOMER_COMMERCE_INVOICE_EMAILS_ENABLED`
- Start with tenant internal environment, then 1 pilot tenant, then full rollout.
- Monitoring:
- Email send success rate.
- PDF generation failures.
- Invoice transition anomalies.

## Risks & Mitigation
- Risk: duplicate docs from multiple payment paths.
- Mitigation: idempotency lock + unique keys + event table.
- Risk: inconsistent statuses between appointment/order and invoice.
- Mitigation: orchestrator as single transition authority.
- Risk: historical data gaps.
- Mitigation: backfill script with audit report and manual review queue.

## Execution Checklist
- [ ] Approve schema.
- [ ] Implement migrations.
- [ ] Implement backend orchestrator + document/email services.
- [ ] Implement APIs.
- [ ] Implement customer app `My Invoices`.
- [ ] Implement tenant dashboard invoice views.
- [ ] Implement admin dashboard invoice views.
- [ ] Run backfill (optional by date range).
- [ ] Run E2E QA and sign off.
