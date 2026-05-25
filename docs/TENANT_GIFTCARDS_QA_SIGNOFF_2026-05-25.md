# Tenant Gift Cards QA Sign-off (2026-05-25)

## Scope
- Tenant-scoped gift card packages (tenant dashboard)
- Customer purchase/send/claim flows (customer app)
- Tenant-scoped wallet credit and tenant-only usage rule
- Tenant reporting and CSV export

## Environment Preconditions
- Tenant gift-card schema exists in DB:
  - `tenant_gift_card_packages`
  - `tenant_gift_card_transactions`
  - `tenant_wallet_balances`
  - `tenant_wallet_ledger_entries`
  - `tenant_gift_card_settlements`
- API deployed on commit >= `3f989ca`
- Tenant app deployed on commit >= `e48339e`
- Customer app build includes commit >= `3f989ca`

## Functional Checklist
- [ ] Tenant can create a gift package with EN/AR title and pricing.
- [ ] Tenant can upload package image and see it in package list.
- [ ] Tenant can deactivate package and package disappears from customer tenant gift list.
- [ ] Tenant can reactivate package and package reappears in customer tenant gift list.
- [ ] Tenant can export gift transactions CSV from dashboard.
- [ ] Customer can open tenant page and see `Gift Cards` tab when packages exist.
- [ ] Customer can buy tenant gift for self with fake payment card.
- [ ] Self-purchase credits tenant-scoped wallet balance.
- [ ] Customer can send tenant gift to recipient email/phone.
- [ ] Existing recipient receives tenant gift credit directly.
- [ ] New recipient can claim by token link and receive credit.
- [ ] Gifts history appears in customer gifts screen.
- [ ] Status labels and dates are localized in customer gifts history.

## Isolation & Security Checklist
- [ ] Tenant gift APIs never write into global `gift_card_*` tables.
- [ ] Global gift purchase never writes into `tenant_*` gift tables.
- [ ] Tenant A package is not visible under Tenant B page.
- [ ] Tenant A gift wallet balance cannot be used in Tenant B checkout.
- [ ] Tenant dashboard endpoints are tenant-owner scoped.

## Settlement & Reporting Checklist
- [ ] Every successful tenant gift purchase creates a settlement row.
- [ ] Settlement row contains gross, fee, net payable, and status.
- [ ] Tenant summary report shows gross sales and pending/settled totals.
- [ ] CSV export includes settlement columns.

## Smoke Test Cards (Fake Gateway)
- Success: any normal valid card
- Declined: `4000000000000002`
- Insufficient funds: `4000000000009995`

## Sign-off
- QA Owner:
- Date:
- Result: PASS / FAIL
- Notes:
