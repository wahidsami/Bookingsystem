# Reports and Finance Issue Breakdown

## Scope

This document captures the current reporting and finance failures observed in Tenant-v2 and the production tenant report surfaces.

The goal is to make the failure modes explicit so the financial/reporting stack can be repaired in the correct order.

## What is currently happening

The reports area is not failing for one single reason.

It is failing because multiple layers are overlapping:

1. Some backend report endpoints are returning `500`.
2. Some frontend report shells silently fall back to empty arrays or `null`.
3. Some report tables still derive values locally instead of rendering the canonical backend DTO directly.
4. Some UI mappings expect field names that do not always match the backend shape.
5. The auth bootstrap still emits `401` noise on `/tenant/profile` and `/tenant/settings`, which adds console clutter but is separate from the financial `500` failures.

## Confirmed console errors

- `GET /api/v1/tenant/profile` -> `401 Unauthorized`
- `GET /api/v1/tenant/settings` -> `401 Unauthorized`
- `GET /api/v1/tenant/financial/ledger?...` -> `500`
- `GET /api/v1/tenant/financial/overview?...` -> `500`

These two financial `500`s are the main reason the finance and sales report surface appears empty or full of zeros.

## Main frontend files involved

- `Tenant-v2/src/components/ReportsWorkspace.tsx`
- `Tenant-v2/src/lib/tenantApiAdapter.ts`
- `tenant/src/app/[locale]/dashboard/reports/page.tsx`
- `tenant/src/app/[locale]/dashboard/reports/financial/page.tsx`
- `tenant/src/app/[locale]/dashboard/reports/sales/page.tsx`

## Main backend files involved

- `server/src/controllers/tenantFinancialController.js`
- `server/src/controllers/tenantReportsController.js`

## Why the reports look empty

### 1) The reports shell converts failures into empty state

The shared reports workspace loads many endpoints through `Promise.allSettled()`.

When one endpoint fails, the component does not crash. It quietly falls back to:

- `[]`
- `null`
- zero values

That means a real backend failure can look like an empty report instead of a visible error.

Relevant file:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Relevant loading block:

- the fetch block around `fetchReportData()`
- the fallback assignments to `summaryData`, `financialOverviewData`, `financialLedgerData`, `refundsData`, `paymentMethodsData`, `advancedAnalyticsData`

### 2) The finance endpoints are failing before the UI can render useful data

The two most important endpoints are:

- `GET /api/v1/tenant/financial/overview`
- `GET /api/v1/tenant/financial/ledger`

Both are returning `500` in the browser console.

That breaks:

- Finance Overview
- Sales Overview
- Sales List
- Sales Log Details
- Discount Summary
- Tax Summary
- Payment Transactions
- Cash Flow Summary

### 3) Some report rows are still derived locally

The report shell still computes some values from appointment or transaction rows on the frontend.

Examples in `Tenant-v2/src/components/ReportsWorkspace.tsx`:

- `buildSalesReportRows()`
- `buildCustomerSalesRows()`
- `mapFinancialRows()`
- `mappedPaymentMethods`
- `mappedRefunds`
- `mappedDiscounts`
- `mappedProducts`

That is risky because the frontend can only be correct if the backend shape is exactly what the client expects.

---

## Report-by-report breakdown

### 1. Overview & Analytics

Status:

- Partial

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`
- `tenant/src/app/[locale]/dashboard/reports/page.tsx`

Backend endpoints used:

- `/tenant/reports/summary`
- `/tenant/financial/overview`
- `/tenant/reports/booking-trends`
- `/tenant/reports/service-performance`
- `/tenant/reports/employee-performance`
- `/tenant/reports/customer-analytics`
- `/tenant/reports/rebookings`
- `/tenant/reports/refunds`
- `/tenant/reports/payment-methods`
- `/tenant/reports/advanced-analytics`

Issue:

- The overview screen is a mixed dashboard. It shows some data, but the finance and reporting KPIs collapse when the financial endpoints fail.
- The shared shell falls back to empty values instead of surfacing the backend failure clearly.

Why it appears empty:

- `financial/overview` and `financial/ledger` are returning `500`
- the shell converts failed requests into `null`/`[]`

### 2. Sales Overview

Status:

- Broken / partial depending on backend response

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/sales/page.tsx`
- `tenant/src/app/[locale]/dashboard/reports/sales/summary/page.tsx`
- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoints used:

- `/tenant/financial/overview`
- `/tenant/financial/ledger`
- `/tenant/reports/booking-trends`
- `/tenant/reports/customer-analytics`

Issue:

- Sales Overview depends on the same finance endpoints that are currently returning `500`.
- The report shell also builds sales rows from ledger transactions locally, so if the ledger payload is empty or shaped differently, the chart/table becomes zeroed out.

Specific frontend risk:

- `buildSalesReportRows()` counts rows as bookings and treats completed status as the primary source for several derived values.
- That can undercount valid revenue scenarios if the backend ledger contains paid rows with non-completed appointment statuses.

### 3. Sales List

Status:

- Broken / empty when ledger fails

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/sales/list/page.tsx`

Backend endpoint used:

- `/tenant/financial/ledger`

Issue:

- The list is fed by the financial ledger.
- Since `financial/ledger` returns `500`, the sales list cannot reliably render rows.

### 4. Sales Log Details

Status:

- Broken / empty when ledger fails

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/sales/log-details/page.tsx`

Backend endpoint used:

- `/tenant/financial/ledger`

Issue:

- Same root cause as Sales List.
- The report depends on the ledger response and therefore inherits the `500`.

### 5. Discount Summary

Status:

- Partial

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/sales/discounts/page.tsx`
- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/financial/overview`

Issue:

- The discount report uses `overview.discountTotals`.
- If `financial/overview` fails, the discount tables become empty or default to zero.

### 6. Tax Summary

Status:

- Partial / backend-dependent

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/sales/taxes/page.tsx`

Backend endpoints used:

- `/tenant/financial/ledger`
- `/tenant/financial/overview`

Issue:

- Tax values are not trusted from the frontend; they must come from backend fields.
- If the finance endpoints fail, tax rows and totals collapse to zero or `Unavailable`.

### 7. Gift Card List

Status:

- Needs backend shape verification

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/sales/gift-cards/page.tsx`

Backend endpoint used:

- Gift card reporting data from the finance/report backend

Issue:

- This page depends on canonical gift-card transaction fields.
- If the backend names do not match the page DTO exactly, the list can render as empty or show placeholders.

### 8. Finance Overview

Status:

- Broken

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/financial/page.tsx`
- `tenant/src/app/[locale]/dashboard/reports/financial/summary/page.tsx`

Backend endpoint used:

- `/tenant/financial/overview`

Issue:

- The browser console shows `500` from this endpoint.
- Every KPI and downstream report card that depends on this endpoint becomes empty or zeroed out.

### 9. Payment Transactions

Status:

- Broken / backend-dependent

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/financial/payment-transactions/page.tsx`
- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/financial/ledger`

Issue:

- The page expects canonical payment transaction rows.
- When the ledger endpoint fails, the report empties.

### 10. Cash Flow Summary

Status:

- Broken / backend-dependent

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/financial/cash-flow/page.tsx`

Backend endpoint used:

- `/tenant/financial/ledger`

Issue:

- Cash flow is built from the same ledger family.
- If ledger fails, cash in / cash out / net movement values disappear.

### 11. Appointments Report

Status:

- Currently not one of the confirmed `500` failures, but still mapping-sensitive

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/appointments`

Issue:

- The report uses appointment status and payment status mappings that can undercount if the backend status naming differs from the UI’s assumptions.
- Customer sales currently only counts `completed` appointments, so paid appointments with other statuses can be excluded.

### 12. Employees Report

Status:

- Likely functional, but still backend-shape sensitive

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/reports/employee-performance`

Issue:

- The page expects employee performance rows and maps `name`, `commissionRate`, `revenue`, and `completionRate`.
- If the backend DTO changes shape, names or metrics can collapse to dashes or zero.

### 13. Services Report

Status:

- Likely functional, but name/category mapping is fragile

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/reports/service-performance`

Issue:

- The frontend maps service names and categories using:

  - `row.id`
  - `name_en`
  - `name_ar`
  - `category`
  - the service catalog lookup

- If the backend returns a different key name for the service identifier, the table can show blanks or `-` for service name/category.

### 14. Products Report

Status:

- Likely functional, but stock/revenue mapping is fragile

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoints used:

- `/tenant/products`
- `/tenant/financial/products`

Issue:

- The table merges product catalog data with product revenue rows by `product.id`.
- If the revenue row key does not match the product catalog key exactly, sold/revenue/category can appear as zero or `-`.

### 15. Refunds Report

Status:

- Backend-dependent and may be legitimately empty if there are no refunds

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/financial/page.tsx`
- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/reports/refunds`

Issue:

- The backend builder returns:

  - `refunds`
  - `totals`

- If the frontend is expecting another shape, the page can appear empty.
- If there are no refund transactions, an empty report is expected.

### 16. Payment Methods Report

Status:

- Backend-dependent and shape-sensitive

Where it lives:

- `tenant/src/app/[locale]/dashboard/reports/financial/page.tsx`
- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/reports/payment-methods`

Backend response shape:

- `rows`
- `trend`
- `totals`

Frontend expectation:

- `paymentMethodsData.rows`
- `paymentMethodsData.totals`

Issue:

- If the backend response is empty or the frontend fails to map `paymentMethodLabel` correctly, the UI will look blank even when transactions exist.

### 17. Customer Sales

Status:

- Incorrect business logic risk

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend source:

- appointment rows from `/tenant/appointments`

Issue:

- The current client logic only counts appointments with `status === 'completed'`.
- That is too narrow for the live accounting model because paid appointments may exist with other statuses.
- This can undercount visits and revenue contribution.

### 18. Rebooking Analytics

Status:

- Likely functional

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`
- `tenant/src/app/[locale]/dashboard/reports/page.tsx`

Backend endpoint used:

- `/tenant/reports/rebookings`

Issue:

- No confirmed `500` was observed in the current console evidence.
- Still depends on backend DTO shape.

### 19. Advanced Analytics

Status:

- Likely functional, but still backend-shape sensitive

Where it lives:

- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Backend endpoint used:

- `/tenant/reports/advanced-analytics`

Issue:

- The shell expects comparative analytics in a specific nested structure.
- If the backend response changes shape, the charts and KPI cards will collapse to zero.

---

## Frontend mapping issues worth fixing after the backend 500s

These are not the primary source of the current finance outage, but they can still hide data:

1. `ReportsWorkspace.tsx` maps empty values silently instead of surfacing the backend failure.
2. `buildSalesReportRows()` derives values locally from ledger rows instead of consuming a canonical sales DTO.
3. `buildCustomerSalesRows()` counts only `completed` appointments.
4. Service and product tables rely on exact field name matches between catalog data and performance data.
5. Payment methods and refunds depend on DTO names staying exactly aligned with the backend response.

---

## What is most likely breaking the financial feature right now

Priority 1:

- `GET /api/v1/tenant/financial/overview` returning `500`
- `GET /api/v1/tenant/financial/ledger` returning `500`

Priority 2:

- local fallback logic turning failures into empty arrays/null

Priority 3:

- a few report tables still using frontend-derived values or strict field-name assumptions

---

## Recommended fix order

1. Fix the backend `500` errors in `financial/overview` and `financial/ledger`.
2. Stop the reports shell from silently flattening backend failures into empty state.
3. Align the report DTOs and table mappings for:
   - services
   - products
   - payment methods
   - refunds
   - customer sales
4. Remove any remaining frontend-only financial derivations where the backend already exposes canonical values.

