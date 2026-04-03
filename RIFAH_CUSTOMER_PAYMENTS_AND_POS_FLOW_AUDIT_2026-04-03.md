# Refah Customer Payments and POS Flow Audit

Document date: 2026-04-03  
Scope: customer service booking payments, product order payments, tenant dashboard payment operations, and whether Refah needs a POS / cashier module for in-center collection.

## Executive Summary

The current system **partially supports** customer payments for appointments and orders, but the flow is **not yet professional enough for center cashier operations**.

For services, the tenant can see if an appointment is `pending`, `deposit_paid`, or `fully_paid`, and can collect a remaining balance from the appointment details page. However, deposit logic is inconsistent, true **50/50 payment is not implemented**, and there is no central cashier queue showing who should pay at arrival or who still owes the remainder.

For products, the tenant can confirm payment from the order details page for `cash_on_delivery` or `pay_on_visit` orders, but the system does not create a proper payment transaction ledger entry for that collection, and the public order API currently collapses every non-online payment into `cash_on_delivery`, which can incorrectly label pickup-at-center payments.

**Recommendation:** yes, Refah should add a dedicated **POS / Payments Due** section in the tenant dashboard, but it should be built on top of a corrected payment model and a unified transaction ledger first. This POS section should not replace the existing appointment/order detail actions; it should become the central operational screen for “who needs to pay now?” and “what remainder is still due?”.

## Current Behavior - Service Bookings

| Customer payment choice | Current backend behavior | What tenant sees now | Main gap |
| --- | --- | --- | --- |
| Pay full amount online | Appointment becomes `fully_paid`; `depositPaid=true`, `remainderPaid=true`, `remainderAmount=0`, `totalPaid=price` | Appointment detail shows paid status and no remainder collection action | No payment transaction record is written for the full online payment in the tenant-facing ledger flow |
| Pay booking fee / deposit | Public booking marks appointment `deposit_paid`, but uses **fixed SAR 50** deposit, not percentage-based 50/50 | Appointment detail shows remaining amount and a “Collect remaining” action if `deposit_paid` | This is not true 50/50, deposit amount is hardcoded, and it is inconsistent with tenant-side manual `deposit_paid` logic |
| Pay at center on arrival | Appointment stays `paymentStatus=pending` | Appointment detail allows “Mark as Paid” | No central “due on arrival” queue; direct Mark as Paid does not create a proper `PaymentTransaction` row |

## Current Behavior - Product Orders

| Customer payment choice | Current backend behavior | What tenant sees now | Main gap |
| --- | --- | --- | --- |
| Pay full amount online | Order created as `pending`, then marked `paymentStatus=paid` | Order detail shows paid status | No cashier/POS issue for this path, but no unified payment transaction audit row is created in tenant order payment update flow |
| Delivery + pay on delivery | Stored as `deliveryType=delivery`, `paymentMethod=cash_on_delivery`, `paymentStatus=pending` | Order detail shows COD and allows payment status confirmation | No amount/method/reference capture when confirming collection; no `PaymentTransaction` row |
| Pickup + pay at center | This should be `paymentMethod=pay_on_visit`, `deliveryType=pickup`, but public tenant order API currently normalizes every non-online payment to `cash_on_delivery` | Tenant may see COD even when the customer is actually picking up at the center | Incorrect payment-method mapping causes operational confusion and weak reporting |

## How the Center Currently Knows Payment State

### 1) Customer paid half / deposit and must pay the rest at center

For service appointments, the center can know this **only by opening the appointment details page** and checking:

- `paymentStatus = deposit_paid`
- `depositAmount`
- `remainderAmount`
- `totalPaid`
- `remainderPaid = false`

The tenant dashboard appointment details page then shows a **Collect remaining at salon** section and allows choosing `cash`, `card_pos`, or `wallet`.

**Current limitation:** there is no dashboard-wide cashier list that says “these customers are arriving today and still owe a remainder”. Staff must open each appointment one by one.

For product orders, partial payment / split payment is **not implemented** in a structured way. Orders are mostly handled as `pending` or `paid`, not deposit + remainder.

### 2) Customer selected “pay in center when arrives”

For service appointments, this is represented as `paymentStatus = pending`. The appointment details page lets the tenant click **Mark as Paid**.

For pickup product orders, the intended state should be `paymentMethod = pay_on_visit` and `paymentStatus = pending`, but public order creation currently stores non-online payment as `cash_on_delivery`, so the center may not reliably know whether the customer will pay **at pickup in-center** or **cash on delivery**.

**Current limitation:** “pay on arrival” exists as status data, but there is no dedicated operational workflow around arrival/check-in/payment collection, cashier attribution, receipt printing, or daily reconciliation.

## Deep Technical Findings

## A. Appointment payment logic is inconsistent and not configurable enough

### Public booking deposit path

In `server/src/controllers/publicTenantController.js`, the booking-fee path uses a fixed booking fee of **SAR 50** and stores the appointment as `deposit_paid`.

This means the current system does **not** implement “50/50 payment” even if the business wants that option.

### Tenant manual deposit path

In `server/src/controllers/tenantAppointmentController.js`, when a tenant updates payment status to `deposit_paid` and `depositAmount` is missing, the backend defaults to **25% of appointment price**.

So there are currently **two different deposit rules**:

- public booking deposit = fixed SAR 50
- tenant manual deposit fallback = 25%

This is risky because business logic and financial reporting become inconsistent.

### Best-practice recommendation

Move service booking payment policy into tenant settings:

- allow full online payment
- allow deposit payment
- deposit mode = fixed amount or percentage
- deposit percentage/value configurable per tenant, and optionally per service
- allow pay-at-center
- allowed in-center methods = cash, card POS/Mada, wallet, bank transfer

If Refah wants 50/50, then this should be implemented as **deposit percentage = 50%**, not hardcoded special logic.

## B. Appointment remainder collection is only available inside appointment detail, not in a POS queue

`server/src/services/splitPaymentService.js` supports collecting appointment remainder and writing a `PaymentTransaction` record with `type='remainder'`, and the tenant appointment details UI calls that flow.

This is good, but operationally incomplete:

- no central list of appointments with pending or remainder-due payments
- no “payments due today” dashboard for front desk
- no strong cashier/staff attribution, because `processedBy` is currently passed as `null`
- direct “Mark as Paid” for pending appointments updates the appointment status but does not write a `PaymentTransaction` row, so the transaction ledger is incomplete

### Best-practice recommendation

Create a **POS / Payments Due** module where front-desk staff can see:

- today’s appointments with `pending` payment
- today’s appointments with `deposit_paid` and `remainderPaid=false`
- customer name, service, appointment time, total, paid, remaining, selected payment method intent
- one-click **Collect Payment** / **Collect Remainder**
- choose actual payment method, enter POS reference / transaction note, assign cashier staff, generate receipt

The appointment detail page should still keep payment actions, but the POS queue should be the main operational cockpit.

## C. Product order “pay on pickup” vs “cash on delivery” is not preserved correctly in public checkout

`server/src/models/Order.js` already supports:

- `paymentMethod = online`
- `paymentMethod = cash_on_delivery`
- `paymentMethod = pay_on_visit`
- `deliveryType = pickup | delivery`

So the data model is actually capable of representing the difference.

However, in `server/src/controllers/publicTenantController.js`, public order creation currently does:

- `paymentMethod === 'online'` => `online`
- any non-online method => `cash_on_delivery`

This means even if the customer is choosing pickup + pay at center, the order can be saved as `cash_on_delivery`, which is semantically wrong.

### Best-practice recommendation

Fix public order creation so payment method and fulfillment method are stored independently:

- `deliveryType = pickup` + pay at center => `paymentMethod = pay_on_visit`
- `deliveryType = delivery` + pay at delivery => `paymentMethod = cash_on_delivery`
- online payment stays `paymentMethod = online`

This distinction is important for cashier workflows, delivery operations, and financial reports.

## D. Product order payment collection lacks a proper transaction ledger and cashier workflow

The tenant order details page can update `paymentStatus` for COD / pay-on-visit orders, but this is mostly a status toggle.

Current gaps:

- no amount collected input
- no payment method override at collection time
- no POS transaction reference capture
- no `PaymentTransaction` row written for order payment collection
- no cashier/staff attribution
- no central list of pickup orders waiting for payment or delivery orders waiting for COD collection

### Best-practice recommendation

Use `PaymentTransaction` for **orders too**, not only appointment remainder payments, and make order collection a structured transaction event:

- amount collected
- method = cash / card_pos / wallet / bank_transfer
- orderId
- cashier/staff user
- transaction reference
- notes
- receipt generation

Then order `paymentStatus` should be derived from transaction state, not changed as a free status toggle only.

## E. There is currently no dedicated POS / cashier module in tenant dashboard

Search of the tenant dashboard and backend controller/service names shows no dedicated POS module or front-desk cashier workspace. Payment actions are distributed across appointment and order detail pages.

This means the current system can handle some payment state updates, but it is **not optimized for front-desk operations**.

### Best-practice recommendation

Yes, add a POS section, but design it as **“Payments Due + Checkout + Receipts + End-of-Day Summary”**, not just a basic list.

Suggested sidebar module name:

- Arabic: **نقطة البيع / التحصيل**
- English: **POS / Collections**

Suggested sub-sections:

- **Payments Due Today**: appointments/orders waiting for full payment or remainder payment
- **Checkout**: collect payment, choose method, record reference, print/send receipt
- **Transactions**: searchable ledger of all appointment/order payment transactions
- **Cash Closing / Daily Summary**: cash, POS card, wallet totals by day and by cashier

## F. Notifications are not yet structured around center payment operations

For customer due-on-arrival or remainder-due payments, there is no dedicated notification workflow that proactively tells the center:

- “This appointment has a remainder due today”
- “This pickup order is waiting for in-center payment”
- “This delivery order is pending COD collection”
- “Staff X collected payment”

### Best-practice recommendation

Add tenant-side operational notifications and POS badges:

- badge count on **POS / Collections** for payments due today
- dashboard card **Payments Due Today**
- alert before appointment starts if customer chose pay-at-center or has remainder due
- alert when pickup order becomes ready and payment is still pending
- alert when delivery order is out for delivery and COD is expected
- receipt/payment confirmation notification after collection

For staff app, if cashier/employee roles are used, push notifications can be added later for assigned staff.

## Recommended Target Flow

## Service booking payment flow

1. Customer books service and selects one allowed payment option:
   - pay full online
   - pay deposit online
   - pay at center

2. If deposit is selected, system calculates deposit based on tenant policy:
   - percentage, for example 50%
   - or fixed amount

3. Tenant dashboard shows payment state everywhere consistently:
   - Appointment details
   - Appointment list
   - POS / Payments Due
   - Dashboard counters

4. When customer arrives, cashier opens POS / Collections and collects:
   - full amount if `pending`
   - remaining amount if `deposit_paid`

5. System creates a `PaymentTransaction`, updates appointment payment fields, attributes the cashier, and generates a receipt.

## Product order payment flow

1. Customer places product order and selects:
   - online payment
   - pay at pickup in center
   - cash on delivery

2. System stores `deliveryType` and `paymentMethod` correctly and independently.

3. Tenant dashboard shows:
   - pickup orders awaiting in-center payment
   - delivery orders awaiting COD payment

4. At pickup or delivery settlement, cashier/staff records payment through POS / Collections or order details.

5. System writes a `PaymentTransaction`, updates order payment status, and issues a receipt.

## Proposed Implementation Phases

## POS-1 - Fix payment policy model and data correctness

- Add tenant payment policy settings for service booking deposit/full/pay-at-center options
- Support deposit percentage and fixed deposit amount
- Remove hardcoded SAR 50 and backend 25% fallback inconsistency
- Fix public order API so `pay_on_visit` and `cash_on_delivery` are not collapsed
- Add explicit “customer selected payment option” fields where needed for appointment/order display

## POS-2 - Build unified payment transaction recording

- Make all appointment/order payment collection paths create `PaymentTransaction` rows
- Ensure direct “Mark as Paid” on appointments also writes a transaction row
- Add cashier/staff attribution and transaction references
- Support full, deposit, remainder, and order payment transaction types cleanly

## POS-3 - Create POS / Collections tenant dashboard module

- Add tenant dashboard POS page
- Show payments due today for:
  - appointment full payment on arrival
  - appointment remainder due
  - pickup order pay-on-visit
  - delivery order COD
- Add filters, search, status chips, and “Collect Payment” workflow
- Link back to appointment/order detail pages

## POS-4 - Add notifications and dashboard widgets

- Add dashboard summary cards for due payments and collected today
- Add tenant notification events for payment due and payment collected
- Add POS sidebar badge for due items count
- Optional later: push notifications to staff app

## POS-5 - Add receipts and daily reconciliation

- Generate receipt PDF for appointment and order collections
- Add tenant transaction ledger page
- Add daily closing summary by payment method and cashier
- Add export to CSV/PDF for accounting

## Risk Assessment

| Risk | Why it matters | Recommended mitigation |
| --- | --- | --- |
| Current deposit rules are inconsistent | Wrong remaining amounts and confusing customer/center experience | Centralize payment policy in tenant settings and recalculate consistently |
| Public pickup payments may be stored as COD | Center may not know whether payment is expected at counter or on delivery | Fix public order payment method mapping |
| Status-only updates without transaction rows | Weak audit trail and unreliable finance/POS reporting | Require `PaymentTransaction` creation for every settlement action |
| No cashier attribution | Cannot audit who collected money | Store cashier/staff actor on payment transaction |
| No central POS queue | Front desk must open each appointment/order manually | Build POS / Collections dashboard |
| Immediate stock decrement for unpaid COD/POV orders | If order is never paid/cancelled, inventory can be locked too aggressively | Review reservation vs deduction strategy in POS/order phase |

## Final Recommendation

Refah should **not** rely only on appointment/order detail pages for in-center payment collection. For a professional center workflow, we should build a **POS / Collections module** backed by a **single transaction ledger** and **configurable tenant payment policies**.

But the first priority is **not UI**. The first priority is to fix the underlying payment semantics:

1. configurable service deposit/full/pay-at-center policy
2. correct order payment method mapping for pickup vs delivery
3. transaction ledger for every appointment/order payment event

After those are correct, the POS dashboard and payment notifications will be much safer to implement.
