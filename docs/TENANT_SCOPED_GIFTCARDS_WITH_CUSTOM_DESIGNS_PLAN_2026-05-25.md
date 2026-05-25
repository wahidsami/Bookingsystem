# TENANT GIFT CARDS WITH CUSTOM VISUAL DESIGNS - IMPLEMENTATION PLAN (2026-05-25)

## 1) Goal
Enable each tenant center to create and sell its own gift cards with custom visuals (uploaded card artwork), and allow customers to buy/use those cards only inside that tenant center.

This is separate from global/platform gift cards.

## 2) Core Product Rules
1. Every tenant gift card package belongs to exactly one tenant (`tenantId`).
2. A tenant gift card balance can only be redeemed for:
   - services of the same tenant
   - products of the same tenant
3. Tenant gift card balance cannot be used in any other tenant checkout.
4. Tenant admin can upload custom visual artwork per gift card package.
5. Customer sees tenant gift cards inside that tenant page as a dedicated tab.

## 3) UX Scope

## 3.1 Tenant Dashboard
New section under tenant dashboard: `Marketing > Gift Cards` (or `Catalog > Gift Cards`, confirm final IA).

Tenant admin actions:
- Create gift card package
- Upload gift card design image (cover artwork)
- Set card title (EN/AR)
- Set description (EN/AR)
- Set payable amount and wallet credit amount
- Optional bonus amount
- Set active period (start/end)
- Set quantity/availability controls (optional phase 2)
- Activate/deactivate package
- View package sales and redemptions

## 3.2 Customer App
On tenant profile page, add tab: `Gift Cards`.

Customer actions:
- Browse tenant gift cards with visual cards
- Open package details modal/screen
- Choose:
  - Add to my wallet (tenant-scoped balance)
  - Send as gift (phone/email)
- Complete payment (existing fake gateway now, real gateway later)
- See success state and balance update

Card visual behavior:
- Large image-first card layout
- Overlay title + value chips
- Badge for bonus/limited time
- Fallback artwork if tenant did not upload image

## 4) Data Model

## 4.1 New Tables

### A) `tenant_gift_card_packages`
- `id UUID PK`
- `tenantId UUID FK -> tenants.id`
- `title_en VARCHAR(255) NOT NULL`
- `title_ar VARCHAR(255) NOT NULL`
- `description_en TEXT NULL`
- `description_ar TEXT NULL`
- `priceAmount NUMERIC(10,2) NOT NULL`
- `walletCreditAmount NUMERIC(10,2) NOT NULL`
- `bonusAmount NUMERIC(10,2) NOT NULL DEFAULT 0`
- `imageUrl VARCHAR(1000) NULL`  <-- tenant uploaded visual design
- `thumbnailUrl VARCHAR(1000) NULL` (optional for optimized list loading)
- `displayOrder INT NOT NULL DEFAULT 0`
- `isActive BOOLEAN NOT NULL DEFAULT TRUE`
- `startsAt TIMESTAMPTZ NULL`
- `endsAt TIMESTAMPTZ NULL`
- `createdByTenantUserId UUID NULL`
- `createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:
- `(tenantId, isActive)`
- `(tenantId, displayOrder)`
- `(startsAt, endsAt)`

### B) `tenant_gift_card_transactions`
- `id UUID PK`
- `tenantId UUID FK -> tenants.id`
- `packageId UUID FK -> tenant_gift_card_packages.id`
- `senderPlatformUserId UUID NULL FK -> platform_users.id`
- `recipientPlatformUserId UUID NULL FK -> platform_users.id`
- `recipientEmail VARCHAR(255) NULL`
- `recipientPhone VARCHAR(64) NULL`
- `purchaseAmount NUMERIC(10,2) NOT NULL`
- `creditAmount NUMERIC(10,2) NOT NULL`
- `bonusAmount NUMERIC(10,2) NOT NULL DEFAULT 0`
- `totalCreditAmount NUMERIC(10,2) NOT NULL`
- `status ENUM(...) NOT NULL`
- `deliveryChannel ENUM(...) NOT NULL`
- `claimToken VARCHAR(255) NULL`
- `claimedAt TIMESTAMPTZ NULL`
- `expiresAt TIMESTAMPTZ NULL`
- `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
- `createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:
- `(tenantId, status)`
- `(senderPlatformUserId)`
- `(recipientPlatformUserId)`
- `(claimToken)`

### C) `tenant_wallet_ledger_entries`
(If reusing existing wallet ledger, add `tenantId` nullable column and scope rules. If separation preferred, create dedicated table.)

Recommended fields:
- `id UUID PK`
- `platformUserId UUID`
- `tenantId UUID`  <-- mandatory for tenant gift wallet entries
- `type ENUM(...)` (tenant gift credit/debit/refund/adjust)
- `direction ENUM(credit,debit)`
- `amount NUMERIC(10,2)`
- `balanceBefore NUMERIC(10,2)`
- `balanceAfter NUMERIC(10,2)`
- `referenceType VARCHAR(64)`
- `referenceId VARCHAR(128)`
- `metadata JSONB`
- timestamps

Critical index:
- `(platformUserId, tenantId, createdAt)`

## 4.2 Optional Aggregated Balance Table
`tenant_wallet_balances`
- `platformUserId`
- `tenantId`
- `balance`
- `updatedAt`
Composite PK: `(platformUserId, tenantId)`

This improves checkout speed.

## 5) Backend APIs

## 5.1 Tenant Dashboard APIs
- `POST /tenant/gift-cards/packages`
- `PUT /tenant/gift-cards/packages/:id`
- `GET /tenant/gift-cards/packages`
- `PATCH /tenant/gift-cards/packages/:id/active`
- `POST /tenant/gift-cards/packages/:id/image` (upload visual)
- `GET /tenant/gift-cards/reports/summary`
- `GET /tenant/gift-cards/reports/transactions`

## 5.2 Public/Customer APIs
- `GET /public/tenant/:tenantId/gift-cards`
- `POST /gift-cards/tenant/purchase`
- `POST /gift-cards/tenant/claim`
- `GET /wallet/tenant-balances?tenantId=...`
- `GET /wallet/tenant-ledger?tenantId=...`

## 5.3 Checkout Enforcement API Logic (Critical)
At service/product payment endpoint:
- If payment method = tenant wallet/gift:
  1. Resolve checkout `tenantId`
  2. Load customer balance for same `tenantId`
  3. Reject if tenant mismatch or insufficient balance

Error message:
- `This gift balance belongs to another center and cannot be used here.`

## 6) Visual Design Upload Pipeline

## 6.1 Upload Constraints
- Accepted: `.jpg`, `.jpeg`, `.png`, `.webp`
- Max size: 3-5 MB (configurable)
- Recommended ratio: 16:9 (e.g., 1200x675) or card ratio 1.586:1
- Server-side validation for MIME and dimensions

## 6.2 Storage
- Store in existing uploads bucket/path, e.g.:
  - `/uploads/tenant-gift-cards/{tenantId}/{packageId}/cover.webp`
- Save URL in `imageUrl`

## 6.3 Optimization
- Generate thumbnail for list grids
- WebP conversion optional
- Preserve original optional for future editing

## 6.4 Frontend Rendering
- Gradient overlay for text readability
- Rounded card corners
- Loading skeleton
- Fallback default branded card if image missing

## 7) Customer App UI Design Requirements

## 7.1 Tenant Page Tab
- Tab label: `Gift Cards`
- Position: after services/products/reviews (final order to confirm)

## 7.2 Card Component
Show:
- Background image (tenant uploaded design)
- Title
- `Pay X SAR` + `Get Y SAR`
- Bonus chip (`+10 SAR bonus`) if applicable
- Validity chip (`Ends in 3 days`) if time-limited

## 7.3 Package Details Modal
Contains:
- Large image
- bilingual title/description
- payment/credit/bonus breakdown
- CTA buttons:
  - `Add to My Wallet`
  - `Send Gift`

## 7.4 Send Gift Flow
Fields:
- recipient method selector (email/phone)
- recipient value
- optional message

## 8) Tenant Dashboard UI Requirements

## 8.1 Gift Card Builder Form
- Title EN/AR
- Description EN/AR
- Price
- Credit
- Bonus
- Active toggle
- Start/End dates
- Upload artwork button + preview

## 8.2 Package List
- Card thumbnail preview
- Title/value
- Active status
- Sales count and revenue quick chips
- Edit / deactivate actions

## 8.3 Reporting
- Total sold amount
- Total credited amount
- Total redeemed amount
- Outstanding liability (unspent balance)
- Top packages by sales

## 9) Security & Abuse Controls
- Tenant cannot create/edit package for another tenant
- All package CRUD scoped by auth tenant
- Server validates `tenantId` ownership on every operation
- Purchase and redemption idempotency keys
- Ledger transaction atomicity (DB transaction/row lock)

## 10) Payment Integration Strategy
Phase 1:
- Use existing fake payment gateway endpoint to complete purchase simulation
- Mark purchase successful and credit tenant wallet ledger

Phase 2:
- Replace payment simulator with real PSP flow
- Keep same gift-card domain APIs

## 10.1 Money Flow and Settlement (Critical)
1. Customer pays through the unified payment gateway (fake gateway in phase 1).
2. Funds are recorded first as platform-collected money (clearing model).
3. Wallet credit is issued to:
   - sender (self purchase), or
   - recipient (gift send/claim),
   always scoped to the same tenant.
4. Tenant payout is not assumed as instant transfer; it is tracked as payable.

Required settlement fields per tenant gift purchase:
- `grossAmount` (what customer paid)
- `platformFeeAmount` (if any)
- `netTenantPayableAmount`
- `tenantId`
- `transactionId`
- `packageId`
- `settlementStatus` (`pending`, `partially_settled`, `settled`)
- `settledAt`

## 10.2 Reporting Requirements (Admin + Tenant)
Platform admin report (all tenants):
- total gross sales by tenant
- total net payable by tenant
- total settled vs pending
- transaction-level export (CSV)
- payout-ready summary: \"amount to transfer per tenant\"

Tenant report (single tenant scope):
- package sales count
- gross sold amount
- redeemed amount
- outstanding liability (unused wallet credit)
- net payable to tenant
- settlement history/status

Both reports use same calculation logic; visibility differs by role scope.

## 11) Notifications

Phase 1 (current channel):
- Email notification on successful purchase/sending/claim

Phase 2:
- WhatsApp + push notifications

Notification examples:
- `You received a gift card of 100 SAR from <sender>.`
- `Your gift card purchase for <tenant> is successful.`

## 12) Rollout Phases

## Phase A - Foundation
- DB schema and migrations
- tenant-scoped ledger logic
- checkout enforcement by tenant

## Phase B - Tenant Dashboard Management
- package CRUD
- image upload + preview
- active window controls

## Phase C - Customer App Experience
- tenant page gift tab
- card list UI with visuals
- purchase/send/claim flows

## Phase D - Reporting & Reconciliation
- tenant-level reports
- admin audit view (optional)

## Phase E - Hardening
- QA matrix
- edge cases
- load checks

## 13) QA Checklist (Critical)
1. Tenant A package appears only on Tenant A page.
2. Customer buys Tenant A gift card -> Tenant A wallet balance increases.
3. Tenant A gift balance works in Tenant A checkout.
4. Tenant A gift balance fails in Tenant B checkout.
5. Send gift by email/phone and claim flow updates correct recipient.
6. Deactivated/expired package cannot be purchased.
7. Uploaded design appears in customer card and tenant list.
8. Missing design falls back to default card visual.

## 14) Migration Scripts Needed
1. Create tenant gift card package table.
2. Create tenant gift card transactions table.
3. Add tenant scope to wallet ledger (or create tenant wallet ledger).
4. Add indexes for tenant+user ledger queries.

## 15) Definition of Done
- Tenant can create visual gift card packages with uploaded artwork.
- Customer can discover and buy from tenant page tab.
- Funds are credited to tenant-scoped wallet balance.
- Balance can only be redeemed in same tenant checkout.
- Reporting is available for tenant operations.
- QA checklist fully passes on web + mobile.

## 16) Phase Tracking
- [x] Phase A - Foundation
- [ ] Phase B - Tenant Dashboard Management
- [ ] Phase C - Customer App Experience
- [ ] Phase D - Reporting & Reconciliation
- [ ] Phase E - Hardening
