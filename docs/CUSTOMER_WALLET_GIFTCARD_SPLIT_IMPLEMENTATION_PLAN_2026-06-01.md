# Customer Wallet + Gift Card Split Implementation Plan (2026-06-01)

## Objective
Implement a clean and strict separation of customer balances into:
1. `Wallet` (user prepaid platform credit)
2. `Rafah Gift Card` (platform-wide gift card liability)
3. `Salon Gift Card` (tenant-scoped gift card liability)

This plan is designed to preserve existing behavior while introducing safer accounting, clearer UX, and strict redemption rules.

---

## Product Rules (Source of Truth)

### 1) Wallet
- User-loaded credit.
- Usable across all eligible bookings/orders in platform.
- Not tied to a specific tenant.

### 2) Rafah Gift Card
- Issued as platform gift.
- Usable across all tenants (subject to generic gift rules).
- Separate liability from wallet.

### 3) Salon Gift Card
- Issued by one tenant.
- Redeemable only for that same tenant.
- Separate liability from wallet and platform gift card.

---

## Current State Snapshot

Already present in codebase:
- Global gifts APIs: `/users/gifts/*`
- Tenant gifts APIs: `/users/tenant-gifts/*`
- Tenant wallet ledger/service exists.

Current gaps:
- UX still mixes concerns in one view.
- Checkout priority/eligibility logic needs strict, unified server-side enforcement.
- Reporting and settlements need explicit ownership/liability buckets.

---

## Target Architecture

## A) Domain Model
- `wallet_balance` (platform user credit)
- `platform_gift_balance` (credit from Rafah gift cards)
- `tenant_gift_balance` (credit per user per tenant)

Ledger ownership:
- `wallet_ledger_entries` -> `wallet_balance`
- `gift_card_transactions` + `gift_card_codes` -> `platform_gift_balance` related events
- `tenant_gift_card_transactions` + `tenant_gift_card_packages` + `tenant_wallet_ledger_entries` -> tenant gift events

## B) Checkout Engine
Server computes applicable sources by context:
- If checkout tenant is `T`:
1. Wallet: always eligible (if > 0)
2. Platform gift: eligible (if > 0)
3. Tenant gift: only entries scoped to tenant `T`
4. Online payment fallback

Never trust client-only filtering; backend eligibility is mandatory.

---

## Data & Schema Plan

## Phase D1: Explicit Balance Buckets
- Add/confirm typed source tags in ledgers:
  - `wallet_topup`, `wallet_spend`
  - `platform_gift_credit`, `platform_gift_redeem`
  - `tenant_gift_credit`, `tenant_gift_redeem`

- Ensure all transaction metadata includes:
  - `sourceType`: `wallet | platform_gift | tenant_gift`
  - `tenantId` when `tenant_gift`
  - `giftTransactionId` / `giftCodeId` when relevant

## Phase D2: Reporting Views
- Add DB views/materialized queries for:
  - Platform gift liabilities outstanding
  - Tenant gift liabilities outstanding per tenant
  - Expiry pipeline (next 7/30/60 days)

## Migration Safety
- Backfill legacy rows with inferred `sourceType`.
- Keep idempotent SQL scripts.
- Run in read-only verify mode first (counts, sums, sample joins).

---

## API Plan

## Phase A1: Read APIs (no behavior break)
- `GET /users/wallet/summary`
  - returns `walletBalance`, `platformGiftBalance`, `tenantGiftBalances[]`

- `GET /users/gifts/history` (platform only)
- `GET /users/tenant-gifts/history?tenantId=...` (tenant scoped)

## Phase A2: Checkout Eligibility API
- `GET /payments/sources?tenantId=...&amount=...`
  - returns ordered eligible sources:
    - wallet
    - eligibleGiftCards (platform + tenant-matching)
    - online

## Phase A3: Redemption APIs
- `POST /payments/apply-source`
  - validates source ownership + scope server-side
  - rejects tenant mismatch with explicit message

---

## Mobile UX Plan (Customer App)

## Phase U1: Wallet & Gift Screen Restructure
Replace mixed block with explicit cards/tabs:
1. Wallet
2. Rafah Gift Cards
3. Salon Gift Cards

Each section shows:
- available balance
- claim/redeem actions
- section-specific history

## Phase U2: Gift Send Flow
- Recipient lookup by email OR phone.
- If account exists:
  - show recipient confirmation card (masked details)
  - send in-app + optional email receipt
- If no account:
  - prompt: send by email instead?
  - require email before submit

## Phase U3: Checkout UI
- Show only eligible sources from backend.
- Tenant gift cards hidden automatically if tenant mismatch.
- Clear labels:
  - `Wallet`
  - `Rafah Gift Card`
  - `Salon Gift Card (Tenant Name)`

---

## Tenant Dashboard Plan

## Phase T1: Tenant Gift Management
- Keep salon gift lifecycle in tenant dashboard only:
  - create package
  - active/inactive
  - issue/report/redeem history

## Phase T2: Liability Dashboard
- Cards:
  - issued value
  - redeemed value
  - remaining liability
  - expiring soon

---

## Code Quality Standards

## Backend
- Controller thin, service-first design.
- Typed constants for status/source values.
- Transaction boundaries on all purchase/send/claim actions.
- All early returns in transactions must rollback/commit safely.
- Structured logging for gift flows (`eventType`, `tenantId`, `giftTxId`, `channel`).

## Mobile
- Single source currency formatting utility.
- Centralized popup/dialog components.
- Strict error-state UX (actionable and localized).
- Keep API response parsing defensive (null-safe).

---

## QA & Test Strategy

## Unit Tests
- Recipient lookup logic (email/phone variants).
- Eligibility function (tenant match rules).
- Ledger posting by source type.
- Expiry/claim status transitions.

## Integration Tests
- Send gift to existing user -> wallet credit + push.
- Send gift to non-existing user -> email code path.
- Claim flow success/expired/invalid token.
- Tenant mismatch redemption blocked.

## E2E (Mobile)
- Wallet/Gift tabs visibility and balances.
- Checkout source ordering and restrictions.
- History correctness per section.

---

## Rollout Plan

## Step 1: Backend additive changes
- New read APIs + source tagging + eligibility endpoint.
- Keep old endpoints functional.

## Step 2: Mobile incremental switch
- Feature flag `wallet_gift_split_v2`.
- Route new UI to new endpoints.

## Step 3: Checkout enforcement
- Turn on strict backend source validation.

## Step 4: Reporting and reconciliation
- Enable tenant liability dashboards.
- Weekly reconciliation reports for first month.

## Step 5: Legacy cleanup
- Remove deprecated mixed assumptions after stable period.

---

## Risk Register
- Misclassified legacy rows -> mitigate with backfill dry-run + reconciliation scripts.
- Client/server mismatch in eligibility -> backend authoritative checks only.
- Notification/email deliverability issues -> keep fallback logs + retry policy.
- Localization drift -> lock key strings and review both EN/AR.

---

## Deliverables Checklist
- [ ] DB migration scripts + backfill + verification SQL
- [ ] Backend APIs for summary/history/eligibility/redemption
- [ ] Mobile split UI (Wallet / Rafah Gift / Salon Gift)
- [x] Checkout integration with backend-driven payment sources
- [ ] Tenant liability reporting widgets
- [ ] Test suite updates (unit/integration/e2e)
- [ ] Rollout playbook + rollback plan

---

## Implementation Notes for Current Repo
- Reuse existing:
  - `server/src/controllers/userGiftController.js`
  - `server/src/controllers/userTenantGiftController.js`
  - `server/src/services/walletService.js`
  - `server/src/services/tenantWalletService.js`
  - `RifahMobile/src/screens/GiftsScreen.tsx`

- Introduce new shared constants:
  - `server/src/constants/giftSources.js`
  - `server/src/constants/paymentSourcePriority.js`

- Add endpoint docs in project docs once APIs are finalized.
