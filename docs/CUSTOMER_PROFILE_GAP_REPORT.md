# Customer Profile Gap Report

## Scope

Customer Profile Drawer in `Tenant-v2`.

## Audit Summary

- `Customer-facing backend gaps`: No blocking gaps identified.
- `UI mapping gaps`: Yes, the drawer initially ignored richer production payloads and rendered simplified summaries.
- `Standalone transaction drawer`: Not found in the current codebase; transaction cards now reuse existing appointment-linked detail behavior when available.

## Endpoints Audited

### Customer Profile

- `GET /api/v1/tenant/customers/:id`

### Customer Summary

- `GET /api/v1/tenant/customers/:id`
- `GET /api/v1/tenant/customers/:id/history`

### Appointment History

- `GET /api/v1/tenant/customers/:id/history`

### Transaction History

- `GET /api/v1/tenant/customers/:id/transactions`

### Wallet History

- `GET /api/v1/tenant/customers/:id/history`
- `GET /api/v1/tenant/customers/:id/transactions`

### Finance / Invoices

- No separate Customer Profile drawer endpoint was required.
- Financial detail reuse is currently appointment-linked in the customer flow.

## Root Causes Found

1. Appointment history was mapped from an older `recentAppointments`-style expectation instead of the unified `history` array returned by the backend.
2. Transaction rows were rendered as compact labels instead of using the richer production fields already returned by `getCustomerTransactions`.
3. The drawer previously duplicated current visit context inside Overview instead of focusing on long-term CRM data.

## Backend Field Check

No missing backend fields were identified for the current Customer Profile Drawer scope.

The backend already exposes:

- appointment service and staff details
- appointment payment status and paid amounts
- transaction reference, payment method, status, and timestamps
- wallet transaction metadata

## Notes

- The Customer Profile Drawer now relies on production data only.
- Any future invoice-specific drawer work should be handled as a separate financial workspace concern, not as a new CRM page.
