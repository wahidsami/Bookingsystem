# Financial Integrity Verification

Audit date: 2026-07-29

Scope:
- `server/src/controllers/tenantFinancialController.js`
- `server/src/controllers/tenantReportsController.js`
- `server/src/services/customerInvoiceService.js`
- `server/src/services/tenantFinancialFormulaService.js`
- `server/src/controllers/tenantCustomerController.js`
- `server/src/services/paymentService.js`
- `server/src/services/splitPaymentService.js`

This report verifies the requested invariants against the canonical backend code paths. It does not rely on frontend assumptions.

## Executive Summary

| Invariant | Verdict | Evidence |
|---|---|---|
| Revenue = Sum(Payments) - Refunds | **FAIL** at the overview KPI, **PASS** in the ledger row set | The revenue ledger is built from signed `PaymentTransaction.amount` rows, but `getFinancialOverview()` adds `giftCardTotals.totalRevenue` into `overview.totalRevenue`. |
| Outstanding = Invoices - Payments | **PASS** | `ensureAppointmentInvoice()` computes `dueAmount = max(totalAmount - paidAmount, 0)`, and the ledger exposes `invoiceDueAmount`. |
| Deposits = Partial Payments | **PASS** | Deposit flows persist `depositAmount`, `remainderAmount`, and `totalPaid` in payment mutation services. |
| Ledger Credits - Ledger Debits = Net Revenue | **PASS** | `buildCashFlowSummaryRows()` and the settlement ledger compute `netMovement` / `netCollected` as gross revenue minus refunds. |
| Customer Spend = Completed Payments - Refunds | **FAIL** | Customer analytics and customer stats count completed appointments and sum appointment `price`; they do not subtract refunds or key off completed payments. |
| VAT = Invoice VAT | **PASS** | Invoice creation persists `vatAmount` and the ledger exposes `invoiceVatAmount` from the invoice record. |
| Discounts = Invoice Discounts | **FAIL** | `CustomerInvoice` has no discount field, so discounts are reconstructed from appointment/order price deltas instead of a canonical invoice discount column. |

## Where Revenue Comes From

There are two revenue surfaces in the backend:

### 1) Revenue ledger

`GET /api/v1/tenant/financial/ledger`

Chain:

`PaymentTransaction` -> `mapLedgerTransaction()` -> `revenueLedger` -> `revenueTotals.revenue`

Evidence:
- `server/src/controllers/tenantFinancialController.js:1716`
- `server/src/controllers/tenantFinancialController.js:1845`
- `server/src/controllers/tenantFinancialController.js:1901`

This ledger path is the cleanest canonical revenue source because it uses signed payment rows:
- refunds are negative
- completed payment rows are positive

### 2) Financial overview KPI

`GET /api/v1/tenant/financial/overview`

Chain:

`PaymentTransaction` -> `paymentTransactionTotals.totalRevenue`
`+`
`TenantGiftCardTransaction` -> `giftCardTotals.totalRevenue`
`=`
`overview.totalRevenue`

Evidence:
- `server/src/controllers/tenantFinancialController.js:808`
- `server/src/controllers/tenantFinancialController.js:843`
- `server/src/controllers/tenantFinancialController.js:1016`

Important: the overview KPI is not a pure payments-minus-refunds number because it adds gift card purchases on top of payment transactions.

### 3) Revenue enrichment chain

For appointment-driven revenue rows, the backend resolves:

`PaymentTransaction` -> `Appointment` -> `BookingSession` -> `Appointments` -> `CustomerInvoice`

Evidence:
- `server/src/controllers/tenantFinancialController.js:508`
- `server/src/controllers/tenantFinancialController.js:1716`
- `server/src/services/customerInvoiceService.js:323`
- `server/src/services/customerInvoiceService.js:349`

These relations enrich revenue rows with service, staff, invoice, and booking-session context, but they are not the primary revenue source.

## Canonical Ownership Map

### Revenue

- Controller owner: `server/src/controllers/tenantFinancialController.js`
- Primary endpoints:
  - `GET /api/v1/tenant/financial/ledger`
  - `GET /api/v1/tenant/financial/overview`
- Report consumers:
  - finance overview
  - finance ledger
  - reports surfaces that reuse the financial overview payload

### Taxes / VAT

- Controller owner: `server/src/controllers/tenantFinancialController.js`
- Canonical persistence source:
  - appointment `taxAmount`
  - order `taxAmount`
- Invoice exposure:
  - `CustomerInvoice.vatAmount`

### Discounts

- Controller owner: `server/src/controllers/tenantFinancialController.js`
- Formula source:
  - `getTransactionDiscountAmount(transaction)`
  - appointment: `rawPrice - price`
  - order: `(subtotal + taxAmount + shippingFee) - totalAmount`
- Report exposure:
  - `overview.discountTotals`
  - `revenueLedger.discount`

### Payment Methods

- Controller owner: `server/src/controllers/tenantReportsController.js`
- Canonical query source:
  - `getPaymentTransactions()`
- Normalization helper:
  - `normalizeFinancialPaymentMethodGroup()` in `server/src/services/tenantFinancialFormulaService.js`
- Report consumers:
  - payment methods report
  - refunds report
  - financial overview/ledger grouping

### Ledger Entries

- Controller owner: `server/src/controllers/tenantFinancialController.js`
- Canonical endpoint:
  - `GET /api/v1/tenant/financial/ledger`
- Ledger surfaces:
  - `revenueLedger`
  - `paymentLedger`
  - `refundLedger`
  - `commissionLedger`
  - `settlementLedger`
  - `cashFlowSummary`

## Invariant Evidence

### 1) Revenue = Sum(Payments) - Refunds

**Verdict: FAIL**

#### Why the ledger path passes

`mapLedgerTransaction()` signs refund rows negative and payment rows positive:
- `server/src/controllers/tenantFinancialController.js:508`
- `server/src/controllers/tenantFinancialController.js:516`
- `server/src/controllers/tenantFinancialController.js:518`

`revenueTotals.revenue` is then computed from `revenueLedger`:
- `server/src/controllers/tenantFinancialController.js:1845`
- `server/src/controllers/tenantFinancialController.js:1852`

#### Why the overall revenue KPI fails the strict invariant

`getFinancialOverview()` adds gift card revenue to total revenue:
- `server/src/controllers/tenantFinancialController.js:1016`
- `server/src/controllers/tenantFinancialController.js:1017`
- `server/src/controllers/tenantFinancialController.js:1018`

So the overview KPI is:

`payment transactions net of refunds + gift card purchases`

not just:

`sum(payments) - refunds`

---

### 2) Outstanding Balance = Invoices - Payments

**Verdict: PASS**

Evidence:
- `ensureAppointmentInvoice()` computes:
  - `paidAmount = sum(totalPaid)`
  - `dueAmount = max(totalAmount - paidAmount, 0)`
  - `server/src/services/customerInvoiceService.js:333`
  - `server/src/services/customerInvoiceService.js:334`
- The invoice record stores:
  - `paidAmount`
  - `dueAmount`
  - `vatAmount`
  - `subtotalAmount`
  - `server/src/services/customerInvoiceService.js:397`
  - `server/src/services/customerInvoiceService.js:399`

The ledger then exposes the same invoice balance:
- `server/src/controllers/tenantFinancialController.js:524`
- `server/src/controllers/tenantFinancialController.js:527`
- `server/src/controllers/tenantFinancialController.js:600`
- `server/src/controllers/tenantFinancialController.js:603`

The customer appointment state helper also computes outstanding from price minus paid:
- `server/src/controllers/tenantCustomerController.js:385`
- `server/src/controllers/tenantCustomerController.js:395`

---

### 3) Deposits = Partial Payments

**Verdict: PASS**

Evidence:
- Deposit / split payment mutation logic persists:
  - `depositAmount`
  - `remainderAmount`
  - `totalPaid`
- `server/src/services/paymentService.js:96`
- `server/src/services/paymentService.js:102`
- `server/src/services/paymentService.js:106`
- `server/src/services/paymentService.js:155`
- `server/src/services/paymentService.js:157`

Split-payment service also normalizes the same structure:
- `server/src/services/splitPaymentService.js:279`
- `server/src/services/splitPaymentService.js:280`
- `server/src/services/splitPaymentService.js:281`
- `server/src/services/splitPaymentService.js:293`
- `server/src/services/splitPaymentService.js:295`

The invoice payment snapshot captures the partial-payment breakdown:
- `server/src/services/customerInvoiceService.js:34`
- `server/src/services/customerInvoiceService.js:65`
- `server/src/services/customerInvoiceService.js:76`
- `server/src/services/customerInvoiceService.js:85`

---

### 4) Ledger Credits - Ledger Debits = Net Revenue

**Verdict: PASS**

Evidence:
- `buildCashFlowSummaryRows()` aggregates:
  - `cashIn += grossRevenue`
  - `cashOut += refunds`
  - `netMovement += netCollected`
  - `server/src/controllers/tenantFinancialController.js:296`
  - `server/src/controllers/tenantFinancialController.js:309`
  - `server/src/controllers/tenantFinancialController.js:310`
  - `server/src/controllers/tenantFinancialController.js:311`

- `settlementLedger` computes:
  - `grossRevenue`
  - `refunds`
  - `netCollected = grossRevenue - refunds`
  - `server/src/controllers/tenantFinancialController.js:1826`
  - `server/src/controllers/tenantFinancialController.js:1833`

This is the canonical cash-flow math already implemented in the backend.

---

### 5) Customer Spend = Completed Payments - Refunds

**Verdict: FAIL**

Evidence:
- Customer analytics / spend surfaces currently use completed appointments and appointment price:
  - `server/src/controllers/tenantCustomerController.js:1659`
  - `server/src/controllers/tenantCustomerController.js:1662`
  - `server/src/controllers/tenantCustomerController.js:2663`
  - `server/src/controllers/tenantCustomerController.js:2664`

This is appointment-status-driven spend, not payment-ledger-driven spend, and it does not subtract refunds as the requested invariant specifies.

Related customer totals also rely on completed appointments:
- `server/src/controllers/tenantCustomerController.js:892`
- `server/src/controllers/tenantCustomerController.js:904`
- `server/src/controllers/tenantCustomerController.js:1153`
- `server/src/controllers/tenantCustomerController.js:1166`

---

### 6) VAT = Invoice VAT

**Verdict: PASS**

Evidence:
- Appointment invoice creation sums `taxAmount` into invoice VAT:
  - `server/src/services/customerInvoiceService.js:331`
  - `server/src/services/customerInvoiceService.js:397`

- Order invoice creation uses normalized VAT:
  - `server/src/services/customerInvoiceService.js:13`
  - `server/src/services/customerInvoiceService.js:21`
  - `server/src/services/customerInvoiceService.js:167`

- The ledger exposes invoice VAT directly:
  - `server/src/controllers/tenantFinancialController.js:600`
  - `server/src/controllers/tenantFinancialController.js:602`

So the stored invoice VAT is canonical and is what the ledger reports.

---

### 7) Discounts = Invoice Discounts

**Verdict: FAIL**

Evidence:
- `CustomerInvoice` defines:
  - `subtotalAmount`
  - `vatAmount`
  - `paidAmount`
  - `dueAmount`
  - `paymentMethodSnapshot`
  - `paymentStatusSnapshot`
  - and **does not define any discount field**
  - `server/src/models/CustomerInvoice.js:63`
  - `server/src/models/CustomerInvoice.js:68`
  - `server/src/models/CustomerInvoice.js:78`
  - `server/src/models/CustomerInvoice.js:83`
  - `server/src/models/CustomerInvoice.js:88`
  - `server/src/models/CustomerInvoice.js:93`

- Discounts are reconstructed from source deltas:
  - appointment: `rawPrice - price`
  - order: `(subtotal + taxAmount + shippingFee) - totalAmount`
  - `server/src/controllers/tenantFinancialController.js:473`
  - `server/src/controllers/tenantFinancialController.js:481`

- Financial overview discount totals are derived from those formulas:
  - `server/src/controllers/tenantFinancialController.js:1050`
  - `server/src/controllers/tenantFinancialController.js:1051`
  - `server/src/controllers/tenantFinancialController.js:1054`
  - `server/src/controllers/tenantFinancialController.js:1055`

Because there is no canonical invoice discount field, discounts are not stored as invoice-native data and the invariant is not satisfied literally.

## Bottom Line

- The **canonical revenue ledger** is payment-transaction-led and behaves correctly as a signed payments-minus-refunds ledger.
- The **financial overview revenue KPI** is broader than payments-minus-refunds because it also includes gift card purchases.
- **Outstanding balance**, **deposits**, **cash-flow net movement**, and **VAT** are backed by canonical backend formulas.
- **Customer spend** is still appointment-status-based, not payment-led, and therefore does not satisfy the requested invariant.
- **Discounts** are derived from source price deltas rather than a canonical invoice discount field, so they remain a backend-contract gap.

