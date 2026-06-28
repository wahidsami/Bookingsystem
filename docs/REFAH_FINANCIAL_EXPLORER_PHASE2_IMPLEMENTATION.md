# Refah Financial Explorer Phase 2 Implementation

This document captures the drill-down architecture added to the Finance and Reports areas of the tenant dashboard.

## 1. Objective

Transform summary-only analytics surfaces into explorer-style workspaces without changing:

1. Backend calculations.
2. Existing APIs.
3. Existing report exports.
4. Existing navigation flows.

## 2. Reused Components

Existing reusable surfaces were kept and extended instead of duplicated:

1. `tenant/src/components/AnalyticsDataTable.tsx`
2. `tenant/src/components/AnalyticsDetailsDrawer.tsx`
3. `tenant/src/components/AppointmentDetailsDrawer.tsx`
4. `tenant/src/app/[locale]/dashboard/customers/[id]/page.tsx`
5. `tenant/src/app/[locale]/dashboard/customers/[id]/wallet/page.tsx`
6. `tenant/src/app/[locale]/dashboard/employees/[id]/page.tsx`
7. `tenant/src/app/[locale]/dashboard/services/[id]/page.tsx`
8. `tenant/src/app/[locale]/dashboard/products/[id]/page.tsx`

## 3. New Presentation Layer

### 3.1 Analytics Data Table

`AnalyticsDataTable` now supports:

1. Pagination.
2. Rows-per-page selection.
3. Search.
4. Sorting.
5. Row count labels.
6. Clickable rows when drill-down data exists.

### 3.2 Analytics Details Drawer

`AnalyticsDetailsDrawer` provides a consistent drill-down shell with:

1. Left summary panel.
2. Middle tab navigator.
3. Right detail content panel.
4. Wide desktop layout.
5. Action area for source links and related navigation.

## 4. Drill-Down Coverage Matrix

### Finance Workspace

1. Overview top services.
2. Overview top customers.
3. Employee performance rows.
4. Service performance rows.
5. Product revenue rows.
6. Discounts top services.
7. Refund rows.
8. Payment method rows.

### Reports Workspace

1. Booking trend rows.
2. Top customers rows.
3. Rebooking employee rows.
4. Rebooking detail rows.
5. Service performance rows.
6. Product rows.
7. Discount rows.
8. Refund rows.
9. Payment method rows.

### Report Preview Workspace

1. Summary report rows where the preview already exposes row data.
2. Source-only drill-down where the backend intentionally returns summary aggregates.

## 5. Drill-Down Behavior

When a clickable analytics row exists:

1. The row opens the drill-down drawer.
2. The drawer shows aggregated summary values.
3. The drawer links to the strongest source record available.
4. Existing reusable workspace pages are used for deeper detail instead of duplicating logic.

## 6. New APIs

No new backend APIs were required for this phase.

The implementation reuses existing endpoints such as:

1. Customer detail and customer transactions endpoints.
2. Employee financial detail endpoint.
3. Existing service and product workspace pages.

## 7. Regression Verification

The following behavior must remain unchanged:

1. Finance KPI calculations.
2. Report calculations.
3. PDF export generation.
4. CSV export generation.
5. Excel export generation.
6. Existing filters and date ranges.
7. Existing navigation and workspace routing.

## 8. What Is Now Clickable

1. KPI-derived row tables where source records exist.
2. Top customer rows.
3. Employee rows.
4. Service rows.
5. Product rows.
6. Refund rows.
7. Payment method rows.
8. Rebooking rows.

## 9. Notes

1. Summary-only KPIs remain summary-only unless a safe source record exists.
2. This phase intentionally avoids changing aggregation logic.
3. The next improvement should focus on adding deeper row-level source links only where the current data model supports them cleanly.

