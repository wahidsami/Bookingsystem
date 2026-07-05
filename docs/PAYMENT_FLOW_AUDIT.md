# Payment Flow Audit

Audit scope: appointment payment pipeline in production tenant and V2 appointment checkout flow.

Status: certified after fix.

## Verdict

The appointment payment pipeline now persists through the backend transaction chain without relying on optimistic UI state.

One persistence gap was identified and fixed:

- Wallet-funded appointment payments now create a real `WalletLedgerEntry` record instead of only decrementing `PlatformUser.walletBalance`.
- Customer history and transaction endpoints now return wallet movements, so the customer drawer and history views stay consistent after refresh.
- The appointment workspace now waits for backend confirmation and re-fetches the appointment before reflecting the final paid state.
- Wallet refunds now also create a ledger entry instead of only incrementing the balance.
- Late cancellation and no-show status changes now propagate an outstanding-balance charge through finance, reports, analytics, and history.

No SQL migration scripts were required.

## What Was Verified

1. Payment success updates invoice status.
2. Appointment payment state persists in the database.
3. Wallet balance is updated through a ledgered mutation.
4. Wallet transaction history is written.
5. Finance rows are created in the canonical `transactions` table.
6. Reports can read the same transaction source as finance.
7. Dashboard KPIs read from persisted appointment and revenue state.
8. Customer wallet history now includes the payment movement.
9. Customer profile wallet balance reflects the saved value.
10. Appointment details refresh from the backend after payment.
11. Page refresh continues to show the persisted state.
12. No success toast is shown before backend confirmation.
13. Late cancellation and no-show charges now create persisted finance rows.

## Payment Mutation Chain

### Primary payment mutation

- `PATCH /api/v1/tenant/appointments/:id/payment`

Responsible for:

- updating appointment payment status
- updating `totalPaid`, `paidAt`, `depositPaid`, `remainderPaid`, `paymentMethod`
- creating appointment payment ledger rows
- creating finance `Transaction` rows
- creating appointment audit/history events
- triggering invoice creation or refresh

### Checkout companion mutation

- `POST /api/v1/tenant/cart/products/purchase`

Responsible for:

- persisting product purchase totals
- creating product purchase finance rows
- keeping appointment checkout and retail purchase flows aligned

## Read Paths Confirmed

### Appointment refresh

- `GET /api/v1/tenant/appointments/:id`

Used to rehydrate the appointment drawer after payment confirmation.

- `GET /api/v1/tenant/appointments/board`

Used to refresh the board and remove stale local state.

### Customer profile and history

- `GET /api/v1/tenant/customers/:id`

Used for customer identity, wallet balance, summary metrics, and ledger totals.

- `GET /api/v1/tenant/customers/:id/history`

Used for the contextual drawer timeline.

- `GET /api/v1/tenant/customers/:id/transactions`

Used for the customer transaction feed and "View All" behavior.

### Dashboard and reporting consumers

- `GET /api/v1/tenant/dashboard/stats`
- `GET /api/v1/tenant/financial/overview`
- `GET /api/v1/tenant/financial/ledger`
- `GET /api/v1/tenant/financial/landing-summary`
- `GET /api/v1/tenant/financial/invoices/:id`
- `GET /api/v1/tenant/reports/summary`
- `GET /api/v1/tenant/reports/full`
- `GET /api/v1/tenant/reports/payment-methods`

These consumers read persisted appointment revenue and transaction rows, so they update automatically once the payment mutation commits.

## Backend Persistence Details

### Appointment payment status

Stored on the appointment record via `PATCH /api/v1/tenant/appointments/:id/payment`.

### Invoice state

Refreshed after the appointment payment transaction commits through invoice generation helpers.

### Finance and reports

Persisted through the canonical `transactions` table, which is the source for financial and reporting consumers.

### Wallet balance

Persisted through `WalletLedgerEntry` and `PlatformUser.walletBalance`.

### Customer history

Now includes wallet transactions in addition to appointments and orders.

## Fixes Applied

1. Replaced the raw wallet balance decrement in appointment split-payment handling with a real wallet ledger mutation.
2. Added wallet transaction rows to the customer history and transaction APIs.
3. Removed optimistic appointment completion state from the V2 checkout flow.
4. Rehydrated the appointment drawer from the backend after payment confirmation.
5. Deduplicated customer transaction rendering so wallet rows do not double-count in the drawer.

## Endpoint-by-Endpoint Status

| Endpoint | Role | Status |
|---|---|---|
| `PATCH /api/v1/tenant/appointments/:id/payment` | Primary payment mutation | Pass |
| `POST /api/v1/tenant/cart/products/purchase` | Retail checkout companion | Pass |
| `GET /api/v1/tenant/appointments/:id` | Appointment rehydration | Pass |
| `GET /api/v1/tenant/appointments/board` | Board refresh | Pass |
| `GET /api/v1/tenant/customers/:id` | Customer profile snapshot | Pass |
| `GET /api/v1/tenant/customers/:id/history` | Timeline and wallet history | Pass |
| `GET /api/v1/tenant/customers/:id/transactions` | Transaction feed / view all | Pass |
| `GET /api/v1/tenant/dashboard/stats` | KPI consumer | Pass |
| `GET /api/v1/tenant/financial/overview` | Finance consumer | Pass |
| `GET /api/v1/tenant/financial/ledger` | Finance ledger consumer | Pass |
| `GET /api/v1/tenant/reports/summary` | Reports consumer | Pass |
| `GET /api/v1/tenant/reports/full` | Reports consumer | Pass |

## Notes

- No backend contract changes were introduced.
- No database column additions were required.
- The payment flow now relies on persisted backend state rather than local UI assumptions.
