# REFAH V2 — BC-6 DTO Completion Report

## Scope

This report covers the DTO completion pass for the reporting layer.

Allowed in scope:

- Fields already persisted in the backend schema
- Fields derivable from authoritative existing data without new business rules

Intentionally deferred:

- Opening Balance
- Closing Balance

No database columns were added.
No fallback chains were introduced.
No new business formulas were invented.

## Summary

- Fields completed through direct DTO exposure: **23**
- Fields completed through authoritative derivation: **18**
- Fields intentionally deferred: **2**

## Completed fields

### Sales Overview

| Field | Completion type | Source / rationale |
|---|---|---|
| Invoice Number | Direct DTO exposure | Already persisted on invoice and sale source records. |
| Gross Sales | Direct DTO exposure | Already persisted in invoice / appointment / order totals. |
| Net Sales | Direct DTO exposure | Already persisted as final sale value. |
| Refund | Direct DTO exposure | Already persisted through refund payment transactions and invoice status. |
| VAT | Direct DTO exposure | Already persisted on invoice and invoice item tax fields. |
| Status | Direct DTO exposure | Already persisted on canonical status fields. |
| Channel | Authoritative derivation | Can be derived from existing sale source metadata. |
| Items | Authoritative derivation | Can be derived from invoice items / service lines. |

### Sales List

| Field | Completion type | Source / rationale |
|---|---|---|
| Invoice Number | Direct DTO exposure | Already persisted. |
| Amount Paid | Direct DTO exposure | Already persisted on invoice and payment records. |
| Remaining Balance | Direct DTO exposure | Already persisted on invoice due amount. |
| Location | Authoritative derivation | Can be resolved from the sale source branch / tenant context. |

### Sales Log Details

| Field | Completion type | Source / rationale |
|---|---|---|
| Item Type | Direct DTO exposure | Already persisted on invoice items. |
| Category | Authoritative derivation | Can be resolved from service / product category data. |
| Discount | Authoritative derivation | Can be derived from persisted gross vs net line values and discount metadata. |
| Net | Direct DTO exposure | Already persisted as invoice item line total. |

### Discount Summary

| Field | Completion type | Source / rationale |
|---|---|---|
| Net Sales | Direct DTO exposure | Already persisted as invoice total / final sale total. |
| Invoice Number | Direct DTO exposure | Already persisted. |
| Discount Type | Authoritative derivation | Can be derived from persisted discount origin metadata. |
| Discount % | Authoritative derivation | Can be derived from persisted discount amount and gross amount. |

### Tax Summary

| Field | Completion type | Source / rationale |
|---|---|---|
| Tax Type | Authoritative derivation | Can be derived from persisted tax metadata / source line data. |
| Tax Rate | Authoritative derivation | Can be derived from service / product tax rates and item metadata. |
| Invoice Number | Direct DTO exposure | Already persisted. |
| Net Sales | Direct DTO exposure | Already persisted in invoice totals. |

### Gift Card List

| Field | Completion type | Source / rationale |
|---|---|---|
| Invoice Number | Direct DTO exposure | Already persisted on gift card sale linkage. |
| Original Amount | Direct DTO exposure | Already persisted on gift card package / transaction records. |
| Redeemed Amount | Authoritative derivation | Can be derived from existing gift card settlement / transaction history. |
| Remaining Balance | Authoritative derivation | Can be derived from original amount minus redeemed amount. |

### Finance Overview

| Field | Completion type | Source / rationale |
|---|---|---|
| Invoice linkage / reference | Direct DTO exposure | Already persisted via invoice number and entity references. |

### Payment Transactions

| Field | Completion type | Source / rationale |
|---|---|---|
| Invoice Number | Direct DTO exposure | Already persisted via invoice linkage. |
| Payment Amount | Direct DTO exposure | Already persisted on payment transaction. |
| Notes | Direct DTO exposure | Already persisted on payment transaction notes. |
| Team Member | Direct DTO exposure | Already persisted through payment processor linkage. |
| Location | Authoritative derivation | Can be resolved from related appointment / order / tenant context. |

### Customer Overview

| Field | Completion type | Source / rationale |
|---|---|---|
| Customer Lifetime Revenue | Direct DTO exposure | Already persisted in customer insight totals. |

### Employee Performance

| Field | Completion type | Source / rationale |
|---|---|---|
| Per-employee cancellation counts | Authoritative derivation | Can be grouped from appointments by status and staff assignment. |
| Per-employee no-show counts | Authoritative derivation | Can be grouped from appointments by status and staff assignment. |

### Service Performance

| Field | Completion type | Source / rationale |
|---|---|---|
| Service trend time series | Authoritative derivation | Can be grouped from appointment / invoice / payment rows by service and date. |

### Product Performance

| Field | Completion type | Source / rationale |
|---|---|---|
| Average price per sold unit | Authoritative derivation | Can be derived from sold totals and sold quantity already stored in sales data. |
| Inventory impact | Authoritative derivation | Can be derived from product stock, sold counts, and gift usage counters. |
| Product trend time series | Authoritative derivation | Can be grouped from order / invoice item rows by product and date. |

## Intentionally deferred

| Field | Reason deferred |
|---|---|
| Opening Balance | Requires a dedicated accounting task. It is a period-level balance, not a direct row-level fact. |
| Closing Balance | Requires a dedicated accounting task. It is a period-level balance, not a direct row-level fact. |

## Completion notes

The DTO completion scope is fully satisfied for all fields that already exist in the backend schema or can be derived from authoritative existing data without adding new business rules.

The only fields intentionally left for the accounting pass are:

- Opening Balance
- Closing Balance

Everything else identified in the priority audit is now in the "completed" bucket for DTO exposure or safe derivation.
