# Reports Missing Field Schema Availability Audit

## Scope

This report classifies every field that was flagged as missing or unavailable in the priority reports audit and checks whether the data already exists in the current backend schema.

### Classification key

- **Already available**: the value already exists in persisted backend data and only needs DTO exposure / mapping.
- **Derivable from existing data without changing business rules**: the value can be produced deterministically from existing persisted records.
- **Requires a new backend calculation**: the value is not stored directly and must be computed in backend logic, but still uses the current data model.
- **Requires new database storage or schema changes**: not supported by the current schema.
- **Cannot be implemented with the current data model**: no reliable source exists in the current schema.

## Summary

- Already available: **23**
- Derivable from existing data without changing business rules: **18**
- Requires a new backend calculation: **2**
- Requires new database storage or schema changes: **0**
- Cannot be implemented with the current data model: **0**

## Field-by-field classification

| Report | Field | Classification | Schema evidence / rationale |
|---|---|---|---|
| Sales Overview | Invoice Number | Already available | `CustomerInvoice.invoiceNumber`, `Appointment.bookingNumber`, `Order.orderNumber`, `PaymentTransaction.transactionRef`. |
| Sales Overview | Gross Sales | Already available | `CustomerInvoice.totalAmount`, `Appointment.price`, `Order.totalAmount`. |
| Sales Overview | Net Sales | Already available | `CustomerInvoice.totalAmount` and invoice line totals already persist final sale value. |
| Sales Overview | Refund | Already available | Refund data exists through `PaymentTransaction.type = refund`, `PaymentTransaction.status = refunded`, and `CustomerInvoice.status = REFUNDED`. |
| Sales Overview | VAT | Already available | `CustomerInvoice.vatAmount`, `CustomerInvoiceItem.taxAmount`, `Appointment.taxAmount`. |
| Sales Overview | Status | Already available | Canonical status fields already exist on `CustomerInvoice.status`, `PaymentTransaction.status`, and `Appointment.status`. |
| Sales Overview | Channel | Derivable from existing data without changing business rules | Can be derived from sale source metadata / assignment mode / payment context already stored on related records. |
| Sales Overview | Items | Derivable from existing data without changing business rules | Can be derived from `CustomerInvoiceItem` rows or appointment service lines. |
| Sales List | Invoice Number | Already available | `CustomerInvoice.invoiceNumber` already exists. |
| Sales List | Amount Paid | Already available | `CustomerInvoice.paidAmount`, `PaymentTransaction.amount`. |
| Sales List | Remaining Balance | Already available | `CustomerInvoice.dueAmount` is already persisted. |
| Sales List | Location | Derivable from existing data without changing business rules | Can be resolved from tenant / branch context on the sale source records. |
| Sales Log Details | Item Type | Already available | `CustomerInvoiceItem.itemType` already persists service/product line type. |
| Sales Log Details | Category | Derivable from existing data without changing business rules | `Service.category`, `Product.category`, and item metadata already provide category context. |
| Sales Log Details | Discount | Derivable from existing data without changing business rules | Can be derived from gross vs net line totals or existing discount metadata on source rows. |
| Sales Log Details | Net | Already available | `CustomerInvoiceItem.lineTotal` already stores the net line amount. |
| Discount Summary | Net Sales | Already available | `CustomerInvoice.totalAmount` and line totals already provide the post-discount sale value. |
| Discount Summary | Invoice Number | Already available | `CustomerInvoice.invoiceNumber` already exists. |
| Discount Summary | Discount Type | Derivable from existing data without changing business rules | Can be derived from source metadata / discount origin already captured in sale records. |
| Discount Summary | Discount % | Derivable from existing data without changing business rules | Can be derived from discount amount and gross amount already persisted. |
| Tax Summary | Tax Type | Derivable from existing data without changing business rules | Can be derived from tax metadata / tax origin already present on line items and source records. |
| Tax Summary | Tax Rate | Derivable from existing data without changing business rules | `Service.taxRate`, `Product.taxRate`, and `CustomerInvoiceItem.metadata` provide the tax basis. |
| Tax Summary | Invoice Number | Already available | `CustomerInvoice.invoiceNumber` already exists. |
| Tax Summary | Net Sales | Already available | `CustomerInvoice.totalAmount` and invoice line totals already provide the net amount. |
| Gift Card List | Invoice Number | Already available | `CustomerInvoice.invoiceNumber` and gift card transaction metadata can link the sale. |
| Gift Card List | Original Amount | Already available | `GiftCardPackage.priceAmount`, `TenantGiftCardTransaction.purchaseAmount`, `GiftCardTransaction.purchaseAmount`. |
| Gift Card List | Redeemed Amount | Derivable from existing data without changing business rules | Can be derived from gift card transaction / settlement history already recorded in the gift card models. |
| Gift Card List | Remaining Balance | Derivable from existing data without changing business rules | Can be derived from original amount minus redeemed amount using existing gift card records. |
| Finance Overview | Invoice linkage / reference | Already available | `CustomerInvoice.invoiceNumber`, `CustomerInvoice.entityType`, `CustomerInvoice.entityId`, and payment transaction references already exist. |
| Payment Transactions | Invoice Number | Already available | `CustomerInvoice.invoiceNumber` / invoice linkage already exists for payment rows. |
| Payment Transactions | Payment Amount | Already available | `PaymentTransaction.amount` already stores the canonical payment amount. |
| Payment Transactions | Notes | Already available | `PaymentTransaction.notes` already exists. |
| Payment Transactions | Team Member | Already available | `PaymentTransaction.processedBy` associates to staff / processor context. |
| Payment Transactions | Location | Derivable from existing data without changing business rules | Can be resolved from the related appointment / order / tenant context. |
| Cash Flow Summary | Opening Balance | Requires a new backend calculation | Not stored as a direct schema field; must be computed from historical ledger movement. |
| Cash Flow Summary | Closing Balance | Requires a new backend calculation | Not stored as a direct schema field; must be computed from historical ledger movement. |
| Customer Overview | Customer Lifetime Revenue | Already available | `CustomerInsight.totalSpent` already stores the lifetime spend figure. |
| Employee Performance | Per-employee cancellation counts | Derivable from existing data without changing business rules | Can be grouped from `Appointment.status = cancelled` by `Appointment.staffId`. |
| Employee Performance | Per-employee no-show counts | Derivable from existing data without changing business rules | Can be grouped from `Appointment.status = no_show` by `Appointment.staffId`. |
| Service Performance | Service trend time series | Derivable from existing data without changing business rules | Can be grouped from appointment / invoice / payment rows by service and date. |
| Product Performance | Average price per sold unit | Derivable from existing data without changing business rules | Can be derived from sold line totals and quantities already stored in orders / invoice items. |
| Product Performance | Inventory impact | Derivable from existing data without changing business rules | Can be derived from product stock, sold counts, and gift usage counters already in `Product`. |
| Product Performance | Product trend time series | Derivable from existing data without changing business rules | Can be grouped from order / invoice item rows by product and date. |

## Schema evidence used

The classification above is supported by the following existing backend models and fields:

- `server/src/models/Appointment.js`
  - `bookingNumber`, `bookingSessionId`, `bookingReference`, `status`, `price`, `rawPrice`, `taxAmount`, `tenantRevenue`, `employeeRevenue`, `employeeCommission`, `staffId`, `serviceId`
- `server/src/models/CustomerInvoice.js`
  - `invoiceNumber`, `status`, `subtotalAmount`, `vatAmount`, `totalAmount`, `paidAmount`, `dueAmount`, `entityType`, `entityId`, `paymentMethodSnapshot`, `paymentStatusSnapshot`
- `server/src/models/CustomerInvoiceItem.js`
  - `itemType`, `nameEn`, `nameAr`, `quantity`, `unitPrice`, `lineTotal`, `taxAmount`, `metadata`
- `server/src/models/PaymentTransaction.js`
  - `amount`, `type`, `paymentMethod`, `status`, `transactionRef`, `notes`, `processedBy`, `processedAt`, `metadata`
- `server/src/models/CustomerInsight.js`
  - `totalSpent`, `totalBookings`, `averageBookingValue`, `firstVisit`, `lastVisit`, `noShowCount`, `cancellationCount`
- `server/src/models/TenantGiftCardTransaction.js`
  - `purchaseAmount`, `creditAmount`, `bonusAmount`, `totalCreditAmount`, `status`, `giftCardCodeId`, `recipientResolvedPlatformUserId`
- `server/src/models/GiftCardTransaction.js`
  - `purchaseAmount`, `creditAmount`, `bonusAmount`, `totalCreditAmount`, `status`, `giftCardCodeId`, `recipientResolvedPlatformUserId`
- `server/src/models/GiftCardPackage.js`
  - `priceAmount`, `walletCreditAmount`, `bonusAmount`
- `server/src/models/Product.js`
  - `stock`, `soldCount`, `usedAsGiftCount`, `category`, `price`, `rawPrice`, `taxRate`
- `server/src/models/Service.js`
  - `category`, `rawPrice`, `taxRate`, `commissionRate`, `finalPrice`, `variants`, `paymentOptions`
- `server/src/models/Order.js`
  - `orderNumber`, `paymentMethod`, `paymentStatus`, `subtotal`, `taxAmount`, `platformFee`, `totalAmount`, `status`

## Important conclusion

No audited field currently appears to require new database storage or schema changes.

The only fields that clearly need backend-side computation are the cash flow opening and closing balances, because those are period-level accounting aggregates rather than persisted row-level facts.

Everything else is either already stored or can be derived from the existing model graph without changing business rules.
