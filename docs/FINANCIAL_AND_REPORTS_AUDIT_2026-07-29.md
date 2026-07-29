# Financial and Reports Audit

Date: 2026-07-29

This document captures the current audit state of the Finance and Reports area in Tenant-v2.

It focuses on backend/frontend contract issues, data mapping mismatches, and places where the frontend still performs business interpretation that should come from canonical backend data.

## Scope

Audited areas:

1. Shared BI shell
2. Reports workspace
3. Finance overview
4. Payment transactions
5. Cash flow summary
6. Sales overview
7. Gift card list
8. Operations intelligence
9. Tenant auth profile bootstrap noise

Audited files:

1. `Tenant-v2/src/components/bi/BIReportShell.tsx`
2. `Tenant-v2/src/components/bi/BIDataTable.tsx`
3. `Tenant-v2/src/components/bi/BIReportToolbar.tsx`
4. `Tenant-v2/src/components/bi/BIReportFilters.tsx`
5. `Tenant-v2/src/components/ReportsWorkspace.tsx`
6. `Tenant-v2/src/components/FinanceReportsWorkspace.tsx`
7. `Tenant-v2/src/components/reports/SalesOverviewReport.tsx`
8. `Tenant-v2/src/components/reports/FinanceOverviewReport.tsx`
9. `Tenant-v2/src/components/reports/PaymentTransactionsReport.tsx`
10. `Tenant-v2/src/components/reports/CashFlowSummaryReport.tsx`
11. `Tenant-v2/src/components/reports/GiftCardListReport.tsx`
12. `Tenant-v2/src/components/reports/OperationsIntelligenceReport.tsx`
13. `Tenant-v2/src/lib/tenantApiAdapter.ts`
14. `Tenant-v2/src/lib/bi/reports/salesOverview.ts`
15. `Tenant-v2/src/lib/bi/reports/salesOverviewViewModel.ts`
16. `Tenant-v2/src/lib/bi/reports/financeOverview.ts`
17. `Tenant-v2/src/lib/bi/reports/paymentTransactions.ts`
18. `Tenant-v2/src/lib/bi/reports/cashFlowSummary.ts`
19. `Tenant-v2/src/lib/bi/reports/discountSummary.ts`
20. `Tenant-v2/src/lib/bi/reports/taxSummary.ts`
21. `Tenant-v2/src/lib/bi/reports/giftCardList.ts`
22. `Tenant-v2/src/lib/bi/reports/operationsIntelligence.ts`
23. `server/src/controllers/tenantFinancialController.js`
24. `server/src/controllers/tenantReportsController.js`
25. `server/src/routes/tenantRoutes.js`

## Executive Summary

1. The report shell is structurally stable.
2. The largest remaining risks are contract drift and frontend-derived accounting/grouping.
3. At least one backend normalization rule is inconsistent with the business domain: `bank_transfer` is grouped as `card`.
4. Several report filters are still local-only, which means the UI looks server-driven but the backend is not actually receiving all filter criteria.
5. The cash flow summary still performs grouping and movement calculations in the frontend.

## Findings

### 1. Cash Flow Summary still performs accounting in the frontend

- File: `Tenant-v2/src/components/reports/CashFlowSummaryReport.tsx`
- Main logic: `buildCashFlowRows(...)`
- Related helpers: `groupStart`, `groupEnd`, `groupLabel`

Observed behavior:

1. The component groups ledger rows by day, week, or month in the UI.
2. It calculates `cashIn`, `cashOut`, `netMovement`, and the payment-method breakdown client-side.
3. `openingBalance` and `closingBalance` remain unavailable in the current payload usage and are rendered as `Unavailable`.

Why this is a problem:

1. Financial movement calculations should come from canonical backend values.
2. The frontend should not be responsible for producing accounting totals that can drift from the source of truth.

Risk level: High

---

### 2. Bank transfer is grouped as card in backend report normalization

Backend file:

1. `server/src/controllers/tenantFinancialController.js`
2. `server/src/controllers/tenantReportsController.js`

Relevant helper:

- `normalizeLedgerPaymentMethodGroup(paymentMethod)`

Observed behavior:

1. `cash`, `pay_on_visit`, and `cash_on_delivery` are grouped as `cash`.
2. `wallet` is grouped as `wallet`.
3. `gift_card_code` is grouped as `gift_card`.
4. `split` is grouped as `split`.
5. `card_pos`, `online`, `online-full`, `mock_online`, and `bank_transfer` are grouped as `card`.

Why this is a problem:

1. `bank_transfer` is a distinct payment method.
2. Grouping it as `card` distorts payment-method and finance summaries.
3. This is a backend normalization mismatch, not only a UI issue.

Risk level: High

---

### 3. Sales Overview uses fallback status interpretation instead of strict canonical mapping

- File: `Tenant-v2/src/lib/bi/reports/salesOverviewViewModel.ts`
- Function: `buildSalesOverviewRows(...)`

Observed behavior:

1. `paymentStatus` is derived from `row.paymentStatus || row.status || saleStatus`.
2. `saleStatus` is derived from `row.saleStatus || row.status || '-'`.

Why this is a problem:

1. The frontend is interpreting status semantics instead of consuming one canonical field.
2. This can silently hide backend contract drift.

Risk level: Medium

---

### 4. Sales Overview refund KPI depends on nested response shape

- File: `Tenant-v2/src/components/reports/SalesOverviewReport.tsx`

Observed behavior:

1. The KPI reads `report.finance?.refunds?.totals?.refundAmount || 0`.
2. This assumes refunds are always exposed as a nested `totals` object.

Why this is a problem:

1. If the backend returns refunds in a different shape, the KPI falls back to `0`.
2. That can make valid production values appear missing.

Risk level: Medium

---

### 5. Several report filters are still local-only

Files involved:

1. `Tenant-v2/src/components/reports/FinanceOverviewReport.tsx`
2. `Tenant-v2/src/components/reports/PaymentTransactionsReport.tsx`
3. `Tenant-v2/src/components/reports/CashFlowSummaryReport.tsx`
4. `Tenant-v2/src/components/ReportsWorkspace.tsx`

Observed behavior:

1. Many filters are applied after the payload loads.
2. The backend query is often only date-ranged, while employee, payment method, location, status, source, and amount filters are handled in memory.
3. The UI gives the impression of a fully server-driven filter framework, but many filters are actually client-side only.

Why this is a problem:

1. It increases the chance of mismatch between displayed results and backend totals.
2. It makes filter semantics harder to keep aligned with the production tenant.

Risk level: Medium

---

### 6. Operations Intelligence derives customer type from visit count

- File: `Tenant-v2/src/components/OperationsIntelligenceReport.tsx`
- Area: Customer overview

Observed behavior:

1. `customerType` is derived from `visits > 1 ? 'Returning Customer' : 'New Customer'`.
2. `lifetimeRevenue` is currently unavailable in the UI and appears as a backend gap note.

Why this is a problem:

1. `customerType` is not coming from a canonical backend field.
2. This is frontend business interpretation, not a strict DTO mapping.

Risk level: Medium

---

### 7. Gift card reporting is aligned

- File: `Tenant-v2/src/components/reports/GiftCardListReport.tsx`
- Canonical field used: `summary.totalRedeemedAmount`

Audit result:

1. The current frontend mapping matches the backend contract for gift-card redemption totals.
2. The earlier `redeemedAmount` vs `totalRedeemedAmount` mismatch is not present in the current implementation.

Risk level: Low

---

### 8. `/tenant/profile` 401s are bootstrap noise, not report-specific retries

- File: `Tenant-v2/src/lib/tenantApiAdapter.ts`
- Related consumer: `Tenant-v2/src/components/TenantAuthContext.tsx`

Observed behavior:

1. The adapter automatically attaches Bearer tokens for tenant API calls when an access token exists.
2. The adapter intentionally does not retry unauthorized requests for `/tenant/profile`.
3. The repeated 401s appear to be auth bootstrap or stale-token behavior, not caused by the reporting screens themselves.

Why this matters:

1. These console messages can be mistaken for report failures.
2. They are separate from the finance/report contract issues.

Risk level: Low to Medium

## Report-by-Report Status

### Finance Overview

Status:

1. Works structurally.
2. Still depends on local filtering after load.
3. Must not recalculate canonical amounts in the frontend.

### Payment Transactions

Status:

1. Endpoint and report definition are aligned.
2. UI mapping is generally correct.
3. Still uses local filtering semantics.

### Cash Flow Summary

Status:

1. Main risk area.
2. The frontend is still grouping and deriving movement values.
3. Opening and closing balances are not currently coming from the backend payload used by the UI.

### Sales Overview

Status:

1. Broadly aligned with the backend report route.
2. Uses fallback chains for statuses.
3. Refund KPI shape should be verified against the backend response.

### Gift Card List

Status:

1. Aligned with backend summary field names.
2. No active contract mismatch found in the current implementation.

### Operations Intelligence

Status:

1. Mostly powered by the full report payload.
2. Contains some frontend-derived business interpretation.
3. Customer type derivation should be treated as a contract-risk area.

## Backend / Frontend Mismatch Summary

1. `bank_transfer` is normalized as `card` in backend reporting helpers.
2. Cash flow still calculates grouped totals in the frontend.
3. Sales Overview and Operations Intelligence use fallback interpretation chains.
4. Several filters are local-only rather than backend-driven.
5. Some KPIs depend on nested payload shapes that can silently return `0`.

## Technical Verdict

1. The report engine is usable.
2. The most serious issue is not missing screens.
3. The most serious issue is **contract drift** between the canonical backend values and the frontend mapping/calculation layer.
4. The finance/report stack needs stricter backend-first consumption for totals, grouping, and payment-method normalization.

