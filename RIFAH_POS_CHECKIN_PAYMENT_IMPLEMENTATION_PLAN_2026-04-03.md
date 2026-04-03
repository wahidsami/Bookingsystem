# Refah POS, Check-In, and Customer Payment Implementation Plan

Document date: 2026-04-03  
Scope: tenant dashboard POS / Collections module, customer arrival check-in, staff app service-start workflow, service booking split payments, product pickup/COD payments, receipts, and operational notifications.

## Why This Plan Is Needed

Today, Refah can store appointment/order payment statuses and some remainder-payment details, but the workflow is still fragmented:

- no dedicated reception / POS screen
- no booking lookup by booking number, QR, or customer phone
- no true `checked_in` or `in_service` appointment state
- service deposit logic is inconsistent and not truly configurable as 50/50
- product pickup payment and cash-on-delivery are not always separated correctly
- not every collected payment writes a proper `PaymentTransaction` row
- no center-side operational alerts for “payment due now” or “remainder still pending”

The goal of this implementation is to make customer arrival and payment collection feel like a **professional reception + POS workflow**, while keeping staff-app service execution clean and auditable.

## Target Operating Model

## Service appointments

1. Customer books a service and chooses one allowed payment option:
   - full online
   - deposit online
   - pay at center

2. When customer arrives, receptionist searches by:
   - booking reference
   - QR code
   - customer phone/name

3. Receptionist checks customer in and system immediately shows:
   - total amount
   - already paid amount
   - remaining amount
   - selected payment intent

4. If payment is still pending or remainder is due, receptionist collects payment and a transaction record is created.

5. Assigned employee then starts service in staff app and later marks it completed.

## Product orders

1. Customer buys products and chooses:
   - pay online
   - pay at pickup
   - cash on delivery

2. Tenant POS / Collections shows pickup orders waiting for payment and delivery orders waiting for COD settlement.

3. Receptionist or delivery staff records payment with method, reference, cashier/staff actor, and receipt.

4. Order payment status and fulfillment status stay synchronized and auditable.

## Recommended Status Model

## Appointment operational status

| Status | Meaning | Who can set it | Notes |
| --- | --- | --- | --- |
| `pending` | Booking created but not yet confirmed/check-in-started | system / tenant | current behavior can remain |
| `confirmed` | Booking accepted/confirmed ahead of visit | tenant / staff | should no longer be reused to mean customer arrived |
| `checked_in` | Customer has arrived at reception | POS / reception / staff | this should trigger payment-due visibility |
| `in_service` | Employee has started performing the service | staff app | this is the real “service started” state |
| `completed` | Service finished | staff app / tenant | existing status |
| `cancelled` | Booking cancelled | tenant / staff | existing status |
| `no_show` | Customer did not arrive | tenant / staff | existing status |

### Important migration note

The current appointment enum does **not** include `checked_in` or `in_service`, so this phase will need a **PostgreSQL enum migration** and backend/frontend status-flow updates.

## Appointment payment status

Keep the existing payment states but enforce clearer semantics:

| Payment status | Meaning |
| --- | --- |
| `pending` | nothing collected yet |
| `deposit_paid` | deposit collected, remainder still due |
| `fully_paid` | all due amount collected |
| `refunded` | full refund completed |
| `partially_refunded` | partial refund completed |

## Product order payment/fulfillment model

Preserve these independently:

- `deliveryType = pickup | delivery`
- `paymentMethod = online | cash_on_delivery | pay_on_visit`
- `paymentStatus = pending | paid | failed | refunded | partially_refunded`

This separation is required so pickup-at-center payments are not mislabeled as COD.

## Implementation Phases

## POS-1 - Correct payment semantics and tenant payment policy

### Objectives

Fix the business rules before building the POS UI.

### To do

- Add tenant payment policy settings for service bookings:
  - allow full online payment
  - allow deposit payment
  - allow pay at center
  - deposit mode = fixed amount or percentage
  - deposit value configurable, for example 50%
  - allowed in-center methods = cash, card POS/Mada, wallet, bank transfer
- Remove the hardcoded SAR 50 public-booking deposit rule
- Remove the backend 25% fallback inconsistency for tenant-side `deposit_paid`
- Fix public product order creation so:
  - pickup + pay at center => `pay_on_visit`
  - delivery + pay on delivery => `cash_on_delivery`
  - online payment remains `online`
- Confirm that order and appointment APIs return enough payment-intent data for POS display

### Deliverables

- backend payment policy logic
- tenant settings UI for payment policy
- corrected public booking/order payment behavior
- QA cases for full/deposit/pay-at-center and pickup/COD mapping

## POS-2 - Build a unified payment transaction ledger

### Objectives

Every collection action must create an auditable transaction record, not only mutate appointment/order status.

### To do

- Make appointment **Mark as Paid** create a `PaymentTransaction` row
- Make appointment deposit collection and remainder collection use one consistent payment recording service
- Make order payment confirmation create a `PaymentTransaction` row with `orderId`
- Store cashier/staff actor in payment transactions
- Store payment method, payment reference, and optional notes
- Add transaction-level API responses so POS and detail pages can show receipt/ledger history
- Decide whether online customer payments should also create `PaymentTransaction` rows for full end-to-end consistency

### Deliverables

- unified backend payment recording service
- appointment/order payment transaction history
- stronger audit trail for tenant finance and POS

## POS-3 - Add appointment check-in and service-start workflow

### Objectives

Separate “booking confirmed” from “customer arrived” and “service started”.

### To do

- Add `checked_in` and `in_service` to appointment status enum and transition rules
- Update tenant dashboard appointment details and list to support:
  - Confirm
  - Check In
  - Start Service
  - Complete
  - Cancel
  - No Show
- Update staff app so:
  - pending/confirmed appointment can be **Check In**
  - checked-in appointment can be **Start Service**
  - in-service appointment can be **Complete**
- Keep invalid transitions blocked server-side
- Decide whether reception-only check-in is allowed from staff app or tenant dashboard only; recommended default is allow both, but POS/reception should be the primary flow

### Deliverables

- updated appointment status enum and transition map
- tenant appointment UI status actions
- staff app status workflow update

## POS-4 - Build Tenant POS / Collections module

### Objectives

Create the central receptionist/cashier screen for customer lookup, payment collection, and receipt actions.

### Suggested sidebar name

- Arabic: **نقطة البيع / التحصيل**
- English: **POS / Collections**

### Recommended pages

- `/dashboard/pos` - live payment queue and customer lookup
- `/dashboard/pos/transactions` - searchable payment transaction ledger
- `/dashboard/pos/closing` - daily cashier summary and end-of-day report

### To do

- Add a POS queue showing:
  - appointments with `paymentStatus=pending`
  - appointments with `paymentStatus=deposit_paid` and remainder due
  - pickup orders with `paymentMethod=pay_on_visit` and `paymentStatus=pending`
  - delivery orders with `paymentMethod=cash_on_delivery` and `paymentStatus=pending`
- Add search by:
  - booking/order reference
  - customer phone
  - customer name
  - QR code scan if supported
- Add a payment collection modal:
  - amount due
  - amount being collected
  - payment method
  - transaction reference
  - cashier note
- After successful collection:
  - write `PaymentTransaction`
  - update appointment/order payment state
  - optionally open receipt PDF
- Add links from POS queue to appointment/order detail pages
- Add package entitlement control if POS becomes a premium package feature

### Deliverables

- tenant POS page
- POS transaction modal
- transaction ledger page
- daily closing summary page

## POS-5 - Add booking/order references and QR check-in support

### Objectives

Make arrival handling fast at reception without forcing staff to manually browse lists.

### To do

- Confirm whether appointment/order IDs are user-friendly enough; if not, add short human-readable `bookingNumber` / `orderNumber` fields for display and search
- Add QR code generation for appointment confirmation and order confirmation views/emails
- Add QR scanner support in POS page if feasible in web browser
- Add fallback manual lookup by reference number or phone
- Ensure references are unique per tenant or globally unique enough for fast lookup

### Deliverables

- customer-facing booking/order reference display
- POS lookup by reference
- optional QR scan flow

## POS-6 - Add operational notifications and due-payment badges

### Objectives

Make payment issues visible before service starts or handoff happens.

### To do

- Add tenant dashboard notification events for:
  - customer checked in but payment still pending
  - customer checked in with deposit paid and remainder due
  - pickup order ready but payment pending
  - delivery order out for delivery with COD pending
  - payment collected successfully
- Add POS sidebar badge for due items count
- Add dashboard widget **Payments Due Today**
- If staff app push is desired, notify assigned employee or reception role when a checked-in customer still has payment due
- Avoid noisy duplicate alerts by deduplicating event notifications per appointment/order/payment state

### Deliverables

- tenant POS/due-payment notifications
- dashboard and sidebar counters
- optional staff app push alerts

## POS-7 - Add receipts and cash closing

### Objectives

Support end-of-day reconciliation and customer proof of payment.

### To do

- Generate receipt PDF for appointment and order collections
- Add receipt send/download from POS and transaction ledger
- Add daily summary by:
  - payment method
  - cashier/staff
  - appointment vs order
  - refund amounts
- Add CSV/PDF export for accounting
- Add permission controls so only authorized staff can access cash closing and refunds

### Deliverables

- receipt generation for customer payments
- daily closing dashboard
- transaction export
- role-based POS permissions

## Suggested Execution Order

1. POS-1
2. POS-2
3. POS-3
4. POS-4
5. POS-5
6. POS-6
7. POS-7

## DB and Migration Impact

Expected database changes:

- Appointment status enum migration for `checked_in` and `in_service`
- possible new `bookingNumber` / QR reference fields for appointments
- possible tenant payment policy fields in tenant settings
- `PaymentTransaction` enhancements if cashier actor/reference fields need refinement
- possible POS notification tables or extension of existing tenant notification model if we choose in-app alerts

## Risk Notes

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Adding new appointment statuses can break existing UI/API assumptions | Current tenant/staff screens mostly expect `pending/confirmed/completed/cancelled/no_show` | update all status maps, labels, filters, transitions, and run regression tests |
| Changing deposit logic can affect existing tenant expectations | Current public booking uses fixed SAR 50 | introduce tenant-configurable policy with safe defaults and clear UI copy |
| Writing transactions for every payment can double count revenue if old code also updates totals manually | finance integrity risk | centralize settlement logic in one service and make status updates derive from transactions |
| POS queue can expose package-restricted modules if not guarded | entitlement regression risk | wire POS module to package entitlement middleware and sidebar visibility rules |
| QR/reference lookup can be abused if references are guessable | privacy risk | use sufficiently random references or require tenant-scoped + partial identity validation |

## Recommendation

Start with **POS-1 and POS-2** before building the new POS UI. If we fix appointment/order payment semantics and transaction recording first, the later POS dashboard, check-in flow, and notifications will be much more reliable and easier to test.

After POS-1 and POS-2, the strongest operational design is:

- **Reception POS** handles customer lookup, check-in, collection, receipt, and daily closing
- **Staff App** handles Check In / Start Service / Complete Service for the assigned employee
- **Tenant notifications** surface due payments and remainder collection events

This separation matches real-world center operations better than forcing everything through either the staff app alone or appointment detail pages alone.
