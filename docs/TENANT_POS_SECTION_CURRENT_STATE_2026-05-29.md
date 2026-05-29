# Tenant Dashboard POS Section - Current State Details (2026-05-29)

## Purpose
The `POS / Collections` section in tenant dashboard is the operational payment-collection workspace for:
- collecting outstanding amounts for appointments and product orders
- handling remainder collection after deposit payments
- validating/redeeming gift cards at collection time
- reviewing recent payment transactions
- viewing daily closing summary and exporting closing report

Route:
- `tenant/src/app/[locale]/dashboard/pos/page.tsx`
- URL: `/{locale}/dashboard/pos`

---

## High-Level Page Structure
1. Header block
- Title: `POS / Collections` (or Arabic equivalent)
- Subtitle explaining collection and closing workflow
- `Refresh` button

2. Inline system messages
- `notice` (amber): partial section load failures
- `error` (red): hard failure from API operations

3. Live collection alerts panel (optional)
- shows up to 5 alerts from POS alerts API
- each alert links to detail page/path

4. KPI cards (4 cards)
- Due Now (amount)
- Appointments due (count)
- Orders due (count)
- Checked-in customers with due payment (count)

5. Main content area (2 columns on xl)
- Left (wide): Collection Queue
- Right (narrow): Daily Closing summary + Recent Transactions

6. Payment collection modal (opens when clicking `Collect Payment`)
- method selection
- optional gift card validation/redeem
- transaction reference + notes
- confirm collection

---

## Data Models Rendered on POS Page

## 1) Collection Queue Item (`PosQueueItem`)
Fields currently used:
- `id`
- `entityType`: `appointment | order`
- `entityId`
- `reference`
- `customerName`
- `customerPhone` (optional)
- `title` (service/product descriptor)
- `employeeName` (optional)
- `scheduledAt` (displayed datetime)
- `status`
- `paymentStatus`
- `paymentIntent`:
  - `pay_at_center`
  - `deposit_remainder_due`
  - `online_payment_pending`
  - `pay_on_pickup`
  - `cash_on_delivery`
- `paymentMethod`
- `paymentMethodLabel`
- `totalAmount`
- `paidAmount`
- `dueAmount`
- `detailPath`

Displayed per queue card:
- entity badge (`Appointment` / `Order`)
- payment-intent badge
- customer name
- title
- metadata line: reference + phone + employee + schedule
- amount mini-summary:
  - total
  - paid
  - remaining
- actions:
  - `Collect Payment`
  - `View Details`

## 2) POS Transaction (`PosTransaction`)
Fields currently used:
- `id`
- `entityType`
- `entityId`
- `reference`
- `customerName`
- `title`
- `amount`
- `type`: `deposit | remainder | full | refund`
- `paymentMethod`
- `paymentMethodLabel`
- `status`
- `transactionRef` (optional)
- `notes` (optional)
- `processedAt`
- `processorName` (optional)
- `detailPath` (optional)

Displayed per transaction card:
- customer name + title
- transaction type label + payment method label
- processed datetime
- collected-by line when available
- amount
- status pill (raw status text)
- actions:
  - `Receipt PDF`
  - `View Details` (if path exists)

## 3) Daily Closing Summary (`PosClosingSummary`)
Fields currently used:
- `date`
- `grossCollected`
- `refundsTotal`
- `netCollected`
- `transactionCount`
- `totalsByMethod[]`:
  - `paymentMethod`
  - `paymentMethodLabel`
  - `collected`
  - `refunded`
  - `transactionCount`
- `totalsBySource`:
  - `appointments`
  - `orders`
  - `refunds`
- `cashierBreakdown[]`:
  - `processorName`
  - `transactionCount`
  - `collected`

Currently rendered:
- net collected (highlight card)
- gross and refunds
- payment method breakdown (net by method = collected - refunded)
- cashier/staff breakdown

Note:
- `totalsBySource` exists in model but is not currently rendered as a dedicated UI block.
- `transactionCount` exists but is not strongly surfaced as a primary card on right rail.

## 4) POS Alert (`PosAlert`)
Fields currently used:
- `id`
- `title`
- `title_ar` (optional)
- `message`
- `message_ar` (optional)
- `severity`: `low | medium | high`
- `detailPath` (optional)

Behavior:
- list shown when alerts array is non-empty
- high severity uses rose styling; others use sky styling
- link target defaults to `/dashboard/pos` if no custom path

---

## Current API Calls and Endpoints (Tenant Frontend Client)
From `tenant/src/lib/api.ts`:

Read:
- `getPosQueue(params)` -> `GET /tenant/pos/queue`
- `getPosAlerts(params)` -> `GET /tenant/pos/alerts`
- `getPosTransactions(params)` -> `GET /tenant/pos/transactions`
- `getPosClosingSummary(params)` -> `GET /tenant/pos/closing`
- `validatePosGiftCard(data)` -> `GET /tenant/pos/gift-cards/validate`

Write / actions:
- `recordRemainderPayment(appointmentId, data)` -> `POST /tenant/appointments/{id}/record-payment`
- `updatePaymentStatus(appointmentId, "fully_paid", ...)` -> `PATCH /tenant/appointments/{id}/payment`
- `updateOrderPaymentStatus(orderId, "paid", ...)` -> `PATCH /tenant/orders/{id}/payment`
- `redeemPosGiftCard(data)` -> `POST /tenant/pos/gift-cards/redeem`
- `markPosAlertRead(alertKey)` -> `POST /tenant/pos/alerts/{alertKey}/read`
- `markAllPosAlertsRead()` -> `POST /tenant/pos/alerts/read-all`

Exports/downloads:
- `downloadPosTransactionReceiptPdf(id)` -> `GET /tenant/pos/transactions/{id}/receipt-pdf`
- `downloadPosClosingSummaryCsv({date})` -> `GET /tenant/pos/closing/export`

---

## Collection Modal Logic (Important)
The modal is fed by selected queue item.

Collection method options:
- `cash`
- `card_pos`
- `wallet`
- `bank_transfer`
- `gift_card`

Normalization behavior:
- `online`, `online-full`, `booking-fee` are normalized to `card_pos` preselection.

Collection submission logic:
1. If entity is `appointment`:
- `gift_card` -> redeem gift card endpoint
- else if paymentStatus is `deposit_paid` -> record remainder payment endpoint
- else -> update appointment payment status to `fully_paid`

2. If entity is `order`:
- `gift_card` -> redeem gift card endpoint
- else -> update order payment status to `paid`

Gift card flow:
- validate code first (`validatePosGiftCard`)
- UI shows:
  - remaining balance
  - max redeemable amount
- confirm is disabled for `gift_card` if code input is empty

---

## Filters, Search, and Date Controls
Current controls:
- queue/transactions shared text search input + search button
- closing date picker (`type=date`)

Behavior:
- searching updates `searchQuery` and reloads all sections
- changing closing date reloads transactions + closing summary for selected date
- queue fetch limit: 100
- transactions fetch limit: 20 (page 1 currently fixed)

---

## What Is Shown to Tenant Today (Functional Summary)
Tenant can currently:
- see who owes money now and how much
- collect payment by several methods
- collect remaining amount after deposit
- process gift card redemption at POS
- view recent payment records
- download transaction receipt PDFs
- view and export daily closing data
- see live collection alerts

---

## Gaps / Enhancement Opportunities (Based on Current Implementation)
1. Closing summary completeness
- `totalsBySource` and `transactionCount` exist but are not clearly surfaced in dedicated visual widgets.

2. Transaction list controls
- no client-side filters for method/type/status on POS page (only search + date).

3. Queue segmentation
- no tabs for appointment vs order vs checked-in due; only aggregated cards.

4. Alert workflow
- POS page displays alerts, but read/unread controls are not exposed directly in this page UI yet.

5. Pagination
- transactions are fixed to first 20 on load; no next/previous controls on page.

6. Modal UX data richness
- no explicit display of payment status transition preview before confirmation.

7. Audit visibility
- transaction reference and notes are captured, but queue card does not show prior collection attempts/status history inline.

---

## Dependencies and Cross-Section Coupling
- Appointment payment states (`pending`, `deposit_paid`, `fully_paid`) influence queue and collection behavior.
- Order payment status updates flow through order endpoints from POS.
- Gift card validation/redeem depends on tenant gift-card subsystem.
- Alerts tie into tenant layout notification center and due-count badge in sidebar.

---

## Files to Update for POS Enhancements
Primary:
- `tenant/src/app/[locale]/dashboard/pos/page.tsx`

Supporting:
- `tenant/src/lib/api.ts` (if new POS endpoints/params needed)
- `tenant/src/components/TenantLayout.tsx` (if alert badge/read behavior is enhanced globally)

---

## Suggested Next Enhancement Phases (for execution)
1. UX/Data parity phase
- expose totals by source + transaction count cards
- add transaction filter chips (type, method, status)

2. Queue operations phase
- add queue tabs + sort options (highest due first, oldest first)
- add quick mark alert read/read-all controls

3. Audit/export phase
- add full transaction history paging
- richer export controls (date range, payment method)

