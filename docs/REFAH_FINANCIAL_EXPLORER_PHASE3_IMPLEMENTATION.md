# REFAH Financial Explorer Initiative - Phase 3

## Financial Ledger Workspace

### Objective

Create a dedicated financial explorer workspace without changing existing finance, reports, or export calculations.

### What Was Added

1. A new ledger route at `tenant/src/app/[locale]/dashboard/financial/ledger/page.tsx`
2. A new finance API action: `GET /api/v1/tenant/financial/ledger`
3. A finance dashboard entry point that links to the ledger workspace
4. A reusable enterprise-style table experience using `AnalyticsDataTable`
5. A reusable drill-down drawer using `AnalyticsDetailsDrawer`

### Reused Datasets

| Ledger Section | Reused Sources | Notes |
| --- | --- | --- |
| Revenue Ledger | `PaymentTransaction`, `Appointment`, `Order`, `Service`, `PlatformUser` | Built from existing finance transactions without changing revenue calculations |
| Payment Ledger | `PaymentTransaction`, `Appointment`, `Order` | Shows payment movements and source records |
| Refund Ledger | `PaymentTransaction`, `Appointment`, `Order` | Uses existing refund transactions and reason fields |
| Commission Ledger | `getEmployeeRevenue`, `StaffPayroll`, `Staff` | Reuses current commission and payroll calculations |
| Settlement Ledger | `PaymentTransaction` | Aggregates daily gross, refunds, cash, card, and wallet totals from existing transactions |

### Screens Affected

1. Finance workspace
   - Added a `Ledger workspace` entry point
2. Ledger workspace
   - New dedicated explorer page
3. Finance detail experience
   - Reuses the existing drill-down drawer pattern

### New API

1. `GET /api/v1/tenant/financial/ledger`

This endpoint returns:

1. `overview`
2. `revenueLedger`
3. `paymentLedger`
4. `refundLedger`
5. `commissionLedger`
6. `settlementLedger`
7. `dateRange`

### Regression Rules

1. Existing finance workspace remains unchanged.
2. Existing reports workspace remains unchanged.
3. Existing export behavior remains unchanged.
4. No accounting or revenue logic was modified.
5. No commission logic was modified.

### Verification Checklist

1. Finance dashboard opens normally.
2. Reports workspace opens normally.
3. Ledger workspace opens from finance.
4. Ledger tables support search, sort, and pagination.
5. Row click opens drill-down drawer.
6. CSV export works from the ledger workspace.
7. Excel export works from the ledger workspace.
8. Existing reports export continues to work.

### Production Deployment Note

After merging and redeploying the backend and tenant dashboard:

1. Redeploy `refah_api`
2. Redeploy `rtenant`
3. Open `Finance -> Ledger workspace`
4. Validate the five ledgers and the drill-down drawer

