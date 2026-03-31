# System QA Audit

Date: 2026-03-31
Repository: `d:\Waheed\Refah\Bookingsystem`
Scope: admin dashboard, tenant dashboard, customer app, public site, staff app, backend, deployment wiring
Audit mode: read-only review, no application code changed

## Executive Summary

This codebase is not ready for a confident production redeploy on the VPS in its current state.

The biggest confirmed risks are:

1. Cross-app navigation and media loading still depend heavily on `localhost`, which will break real user journeys on Coolify/VPS deployments.
2. The web surfaces are not in a clean deployable state today. `client` and `admin` builds fail from alias resolution, `tenant` currently depends on missing `next-intl`, and the root installer skips `PublicPage`.
3. The purchasing flow is inconsistent across public and authenticated paths, and the public order path appears structurally broken against the `OrderItem` model.
4. Payment handling is still demo/fake-payment logic, not a real payment gateway integration. This is both a business-flow issue and a security/compliance concern.
5. There are production security issues in the backend, including exposed dev credentials, insecure fallback secrets, token-handling flaws, and tokens stored in browser storage.
6. The staff app is not actually wired yet beyond a health check shell; staff auth and staff workflow endpoints are not implemented end-to-end.

## Methodology

The audit covered:

- Routing and navigation review across all surfaces
- Search for hardcoded dev URLs, mock data, TODOs, debug traces, and placeholder logic
- End-to-end tracing of booking flow
- End-to-end tracing of purchasing flow
- Security and deployment review for VPS/Coolify
- Build/test verification already performed during repo familiarization

## Build And Deployment Findings

### QA-001: `client` and `admin` are not build-clean

Severity: Critical

Evidence:

- `client/tsconfig.json`
- `admin/tsconfig.json`
- Both define `paths` for `@/*` but do not define `baseUrl`
- Earlier build verification failed with unresolved `@/...` imports

Impact:

- Customer app and admin app are not in a trustworthy deployable state.
- Broken production builds block clean redeploys and mask runtime defects.

### QA-002: `tenant` has dependency drift

Severity: High

Evidence:

- `tenant/src/middleware.ts`
- `tenant/src/app/[locale]/layout.tsx`
- `tenant/src/i18n.ts`
- Earlier build verification failed because `next-intl` was not installed in the current environment

Impact:

- Tenant dashboard deployment is fragile.
- Fresh environments can fail even if the code itself is otherwise valid.

### QA-003: Root install flow skips `PublicPage`

Severity: High

Evidence:

- `package.json:7`
- `install:all` installs `server`, `client`, `admin`, `tenant`, and `staff-app`, but not `PublicPage`

Impact:

- Fresh VPS/Coolify deployments can miss dependencies for the public site.
- This explains environment drift and inconsistent “works locally / fails on server” behavior.

### QA-004: `PublicPage` environment wiring is still local-dev oriented

Severity: Critical

Evidence:

- `PublicPage/src/lib/api.ts`
- `PublicPage/src/context/AuthContext.tsx`
- `PublicPage/src/components/Header.tsx`
- `PublicPage/src/components/LoginModal.tsx`
- `PublicPage/src/components/AboutPage.tsx`
- `PublicPage/src/components/ContactPage.tsx`
- `PublicPage/src/components/CheckoutPage.tsx`

Impact:

- Public tenant pages will break or partially break outside localhost.
- Auth handoff from public site to customer app is not production-safe.

## Routing And Page Wiring Findings

### QA-005: Cross-surface navigation still hardcodes localhost domains and ports

Severity: Critical

Evidence:

- `client/src/app/tenant/[slug]/page.tsx`
- `tenant/src/app/[locale]/dashboard/mypage/page.tsx`
- `PublicPage/src/components/Header.tsx`
- `PublicPage/src/context/AuthContext.tsx`
- `PublicPage/src/components/LoginModal.tsx`
- Many files use `http://localhost:3000`, `http://localhost:3004`, or `http://localhost:5000`

Impact:

- Customer-to-public navigation, public-to-customer dashboard navigation, and tenant public-page previewing can all break on production domains.
- Pages may appear present but link users to dead targets.

Examples:

- Customer app tenant detail page redirects to `http://localhost:3004/t/:slug`
- Public site authenticated user menu links to `http://localhost:3000/dashboard*`
- Tenant dashboard “my page” preview uses localhost public-site URL

### QA-006: Customer booking lists likely render incomplete service/staff data

Severity: High

Evidence:

- `client/src/app/dashboard/page.tsx`
- `client/src/app/dashboard/bookings/page.tsx`
- These pages render `booking.Service` and `booking.Staff`
- Backend user booking responses load aliases as lowercase `service` and `staff` in:
  - `server/src/controllers/userController.js`
  - `server/src/controllers/bookingController.js`

Impact:

- Booking list pages can show blank service/staff values even when bookings exist.
- UX degrades and users may think data is missing or corrupted.

### QA-007: Public-site mobile auth navigation is incomplete

Severity: Medium

Evidence:

- `PublicPage/src/components/Header.tsx`

Impact:

- On mobile, authenticated users do not get a complete equivalent of desktop dashboard/bookings/purchases/profile navigation.
- This is a UX gap even if desktop works.

## Mock Data And Placeholder Findings

### QA-008: Active runtime mock data exists in admin tenant stats

Severity: High

Evidence:

- `server/src/controllers/adminTenantsController.js:600`
- Comment says “For now, return mock data”

Impact:

- Admin tenant-level booking stats are not trustworthy.
- Decision-making from admin dashboards may be based on placeholder values.

### QA-009: Admin settings page contains active static placeholder content

Severity: Medium

Evidence:

- `admin/src/app/dashboard/settings/page.tsx`

Observed:

- Subscription plans are hardcoded in the UI
- Admin users section is static placeholder content
- Page explicitly says more functionality is “Coming Soon”

Impact:

- Admin settings surface is partially decorative rather than fully system-driven.
- This can mislead operators into thinking settings are wired when they are not.

### QA-010: Placeholder assets and unfinished content remain in public booking/content surfaces

Severity: Medium

Evidence:

- `PublicPage/src/components/BookingModal.tsx`
- `PublicPage/src/components/ReviewCarousel.tsx`
- `PublicPage/src/components/AboutPage.tsx`
- `server/src/controllers/publicTenantController.js:998`

Observed:

- Staff image fallback uses `via.placeholder.com`
- Review carousel still says it should be replaced with actual API data
- About page hardcodes locale to English
- Contact form storage is still TODO

Impact:

- Public site has unfinished experiences and fake-looking fallbacks.
- Contact submissions are not reliably persisted.

### QA-011: Residual mock-data files still exist

Severity: Low

Evidence:

- `PublicPage/src/data/mockData.ts`
- `PublicPage/src/data/productData.ts`

Impact:

- These may be dead artifacts, but they increase confusion and future regression risk.

## Booking Flow Audit

### Current flow map

Authenticated booking:

- Customer app selects tenant/service/staff/time
- `client/src/app/booking/page.tsx`
- `client/src/components/BookingFlow.tsx`
- APIs used:
  - `/public/tenant/:tenantId/services`
  - `/public/tenant/:tenantId/services/:serviceId/staff`
  - `/bookings/search`
  - `/bookings/next-available`
  - `/bookings/create`
  - `/payments/process`

Public booking:

- `PublicPage/src/components/BookingModal.tsx`
- API used:
  - `/public/tenant/:tenantId/bookings`

Backend core:

- `server/src/controllers/bookingController.js`
- `server/src/controllers/publicTenantController.js`
- `server/src/services/bookingService.js`
- `server/src/services/availabilityService.js`

### QA-012: Public booking staff selection is not service-scoped

Severity: High

Evidence:

- `PublicPage/src/components/BookingModal.tsx`
- Public modal fetches all staff via general staff API instead of the service-specific staff endpoint

Impact:

- Customers can select staff who may not be assigned to the chosen service.
- This creates booking friction and avoidable API conflicts.

### QA-013: Public booking payment options are mostly cosmetic

Severity: High

Evidence:

- `PublicPage/src/components/BookingModal.tsx`
- `server/src/controllers/publicTenantController.js`

Observed:

- UI collects payment choice
- Backend `createPublicBooking` does not process payment
- “booking fee” logic only calculates a response value; it does not execute a real deposit/payment flow

Impact:

- Customers can be led through a payment-looking flow without a true payment transaction.
- Business rules around deposit/full-payment are not enforced end-to-end.

### QA-014: Booking creation counts customer spending before payment, then counts again on payment

Severity: Critical

Evidence:

- `server/src/services/bookingService.js`
- `server/src/services/paymentService.js`

Observed:

- `bookingService.createBooking()` increments `PlatformUser.totalSpent` while booking payment status is still `pending`
- `paymentService.processPayment()` increments `PlatformUser.totalSpent` again when payment is processed

Impact:

- Customer spend, loyalty logic, and insights can be overstated.
- Any analytics or rewards based on spend are unreliable.

### QA-015: Booking pages still contain localhost links/media references

Severity: High

Evidence:

- `client/src/app/booking/page.tsx`
- `client/src/components/BookingFlow.tsx`
- `PublicPage/src/components/BookingModal.tsx`

Impact:

- Booking flow can break when users view service details, tenant media, or move across surfaces in production.

## Purchasing Flow Audit

### Current flow map

Authenticated purchase:

- Customer app product page / purchase flow creates order
- If online payment is chosen, user is redirected to `/products/payment`
- Backend uses:
  - `server/src/controllers/orderController.js`
  - `server/src/services/orderService.js`
  - `server/src/controllers/paymentController.js`
  - `server/src/services/paymentService.js`

Public purchase:

- `PublicPage/src/components/CheckoutPage.tsx`
- Backend uses `server/src/controllers/publicTenantController.js:createPublicOrder`

Tenant order ops:

- `tenant/src/app/[locale]/dashboard/orders/page.tsx`
- `tenant/src/app/[locale]/dashboard/orders/[id]/page.tsx`
- `server/src/controllers/tenantOrderController.js`

### QA-016: Public order creation appears structurally broken against the `OrderItem` model

Severity: Critical

Evidence:

- `server/src/controllers/publicTenantController.js`
- `server/src/models/OrderItem.js`

Observed:

- `OrderItem` requires snapshot fields such as `productName` and `productPrice`
- `createPublicOrder` creates order items with only:
  - `orderId`
  - `productId`
  - `quantity`
  - `unitPrice`
  - `totalPrice`

Impact:

- Public checkout is at high risk of failing at runtime when saving order items.
- Even if database constraints are looser than the model, order snapshots will be incomplete and downstream UIs will break.

### QA-017: Public online orders are marked paid without real payment processing

Severity: Critical

Evidence:

- `server/src/controllers/publicTenantController.js`

Observed:

- When public checkout uses `online`, the order is created with:
  - `paymentStatus: 'paid'`
  - `status: 'confirmed'`
- No real payment processing step occurs

Impact:

- Revenue and fulfillment state can become false-positive.
- Orders may be treated as paid when no payment actually happened.

### QA-018: Authenticated and public order flows use inconsistent payment method contracts

Severity: High

Evidence:

- `client/src/components/ProductPurchaseFlow.tsx`
- `server/src/controllers/orderController.js`
- `PublicPage/src/components/CheckoutPage.tsx`
- `server/src/controllers/publicTenantController.js`

Observed:

- Authenticated flow uses `cash_on_delivery`
- Public flow uses `cash-on-delivery`
- Public checkout maps unsupported options like “booking fee” to COD

Impact:

- The two commerce surfaces are not using one clean shared contract.
- This increases regression risk and makes payment behavior hard to reason about.

### QA-019: Pending online orders disappear from dashboards, and recovery flow is broken

Severity: Critical

Evidence:

- `server/src/services/orderService.js`
- `server/src/controllers/tenantOrderController.js`
- `client/src/app/dashboard/purchases/page.tsx`
- `client/src/app/dashboard/purchases/[id]/page.tsx`
- `client/src/app/products/payment/page.tsx`

Observed:

- User order listing only returns online orders when `paymentStatus === 'paid'`
- Tenant order listing has the same default visibility rule
- Dashboard “Pay Now” links send users to `/products/payment?orderId=...&amount=...`
- Product payment page requires `tenantId` and fails without it

Impact:

- If a user creates an online order and payment is interrupted, the order can disappear from normal list views.
- Even when the order is visible in the dashboard, the “Pay Now” recovery path is broken.

### QA-020: Spend tracking is inflated for orders too

Severity: Critical

Evidence:

- `server/src/services/orderService.js`
- `server/src/services/paymentService.js`

Observed:

- Order creation increments `PlatformUser.totalSpent` immediately
- Online order payment increments `PlatformUser.totalSpent` again

Impact:

- Customer spend totals, loyalty, and reporting are inaccurate.

### QA-021: Public and guest order identity handling is inconsistent

Severity: Medium

Evidence:

- `server/src/controllers/publicTenantController.js`

Observed:

- Public order flow creates/uses legacy `Customer`
- Then separately finds or creates `PlatformUser`

Impact:

- Identity can fragment across `Customer` and `PlatformUser`
- Future history, analytics, and CRM behavior become harder to trust

## Payment And Financial Integrity Findings

### QA-022: Payment implementation is still demo/fake mode

Severity: Critical

Evidence:

- `server/src/services/paymentService.js`
- `client/src/app/booking/payment/page.tsx`
- `client/src/app/products/payment/page.tsx`

Observed:

- Test cards are hardcoded into the UI
- Payment service stores `fakePayment: true` in transaction metadata
- No real PSP/tokenized gateway flow exists

Impact:

- Production customers cannot use a real payment system safely.
- Financial flows are not production-grade.

### QA-023: Card handling is not PCI-safe

Severity: Critical

Evidence:

- `client/src/app/booking/payment/page.tsx`
- `client/src/app/products/payment/page.tsx`
- `client/src/components/PaymentModal.tsx`
- `server/src/controllers/paymentController.js`
- `server/src/services/paymentService.js`

Observed:

- Raw card number, expiry, and CVV are posted directly to the backend
- No gateway tokenization or hosted-fields approach exists

Impact:

- This is a major security/compliance risk for any real production payment launch.

### QA-024: Wallet top-up is also built on fake payment logic

Severity: High

Evidence:

- `client/src/app/dashboard/wallet/page.tsx`
- `server/src/controllers/paymentController.js`
- `server/src/services/paymentService.js`

Impact:

- Wallet balance can be changed through demo payment behavior rather than a real PSP-backed top-up flow.

## Security Findings

### QA-025: Default super-admin credentials are hardcoded and logged

Severity: Critical

Evidence:

- `server/src/index.js`
- `admin/src/app/login/page.tsx`

Observed:

- Default password `RifahAdmin@2024` is hardcoded
- Startup logs print the default admin credentials
- Admin login page still shows development credentials hint

Impact:

- Severe takeover risk if this path is reachable in production or reused after deployment.

### QA-026: Public diagnostic route is exposed

Severity: High

Evidence:

- `server/src/index.js`
- Route `/test-uploads`

Impact:

- Unnecessary attack surface in production.

### QA-027: Insecure fallback secrets remain in multiple auth paths

Severity: Critical

Evidence:

- `server/src/middleware/authSuperAdmin.js`
- `server/src/controllers/superAdminAuthController.js`
- `server/src/middleware/authTenant.js`
- `server/src/controllers/tenantAuthController.js`
- `server/src/controllers/tenantSubscriptionPaymentController.js`
- `server/src/config/database.js`

Observed:

- Fallback secrets such as `your-secret-key`, `rifah-super-admin-secret-key-2024`, and `dev_password` still exist

Impact:

- Misconfigured environments can silently fall back to insecure defaults.

### QA-028: User refresh-token flow does not properly use a distinct refresh secret

Severity: High

Evidence:

- `server/src/services/userAuthService.js`

Observed:

- `JWT_REFRESH_SECRET` is declared but refresh tokens are signed and verified with `JWT_SECRET`

Impact:

- Token separation and rotation hygiene are weaker than intended.

### QA-029: Browser token storage remains vulnerable to XSS theft

Severity: High

Evidence:

- `client/src/lib/api.ts`
- `tenant/src/lib/api.ts`
- `PublicPage/src/context/AuthContext.tsx`

Observed:

- Tokens are stored in `sessionStorage` and/or `localStorage`

Impact:

- Any XSS bug can become an auth-token theft bug.

### QA-030: Backend lacks a production-grade payment/security posture around graceful failure and hardening

Severity: Medium

Evidence:

- `server/src/index.js`
- Security posture review from prior scan

Observed:

- No clearly centralized global error middleware in the main startup path
- No obvious graceful shutdown handling around background tasks/listener lifecycle

Impact:

- Operational failures are harder to control and recover from cleanly.

## Staff App Findings

### QA-031: Staff app is only a scaffold, not a fully wired stakeholder surface

Severity: Critical

Evidence:

- `staff-app/App.tsx`
- `staff-app/src/config/env.ts`

Observed:

- App currently only shows API URL and a health ping
- UI itself says staff login and schedules will connect later
- No verified staff-auth backend flow exists

Impact:

- Requirement “admin, tenant, customer, and staff all wired perfectly” is not yet met.

## Additional Operational And UX Findings

### QA-032: Debug logging is still heavy in production paths

Severity: Medium

Evidence:

- `server/src/controllers/tenantEmployeeController.js`
- `server/src/controllers/tenantPublicPageController.js`
- Several frontend components with `console.*`

Impact:

- Noisy logs make incidents harder to monitor and can expose internal details.

### QA-033: There are no meaningful automated backend tests in place

Severity: Medium

Evidence:

- Earlier verification of `server` test command found zero tests

Impact:

- Fixing this system without introducing regressions will be slower and riskier.

## Surface Status By Stakeholder

### Super Admin

Status: Partially wired, not production-safe

Main issues:

- Build currently not clean
- Dev credentials visible
- Some stats/settings content is static or mocked

### Tenant Dashboard

Status: Broadly feature-rich, but deployment and data-contract risks remain

Main issues:

- Dependency drift
- Many localhost media/preview references
- Order visibility rules hide some online-payment cases

### Customer App

Status: Core flows exist but are not reliable enough yet

Main issues:

- Build not clean
- Cross-app localhost redirects
- Booking list alias mismatch
- Purchase payment recovery broken

### Public Site

Status: Visually broad but not production-ready end-to-end

Main issues:

- Hardcoded localhost URLs
- Public booking payment logic incomplete
- Public order path likely broken and semantically inconsistent

### Staff App

Status: Scaffold only

Main issues:

- No real staff auth or staff workflows yet

## Recommended Priority Order

1. Deployment/build blockers and cross-domain URL normalization
2. Security hardening for secrets, admin bootstrap, and exposed dev helpers
3. Purchasing-flow correctness, especially public order creation and online payment recovery
4. Booking-flow correctness, especially staff scoping and spend accounting
5. Data integrity cleanup around spend/loyalty/reporting
6. Mock/placeholder removal and UX cleanup
7. Regression tests before broad fixes

## Deliverables Created In This Audit

- `SYSTEM_QA_AUDIT_2026-03-31.md`
- `SYSTEM_QA_FIX_PLAN_2026-03-31.md`

