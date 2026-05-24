# Refah Wallet & Gift Cards System - Implementation Plan (2026-05-24)

## Objective
Design and implement a complete Wallet + Gift Card ecosystem across Refah platform:
- Customer can buy wallet credits from mobile app.
- Customer can buy gift cards and send them to another user by mobile or email.
- Gift card packages are controlled by **Admin Dashboard** (not Tenant).
- Receiver wallet is credited automatically and notified.
- Wallet can be used as a payment method in service bookings and product purchases.

---

## Product Scope (Requested Flow)
1. Customer opens mobile app.
2. Customer opens `Gifts` section.
3. Customer sees available gift card packages.
4. On package click, customer chooses:
- Recharge own wallet
- Send gift card to another person (phone/email)
5. If sent to another person:
- Receiver wallet credited
- Receiver notified: `<sender> sent you gift card of <amount>`
6. Gift card packages managed from Admin Dashboard.
7. Wallet payment option appears in service and product checkout flows.

---

## Existing Foundations (Already in codebase)
- `PlatformUser.walletBalance` exists.
- Wallet top-up endpoint exists (`/payments/wallet/topup`).
- Payment methods include `wallet` in multiple backend modules.
- Some customer app wallet references already exist, but UX flow is incomplete.

This plan builds a full, production-ready layer on top of existing primitives.

---

## Architecture Decisions

### 1) Wallet Ledger First
Do not rely only on `walletBalance` arithmetic. Use immutable wallet ledger entries to guarantee auditability.

### 2) Gift Cards as Configurable Packages
Admin creates package definitions (price, credit amount, title, active state, optional promo bonus).

### 3) Transfer by Identity Resolution
Send by:
- Existing Refah user phone/email: immediate credit.
- Non-existing recipient: create pending gift claim token + notification link; credit occurs after claim/registration.

### 4) Unified Payment Orchestrator
Wallet payment should use same checkout orchestration for both:
- Service bookings
- Product orders

### 5) Security & Financial Controls
- Idempotent purchase/transfer APIs
- Double-spend prevention via transaction + row lock
- Daily transfer limits and fraud guardrails

---

## Data Model Additions

## A) `wallet_ledger_entries`
Purpose: immutable financial journal for each wallet movement.

Columns:
- `id` (uuid)
- `platform_user_id` (uuid, indexed)
- `type` enum:
  - `topup`
  - `gift_purchase`
  - `gift_sent_debit`
  - `gift_received_credit`
  - `service_payment_debit`
  - `product_payment_debit`
  - `refund_credit`
  - `admin_adjustment`
- `direction` enum: `credit`, `debit`
- `amount` decimal(10,2)
- `currency` default `SAR`
- `balance_before` decimal
- `balance_after` decimal
- `reference_type` string (appointment/order/gift/txn)
- `reference_id` uuid/string
- `metadata` jsonb
- `created_at`

## B) `gift_card_packages`
Purpose: package catalog controlled by Admin.

Columns:
- `id` (uuid)
- `title_en`, `title_ar`
- `description_en`, `description_ar`
- `display_order` int
- `price_amount` decimal(10,2)
- `wallet_credit_amount` decimal(10,2)
- `bonus_amount` decimal(10,2) default 0
- `is_active` bool
- `starts_at`, `ends_at` nullable
- `image_url` nullable
- `created_by_admin_id`
- timestamps

## C) `gift_card_transactions`
Purpose: purchase + send lifecycle.

Columns:
- `id` (uuid)
- `sender_platform_user_id` (nullable for direct self top-up flow if needed)
- `recipient_platform_user_id` nullable
- `recipient_email` nullable
- `recipient_phone` nullable
- `package_id`
- `purchase_amount` decimal
- `credit_amount` decimal
- `bonus_amount` decimal
- `total_credit_amount` decimal
- `status` enum:
  - `purchased`
  - `sent_pending_claim`
  - `sent_completed`
  - `redeemed`
  - `cancelled`
  - `expired`
- `delivery_channel` enum: `in_app`, `email`, `sms_whatsapp_future`
- `claim_token` nullable
- `claimed_at` nullable
- `expires_at` nullable
- `metadata` jsonb
- timestamps

## D) Optional: `wallet_limits`
Purpose: configurable anti-abuse thresholds.

---

## API Plan

## Customer APIs
1. `GET /api/v1/gifts/packages`
- Returns active gift packages sorted for mobile UI.

2. `POST /api/v1/wallet/recharge-from-package`
Payload:
- `packageId`
- `paymentMethod` (card/online)
Flow:
- Charge user externally
- Credit wallet via ledger
- Return new balance + receipt

3. `POST /api/v1/gifts/send`
Payload:
- `packageId`
- recipient: (`email` or `phone` or existing `platformUserId`)
- optional `message`
Flow:
- Sender pays package price
- If recipient found: immediate credit + notification
- Else create pending gift with claim token + send invite email

4. `GET /api/v1/wallet/balance`
5. `GET /api/v1/wallet/ledger?cursor=...`

## Claim/Recipient APIs
6. `POST /api/v1/gifts/claim`
Payload:
- `token`
Flow:
- Validate token
- Bind to authenticated user
- Credit wallet
- Mark transaction redeemed

## Admin APIs (Platform Admin Dashboard)
7. `GET /api/v1/admin/gift-packages`
8. `POST /api/v1/admin/gift-packages`
9. `PATCH /api/v1/admin/gift-packages/:id`
10. `POST /api/v1/admin/gift-packages/:id/toggle-active`
11. `GET /api/v1/admin/gift-transactions` (audit/reporting)

## Checkout APIs
12. Extend service/product payment endpoints to accept `paymentMethod=wallet` and do:
- balance check
- atomic debit
- create payment transaction record

---

## Mobile App UX Plan (Customer)

## New Section: `Gifts`
- Entry on main tabs/home shortcuts.
- Grid/list of gift packages with amount and value.

## Package Action Bottom Sheet
On package tap, user chooses:
1. `Add to my wallet`
2. `Send to someone`

## Send Flow
- Recipient type selector: phone/email/user lookup
- Recipient input
- Optional personalized message
- Confirmation screen with package details
- Success screen with transaction receipt

## Wallet Area
- Current balance card
- Top up via packages
- Recent wallet activity (ledger)
- CTA: `Use wallet at checkout`

## Checkout Changes
- Service booking payment options include `Pay using wallet` (when balance sufficient).
- Product purchase payment options include `Pay using wallet`.
- If insufficient balance, show quick `Top up` CTA.

---

## Admin Dashboard UX Plan

## New Module: `Gift Cards`
Subsections:
1. `Packages`
- Create/edit package
- Activate/deactivate
- Set pricing/credit/bonus/visibility window

2. `Transactions`
- Filter by sender/recipient/status/date
- Export CSV
- Reconcile failed/pending claims

3. `Settings` (optional)
- Default gift expiry
- Daily sending limits
- Min/max package amounts

---

## Notification Plan

## Sender
- Confirmation after purchase/send
- Receipt details

## Recipient
- In-app notification when credited
- Email notification (current requirement)
- WhatsApp later (future channel)

Message format:
- `<Sender Name> has sent you a gift card of <Amount> SAR`

---

## Payment & Accounting Rules
1. Package purchase uses normal payment gateway (card/online).
2. Wallet credit only after successful capture.
3. Wallet debits require:
- sufficient balance
- atomic update in DB transaction
4. Refund policy:
- if service/product refunded, optionally return to wallet based on policy.
5. All operations create ledger entries for audit trail.

---

## Security, Fraud, and Consistency
- Idempotency key on recharge/send endpoints.
- Row-level lock on `platform_users` balance update.
- Prevent self-send abuse loops (configurable).
- Transfer limits (daily/weekly).
- Rate limits on send and claim endpoints.
- Signed claim tokens with expiry.
- Avoid exposing full recipient PII in responses.

---

## Phased Implementation Tracker

## Phase 0 - Contract & Schema Lock
Status: `completed`
Tasks:
- Finalize DB schema and API contracts.
- Finalize package business rules and limits.
Deliverable:
- Approved technical contract.

## Phase 1 - Backend Wallet Ledger
Status: `in_progress`
Tasks:
- Create ledger model/table and wallet service methods.
- Migrate all wallet balance mutations through ledger service.
Acceptance:
- Every wallet movement has journal record.

### Phase 1 Progress (2026-05-24)
- Added `wallet_ledger_entries` SQL migration file.
- Added `WalletLedgerEntry` model and user association.
- Added `walletService` with atomic credit/debit and ledger writes.
- Integrated wallet top-up flow to write ledger entries.
- Added wallet balance and wallet ledger read APIs.

## Phase 2 - Gift Packages (Admin)
Status: `completed`
Tasks:
- Admin APIs + admin UI CRUD for packages.
- Active/inactive + scheduling.
Acceptance:
- Admin can fully manage gift package catalog.

### Phase 2 Progress (2026-05-24)
- Added `gift_card_packages` and `gift_card_transactions` SQL migration.
- Added `GiftCardPackage` and `GiftCardTransaction` models with associations.
- Added Admin CRUD APIs for gift packages.
- Added Admin listing API for gift transactions.
- Added public API to list active gift packages for customer app.
- Added Admin dashboard Gift Cards page (`/dashboard/gift-cards`) with:
  - Create/edit/delete gift package controls
  - Active flag, schedule window, pricing/credit/bonus inputs
  - Gift transactions table with status filter
  - Sidebar navigation integration

## Phase 3 - Customer Gifts UX
Status: `completed`
Tasks:
- Mobile Gifts section + package cards.
- Package action sheet (self recharge / send).
Acceptance:
- User can complete self recharge through package flow.

## Phase 4 - Send Gift to Others
Status: `completed`
Tasks:
- Recipient resolution flow.
- Immediate credit or pending claim path.
- Notification delivery.
Acceptance:
- Recipient receives wallet credit and notification.

## Phase 5 - Wallet Payment in Checkout
Status: `in_progress`
Tasks:
- Add wallet option to service and product checkouts.
- Balance validation + debit pipeline.
Acceptance:
- Wallet payment succeeds for both services and products.

### Phase 5 Progress (2026-05-24)
- Added backend wallet payment processing in `/payments/process` for:
  - appointment payments (full/remainder/deposit logic preserved)
  - product order payments
- Added wallet debit ledger writes using `walletService.debitWallet`:
  - `service_payment_debit`
  - `product_payment_debit`
- Added mobile customer payment flow support to choose `Card` or `Wallet` in `PaymentScreen`.
- Added customer API helper to fetch wallet balance before wallet payment submission.

## Phase 6 - Reporting, QA, Hardening
Status: `pending`
Tasks:
- Admin transaction reports.
- E2E tests and abuse checks.
- Observability dashboards/logging.
Acceptance:
- Stable production rollout with finance-grade traceability.

---

## QA/UAT Matrix

### Customer
- Buy package and recharge own wallet
- Send package to existing user
- Send package to non-existing user and claim later
- Pay service with wallet
- Pay product with wallet
- Insufficient balance fallback

### Admin
- Create/edit/deactivate package
- Validate package visibility windows
- Review gift transactions log

### Backend
- Idempotency tests
- Concurrency/double-spend tests
- Ledger balance consistency tests

---

## Definition of Done (100%)
- [ ] Gift package catalog is fully managed in Admin Dashboard.
- [ ] Customer can recharge wallet using gift packages.
- [ ] Customer can send gift package to another user by phone/email.
- [ ] Recipient gets credited wallet + notification.
- [ ] Wallet payment works for service bookings and product purchases.
- [ ] Wallet ledger provides full audit trail for all credits/debits.
- [ ] E2E test suite and operational monitoring are in place.

---

## Out of Scope (Current Release)
- WhatsApp delivery channel (design for future support only).
- Multi-currency wallet.
- Cross-tenant wallet transfer settlement.

---

## Suggested File for Progress Updates
- Update this file phase-by-phase after each delivery and push.
