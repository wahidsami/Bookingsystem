# REFAH V2 Platform
# Phase 1.75 — Customer Domain & API Contract Audit

## 1. Executive Summary

The Customer Domain is **partially production-backed** but still carries significant frontend contract drift from the earlier Google Studio implementation.

### What is working

- Core customer endpoints exist in the backend and return live data.
- The main customer profile payload is canonical and already includes appointments, orders, wallet, gift cards, reviews, loyalty, and summary fields.
- Appointment Workspace already contains some contract-hardening logic for `booking_session` history rows.

### What is broken

- Customer List statistics use the wrong KPI key names.
- Customer List uses renamed backend fields (`photo`, `joinedAt`, `totalProductsPurchased`) while the UI expects older names (`avatar`, `memberSince`, `productsPurchased`).
- Customer History summary uses `summary` in the backend, but `CustomersWorkspace` reads `metrics`.
- Customer Wallet tab expects `walletLedger` and `giftCards`, but the backend returns `walletLedgerEntries` and `giftCardTransactions`.
- Customer profile save handlers read flattened fields from nested `{ success, data }` responses, so edits do not rehydrate correctly.
- Appointment Workspace history logic is more tolerant, but it still depends on mixed legacy shapes and derived rows.

### Overall conclusion

This is **not** a single backend bug. It is a **contract drift problem** between:

- backend customer controllers,
- tenant API adapter expectations,
- CustomersWorkspace / AppointmentWorkspace render logic,
- and older Google Studio-era placeholder assumptions.

---

## 2. Customer Endpoint Inventory

| Endpoint | Backend owner | Purpose | Response shape | Main V2 consumers |
|---|---|---|---|---|
| `GET /api/v1/tenant/customers` | `tenantCustomerController.getCustomers` | Customer CRM list | `{ success, data: { customers, pagination } }` | `CustomersWorkspace`, `AppointmentWorkspace`, `CustomerPushNotificationsWorkspace`, `tenantApiAdapter.getCustomers()` |
| `GET /api/v1/tenant/customers/stats` | `tenantCustomerController.getCustomerStats` | Customer dashboard KPIs | `{ success, data: { totalCustomers, newCustomersThisMonth, returningCustomers, returningRate, averageBookingsPerCustomer, loyaltyTierDistribution } }` | `CustomersWorkspace` |
| `GET /api/v1/tenant/customers/:id` | `tenantCustomerController.getCustomer` | Full customer profile | `{ success, data: { ...customerData } }` | `CustomersWorkspace`, `AppointmentWorkspace`, `tenantApiAdapter.getCustomer()` |
| `GET /api/v1/tenant/customers/:id/history` | `tenantCustomerController.getCustomerHistory` | Customer timeline / history | `{ success, data: { history, walletTransactions, summary } }` | `CustomersWorkspace`, `AppointmentWorkspace`, `tenantApiAdapter.getCustomerHistory()` |
| `GET /api/v1/tenant/customers/:id/transactions` | `tenantCustomerController.getCustomerTransactions` | Customer financial transactions | `{ success, data: { transactions, summary } }` | `AppointmentWorkspace`, `tenantApiAdapter.getCustomerTransactions()` |
| `PATCH /api/v1/tenant/customers/:id/profile` | `tenantCustomerController.updateCustomerProfile` | Edit customer core profile | `{ success, message, data: updatedCustomer }` | `CustomersWorkspace` |
| `PATCH /api/v1/tenant/customers/:id/notes` | `tenantCustomerController.updateCustomerNotes` | Edit customer notes/tags | `{ success, message, data: { notes, tags } }` | `CustomersWorkspace` |
| `POST /api/v1/tenant/customers/:id/wallet/topup` | `tenantCustomerController.topUpCustomerWallet` | Wallet recharge | `{ success, message, transaction, walletLedgerEntry, refreshedCustomer }` | `CustomersWorkspace`, `AppointmentWorkspace` |
| `GET /api/v1/tenant/reports/customer-analytics` | `tenantReportsController.getCustomerAnalytics` | Customer analytics | `{ success, data: { totalCustomers, newCustomers, returningCustomers, retentionRate, segments, segmentRevenue, topCustomers } }` | `ReportsWorkspace` |

---

## 3. Frontend Contract Inventory

| Component | API calls | Expected DTO shape | Actual backend DTO shape | Compatibility |
|---|---|---|---|---|
| `tenant-v2/src/components/CustomersWorkspace.tsx` | `getCustomers`, `getCustomerStats`, `getCustomer`, `getCustomerHistory`, `getCustomerTransactions`, `patch /notes`, `patch /profile`, `wallet/topup`, export | Old CRM DTOs: `avatar`, `memberSince`, `productsPurchased`, `avgBookings`, `metrics`, `walletLedger`, `giftCards`, flat `notes/tags` and flat save responses | Backend now returns `photo`, `joinedAt`, `totalProductsPurchased`, `averageBookingsPerCustomer`, `summary`, `walletLedgerEntries`, `giftCardTransactions`, nested save responses | **Partial** |
| `tenant-v2/src/components/AppointmentWorkspace.tsx` | `getCustomers`, `getCustomer`, `getCustomerHistory`, `getCustomerTransactions`, `topUpCustomerWallet` | Appointment drawer customer profile, history cards, transaction cards, wallet summary | Backend mostly matches via `booking_session` + payment transaction composition, but several fallbacks are still needed | **Mostly compatible, still mixed** |
| `tenant-v2/src/components/ReportsWorkspace.tsx` | customer analytics + finance/report endpoints | Customer analytics summary, top customers, KPIs | `getCustomerAnalytics` matches `topCustomers` structure closely | **Mostly compatible** |
| `tenant-v2/src/components/CustomerPushNotificationsWorkspace.tsx` | `getCustomers({ limit: 1000 })` | Customer list for targeting | List endpoint is compatible enough for target selection | **Compatible** |

---

## 4. DTO Comparison Table

### 4.1 `GET /api/v1/tenant/customers`

**Expected by `CustomersWorkspace`**

- `customers[].avatar`
- `customers[].memberSince`
- `customers[].productsPurchased`
- `stats.avgBookings`

**Actual backend**

- `customers[].photo`
- `customers[].joinedAt`
- `customers[].totalProductsPurchased`
- stats endpoint returns `averageBookingsPerCustomer`, not `avgBookings`

**Status**

- `avatar` -> missing / renamed
- `memberSince` -> missing / renamed
- `productsPurchased` -> missing / renamed
- `avgBookings` -> missing / renamed

### 4.2 `GET /api/v1/tenant/customers/stats`

**Expected by `CustomersWorkspace`**

- `totalCustomers`
- `newCustomersThisMonth`
- `returningRate`
- `avgBookings`

**Actual backend**

- `totalCustomers`
- `newCustomersThisMonth`
- `returningCustomers`
- `returningRate`
- `averageBookingsPerCustomer`
- `loyaltyTierDistribution`

**Status**

- `avgBookings` -> missing / renamed to `averageBookingsPerCustomer`
- `returningCustomers` -> present but not surfaced in UI

### 4.3 `GET /api/v1/tenant/customers/:id`

**Expected by `CustomersWorkspace`**

- root profile fields
- `recentAppointments`
- `recentOrders`
- `walletBalance`
- `loyaltyPoints`
- `reviews`
- `notes`
- `tags`
- `documents`
- `communication`
- `assignedStylist`
- `transactions`
- `walletHistory` when wallet tab is opened

**Actual backend**

- `id`, `firstName`, `lastName`, `email`, `phone`, `profileImage`, `gender`, `dateOfBirth`, `preferredLanguage`, `walletBalance`, `createdAt`
- `totalBookings`, `totalOrders`, `totalProductsPurchased`, `totalSpent`, `averageBookingValue`
- `firstVisit`, `lastVisit`, `noShowCount`, `cancellationCount`
- `favoriteServices`, `favoriteProducts`, `preferredStaff`, `preferredTime`, `preferredDeliveryType`
- `loyaltyTier`, `loyaltyPoints`, `tags`, `notes`, `customerType`
- `walletSummary`, `walletLedgerEntries`, `giftCardTransactions`
- `reviews`, `allAppointments`, `allOrders`, `recentAppointments`, `recentOrders`

**Status**

- `profileImage` -> present, but UI expects `avatar` in the list
- `documents` -> missing
- `communication` -> missing
- `assignedStylist` -> missing (backend exposes `preferredStaff`)
- `transactions` -> missing on the profile payload
- `walletLedger` -> missing (backend exposes `walletLedgerEntries`)
- `giftCards` -> missing (backend exposes `giftCardTransactions`)

### 4.4 `GET /api/v1/tenant/customers/:id/history`

**Expected by `CustomersWorkspace`**

- `data.history`
- `data.metrics`
- rows with labels that can be rendered as appointment vs purchase rows

**Actual backend**

- `data.history`
- `data.walletTransactions`
- `data.summary`
- history rows are typed as `booking_session`, `order`, and `wallet`

**Status**

- `metrics` -> missing / renamed to `summary`
- `appointment` row type -> missing, backend uses `booking_session`
- `provider/providerAr` -> missing, backend uses `title/subtitle/serviceNameEn/serviceNameAr/assignedStaffName`

### 4.5 `GET /api/v1/tenant/customers/:id/transactions`

**Expected by `AppointmentWorkspace`**

- `data.transactions`
- `data.summary`
- transaction rows with `source`, `id`, `date`, `amount`, `status`, `paymentMethodLabel`, `detailPath`

**Actual backend**

- `data.transactions`
- `data.summary`
- transaction groups composed from gateway, ledger, wallet and synthetic booking-session records

**Status**

- Generally compatible
- Still depends on mixed booking-session / transaction / wallet shapes

### 4.6 `PATCH /api/v1/tenant/customers/:id/profile`

**Expected by `CustomersWorkspace`**

- flat response fields like `updated.firstName`, `updated.lastName`, `updated.email`

**Actual backend**

- `{ success, message, data: updatedCustomer }`

**Status**

- UI reads the wrong level (`updated.firstName` instead of `updated.data.firstName`)

### 4.7 `PATCH /api/v1/tenant/customers/:id/notes`

**Expected by `CustomersWorkspace`**

- flat response fields `notes`, `tags`

**Actual backend**

- `{ success, message, data: { notes, tags } }`

**Status**

- UI reads the wrong level (`updated.notes`, `updated.tags` instead of `updated.data.notes`, `updated.data.tags`)

---

## 5. Customer Details Root Cause Analysis

### Primary root cause

The Customer Details experience in `CustomersWorkspace.tsx` is still mapped to an older DTO contract.

### Exact mismatch points

1. **Customer list stats**
   - Backend: `averageBookingsPerCustomer`
   - Frontend expects: `avgBookings`
   - Result: KPI shows `0` / empty.

2. **Customer list rows**
   - Backend: `photo`, `joinedAt`, `totalProductsPurchased`
   - Frontend expects: `avatar`, `memberSince`, `productsPurchased`
   - Result: avatar, join date, and product counts do not render correctly.

3. **History tab**
   - Backend history response uses `summary`
   - Frontend reads `metrics`
   - Backend history rows use `booking_session`
   - Frontend still branches mainly on `appointment`
   - Result: history KPIs and appointment rows are incomplete/misclassified.

4. **Wallet tab**
   - Backend profile response uses `walletLedgerEntries` and `giftCardTransactions`
   - Frontend expects `walletLedger` and `giftCards`
   - Result: wallet subpanels appear empty even when the backend has data.

5. **Profile save / notes save**
   - Backend wraps updates under `data`
   - Frontend writes `updated.notes`, `updated.tags`, `updated.firstName`, etc.
   - Result: local state is updated from the wrong object and can appear stale or blank.

### Practical impact

- Customer details render partially.
- Some tabs look empty despite valid backend data.
- The profile editor can save successfully but fail to hydrate the UI from the response wrapper.

### Backend verdict

- The backend is **not** the primary cause.
- The issue is mostly frontend contract drift plus a few legacy Google Studio assumptions.

---

## 6. React Warning Analysis

### Warning

> A component is changing an uncontrolled input to be controlled.

### Most likely source in the customer domain

`tenant-v2/src/components/AppointmentWorkspace.tsx`

### Evidence

The appointment drawer contains several form controls bound directly to async appointment state:

- `value={activeAppointment.staffId}` around the appointment editor
- `value={activeAppointment.startTime}`
- `value={activeAppointment.date || getSelectedDateKey()}`
- `value={selectedPaymentMethod}`

Those values can be `undefined` before the appointment payload is fully mapped, then become defined after async hydration.

### Why it happens

- The component renders before the async `getAppointment` / `mapBoardAppointment` state is fully stabilized.
- Some `value` props can be `undefined` on the first render.
- When the API response arrives, React sees the input move from uncontrolled to controlled.

### Recommended fix

- Normalize all form-bound fields to stable primitives before render.
- For text/select inputs, default to `''`.
- For numeric inputs, default to `0` or a stringified number.
- Keep the render contract stable even while async data is loading.

### Confidence

- **High confidence** that the appointment drawer is the likely warning source.
- I did not find a single unequivocal uncontrolled input in the customer profile section that was more likely than the appointment editor.

---

## 7. Google Studio Compatibility Audit

### Direct customer-domain consumers

- `CustomersWorkspace.tsx`
- `AppointmentWorkspace.tsx`
- `ReportsWorkspace.tsx`
- `CustomerPushNotificationsWorkspace.tsx`

### Findings

- Direct customer domain consumers are mostly live-backed.
- The biggest drift is not mock APIs inside the customer controllers; it is **frontend field naming drift**.

### Remaining placeholder / mock usage found in the repo

Outside the customer domain consumers, these still exist:

- `tenant-v2/src/data/mockData.ts`
- `tenant-v2/src/components/GlobalSearch.tsx`
- `tenant-v2/src/components/QuickCreateModal.tsx`
- `tenant-v2/src/components/Workspace.tsx`
- legacy fallback mock data and presets in `ReportsWorkspace.tsx`

### Verdict

- Customer domain itself is not primarily mock-driven.
- The customer screens still inherit some legacy placeholder assumptions from the Google Studio era.

---

## 8. Financial Dependency Audit

### Canonical financial ownership

| Financial concept | Canonical owner |
|---|---|
| Customer spend | `tenantFinancialController` + payment transactions / invoices |
| Outstanding balance | invoice / appointment payment fields from backend |
| Payments | `PaymentTransaction`, `Transaction`, invoice/payment controllers |
| Refunds | financial/report controller paths |
| Invoices | `customerInvoiceService` and invoice models |
| Wallet | `WalletLedgerEntry` + wallet service |
| Gift cards | `GiftCardTransaction` + gift card package / wallet logic |

### Important observation

`CustomersWorkspace` should not recalculate spend, balances, or wallet history from raw appointments alone.

### Current status

- `getCustomer` now exposes canonical spend (`totalSpent`) from payment transactions.
- The frontend still mixes canonical financial data with legacy fallback fields.
- Wallet and gift-card sections are the biggest contract mismatch remaining.

---

## 9. Duplicate Logic Audit

### Backend duplicate logic / derived logic

- Customer spend is derived canonically in the backend now, but several customer views still try to re-derive totals from older arrays.
- Customer history and transactions are composed from multiple sources:
  - appointments
  - orders
  - wallet ledger
  - gateway transactions
  - synthetic booking-session rows

### Frontend duplicate / fallback logic

- `AppointmentWorkspace` and `CustomersWorkspace` both contain their own interpretation layers for customer history and wallet data.
- `AppointmentWorkspace` is more tolerant; `CustomersWorkspace` still expects older field names.

### Verdict

- Duplicate logic still exists in the UI composition layer.
- The backend financial core is far more canonical than the customer renderers.

---

## 10. Missing Endpoints

There is **no dedicated endpoint** for several customer subviews that the UI conceptually treats as separate:

- Customer invoices
- Customer payments
- Customer wallet history
- Customer gift card history
- Customer dashboard widgets
- Customer notes read endpoint

Instead, the application composes those views from:

- `GET /api/v1/tenant/customers/:id`
- `GET /api/v1/tenant/customers/:id/history`
- `GET /api/v1/tenant/customers/:id/transactions`
- `GET /api/v1/tenant/customers/stats`
- `GET /api/v1/tenant/reports/customer-analytics`
- wallet and finance controller outputs

---

## 11. Missing DTO Fields

| Field | Current backend status | Notes |
|---|---|---|
| `avgBookings` | Missing / renamed | Backend exposes `averageBookingsPerCustomer` |
| `avatar` | Missing / renamed | Backend exposes `photo` |
| `memberSince` | Missing / renamed | Backend exposes `joinedAt` / `createdAt` |
| `productsPurchased` | Missing / renamed | Backend exposes `totalProductsPurchased` |
| `metrics` | Missing / renamed | Backend history uses `summary` |
| `walletLedger` | Missing / renamed | Backend exposes `walletLedgerEntries` |
| `giftCards` | Missing / renamed | Backend exposes `giftCardTransactions` |
| `assignedStylist` | Missing | Backend exposes `preferredStaff` |
| `communication` | Missing | No dedicated communication array in `getCustomer` |
| `documents` | Missing | No document array in `getCustomer` |
| `transactions` on profile payload | Missing | Must be composed from the transactions endpoint |
| `provider/providerAr` in customer history | Missing | Backend uses `title/subtitle/serviceNameEn/serviceNameAr/assignedStaffName` |

---

## 12. Broken Contracts

### Critical

1. `CustomersWorkspace` customer history tab reads `metrics`, but backend returns `summary`.
2. `CustomersWorkspace` wallet tab expects `walletLedger` and `giftCards`, but backend returns `walletLedgerEntries` and `giftCardTransactions`.
3. `CustomersWorkspace` save handlers read flattened update responses, but backend nests them under `data`.
4. `CustomersWorkspace` history rows still assume the older `appointment` row type.

### High

1. Customer list field renames (`photo`, `joinedAt`, `totalProductsPurchased`).
2. Customer stats rename (`averageBookingsPerCustomer`).
3. Appointment Workspace customer timeline depends on mixed booking-session and transaction shapes.

### Medium

1. Reports customer analytics is mostly aligned, but it still depends on legacy UI filter patterns elsewhere in the report shell.
2. Some customer wallet and gift card KPIs are derived from the wrong payload level in the UI.

### Low

1. Legacy mock data still exists in unrelated modules such as global search and quick-create.

---

## 13. Recommended Fixes

1. **Unify customer list DTO contract**
   - Alias or map `photo -> avatar`
   - Alias or map `joinedAt -> memberSince`
   - Alias or map `totalProductsPurchased -> productsPurchased`
   - Alias or map `averageBookingsPerCustomer -> avgBookings`

2. **Fix customer history DTO consumption**
   - `CustomersWorkspace` should read `summary`, not `metrics`
   - Customer history rows should support `booking_session`
   - Normalize row labels from `title/subtitle/serviceNameEn/serviceNameAr/assignedStaffName`

3. **Fix customer wallet DTO consumption**
   - Use `walletLedgerEntries` and `giftCardTransactions`
   - Stop expecting `walletLedger` and `giftCards`
   - Derive counts from the canonical arrays

4. **Fix update response hydration**
   - Read `response.data` for profile and notes updates
   - Rehydrate UI state from the nested payload

5. **Standardize appointment drawer transaction consumption**
   - Prefer the canonical `getCustomerTransactions` payload
   - Reduce dependence on older fallback fields

6. **Stabilize controlled inputs**
   - Normalize all appointment/customer editor values to stable primitives

7. **Clean up remaining placeholder assumptions**
   - Remove legacy mock-driven assumptions from any customer-facing auxiliary widgets

---

## 14. Production Readiness Score

**Customer Domain Readiness: 64 / 100**

### Why not higher

- Core endpoints exist, but several key UI contracts are still misaligned.
- The list/history/wallet/profile-save flows are still partially depending on older field names.
- The customer details experience is not yet stable enough to be considered production-polished.

### Why not lower

- The backend is largely canonical.
- The major problems are contract and mapping drift, not missing core business data.

---

## 15. Recommended Implementation Order

1. Fix `CustomersWorkspace` list/stat DTO mapping.
2. Fix `CustomersWorkspace` history summary and row-type mapping.
3. Fix `CustomersWorkspace` wallet payload mapping.
4. Fix `CustomersWorkspace` profile/notes update hydration.
5. Tighten `AppointmentWorkspace` customer timeline and transaction consumption.
6. Stabilize any controlled inputs in the appointment drawer / customer editor.
7. Remove remaining legacy placeholder assumptions from customer-adjacent UI.

---

## 16. Evidence References

### Backend

- `server/src/routes/tenantRoutes.js:163-171`
- `server/src/controllers/tenantCustomerController.js:810, 1082, 1506, 1615, 1661, 1754, 1968, 2079, 2667`
- `server/src/controllers/tenantReportsController.js:970`

### Frontend

- `tenant-v2/src/lib/tenantApiAdapter.ts:365-382, 669, 728`
- `tenant-v2/src/components/CustomersWorkspace.tsx:415, 449, 494, 575, 606`
- `tenant-v2/src/components/AppointmentWorkspace.tsx:1390-1405, 944-953, 1062-1063, 4772-5770`
- `tenant-v2/src/components/ReportsWorkspace.tsx:483, 842-852, 1145-1249`

