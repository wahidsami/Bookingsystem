# REFAH Platform Integration Audit
## Tenant V2 <-> Customer App <-> Backend

**Audit type:** static repository audit  
**Scope:** `Tenant-v2/`, `RifahMobile/`, `server/`  
**Goal:** identify source-of-truth boundaries, integration coverage, mismatches, mock/placeholder usage, and backend/frontend contract drift.

## 1. Executive Summary

The repository is structured around three production surfaces:

| Surface | Role | Status |
|---|---|---|
| `server/` | Canonical backend for all persisted business data | Production source of truth |
| `RifahMobile/` | Customer-facing mobile/web app | Mostly live backend-backed consumer flow |
| `Tenant-v2/` | Admin/tenant dashboard | Mostly live backend-backed operator flow, but still contains mock/seed pockets and front-end normalization drift |

The integration model is mostly correct:

- Customer app and Tenant-v2 do **not** call each other directly.
- Both frontends talk to the backend.
- Shared entities are joined through canonical IDs such as `tenantId`, `bookingSessionId`, `bookingReference`, `appointment.id`, `order.id`, `transaction.id`, and `platformUserId`.

Main findings:

1. The backend is the only durable source of truth for appointments, bookings, orders, payments, wallet movements, notifications, and gift-card ledgers.
2. `RifahMobile/` is largely live and API-backed, with local persistence used only for UX state such as onboarding, language, cart state, and push-token bookkeeping.
3. `Tenant-v2/` is largely live and API-backed, but it still contains:
   - a mocked / seeded dev server file (`Tenant-v2/server.ts`)
   - placeholder staff-mode tabs in `StaffRootNavigator.tsx`
   - extensive response-shape normalization and fallback chains in the customer/appointment workspaces
4. The highest contract-drift risk is not missing endpoints. It is **shape mismatch** and **fallback normalization** between frontend expectations and backend DTOs.

## 2. Architecture Summary

### 2.1 Backend

The backend exposes three major route families:

| Route family | Example routes | Notes |
|---|---|---|
| User / customer routes | `/api/v1/users/profile`, `/api/v1/users/bookings`, `/api/v1/users/reviews`, `/api/v1/users/wallet/summary` | Customer-facing authenticated flows |
| Public routes | `/api/v1/public/tenants`, `/api/v1/public/tenant/:tenantId/services`, `/api/v1/public/apps-center/customer-app` | Discovery, storefront, content, guest-facing flows |
| Tenant / admin routes | `/api/v1/tenant/customers`, `/api/v1/tenant/appointments`, `/api/v1/tenant/reports/*`, `/api/v1/tenant/gift-cards/*` | Operator / CRM / BI / marketing / POS flows |

Relevant route files:

- `server/src/routes/userRoutes.js:1-65`
- `server/src/routes/publicRoutes.js:1-53`
- `server/src/routes/tenantRoutes.js:174-277`

### 2.2 Customer App

The customer app is a React Native / Expo application with a canonical root navigator and a live API client.

Key files:

- `RifahMobile/src/navigation/RootNavigator.tsx`
- `RifahMobile/src/navigation/TabNavigator.tsx`
- `RifahMobile/src/api/client.ts`

The app is structured around these user journeys:

- Home / discovery
- Browse tenants
- View tenant details
- Book services / appointments
- View appointment history
- View purchases / orders
- Pay
- Use wallet / gifts
- Review bookings
- View profile / notifications / info pages

### 2.3 Tenant V2

Tenant-v2 is the admin shell for operators and managers.

Key files:

- `Tenant-v2/src/App.tsx`
- `Tenant-v2/src/components/Workspace.tsx`
- `Tenant-v2/src/lib/tenantApiAdapter.ts`
- `Tenant-v2/src/components/CustomersWorkspace.tsx`
- `Tenant-v2/src/components/AppointmentWorkspace.tsx`
- `Tenant-v2/src/components/ReportsWorkspace.tsx`

Tenant-v2 is mostly backend-connected, but its repository still contains a local mock/seed dev server at `Tenant-v2/server.ts`.

---

## 3. Customer App Inventory

### 3.1 Screens and Their Data Sources

| Screen / area | Data source | Status |
|---|---|---|
| Home | `api.getProfile()`, `api.getNotifications()`, live home sections (`hot deals`, `tenants`, `categories`, `top providers`) | Live |
| Browse | `api.getTenants()`, `api.getCategories()`, `api.getTrendingTenants()` | Live |
| Tenant details | `/public/tenant/:slug`, `/public/tenant/:tenantId/services`, `/products`, `/staff`, `/gift-cards`, `/reviews` | Live |
| Service booking flow | `/public/tenant/:tenantId/services/:serviceId/staff`, `/bookings/search`, `/public/tenant/:slug` | Live |
| Booking cart | `/bookings/create`, `/payments/sources` | Live |
| Appointments | `/users/bookings`, `/bookings/:id`, `/bookings/:id/cancel`, `/bookings/:id/reschedule` | Live |
| Purchases | `/orders`, `/orders/:id`, `/orders/:id/cancel` | Live |
| Payment | `/payments/process`, `/payments/wallet/balance`, `/payments/sources` | Live |
| Gifts / wallet | `/users/wallet/summary`, `/users/gifts/*`, `/users/tenant-gifts/*`, `/public/tenant/:tenantId/gift-cards` | Live |
| Notifications | `/users/notifications*` | Live |
| Profile | `/users/profile`, `/users/profile/photo` | Live |
| Reviews | `/users/reviews` | Live |
| Info / legal pages | `/public/apps-center/customer-app` | Live |

### 3.2 Customer App API Coverage

Primary API client:

- `RifahMobile/src/api/client.ts`

Major methods and routes:

| Method | Route | Notes |
|---|---|---|
| `getProfile()` | `GET /users/profile` | Authenticated profile fetch |
| `getNotifications()` | `GET /users/notifications` | Customer inbox |
| `getMyReviews()` | `GET /users/reviews` | Customer review history |
| `getBookings()` | `GET /users/bookings` with fallback to `GET /bookings?platformUserId=...` | Supports grouped appointment history |
| `getBooking()` | `GET /bookings/:id` | Appointment detail |
| `respondToAppointmentInvite()` | `POST /bookings/:id/respond` | Invite workflow |
| `getOrders()` | `GET /orders` | Purchase history |
| `processPayment()` | `POST /payments/process` | Unified payment entrypoint |
| `getWalletBalance()` | `GET /payments/wallet/balance` | Wallet summary |
| `getEligiblePaymentSources()` | `GET /payments/sources` | Payment method eligibility |
| `getHotDeals()` | `GET /hot-deals` | Discovery |
| `getCategories()` | `GET /categories` | Discovery |
| `getTenants()` | `GET /public/tenants` | Discovery |
| `getTopProviders()` | `GET /public/providers/top` | Discovery |
| `getCustomerAppContent()` | `GET /public/apps-center/customer-app` | Content blocks / legal / support |

### 3.3 Customer App Local-Only State

These are intentional client-side persistence layers rather than backend business data:

| Area | Storage / behavior | Status |
|---|---|---|
| Language preference | `AsyncStorage` | Client-only UX state |
| Onboarding completion | `AsyncStorage` | Client-only UX state |
| Product cart | `AsyncStorage` | Client-only cart persistence |
| Service booking cart | `AsyncStorage` | Client-only cart persistence |
| Push token / debug state | `AsyncStorage` | Client-side device registration state |

Relevant files:

- `RifahMobile/src/utils/language.ts`
- `RifahMobile/src/utils/onboarding.ts`
- `RifahMobile/src/contexts/CartContext.tsx`
- `RifahMobile/src/contexts/ServiceBookingCartContext.tsx`
- `RifahMobile/src/lib/notifications.ts`

These are not backend contract problems by themselves. They are expected UX-state persistence.

---

## 4. Tenant V2 Inventory

### 4.1 Core Admin Modules

Tenant-v2 includes the following major workspaces and menu families:

- Dashboard / home
- Appointments
- Customers
- Teams
- Finance
- Reports
- Marketing
- Gift Cards
- Reviews
- Settings
- POS / checkout / operational drawers
- Operations Intelligence and BI-style report modules

### 4.2 Tenant V2 Backend Adapter

Primary adapter:

- `Tenant-v2/src/lib/tenantApiAdapter.ts`

Important methods and routes:

| Method | Route | Notes |
|---|---|---|
| `getProfile()` | `GET /tenant/profile` | Tenant auth bootstrap |
| `getCustomers()` | `GET /tenant/customers` | Customer list |
| `getCustomer(id)` | `GET /tenant/customers/:id` | Customer profile |
| `getCustomerHistory(id)` | `GET /tenant/customers/:id/history` | Customer history |
| `getCustomerTransactions(id)` | `GET /tenant/customers/:id/transactions` | Customer transactions |
| `getBoardAppointments()` | `GET /tenant/appointments/board` | Appointments board |
| `getAppointments()` | `GET /tenant/appointments` | Appointment list |
| `getAppointment(id)` | `GET /tenant/appointments/:id` | Appointment details |
| `createAppointment()` | `POST /tenant/appointments` | Appointment creation |
| `updateAppointmentStatus()` | `PATCH /tenant/appointments/:id/status` | Appointment workflow |
| `getTodayAppointments()` | `GET /tenant/dashboard/todays-appointments` | Dashboard summary |
| `getReportsSummary()` | `GET /tenant/reports/summary` | Reporting overview |
| `getServicePerformance()` | `GET /tenant/reports/service-performance` | BI report |
| `getEmployeePerformance()` | `GET /tenant/reports/employee-performance` | BI report |
| `getCustomerAnalytics()` | `GET /tenant/reports/customer-analytics` | BI report |
| `getRebookings()` | `GET /tenant/reports/rebookings` | BI report |
| `getRefunds()` | `GET /tenant/reports/refunds` | BI report |
| `getPaymentMethods()` | `GET /tenant/reports/payment-methods` | BI report |
| `getAdvancedAnalytics()` | `GET /tenant/reports/advanced-analytics` | BI report |
| `purchaseGiftCard()` | `POST /tenant/cart/gift-cards/purchase` | Marketing / gifts |
| `recordPayment()` | `PATCH /tenant/appointments/:id/payment` | Appointment payment path |
| `recordRemainderPayment()` | `POST /tenant/appointments/:id/record-payment` | Remainder / deposit payment path |
| `topUpCustomerWallet()` | `POST /tenant/customers/:id/wallet/topup` | CRM wallet action |

### 4.3 Tenant V2 Contract Drift Risk

The main issue in Tenant-v2 is not missing connectivity. It is **contract drift by normalization**.

Examples:

- `Tenant-v2/src/components/CustomersWorkspace.tsx` accepts multiple payload shapes for customer history, transactions, wallet history, and summary values.
- `Tenant-v2/src/components/AppointmentWorkspace.tsx` derives appointment, history, and transaction views from multiple fallback fields such as `history`, `appointments`, `records`, `items`, `timeline`, `transactions`, `walletTransactions`, and `walletHistory`.
- `Tenant-v2/src/components/AppointmentWorkspace.tsx` also computes local payment display state from multiple overlapping properties, which creates a risk that the UI will appear “correct” even when the backend DTO has drifted.

Relevant locations:

- `Tenant-v2/src/components/CustomersWorkspace.tsx:266-606`
- `Tenant-v2/src/components/AppointmentWorkspace.tsx:1343-1618`

### 4.4 Tenant V2 Mock / Seed / Placeholder Surfaces

The repository still contains a dev-only / demo-style data surface:

- `Tenant-v2/server.ts`

Observed seed or mock-style data:

- Pre-seeded gift card packages
- Pre-seeded redemption logs
- Pre-seeded gift card transactions
- Placeholder walk-in detection rules
- Mock customer activity conditions

Relevant locations:

- `Tenant-v2/server.ts:753-844`
- `Tenant-v2/server.ts:2198-2222`

This file is a key audit finding because it shows the repo still contains synthetic data paths, even if they are not necessarily the production deployment path.

### 4.5 Placeholder / Non-Production Staff Views

`Tenant-v2/src/navigation/StaffRootNavigator.tsx` includes placeholder screens for several staff-only tabs:

- Schedule
- Clients
- Reviews
- Earnings
- Messages
- Time off

These are explicit placeholders, not finished business workspaces.

Relevant file:

- `Tenant-v2/src/navigation/StaffRootNavigator.tsx`

---

## 5. Backend Surface Map

The backend is the canonical source of truth for shared business entities.

### 5.1 Customer-Facing / Public

| Endpoint family | Purpose | Controller |
|---|---|---|
| `/api/v1/users/profile` | Customer profile | `userController` |
| `/api/v1/users/bookings` | Customer appointment history | `userController` |
| `/api/v1/users/orders` | Customer purchases | `orderController` |
| `/api/v1/users/notifications` | Customer inbox | `userController` |
| `/api/v1/users/reviews` | Customer reviews | `reviewController` |
| `/api/v1/users/wallet/summary` | Wallet summary | `userWalletSummaryController` |
| `/api/v1/users/gifts/*` | Gift-wallet and gift-card flows | `userGiftController` |
| `/api/v1/users/tenant-gifts/*` | Tenant-scoped gifts | `userTenantGiftController` |
| `/api/v1/payments/*` | Payment processing and eligibility | `paymentController` |
| `/api/v1/public/*` | Discovery and storefront content | `publicTenantController`, `publicGiftController`, `publicTenantGiftController` |

### 5.2 Tenant / Admin

| Endpoint family | Purpose | Controller |
|---|---|---|
| `/api/v1/tenant/profile` | Tenant auth bootstrap | `tenantAuthController` |
| `/api/v1/tenant/customers` | CRM customers | `tenantCustomerController` |
| `/api/v1/tenant/appointments` | Appointment board and appointment drawer | `tenantAppointmentController` |
| `/api/v1/tenant/reports/*` | BI / reporting | `tenantReportsController`, `tenantFinancialController` |
| `/api/v1/tenant/gift-cards/*` | Gift card package management and reports | `tenantGiftCardController` |
| `/api/v1/tenant/financial/*` | Financial ledgers and summaries | `tenantFinancialController` |
| `/api/v1/tenant/settings/*` | Dashboard preferences and settings | `tenantSettingsController` |
| `/api/v1/tenant/pos/*` | POS / checkout | `tenantPosController` |

### 5.3 Shared Data Model

The backend already models the shared business objects that both frontends need:

- Platform users / customers
- Tenants
- Services
- Products
- Staff
- Appointments
- Booking sessions
- Orders
- Payment methods
- Payment transactions
- Transactions / wallet movements
- Gift card packages
- Gift card transactions
- Reviews
- Notifications
- Invoices

That means the main integration challenge is not missing schema. It is frontend/backend DTO consistency.

---

## 6. Source of Truth Matrix

| Domain | Canonical source | Tenant-v2 usage | Customer app usage |
|---|---|---|---|
| Tenant identity / auth | Backend | Yes | No |
| Customer profile | Backend | Yes | Yes |
| Appointment history | Backend | Yes | Yes |
| Booking creation | Backend | Yes | Yes |
| Booking session grouping | Backend | Yes | Yes |
| Orders / purchases | Backend | Yes | Yes |
| Payments | Backend | Yes | Yes |
| Wallet | Backend | Yes | Yes |
| Gift cards | Backend | Yes | Yes |
| Notifications | Backend | Yes | Yes |
| Reviews | Backend | Yes | Yes |
| Reports / analytics | Backend | Yes | No |
| Tenant settings / landing page | Backend | Yes | No |
| Language / onboarding / client cart state | Client-side UX state | No | Yes |

Conclusion:

- Backend is the authority for persisted business logic.
- Tenant-v2 should not invent its own accounting or customer-history rules.
- Customer app should not invent its own account/order/payment persistence either.

---

## 7. Group Appointment Audit

Group bookings are represented consistently enough across the stack to be treated as a shared session model.

### 7.1 Customer App

Relevant files:

- `RifahMobile/src/screens/BookingFlow.tsx`
- `RifahMobile/src/screens/ServiceBookingCartScreen.tsx`
- `RifahMobile/src/screens/BookingsScreen.tsx`
- `RifahMobile/src/screens/AppointmentDetailsScreen.tsx`
- `RifahMobile/src/contexts/ServiceBookingCartContext.tsx`

Observed behavior:

- `BookingFlow` accepts `bookingSessionId`, `bookingReference`, and a guest payload.
- `ServiceBookingCartScreen` groups items by shared `bookingSessionId` / `bookingReference`.
- `BookingsScreen` groups list items by `bookingReference || bookingSessionId || id`.
- `AppointmentDetailsScreen` renders a grouped appointment view with guest data and payment normalization.

### 7.2 Backend

Relevant files:

- `server/src/controllers/bookingController.js`
- `server/src/services/customerInvoiceService.js`
- `server/src/services/splitPaymentService.js`
- `server/src/controllers/tenantCustomerController.js`
- `server/src/controllers/tenantFinancialController.js`

Observed behavior:

- `bookingController` creates booking sessions and returns the session plus linked appointments.
- `customerInvoiceService` treats a booking session as a unified invoice source when multiple appointments exist in the session.
- `splitPaymentService` uses booking-session-aware payment allocation and remainder handling.
- `tenantCustomerController` aggregates appointments by booking session for CRM history and transaction views.
- `tenantFinancialController` also uses booking-session-aware financial grouping.

### 7.3 Tenant V2

Relevant files:

- `Tenant-v2/src/components/AppointmentWorkspace.tsx`
- `Tenant-v2/src/components/CustomersWorkspace.tsx`
- `Tenant-v2/src/components/InteractiveDrawers.tsx`

Observed behavior:

- Group guest and multi-session support exists.
- The workspace aggregates appointment rows by `bookingSessionId` / `bookingReference`.
- Customer history and transaction cards are built from aggregated booking-session rows.

Conclusion:

Group appointment support exists in all three surfaces, but Tenant-v2 still relies heavily on frontend aggregation and fallback normalization, so it remains more fragile than the backend invoice / booking-session model.

---

## 8. Feature Parity Assessment

### 8.1 Customer App vs Tenant-v2

| Capability | Customer App | Tenant-v2 | Parity |
|---|---|---|---|
| Sign in / profile | Yes | Yes | Different user type, both live |
| Browse salons / services | Yes | No | Not a tenant-v2 feature |
| Create bookings | Yes | Yes | Different UX surfaces, shared backend objects |
| View appointments | Yes | Yes | Live in both |
| View purchases / orders | Yes | Yes | Live in both |
| Pay / checkout | Yes | Yes | Live in both |
| Wallet / gifts | Yes | Yes | Live in both |
| Customer CRM profile | Self profile only | Full CRM profile | Tenant-v2 only |
| Reports / BI | No | Yes | Tenant-v2 only |
| Marketing / push composer | No | Yes | Tenant-v2 only |
| Settings / landing page | User settings only | Tenant dashboard settings | Different scopes |

### 8.2 Overall Parity Takeaway

The two frontends are not supposed to be identical products. They are complementary:

- Customer App = consumer / booking / wallet / purchases
- Tenant-v2 = operator / CRM / BI / marketing / POS / settings

The backend unifies them.

---

## 9. Settings Impact Matrix

| Settings area | Customer App | Tenant-v2 | Backend |
|---|---|---|---|
| Language | Local persisted preference | Tenant UI language | Client-side only in customer app |
| Push notifications | User notification preferences | Marketing push composer / customer push ops | Backend-backed in both contexts |
| Dashboard landing page | Not applicable | `dashboardSettings.defaultLandingPage` | Backend-backed tenant preference |
| Profile settings | User profile fields | Tenant profile / account settings | Backend-backed |
| Guest / storefront content | Not applicable | Public page / landing content in Tenant-v2 | Backend-backed |

Relevant backend settings files:

- `server/src/models/TenantSettings.js`
- `server/src/controllers/tenantSettingsController.js`

Relevant tenant-v2 files:

- `Tenant-v2/src/components/settings/DashboardPreferencesSection.tsx`
- `Tenant-v2/src/lib/dashboardLandingPage.ts`
- `Tenant-v2/src/contexts/TenantAuthContext.tsx`

---

## 10. API Coverage and Gap Analysis

### 10.1 No Major Missing Public/User APIs Detected

The customer app has backend routes for the major user journeys it implements.

Examples:

- profile
- notifications
- bookings
- orders
- payment sources
- payment processing
- wallet summary
- gift claim / send / history
- public tenant discovery
- customer app content

### 10.2 Tenant-v2 Has Strong Admin Coverage, But Contract Drift Risk Remains

Tenant-v2 already hits the main admin endpoints:

- customers
- appointments
- reports
- gift cards
- financial ledgers
- settings
- POS

But many components accept multiple field names and nested fallback shapes, which means:

- backend DTO changes can silently degrade the UI
- missing fields may be hidden by fallback paths
- some data can appear “available” even if the canonical field changed

This is the biggest integration problem visible in the repository.

### 10.3 Mock / Placeholder / Hidden Data

| Area | Finding | Severity |
|---|---|---|
| `Tenant-v2/server.ts` | Pre-seeded gift card packages, redemptions, transactions, and walk-in detection | Medium |
| `Tenant-v2/src/navigation/StaffRootNavigator.tsx` | Placeholder staff screens for schedule / clients / reviews / earnings / messages / time off | Medium |
| `Tenant-v2/src/components/AppointmentWorkspace.tsx` | Heavy use of fallback field names and frontend aggregation | Medium-High |
| `Tenant-v2/src/components/CustomersWorkspace.tsx` | Heavy use of normalization and fallback history shapes | Medium-High |
| Customer app local persistence | Onboarding / language / carts / push token state | Low (expected) |

---

## 11. Notable Mismatches

### 11.1 Tenant-v2 Mock Server Still Exists

`Tenant-v2/server.ts` contains seeded and synthetic data for:

- gift card packages
- redemption logs
- gift card transactions
- customer activity detection

That is the clearest repository-level sign of non-production content.

### 11.2 Tenant-v2 Uses Response-Shaping Fallback Chains

`Tenant-v2/src/components/AppointmentWorkspace.tsx` and `Tenant-v2/src/components/CustomersWorkspace.tsx` intentionally accept many alternate shapes:

- `history`
- `appointments`
- `records`
- `items`
- `timeline`
- `transactions`
- `walletTransactions`
- `walletHistory`

This is useful for resilience, but it also proves the frontend is still compensating for DTO ambiguity.

### 11.3 Customer App Has Expected Client-Side State, Not Backend State

The customer app stores:

- cart data
- onboarding completion
- language
- push token debug state

This is fine, but it means any auditing of “source of truth” must separate client UX state from persisted business state.

---

## 12. Final Scorecard

| Category | Score | Notes |
|---|---|---|
| Backend canonical data model | 9.5 / 10 | Strong shared entities and route coverage |
| Customer app integration | 8 / 10 | Mostly live and backend-backed |
| Tenant-v2 integration | 7 / 10 | Functional, but contract drift and mock/seed pockets remain |
| DTO stability | 6.5 / 10 | Too many fallback shapes in admin workspaces |
| Mock / placeholder reduction | 6 / 10 | `Tenant-v2/server.ts` and staff placeholders remain |
| Overall platform integration | 7.5 / 10 | Good foundation, but not fully contract-tight |

## 13. Bottom Line

The platform is integrated in the right direction:

- **Backend** is the canonical source of truth.
- **Customer App** is mostly live and production-backed.
- **Tenant-v2** is mostly live and production-backed.

The remaining risk is not missing core routes. It is **contract drift**, **mock/seed residue**, and **frontend fallback normalization**.

The highest-value next cleanup targets are:

1. Reduce fallback DTO chains in Tenant-v2 customer / appointment workspaces.
2. Remove or isolate demo/mock seed data in `Tenant-v2/server.ts`.
3. Keep the backend as the only source for all accounting and session calculations.
4. Continue tightening the customer app and Tenant-v2 to the canonical backend DTOs.

