# System QA Execution Roadmap

Date: 2026-03-31
Repository: `d:\Waheed\Refah\Bookingsystem`
Context:

- Single VPS deployment through Coolify for now
- Infrastructure expansion is intentionally deferred
- Payment gateway is not integrated yet
- SMS gateway is not integrated yet
- Payment and SMS should remain mocked for this phase
- Goal is a clean, stable, production-grade system behavior with current mocked dependencies

## Operating Assumptions

These assumptions drive the roadmap:

1. We are not solving scale infrastructure in this phase.
2. We are making the codebase correct, connected, and safe enough to pass QA on the current VPS.
3. Payment remains mock mode for now:
   - payment success is simulated
   - payment states must still behave correctly
   - no raw-card production rollout should be treated as a final solution
4. SMS remains out of scope for now:
   - customer login continues to use email and password
   - all phone/SMS integration points should remain replaceable later
5. Any fix we make now should preserve clean replacement points for real gateways later.

## Program Goals

By the end of this roadmap, the system should satisfy all of the following:

- All stakeholder surfaces are buildable and deployable
- All pages and app-to-app links work on production URLs
- No critical runtime mock behavior remains in core business logic
- Booking flow works end to end
- Purchasing flow works end to end
- Admin, tenant, customer, and staff surfaces have explicitly correct status
- Security defaults are not dangerous in production
- QA team can test the full system without hidden blockers

## Phase Structure

The work should be executed in 6 phases.

### Phase 1: Foundation And Deployment Wiring

Purpose:

- Make the repo deployable and all surfaces environment-correct on the current VPS

Why first:

- If URL wiring, build configuration, and app connectivity are wrong, deeper business fixes are wasted effort

Main targets:

- `package.json`
- `client/tsconfig.json`
- `admin/tsconfig.json`
- `tenant/tsconfig.json`
- `client/src/lib/api.ts`
- `admin/src/lib/api.ts`
- `tenant/src/lib/api.ts`
- `PublicPage/src/lib/api.ts`
- `PublicPage/src/context/AuthContext.tsx`
- `client/src/app/tenant/[slug]/page.tsx`
- `tenant/src/app/[locale]/dashboard/mypage/page.tsx`
- `PublicPage/src/components/Header.tsx`
- `PublicPage/src/components/LoginModal.tsx`
- media URL handling across all surfaces

Key fixes:

- Remove hardcoded `localhost` app links
- Remove hardcoded `localhost` media origins
- Standardize environment-driven app base URLs
- Fix path alias build issues in `client` and `admin`
- Ensure `PublicPage` is included in install/deploy flow
- Make `tenant` dependency setup deterministic

Verification gate:

- `server`, `client`, `admin`, `tenant`, `PublicPage`, and `staff-app` each build cleanly
- No remaining production-facing links point to localhost
- Navigation between public site and customer app works using production-style env config

Do not touch yet:

- booking-state business logic
- purchasing-state business logic
- payment internals beyond environment wiring

### Phase 2: Surface Connectivity And Navigation QA

Purpose:

- Ensure every visible page and user pathway is actually connected

Why second:

- Once deployment wiring is fixed, we can safely verify page relationships without route noise from localhost assumptions

Main targets:

- Admin layout and dashboard pages
- Tenant layout and dashboard pages
- Customer dashboard pages
- Public site route tree
- Staff app current shell behavior

Likely modules:

- `admin/src/components/AdminLayout.tsx`
- `tenant/src/components/TenantLayout.tsx`
- `client/src/components/DashboardLayout.tsx`
- `PublicPage/src/App.tsx`
- `PublicPage/src/components/Header.tsx`
- `staff-app/App.tsx`

Key fixes:

- Resolve broken links, broken redirects, and incomplete mobile navigation
- Confirm all listed routes have reachable pages
- Confirm dashboard entry points and detail pages connect correctly
- Mark staff app explicitly as:
  - minimally wired, or
  - intentionally not live yet

Verification gate:

- Every nav item lands on a working page
- Every detail page can be reached from its list page
- Cross-surface routes are valid on the VPS domain layout

Do not touch yet:

- security hardening except where it blocks routing
- payment state machine logic

### Phase 3: Booking Flow Stabilization

Purpose:

- Make appointment booking reliable across public, customer, tenant, and backend surfaces

Why third:

- Booking is a core system workflow and should be stabilized before commerce

Main targets:

- `client/src/app/booking/page.tsx`
- `client/src/components/BookingFlow.tsx`
- `client/src/app/dashboard/page.tsx`
- `client/src/app/dashboard/bookings/page.tsx`
- `client/src/app/dashboard/bookings/[id]/page.tsx`
- `PublicPage/src/components/BookingModal.tsx`
- `server/src/controllers/bookingController.js`
- `server/src/controllers/publicTenantController.js`
- `server/src/services/bookingService.js`
- `server/src/services/availabilityService.js`
- `server/src/controllers/userController.js`

Key fixes:

- Scope public staff selection to service-compatible staff
- Normalize appointment response shape for customer UI
- Fix booking list/detail rendering mismatches
- Decide correct pre-payment booking state and make it consistent
- Keep fake payment in place, but ensure booking state transitions make sense
- Remove double-counting of customer spend in booking-related flows

Verification gate:

- Public booking can be created successfully
- Authenticated booking can be created successfully
- Tenant sees bookings correctly
- Customer dashboard sees booking list and detail correctly
- Cancel flow works
- Mock payment flow behaves consistently

Do not touch yet:

- real PSP integration
- SMS/OTP login redesign

### Phase 4: Purchasing Flow Stabilization

Purpose:

- Make product ordering correct, visible, recoverable, and tenant-manageable

Why fourth:

- Purchase flow currently has more contract inconsistencies than booking and should be fixed as one dedicated batch

Main targets:

- `client/src/components/ProductPurchaseFlow.tsx`
- `client/src/app/products/purchase/page.tsx`
- `client/src/app/products/payment/page.tsx`
- `client/src/app/dashboard/purchases/page.tsx`
- `client/src/app/dashboard/purchases/[id]/page.tsx`
- `PublicPage/src/components/CheckoutPage.tsx`
- `server/src/controllers/orderController.js`
- `server/src/services/orderService.js`
- `server/src/controllers/publicTenantController.js`
- `server/src/controllers/paymentController.js`
- `server/src/services/paymentService.js`
- `server/src/models/Order.js`
- `server/src/models/OrderItem.js`
- `server/src/controllers/tenantOrderController.js`

Key fixes:

- Unify payment method enum contract across public and authenticated flows
- Fix public order creation to satisfy `OrderItem` snapshot requirements
- Ensure mock online orders are not falsely treated as real paid orders without the intended mock transition
- Fix “Pay Now” recovery flow for interrupted online orders
- Decide and implement consistent visibility for unpaid online orders
- Remove double-counting of customer spend in order/payment logic
- Make tenant order list and order detail behave consistently

Verification gate:

- Public checkout creates a valid order
- Customer checkout creates a valid order
- Unpaid online order can be found and paid later in mock mode
- Tenant can view and manage orders reliably
- Customer order list and order detail render correctly

Do not touch yet:

- real gateway integration
- final infra scaling work

### Phase 5: Security Hardening For Current Production Mode

Purpose:

- Remove dangerous production defaults without requiring the future SMS/payment integrations

Why fifth:

- By this point the main flows are stable enough that security tightening will not be fighting unknown product behavior

Main targets:

- `server/src/index.js`
- `server/src/services/userAuthService.js`
- `server/src/middleware/authTenant.js`
- `server/src/middleware/authSuperAdmin.js`
- `server/src/controllers/tenantAuthController.js`
- `server/src/controllers/superAdminAuthController.js`
- `server/src/config/database.js`
- token storage strategies in frontend apps

Key fixes:

- Remove hardcoded admin credential bootstrap from production path
- Remove credential logging
- remove/gate `/test-uploads`
- remove insecure fallback secrets
- fix refresh-token secret usage
- reduce obvious auth/session weaknesses while keeping current login model

Verification gate:

- App starts only with valid env configuration
- Admin credentials are not exposed in codepath or UI
- Auth refresh still works
- No dev helpers are exposed publicly

Do not touch yet:

- SMS gateway integration
- phone-login redesign

### Phase 6: QA Polish, Mock Cleanup, And Readiness Pass

Purpose:

- Finish what QA needs for a clean system test cycle

Why last:

- This is the cleanup pass after core correctness and security are under control

Main targets:

- `server/src/controllers/adminTenantsController.js`
- `admin/src/app/dashboard/settings/page.tsx`
- `PublicPage/src/components/ReviewCarousel.tsx`
- `server/src/controllers/publicTenantController.js`
- logging-heavy controllers and pages
- staff app final status decision

Key fixes:

- Replace runtime mock stats with real calculations
- remove or clearly isolate placeholder content
- finish contact form persistence or intentionally disable it
- reduce production debug logs
- confirm what “staff app ready” means for this release

Verification gate:

- QA team can test the main flows without hitting placeholder blockers
- no critical business logic depends on fake runtime data
- open issues list is reduced to non-blocking items only

## Batch Execution Model

Each phase should be treated as its own deployment batch.

### Batch A

Maps to:

- Phase 1

Goal:

- deployability and environment correctness

Risk:

- Low

Must pass before moving on:

- clean builds
- no localhost production links

### Batch B

Maps to:

- Phase 2

Goal:

- page-to-page and app-to-app connectivity

Risk:

- Low

Must pass before moving on:

- all navigation paths are reachable

### Batch C

Maps to:

- Phase 3

Goal:

- booking flow correctness

Risk:

- Medium

Must pass before moving on:

- public and authenticated booking both work end to end

### Batch D

Maps to:

- Phase 4

Goal:

- purchasing flow correctness

Risk:

- Medium to High

Must pass before moving on:

- orders can be created, found, paid in mock mode, and managed

### Batch E

Maps to:

- Phase 5

Goal:

- current-production security cleanup

Risk:

- Medium

Must pass before moving on:

- no dangerous secrets/defaults remain in runtime path

### Batch F

Maps to:

- Phase 6

Goal:

- QA polish and readiness

Risk:

- Low to Medium

Must pass before closing:

- system is clean enough for QA team full-cycle testing

## Mock Payment And SMS Policy

To keep future gateway integration easy, we should use this policy during implementation:

### Payment policy for now

- Keep payment in mock mode
- Preserve payment status transitions as if a gateway existed
- Keep payment service behind clear replacement points
- Do not redesign the whole booking/order architecture around fake payment shortcuts

Meaning:

- The system should behave as if payment is a service dependency that currently always returns a controlled mock result
- Not as if payment simply does not matter

### SMS policy for now

- Keep SMS out of the authentication-critical path
- Continue email/password login for customer app
- Keep SMS hooks isolated for later integration

Meaning:

- We should not build temporary hacks that make later SMS integration harder

## Verification Strategy

Because Docker is not available locally, verification should use two tracks:

### Track 1: Repo-Level Verification

- type/build checks
- route and contract review
- code-path validation
- static QA sweeps

### Track 2: VPS/Coolify Verification

- deploy each batch
- run manual smoke checklist against the live testing environment
- record regressions immediately before next batch

## Manual QA Checklist Per Batch

For each deployment batch, QA should test:

1. Admin login and dashboard
2. Tenant login and dashboard
3. Customer login and dashboard
4. Public site browsing
5. Service discovery
6. Product discovery
7. Booking create, view, cancel
8. Order create, view, pay in mock mode, cancel
9. Media loading
10. Cross-app redirects and links

## Recommended Immediate Start

Start with Batch A only.

Reason:

- The system cannot be made reliable while build configuration and production URL wiring are still unstable.

Immediate next work after Batch A:

- Batch B

Immediate next work after Batch B:

- Batch C

## Definition Of Success For Current Release Mode

This release mode should be considered successful when:

- system works cleanly on one VPS
- fake payment works as a proper mock dependency
- email/password login works cleanly without SMS
- all stakeholder surfaces are correctly wired
- no critical business logic depends on unresolved placeholder behavior
- QA team can fully test the system end to end

At that point, infrastructure scaling and real payment/SMS integration become the next program, not blockers for this one.

