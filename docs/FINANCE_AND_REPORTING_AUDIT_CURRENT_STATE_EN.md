# Finance and Reporting Audit

This document records the current state of the tenant dashboard Finance and Reporting areas in the Refah codebase.

It answers three questions:

1. What each section actually displays today.
2. Where the data comes from.
3. What is missing or misleading, especially around pagination and customer names.

## 1. Scope

Audited screens:

1. Finance workspace
   - `tenant/src/app/[locale]/dashboard/financial/page.tsx`
2. Reports workspace
   - `tenant/src/app/[locale]/dashboard/reports/page.tsx`
3. Report generate page
   - `tenant/src/app/[locale]/dashboard/reports/generate/page.tsx`
4. Report preview page
   - `tenant/src/app/[locale]/dashboard/reports/preview/page.tsx`

Audited server sources:

1. `server/src/controllers/tenantFinancialController.js`
2. `server/src/controllers/tenantReportsController.js`
3. `server/src/services/financialService.js`
4. `server/src/services/tenantReportPdfService.js`

## 2. Main Audit Findings

1. Customer sales currently shows many users as `Guest Customer` because the report builder falls back to a guest label when a user record is missing or incomplete.
2. Most finance and reporting tables do not have pagination controls.
3. Several tables only show a top slice of rows, so the user cannot know from the UI if more rows exist.
4. The reports area is more of a summary and export workspace than a deep analytics explorer.
5. The PDF export was recently improved, but the content still depends on the selected sections and the available backend shapes.

## 3. Finance Workspace Current State

### 3.1 Overview Section

Path:

- `tenant/src/app/[locale]/dashboard/financial/page.tsx`

Current display:

1. Total bookings
2. Total revenue
3. Tenant revenue
4. Unique customers
5. Average booking value
6. Completion rate
7. Retention rate
8. Pending revenue
9. Booking trend chart
10. Operational summary cards
11. Top services
12. Top customers

Current data source:

1. `tenantApi.getFinancialOverview(params)`
2. `tenantApi.getLandingSummary(params)`
3. `tenantApi.getCustomerAnalytics(params)`
4. `tenantApi.getServiceRevenue(params)`
5. `tenantApi.getEmployeePerformance(params)`

Real state:

1. This section is KPI-heavy.
2. It is not a detailed ledger view.
3. Top services and top customers are capped by internal slices, not paginated.

Pagination:

1. No pagination controls.
2. Some lists are truncated with `slice(0, 5)` or similar.

### 3.2 Sales Section

Current display:

1. Revenue trend
2. Revenue mix
3. Top services
4. Top customers

Real state:

1. This is a summary visualization section.
2. It does not show the full raw transaction list.

Pagination:

1. No pagination.
2. Some lists are limited to the top rows only.

### 3.3 Financial Section

Current display:

1. Gross revenue
2. Fees and commissions
3. Tenant revenue

Real state:

1. This is a high-level financial snapshot.
2. It does not expose all accounting detail rows.

Pagination:

1. No pagination.

### 3.4 Appointments Section

Current display:

1. Total bookings
2. Completed bookings
3. Cancelled bookings
4. No-show bookings

Real state:

1. This is a KPI-only section.
2. It does not list appointment rows.

Pagination:

1. No pagination.

### 3.5 Rebookings Section

Current display:

1. Rebooking rate
2. Repeat customers
3. Rebooked revenue
4. Rebooked appointments
5. Trend chart
6. Top rebooking employees
7. Rebooking rows table

Real state:

1. This section is more detailed than most other finance sections.
2. It still behaves like a summary/report, not a fully pageable table explorer.

Pagination:

1. No pagination controls.
2. The UI shows all available rows currently returned by the API.

### 3.6 Employees Section

Current display:

1. Employee name
2. Bookings
3. Revenue
4. Commission

Real state:

1. This is a flat table view of employee performance.
2. If the API returns many employees, the UI renders them all in one table.

Pagination:

1. No pagination.

### 3.7 Services Section

Current display:

1. Service name
2. Bookings
3. Revenue
4. Tenant revenue
5. Completion rate in the reports view

Real state:

1. This is a detailed service-performance summary.
2. It still renders as one table with no paging.

Pagination:

1. No pagination.

### 3.8 Products Section

Current display:

1. Product name
2. Orders
3. Quantity
4. Revenue
5. Tenant revenue

Real state:

1. This is a product performance summary.
2. It is not a catalog inventory view.

Pagination:

1. No pagination.

### 3.9 Discounts Section

Current display:

1. Total discounts
2. Booking discounts
3. Order discounts
4. Average discount
5. Top discounted services
6. Top discounted orders

Real state:

1. Summary cards plus two top-item tables.
2. The tables show only the top rows returned by the backend.

Pagination:

1. No pagination.

### 3.10 Refunds Section

Current display:

1. Total refunds
2. Payment methods count
3. Net collected

Real state:

1. This section is a refund snapshot.
2. The detailed refund rows are shown only in the reports workspace, not as a pageable finance explorer.

Pagination:

1. No pagination.

### 3.11 Payment Methods Section

Current display:

1. Payment method
2. Collected
3. Refunded
4. Transactions

Real state:

1. This shows aggregate payment mix by method.
2. It is not a transaction list.

Pagination:

1. No pagination.

### 3.12 Customer Sales Section

Current display:

1. Customer name
2. Bookings
3. Completed
4. Revenue

Real state:

1. This is built from payment transactions linked to appointments or orders.
2. If the linked user is missing or incomplete, the backend falls back to a guest label.
3. That is why some rows show `Guest Customer`.

Pagination:

1. No pagination.
2. The table renders all rows returned by the API.

## 4. Why Customer Sales Can Show Guest Customer

Current backend behavior:

1. Customer sales rows are built from payment transactions.
2. The builder reads `transaction.appointment.user` or `transaction.order.user`.
3. The customer name helper falls back to email, phone, or `Guest Customer`.

Important consequence:

1. If the transaction is tied to a booking with no real user profile, the row becomes a guest row.
2. If the transaction user exists but the profile is incomplete, the fallback still applies.

Current source:

- `server/src/controllers/tenantReportsController.js`

Related behavior:

1. `buildCustomerSalesRows(transactions)` groups by user id/email/phone.
2. The UI in finance simply renders the returned name.

## 5. Reports Workspace Current State

### 5.1 Overview Section

Current display:

1. Total revenue
2. Tenant revenue
3. Net revenue
4. Bookings

Real state:

1. The reports overview is much shorter than the financial overview.
2. It acts more like a preview summary than a full financial statement.

Pagination:

1. Not applicable.

### 5.2 Employee Section

Current display:

1. Employee name
2. Bookings
3. Revenue
4. Commission
5. Total earnings

Real state:

1. Full table, no paging.

### 5.3 Service Section

Current display:

1. Service name
2. Bookings
3. Revenue
4. Tenant revenue
5. Completion rate

Real state:

1. Full table, no paging.

### 5.4 Product Section

Current display:

1. Product name
2. Orders
3. Quantity
4. Revenue
5. Tenant revenue

Real state:

1. Full table, no paging.

### 5.5 Booking Trends Section

Current display:

1. Date
2. Bookings
3. Completed
4. Revenue

Real state:

1. Trend table with chart support.
2. In the UI preview and export, this is typically limited by the selected date range.

Pagination:

1. No pagination.

### 5.6 Financial Section

Current display:

1. Gross revenue
2. Tenant revenue
3. Net revenue
4. Taxes
5. Platform fees
6. Employee commissions

Real state:

1. This is a financial summary table.
2. It is not a full accounting export.

### 5.7 Discounts Section

Current display:

1. Total discounts
2. Booking discounts
3. Order discounts
4. Average discount
5. Top discounted services
6. Top discounted orders

Real state:

1. Summary plus top-item tables.
2. No paging.

### 5.8 Refunds Section

Current display:

1. Date
2. Customer
3. Reference
4. Amount
5. Method

Real state:

1. The reports workspace shows the detailed refund rows directly.
2. This is one of the more detailed sections available.

### 5.9 Payment Methods Section

Current display:

1. Method
2. Revenue
3. Transactions

Real state:

1. Aggregate payment-method table.
2. No paging.

### 5.10 Customer Sales Section

Current display:

1. Customer
2. Bookings
3. Completed
4. Revenue

Real state:

1. Uses the backend customer sales builder.
2. Guest or incomplete profiles may show as `Guest Customer`.

## 6. PDF Export Current State

The PDF export uses:

1. `server/src/services/tenantReportPdfService.js`
2. `server/src/controllers/tenantReportsController.js`

Current PDF overview content:

1. Financial summary cards
2. Booking summary cards
3. Discount summary
4. Top discounted services
5. Top discounted orders
6. Then selected report sections such as daily revenue, booking trends, payment methods, refunds, customer sales, rebookings, employees, services, and products

Current PDF quality state:

1. Better than before.
2. Still depends on which sections are selected.
3. It is a report export, not a full interactive data explorer.

## 7. Pagination Audit

Current pagination status:

1. Finance overview cards: no pagination.
2. Sales top-customer / top-service tables: no pagination, top slices only.
3. Employees table: no pagination.
4. Services table: no pagination.
5. Products table: no pagination.
6. Discounts tables: no pagination.
7. Refunds table: no pagination.
8. Payment methods table: no pagination.
9. Customer sales table: no pagination.
10. Reports preview tables: no pagination.

What this means:

1. The UI usually shows the full data returned by the backend.
2. In some sub-views, the backend intentionally returns only the top N rows.
3. The user cannot always tell whether the table is complete or truncated.

## 8. Real Data vs Display Gaps

### Customer Sales

What is real:

1. Built from payment transactions.
2. Tied to appointments or orders with a user record.

What is missing:

1. Better display of true customer identity when available.
2. Pagination or row count indicators.
3. A total row count or “showing X of Y” marker.

### Finance Tables

What is real:

1. The data is aggregated from finance and report controllers.
2. Many sections are summary-only.

What is missing:

1. Pagination for long tables.
2. Clear indication of completeness.
3. Drill-down links in many tables.

### Reports

What is real:

1. The reports section is a configurable report builder and preview/export workspace.

What is missing:

1. More granular detail in some sections.
2. A stronger “source row” explanation for each report line.
3. Consistent pagination or virtual scrolling for long tables.

## 9. Recommended Next Improvements

1. Add pagination or page-size controls to every long table.
2. Add row-count text like `Showing 1-20 of 124`.
3. Add a `Real customer / Guest customer` badge in customer sales.
4. Add drill-down links from report rows to the underlying appointment/order/payment record.
5. Add export metadata that tells the user whether the table is complete or top-N only.
6. Expand the report preview to expose more detail sections where useful.

## 10. Bottom Line

The Finance and Reporting areas currently behave as a mixed summary and export workspace:

1. Some sections are rich summary dashboards.
2. Some sections are top-row extracts.
3. Some sections are full flat tables.
4. Most sections do not yet have pagination.

So your concern is valid:

1. The user cannot always know if the table is complete.
2. Customer sales can collapse into guest labels.
3. The reports do not yet expose every detail in a fully explorer-style way.

This audit should be used as the baseline before redesigning the finance/reporting experience.
