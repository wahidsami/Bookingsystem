# Reports Coverage and Gaps Audit

## Executive Summary

I audited the current Tenant-v2 BI/reporting implementation and grouped the findings into active reports and hidden legacy report entries.

### Counts

- Active BI reports mounted in the current shell: **13**
- Hidden / legacy report tabs still present in the repo but not mounted by the active shell: **13**
- Total report entries found in the repository: **26**
- Strictly complete, gap-free reports: **0**
- Active reports with at least one backend gap or frontend fallback: **13**
- Placeholder-only reports: **0**

### What "hidden" means here

The active shell mounts:

- `FinanceReportsWorkspace.tsx`
- `OperationsIntelligenceReport.tsx`

The older `ReportsWorkspace.tsx` file still exists, but it is **not mounted** by `Workspace.tsx`. Those 13 tabs are therefore counted as hidden / legacy.

## Report Inventory

| Report | Visibility | Status | Primary source files |
|---|---|---|---|
| Sales Overview | Active | Backend-backed, gap present | `src/components/reports/SalesOverviewReport.tsx`, `src/lib/bi/reports/salesOverview.ts`, `src/lib/bi/reports/salesOverviewViewModel.ts` |
| Sales List | Active | Backend-backed, gap present | `src/components/reports/SalesListReport.tsx`, `src/lib/bi/reports/salesList.ts` |
| Sales Log Details | Active | Backend-backed, gap present | `src/components/reports/SalesLogDetailsReport.tsx`, `src/lib/bi/reports/salesLogDetails.ts` |
| Discount Summary | Active | Backend-backed, gap present | `src/components/reports/DiscountSummaryReport.tsx`, `src/lib/bi/reports/discountSummary.ts` |
| Tax Summary | Active | Backend-backed, gap present | `src/components/reports/TaxSummaryReport.tsx`, `src/lib/bi/reports/taxSummary.ts` |
| Gift Card List | Active | Backend-backed, gap present | `src/components/reports/GiftCardListReport.tsx`, `src/lib/bi/reports/giftCardList.ts` |
| Customer Overview | Active | Backend-backed, gap present | `src/components/reports/OperationsIntelligenceReport.tsx`, `src/lib/bi/reports/operationsIntelligence.ts` |
| Employee Performance | Active | Backend-backed, gap present | `src/components/reports/OperationsIntelligenceReport.tsx`, `src/lib/bi/reports/operationsIntelligence.ts` |
| Service Performance | Active | Backend-backed, gap present | `src/components/reports/OperationsIntelligenceReport.tsx`, `src/lib/bi/reports/operationsIntelligence.ts` |
| Product Performance | Active | Backend-backed, gap present | `src/components/reports/OperationsIntelligenceReport.tsx`, `src/lib/bi/reports/operationsIntelligence.ts` |
| Finance Overview | Active | Backend-backed, gap present | `src/components/reports/FinanceOverviewReport.tsx`, `src/lib/bi/reports/financeOverview.ts` |
| Payment Transactions | Active | Backend-backed, gap present | `src/components/reports/PaymentTransactionsReport.tsx`, `src/lib/bi/reports/paymentTransactions.ts` |
| Cash Flow Summary | Active | Backend-backed, gap present | `src/components/reports/CashFlowSummaryReport.tsx`, `src/lib/bi/reports/cashFlowSummary.ts` |
| Legacy Reports Workspace tabs | Hidden | Legacy / not mounted | `src/components/ReportsWorkspace.tsx` |

## Field Coverage Summary

### What is already populated correctly

Across the active reports, the following are already wired to live backend or canonical report DTO data:

- Sale / transaction / payment identifiers
- Sale dates and payment dates
- Customer names
- Employee / team member names
- Payment methods
- Gross, net, tax, and discount values where the backend exposes them
- Gift card codes and transaction dates
- Finance overview KPI totals
- Revenue trend and breakdown charts where backend series exist
- Export actions for CSV, Excel, PDF, and Print
- Drawer sections for reports that already provide row-level DTO data

### What is available in backend but not displayed everywhere yet

These backend fields or series exist in the code paths but are not surfaced consistently in every report:

- `topProduct`, `highestSale`, `paymentMethodTrends` in Sales Overview
- `detailPath`, `refundMode`, and some row-level notes in Sales Overview
- `sourceRows` in Cash Flow Summary
- `paymentLedger`, `refundLedger`, and settlement rows in Finance Overview
- `invoiceItems` and row source payloads in Sales Log Details
- `latestRedemption` and redemption collections in Gift Card List

### What is still shown as `Unavailable` but can be populated when backend fields exist

- Invoice numbers in some sales/finance/gift-card views
- Opening balance and closing balance in Cash Flow Summary
- Discount type / tax type / tax rate when backend omits them
- Location / team member / notes / amount when the current DTO does not provide them in a given report

### Genuine backend gaps still present

- Per-employee cancellations and no-shows
- Service time-series / trends
- Product inventory impact
- Customer lifetime revenue
- Cash flow opening / closing balances
- Invoice linkage in finance rows
- Some row-level invoice metadata in payment and gift card reports

### Frontend-derived values that should remain backend-owned if the canonical DTO is extended later

- Customer type derived from visit count in Customer Overview
- Average ticket fallback in Employee / Sales summary cards
- Service and product categorization derived from lookup tables when the row payload omits the category
- Payment / sale status fallback chains in the shared sales view model

---

## Active Report Audit

### 1) Sales Overview

- **Files**: `SalesOverviewReport.tsx`, `salesOverview.ts`, `salesOverviewViewModel.ts`
- **Endpoint**: `/tenant/bi/sales-overview`
- **Visible columns**: Sale Number, Invoice Number, Sale Date, Customer, Employee, Channel, Items, Gross Sales, Discount, VAT, Refund, Net Sales, Payment Method, Status
- **KPIs**: Revenue, Gross Sales, Net Sales, Discounts, Refunds, VAT, Customers, Appointments
- **Charts**: Business insights cards, Revenue Trend, Revenue by Employee, Revenue by Service, Revenue by Payment Method, Revenue by Category
- **Drawer fields**: Sale Number, Invoice Number, Sale Date, Customer, Employee, Channel, Status, Items, Gross Sales, Discounts, Taxes, Refund, Net Sales, Payment Method, Notes
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Populated correctly**: Sale identifiers, dates, customer / employee, gross / net / tax / discount values, payment method, chart data when backend series are present
- **Available in backend but not displayed everywhere yet**: Top product, highest sale, payment method trend series, detail path, refund mode
- **`Unavailable` but fillable**: Invoice Number, Channel, Items, Gross Sales, Net Sales, Refund, VAT, Status when the backend row omits them
- **Backend gaps**: `Invoice Number`, `Channel`, `Items`, `Gross Sales`, `Net Sales`, `Refund`, `VAT`, `Status`
- **Frontend-derived values**: Shared row model still uses fallback chains such as `status || saleStatus` and `paymentStatus || status`

### 2) Sales List

- **Files**: `SalesListReport.tsx`, `salesList.ts`
- **Endpoint**: `/tenant/bi/sales-overview`
- **Visible columns**: Sale Number, Sale Date, Appointment Reference, Invoice Number, Customer, Employee, Location, Channel, Status, Payment Method, Items Sold, Gross Sales, Discount, VAT, Net Sales, Amount Paid, Remaining Balance
- **KPIs**: Sales Count, Gross Sales, Net Sales, Discounts, VAT, Amount Paid, Remaining Balance, Invoices Linked
- **Drawer fields**: Uses the shared BI row drawer for the selected sale row
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Populated correctly**: Sale number, sale date, customer, employee, payment method, gross / net sales
- **Available in backend but not displayed everywhere yet**: Some source-row fields like booking reference and raw invoice linkage
- **`Unavailable` but fillable**: Invoice Number, Location, Amount Paid, Remaining Balance when the row payload omits them
- **Backend gaps**: `Invoice Number`, `Location`, `Amount Paid`, `Remaining Balance`
- **Frontend-derived values**: `itemsSold` and `location` can fall back to helper-derived strings when the backend omits them

### 3) Sales Log Details

- **Files**: `SalesLogDetailsReport.tsx`, `salesLogDetails.ts`
- **Endpoint**: `/tenant/financial/ledger`
- **Visible columns**: Date / Time, Sale Number, Appointment Reference, Invoice Number, Customer, Team Member, Item Type, Item Name, Category, Quantity, Unit Price, Gross, Discount, VAT, Net, Payment Method, Status
- **KPIs**: Line Items, Gross, VAT, Discounts, Customers, Sales, Item Types
- **Drawer fields**: General, Appointment, Services, Products, Payments, Discounts, Taxes, Timeline
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Populated correctly**: Date/time, sale number, appointment reference, invoice number, customer, employee, unit price, gross, VAT, payment method, status
- **Available in backend but not displayed everywhere yet**: Full invoice item arrays, source row payloads, payment / discount / tax timeline rows
- **`Unavailable` but fillable**: Item Type, Category, Discount, Net when the item payload omits them
- **Backend gaps**: `Item Type`, `Category`, `Discount`, `Net`
- **Frontend-derived values**: `itemType` and `category` are inferred from invoice item metadata when the row payload does not provide them directly

### 4) Discount Summary

- **Files**: `DiscountSummaryReport.tsx`, `discountSummary.ts`
- **Endpoint**: `/tenant/bi/sales-overview`
- **Visible columns**: Discount Category, Discount Type, Item, Category, Customer, Team Member, Gross Sales, Discount Amount, Discount %, Net Sales
- **KPIs**: Total Discounts, Discounted Bookings, Discounted Orders, Average Discount, Appointment Discount, Order Discount, Top Discounted Service, Top Discounted Order
- **Drawer fields**: General, Customer, Sale, Discount Details, Related Services, Related Products, Timeline
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Populated correctly**: Discount category, item, customer, team member, gross sales, discount amount
- **Available in backend but not displayed everywhere yet**: Top discounted service/order totals and counts
- **`Unavailable` but fillable**: Discount Type, Discount %, Net Sales, Invoice Number when omitted by the backend
- **Backend gaps**: `Discount Type`, `Discount %`, `Net Sales`, `Invoice Number`
- **Frontend-derived values**: Service / product filter options are derived from the visible rows when the backend does not provide separate option lists

### 5) Tax Summary

- **Files**: `TaxSummaryReport.tsx`, `taxSummary.ts`
- **Endpoint**: `/tenant/financial/ledger`
- **Visible columns**: Tax Type, Tax Rate, Item, Category, Customer, Team Member, Gross Sales, Tax Amount, Net Sales, Invoice Number
- **KPIs**: Total Tax, Gross Sales, Net Sales, Invoices Linked, Tax Types, Tax Rates, Taxed Services, Taxed Products
- **Drawer fields**: General, Customer, Invoice, Tax Details, Related Services, Related Products, Timeline
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Populated correctly**: Item, category, customer, employee, gross sales, tax amount, net sales when the ledger exposes them
- **Available in backend but not displayed everywhere yet**: Distinct invoice counts and top tax rows
- **`Unavailable` but fillable**: Tax Type, Tax Rate, Invoice Number when omitted by the backend
- **Backend gaps**: `Tax Type`, `Tax Rate`, `Invoice Number`, `Net Sales`
- **Frontend-derived values**: `itemType` can be used to bucket service/product rows for filter options and KPI counts

### 6) Gift Card List

- **Files**: `GiftCardListReport.tsx`, `giftCardList.ts`
- **Endpoint**: `/tenant/gift-cards/reports/transactions`
- **Visible columns**: Gift Card Code, Sale Number, Purchased By, Redeemed By, Customer, Status, Issue Date, Expiry Date, Original Amount, Redeemed Amount, Remaining Balance, Invoice Number
- **KPIs**: Gift Cards, Original Amount, Redeemed Amount, Remaining Balance, Issued, Redeemed, Partially Redeemed, Expired
- **Drawer fields**: General, Purchase, Redemption, Customer, Invoice, Timeline
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Populated correctly**: Gift card code, sale number, purchaser / redeemer, customer, status, issue / expiry dates, and the summary totals when present
- **Available in backend but not displayed everywhere yet**: Redemption collections and latest redemption detail objects
- **`Unavailable` but fillable**: Invoice Number, Original Amount, Redeemed Amount, Remaining Balance when the backend omits them
- **Backend gaps**: `Invoice Number`, `Original Amount`, `Redeemed Amount`, `Remaining Balance`
- **Frontend-derived values**: Issued / redeemed / partial / expired KPI counts are derived from the visible status values when the backend summary omits them

### 7) Customer Overview

- **Files**: `OperationsIntelligenceReport.tsx`, `operationsIntelligence.ts`
- **Endpoint**: `/tenant/reports/full?sections=overview,bookingTrends,customerAnalytics`
- **Visible columns**: Customer, Visits, Completed Visits, Revenue, Customer Type, First Visit, Last Visit
- **KPIs**: Customers, New Customers, Returning Customers, Customer Visits, Retention Rate, Top Customer, Customer Lifetime Revenue
- **Drawer fields**: The row drawer uses the same row model and shows the selected customer record details
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Charts**: Customer KPI cards only; no separate charts in this tab
- **Populated correctly**: Customers, visits, completed visits, revenue, first / last visit, retention rate, top customer
- **Available in backend but not displayed everywhere yet**: Any backend lifetime revenue field if the contract later adds it
- **`Unavailable` but fillable**: Customer Lifetime Revenue
- **Backend gaps**: `Customer Lifetime Revenue`
- **Frontend-derived values**: `Customer Type` is currently derived from visit count (`Returning Customer` vs `New Customer`)

### 8) Employee Performance

- **Files**: `OperationsIntelligenceReport.tsx`, `operationsIntelligence.ts`
- **Endpoint**: `/tenant/reports/full?sections=overview,employeePerformance`
- **Visible columns**: Employee, Appointments, Services Performed, Revenue, Average Ticket, Productivity, Completion Rate
- **KPIs**: Revenue, Appointments, Services Performed, Average Ticket, Productivity, Cancellations / No-shows
- **Drawer fields**: The row drawer uses the same row model and shows the selected employee record details
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Charts**: No dedicated chart series; KPI strip and table are the main surfaces
- **Populated correctly**: Revenue, appointments, services performed, average ticket, productivity, completion rate
- **Available in backend but not displayed everywhere yet**: If present later, per-employee cancellations and no-show breakdowns
- **`Unavailable` but fillable**: Cancellations / No-shows
- **Backend gaps**: `Per-employee cancellation counts`, `Per-employee no-show counts`
- **Frontend-derived values**: `Average Ticket` can fall back to a top-row or overview metric when the backend omits a direct row value

### 9) Service Performance

- **Files**: `OperationsIntelligenceReport.tsx`, `operationsIntelligence.ts`
- **Endpoint**: `/tenant/reports/full?sections=overview,servicePerformance`
- **Visible columns**: Service, Category, Quantity Sold, Revenue, Average Price, Completed, Completion Rate
- **KPIs**: Revenue, Quantity Sold, Average Price, Top Service, Completion Rate, Service Trends
- **Drawer fields**: The row drawer uses the same row model and shows the selected service record details
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Charts**: No separate chart series; the tab relies on KPI cards and the sortable table
- **Populated correctly**: Service name, category, quantity sold, revenue, completed bookings, completion rate
- **Available in backend but not displayed everywhere yet**: A backend time series for service trends, if later exposed
- **`Unavailable` but fillable**: Average Price, Service Trends when missing
- **Backend gaps**: `Service trend time series`
- **Frontend-derived values**: The service category filter list is built from the visible row values when the backend does not provide a separate category list

### 10) Product Performance

- **Files**: `OperationsIntelligenceReport.tsx`, `operationsIntelligence.ts`
- **Endpoint**: `/tenant/reports/full?sections=overview,products`
- **Visible columns**: Product, Category, Orders, Quantity Sold, Revenue, Average Price, Tenant Revenue
- **KPIs**: Product Revenue, Quantity Sold, Orders, Tenant Revenue, Top Product, Inventory Impact
- **Drawer fields**: The row drawer uses the same row model and shows the selected product record details
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Charts**: No separate chart series; KPI cards and the sortable table are the main surfaces
- **Populated correctly**: Product name, category, orders, quantity sold, revenue, tenant revenue
- **Available in backend but not displayed everywhere yet**: Any future backend inventory movement detail
- **`Unavailable` but fillable**: Average Price, Inventory Impact when missing
- **Backend gaps**: `Average price per sold unit`, `Inventory impact`, `Product trend time series`
- **Frontend-derived values**: Category filtering is derived from row values when the backend does not provide a dedicated option list

### 11) Finance Overview

- **Files**: `FinanceOverviewReport.tsx`, `financeOverview.ts`
- **Endpoint**: `/tenant/financial/overview` and `/tenant/financial/ledger`
- **Visible columns**: Transaction ID, Date, Reference, Customer, Employee, Service / Order, Payment Method, Revenue, Tax, Discount, Status, Source
- **KPIs**: Gross Sales, Net Sales, Total Payments, Outstanding, Refunds, Taxes, Discounts, Net Collected
- **Charts**: Finance Charts, payment trend line, payment-method bars, settlement bars, and collected/outstanding tiles
- **Drawer fields**: Payment History, Transactions, Appointment Linkage, Invoice, Refund History, Discounts and Taxes, Audit Timeline
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Populated correctly**: Transaction metadata, revenue, tax, discount, status, source, payment trend rows, payment-method rows, settlement rows
- **Available in backend but not displayed everywhere yet**: Detailed refund / payment / settlement source rows beyond the main ledger summary
- **`Unavailable` but fillable**: Invoice linkage/reference when the backend row does not expose it
- **Backend gaps**: `Invoice` linkage / reference
- **Frontend-derived values**: None for accounting totals; the component intentionally reads backend totals directly

### 12) Payment Transactions

- **Files**: `PaymentTransactionsReport.tsx`, `paymentTransactions.ts`
- **Endpoint**: `/tenant/financial/ledger`
- **Visible columns**: Payment Date, Payment Number, Sale Number, Appointment Reference, Customer, Team Member, Location, Payment Method, Transaction Type, Payment Status, Payment Amount, Invoice Number, Notes
- **KPIs**: Payment Count, Gross Revenue, Refunds, Net Collected
- **Drawer fields**: General, Payment, Customer, Appointment, Invoice, Timeline
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Charts**: None; this report is table-first
- **Populated correctly**: Payment date, payment number, sale number, appointment reference, customer, payment method, transaction type, status
- **Available in backend but not displayed everywhere yet**: Raw payment and revenue rows, detail path, source rows
- **`Unavailable` but fillable**: Invoice Number, Notes, Team Member, Location, Payment Amount when the row payload omits them
- **Backend gaps**: `Invoice Number`, `Notes`, `Team Member`, `Location`, `Payment Amount`
- **Frontend-derived values**: `Transaction Type` is mapped from the canonical payment row type/status labels, but the accounting value itself still comes from backend rows

### 13) Cash Flow Summary

- **Files**: `CashFlowSummaryReport.tsx`, `cashFlowSummary.ts`
- **Endpoint**: `/tenant/financial/ledger`
- **Visible columns**: Period (Day / Week / Month), Opening Balance, Cash In, Cash Out, Net Movement, Closing Balance, Cash Payments, Card Payments, Online Payments, Wallet Payments, Bank Transfer Payments
- **KPIs**: Periods, Cash In, Cash Out, Net Movement
- **Drawer fields**: General, Opening Balance, Inflows, Outflows, Payment Breakdown, Timeline
- **Exports**: CSV, Excel, PDF, Print export the filtered visible columns
- **Charts**: None; the report is table-first
- **Populated correctly**: Period grouping, cash in/out, net movement, payment-method breakdown where the ledger exposes it
- **Available in backend but not displayed everywhere yet**: Source rows by period
- **`Unavailable` but fillable**: Opening Balance, Closing Balance
- **Backend gaps**: `Opening Balance`, `Closing Balance`
- **Frontend-derived values**: Grouping and payment-method filtering are presentation controls; balances are intentionally not recalculated in the frontend

---

## Hidden / Legacy Reports

The following 13 tabs exist in `src/components/ReportsWorkspace.tsx`, but that component is not mounted by the active workspace:

1. Overview
2. Sales
3. Financial
4. Appointments
5. Rebookings
6. Employees
7. Services
8. Products
9. Discounts
10. Refunds
11. Payment Methods
12. Customer Sales
13. Advanced Analytics

These are counted as **hidden / legacy** in this audit.

## Conclusion

- The current BI shell is fully wired to live report components.
- No report is a pure placeholder screen.
- Every active report still has at least one declared backend gap or a fallback value that should stay backend-owned.
- The largest gap areas are:
  - customer lifetime revenue
  - per-employee cancellations / no-shows
  - service trend time series
  - product inventory impact
  - cash flow opening / closing balances
  - invoice linkage metadata in finance / payment / gift-card views
