# Reports Missing Field Priority Audit

## Scope

This report reviews every field currently marked as unavailable or missing in the Tenant-v2 reporting layer and classifies each one by production value.

### Classification scale

- **Critical for production**: required for financial accuracy, compliance, reconciliation, or core operational control.
- **High business value**: strongly useful for salon owners, branch managers, finance managers, or operations managers.
- **Nice to have**: useful for analysis or UI completeness, but not a blocker for day-to-day business operations.
- **Internal/debug only**: implementation detail or diagnostic value; not a business-facing requirement.
- **Can be removed**: not needed for the production reporting experience.

## Summary

- Audited missing / unavailable fields: **43**
- Critical for production: **27**
- High business value: **11**
- Nice to have: **2**
- Internal/debug only: **1**
- Can be removed: **0**

## Priority Findings

### Critical for production

| Report | Field | Why it matters |
|---|---|---|
| Sales Overview | Invoice Number | Finance reconciliation, audit trail, and traceability back to the sale. |
| Sales Overview | Gross Sales | Core revenue figure for owners and finance managers. |
| Sales Overview | Net Sales | Required for true business performance and profitability views. |
| Sales Overview | Refund | Needed to understand reversals and net collection impact. |
| Sales Overview | VAT | Compliance and tax reporting requirement. |
| Sales Overview | Status | Needed to distinguish paid, unpaid, refunded, and operational sale states. |
| Sales List | Invoice Number | Required for transaction lookup and reconciliation. |
| Sales List | Amount Paid | Core collection value for finance and cashier workflows. |
| Sales List | Remaining Balance | Required to know what is still outstanding. |
| Sales Log Details | Discount | Needed to audit item-level price reductions. |
| Sales Log Details | Net | Required to show the final sold value after discount and tax. |
| Discount Summary | Net Sales | Needed to understand the post-discount actual collected value. |
| Discount Summary | Invoice Number | Required to trace a discount back to the originating sale. |
| Tax Summary | Tax Type | Needed for tax compliance and reporting consistency. |
| Tax Summary | Tax Rate | Required for accurate tax audit and statutory reporting. |
| Tax Summary | Invoice Number | Required to trace tax rows back to invoices. |
| Tax Summary | Net Sales | Needed to understand net taxable impact. |
| Gift Card List | Invoice Number | Required to trace issued and redeemed gift cards back to a sale. |
| Gift Card List | Original Amount | Core accounting amount for the card liability. |
| Gift Card List | Redeemed Amount | Required to know how much value was consumed. |
| Gift Card List | Remaining Balance | Required for liability tracking and customer balance visibility. |
| Finance Overview | Invoice linkage / reference | Required to connect payments, appointments, and invoices. |
| Payment Transactions | Invoice Number | Required for payment-to-invoice reconciliation. |
| Payment Transactions | Payment Amount | Core amount for the payment ledger. |
| Cash Flow Summary | Opening Balance | Required for accounting continuity across periods. |
| Cash Flow Summary | Closing Balance | Required for period-end reconciliation. |

### High business value

| Report | Field | Why it matters |
|---|---|---|
| Sales List | Location | Important for branch managers and multi-branch performance review. |
| Sales Log Details | Item Type | Helps separate services, products, packages, and gift cards. |
| Sales Log Details | Category | Useful for service mix and merchandising analysis. |
| Discount Summary | Discount Type | Needed to distinguish promotion, manual, and policy-driven discounts. |
| Discount Summary | Discount % | Helps owners and managers audit discount aggressiveness. |
| Customer Overview | Customer Lifetime Revenue | Very valuable for customer value and loyalty analysis. |
| Employee Performance | Per-employee cancellation counts | Important for staffing and accountability. |
| Employee Performance | Per-employee no-show counts | Important for staffing and appointment quality analysis. |
| Service Performance | Service trend time series | Useful for service demand and promotion planning. |
| Product Performance | Average price per sold unit | Useful for pricing and merchandising analysis. |
| Product Performance | Inventory impact | Useful for stock planning and product operations. |
| Product Performance | Product trend time series | Useful for seasonal product demand analysis. |

### Nice to have

| Report | Field | Why it matters |
|---|---|---|
| Sales Overview | Channel | Useful for identifying source mix, but not core to daily reconciliation. |
| Sales Overview | Items | Helpful for quick row scanning, but less critical than invoice and totals. |

### Internal / debug only

| Report | Field | Why it matters |
|---|---|---|
| Payment Transactions | Notes | Operationally helpful for support, but not required for core reporting decisions. |

### Can be removed

No audited missing field was judged safe to remove. The current gaps are either financially important, operationally valuable, or useful for management review.

---

## Role-Based Priority View

### Beauty salon owner

Most important fields:

- Gross Sales
- Net Sales
- VAT
- Refund
- Amount Paid
- Remaining Balance
- Customer Lifetime Revenue
- Discount Type
- Discount %
- Inventory Impact

Reason: the owner needs profitability, tax, discount, and revenue visibility first.

### Branch manager

Most important fields:

- Location
- Status
- Invoice Number
- Item Type
- Category
- Per-employee cancellation counts
- Per-employee no-show counts
- Service trend time series

Reason: the branch manager needs operational accountability, service mix, and local branch performance.

### Finance manager

Most important fields:

- Invoice Number
- Payment Amount
- Remaining Balance
- VAT
- Tax Type
- Tax Rate
- Opening Balance
- Closing Balance
- Original Amount
- Redeemed Amount

Reason: finance needs clean reconciliation, auditability, and balance continuity.

### Operations manager

Most important fields:

- Item Type
- Category
- Service trend time series
- Product trend time series
- Per-employee cancellation counts
- Per-employee no-show counts
- Inventory Impact

Reason: operations needs staffing, demand, and stock signals more than pure accounting totals.

---

## Recommendation

1. Fix all **Critical for production** fields first.
2. Then fill the **High business value** gaps that support management decisions.
3. Leave **Nice to have** items for the final polish pass.
4. Keep **Internal/debug only** fields out of the customer-facing reporting contract unless they become genuinely needed.
