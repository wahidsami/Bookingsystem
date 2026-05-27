# GIFTCARD_EXTERNAL_REDEEM_AND_POS_PAYMENT_IMPLEMENTATION_PLAN_2026-05-27

## 1) Objective
Implement a unified gift card sending and redemption mechanism for both:
1. `Admin gift cards` (usable at any center)
2. `Tenant gift cards` (usable only at issuing center)

with the following behavior:
1. If recipient is a registered Refah customer: auto-credit recipient wallet.
2. If recipient is not registered: send branded email gift card with redeemable code.
3. In tenant dashboard POS: add `Pay using gift card` option by entering code.

## 2) Core Business Rules
1. Admin gift card scope: `global` (all tenants).
2. Tenant gift card scope: `tenant-scoped` (single issuing tenant only).
3. Recipient lookup by normalized email/phone before deciding delivery path.
4. Gift codes are unique, secure, expirable, and auditable.
5. Partial redemption is supported; remaining balance stays on same code.
6. All balance mutations must be atomic and concurrency-safe.

## 3) Lifecycle States
## 3.1 Gift Transaction Status
1. `purchased`
2. `sent_pending_claim` (external recipient, code issued)
3. `sent_completed_auto_wallet` (existing Refah user credited)
4. `partially_redeemed`
5. `redeemed`
6. `expired`
7. `cancelled`

## 3.2 Gift Code Status
1. `issued`
2. `partially_redeemed`
3. `redeemed`
4. `expired`
5. `cancelled`

## 4) Data Model Changes
## 4.1 New Table: `gift_card_codes`
Fields:
1. `id` UUID PK
2. `code` VARCHAR unique (human-friendly, secure)
3. `scopeType` ENUM (`admin_global`, `tenant_scoped`)
4. `tenantId` UUID nullable (required for tenant-scoped)
5. `sourceTransactionId` UUID not null
6. `sourceType` ENUM (`admin_gift_transaction`, `tenant_gift_transaction`)
7. `initialAmount` NUMERIC(10,2)
8. `remainingAmount` NUMERIC(10,2)
9. `currency` VARCHAR(8) default `SAR`
10. `recipientEmail` VARCHAR nullable
11. `recipientPhone` VARCHAR nullable
12. `status` ENUM (`issued`,`partially_redeemed`,`redeemed`,`expired`,`cancelled`)
13. `expiresAt` TIMESTAMPTZ nullable
14. `metadata` JSONB default `{}`
15. `createdAt`, `updatedAt`

Indexes:
1. unique index on `code`
2. index on `status`
3. index on `tenantId`
4. index on `expiresAt`

## 4.2 New Table: `gift_card_code_redemptions`
Fields:
1. `id` UUID PK
2. `giftCardCodeId` UUID FK
3. `tenantId` UUID not null (where redeemed)
4. `appointmentId` UUID nullable
5. `orderId` UUID nullable
6. `posInvoiceId` UUID nullable
7. `redeemedAmount` NUMERIC(10,2)
8. `remainingAfter` NUMERIC(10,2)
9. `redeemedByStaffId` UUID nullable
10. `metadata` JSONB default `{}`
11. `createdAt`, `updatedAt`

Indexes:
1. index on `giftCardCodeId`
2. index on `tenantId`
3. index on `appointmentId`
4. index on `orderId`

## 4.3 Existing Transaction Tables
Add/confirm fields in:
1. `gift_card_transactions`
2. `tenant_gift_card_transactions`

Required fields:
1. `deliveryMode` ENUM (`auto_wallet`,`external_code`)
2. `giftCardCodeId` UUID nullable
3. `recipientResolvedPlatformUserId` UUID nullable

## 5) Send Flow Logic
1. Customer selects package + send mode + recipient info.
2. Backend normalizes recipient contact:
   - lowercased trimmed email
   - normalized phone format
3. Lookup recipient in Refah users.
4. If recipient found:
   - credit appropriate wallet immediately
   - mark transaction `sent_completed_auto_wallet`
   - create ledger entries
   - send in-app/email notification
5. If recipient not found:
   - generate gift code (`gift_card_codes`)
   - mark transaction `sent_pending_claim`
   - send branded email card containing code + amount + expiry + terms

## 6) POS Payment Flow (Tenant Dashboard)
## 6.1 UI
In POS payment methods add:
1. `Pay using gift card`

When selected:
1. Show input: `Gift card code`
2. Validate button
3. Show result panel:
   - card type (`Admin` / `Tenant`)
   - available balance
   - expiry
   - scope notice
4. Staff enters amount to apply (default min of due and remaining).

## 6.2 Validation Rules
1. Code exists and active.
2. Not expired/cancelled/redeemed.
3. If tenant-scoped: `tenantId` must match current tenant.
4. Applied amount <= remainingAmount.
5. Atomic update with row lock (`SELECT ... FOR UPDATE`).

## 6.3 Settlement
1. Redemption updates `remainingAmount`.
2. Create `gift_card_code_redemptions` record.
3. Create wallet/ledger records.
4. Update linked order/appointment payment status.

## 7) Email Gift Card Design + Content
Email must include:
1. Visual gift card layout (tenant or Refah branded)
2. Gift code (clear and copyable)
3. Amount and currency
4. Card type and usage scope
5. Expiry date
6. Redemption instructions:
   - “Present this code at center payment”
7. Legal terms + support link

## 8) API Contracts (Proposed)
1. `POST /users/gifts/send`
2. `POST /users/tenant-gifts/send`
   - upgraded recipient resolution + fallback code generation
3. `POST /tenant/pos/gift-cards/validate`
   - input: code, tenantId
   - output: validity + scope + remaining + expiry
4. `POST /tenant/pos/gift-cards/redeem`
   - input: code, tenantId, amount, context (appointment/order)
   - output: applied amount, remaining, updated payment status
5. `GET /tenant/gift-cards/redemptions/report`
6. `GET /admin/gift-cards/redemptions/report`

## 9) Security & Reliability
1. Gift code generation:
   - cryptographically secure random
   - collision-safe with retry
2. Rate limit validate/redeem endpoints.
3. Locking/transactions for redemption to prevent double spend.
4. Audit log all validation/redeem attempts.
5. Hide sensitive recipient info in logs/UI.

## 10) Reporting Requirements
## 10.1 Tenant Reports
1. Issued tenant cards count/value
2. Redeemed count/value
3. Remaining liability
4. Expired/cancelled cards
5. Redemption source (POS/appointment/order)

## 10.2 Admin Reports
1. Admin global card issuance and redemption totals
2. Tenant card issuance and redemption across tenants
3. Outstanding liabilities by tenant
4. Settlement/payable summaries

## 11) Implementation Phases
## Phase A: Schema + Domain Foundation
1. Create new code and redemption tables
2. Add transaction fields
3. Add enums/indexes

Exit Criteria:
1. Migration successful
2. No regression in current gift purchase flows

## Phase B: Send Flow Upgrade
1. Recipient existence resolution
2. Auto-wallet route for existing users
3. External code + email route for non-existing users

Exit Criteria:
1. Both routes functional
2. Correct transaction statuses

## Phase C: POS Validate/Redeem
1. Add backend validate/redeem APIs
2. Add tenant dashboard POS payment option and UI
3. Wire payment status updates

Exit Criteria:
1. Staff can redeem both card types correctly
2. Scope rules enforced

## Phase D: Reporting + Settlement
1. Admin + tenant report endpoints/UI tables
2. Liability and redemption summaries

Exit Criteria:
1. Stakeholders can audit full lifecycle

## Phase E: Hardening & QA
1. Concurrency tests
2. Rate limiting and abuse checks
3. E2E tests for all scenarios

Exit Criteria:
1. Production sign-off

## 12) Test Matrix
1. Send admin card to registered recipient -> wallet credit
2. Send admin card to non-registered recipient -> email code
3. Redeem admin code in tenant A POS
4. Redeem same admin code partially in tenant B POS
5. Send tenant card to registered recipient -> tenant wallet credit
6. Send tenant card to non-registered recipient -> email code
7. Redeem tenant code in issuing tenant POS (success)
8. Redeem tenant code in different tenant POS (fail)
9. Expired code redemption (fail)
10. Double-redeem race condition (second fails safely)

## 13) Open Decisions
1. External code expiry default (recommended: 12 months)
2. Can external code be split across multiple visits? (recommended: yes)
3. Refund behavior after code redemption (full/partial policy)
4. Whether to allow recipient account claim later to auto-convert remaining code balance to wallet

## 14) Current Recommendation
1. Implement Phase A + B first to unlock sending correctness.
2. Then Phase C for POS redemption.
3. Release after Phase E tests pass.

## 15) Progress Tracker (Updated 2026-05-27)
1. `Phase A` Completed
2. `Phase B` Completed
3. `Phase C` Completed
4. `Phase D` Completed
5. `Phase E` Completed
