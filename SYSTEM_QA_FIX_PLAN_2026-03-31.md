# System QA Fix Plan

Date: 2026-03-31
Companion report: `SYSTEM_QA_AUDIT_2026-03-31.md`
Goal: fix the system in a low-risk order that reduces breakage and avoids harming existing functionality

## Fixing Principles

1. Do not mix deployment fixes, security fixes, and flow rewrites in one batch.
2. Normalize contracts before redesigning UI behavior.
3. Add verification around every business-flow fix.
4. Prefer compatibility shims before hard removals where users may already depend on current behavior.
5. Treat payment work as high-risk and stage it separately from cosmetic UX fixes.

## Phase 0: Safety Setup

Objective:

- Make the next fix passes safe to perform and safe to deploy

Tasks:

- Create a dedicated audit-remediation branch
- Confirm current Coolify services and environment variable sources
- Snapshot production env names for:
  - API base URL
  - client URL
  - tenant dashboard URL
  - public site URL
  - admin URL
  - staff app API URL
- Define a regression checklist for:
  - customer login
  - tenant login
  - admin login
  - public browsing
  - booking create/cancel/pay
  - product order create/pay/cancel

Why first:

- We should not start touching business logic until deploy assumptions are explicit.

## Phase 1: Deployment And Environment Normalization

Objective:

- Make every surface resolve the correct production URLs and build cleanly

Tasks:

- Replace hardcoded localhost links/media origins with environment-driven helpers
- Centralize per-surface URL config
- Fix `client` and `admin` path alias configuration
- Ensure `tenant` has correct dependency/install wiring
- Add `PublicPage` to the root install workflow or document separate install explicitly
- Verify build for:
  - `server`
  - `client`
  - `admin`
  - `tenant`
  - `PublicPage`
  - `staff-app`

Expected risk:

- Low to medium if done as pure config/wiring cleanup without behavior changes

Success criteria:

- All surfaces build successfully in a clean environment
- No production links or images still depend on `localhost`

## Phase 2: Security Hardening

Objective:

- Remove dangerous defaults and lock down obvious attack surface

Tasks:

- Remove or gate `/test-uploads`
- Remove default super-admin password bootstrap from production path
- Remove credential logging
- Remove insecure fallback JWT and DB secrets
- Fix user refresh-token signing/verification to use the refresh secret consistently
- Review whether tenant and admin auth flows have the same fallback-secret problem
- Plan migration away from browser-stored auth tokens where feasible

Expected risk:

- Medium

Notes:

- Secret-removal changes should be coordinated with Coolify env updates in the same deployment window.

Success criteria:

- System refuses to run with weak or missing critical secrets
- No dev-only credentials remain in runtime or UI

## Phase 3: Purchasing Flow Stabilization

Objective:

- Make commerce behavior logically correct before adding polish

Tasks:

- Unify payment method enums across public and authenticated order flows
- Fix public order creation so `OrderItem` snapshot data is written correctly
- Stop marking public online orders as paid without real payment
- Fix dashboard “Pay Now” links to always pass required context, or redesign payment page to load context from order ID only
- Decide whether unpaid online orders should remain visible to users and tenants
- Remove double-counting of `PlatformUser.totalSpent`
- Normalize guest/public identity handling so order history can be traced consistently

Expected risk:

- Medium to high

Recommended implementation order:

1. Fix data contract and model write correctness
2. Fix visibility/recovery behavior for unpaid online orders
3. Fix spend accounting
4. Then refactor UI entry points

Success criteria:

- Public checkout can create a valid order
- Authenticated checkout can recover from interrupted payment
- No paid status is assigned without a real successful payment event

## Phase 4: Booking Flow Stabilization

Objective:

- Make booking behavior internally consistent and production-safe

Tasks:

- Scope public staff selection to the chosen service
- Audit whether booking should be `pending` or `confirmed` before payment
- Remove double-counting of `totalSpent` in booking flow
- Decide how deposit/full-payment/at-center choices should actually work
- Normalize booking list/detail response shapes so customer app uses one association naming convention
- Remove leftover localhost links from booking pages and service-detail jumps

Expected risk:

- Medium

Success criteria:

- Booking lists render service/staff names consistently
- Public and authenticated booking flows respect the same booking-state rules
- Spend totals are accurate

## Phase 5: Payment Strategy Decision

Objective:

- Decide whether this system is remaining demo-payment for now or moving to real payments

Options:

- Option A: keep demo mode temporarily
- Option B: integrate a real PSP

If staying demo temporarily:

- Clearly label all payment paths as sandbox/demo
- Block any production launch that implies real payment acceptance

If moving to real PSP:

- Replace raw card handling with PSP tokenization/hosted fields
- Remove fake test-card logic from production flow
- Rework transaction state machine around gateway callbacks/webhooks

Expected risk:

- High

Important:

- This phase should not be hidden inside ordinary bug-fixing. It is a product, compliance, and architecture decision.

## Phase 6: Mock, Placeholder, And UX Cleanup

Objective:

- Remove misleading UI and unfinished experiences after the core flows are stable

Tasks:

- Replace admin mock stats with real calculations
- Remove placeholder images/content
- Finish contact form persistence
- Remove “coming soon” blocks or hide unfinished admin features
- Clean up public-site mobile authenticated navigation
- Reduce debug logging and console noise

Expected risk:

- Low to medium

## Phase 7: Staff App Wiring

Objective:

- Bring the fourth stakeholder surface to functional parity with the system direction

Tasks:

- Define staff authentication model
- Add backend staff auth/session APIs if not already present
- Define minimum viable staff workflows:
  - today’s appointments
  - schedule view
  - check-in / status updates if needed
- Replace health-check shell UI with real app screens

Expected risk:

- Medium to high

## Phase 8: Regression Coverage

Objective:

- Make future fixes safer

Tasks:

- Add API-level tests for:
  - booking creation
  - booking cancellation
  - order creation
  - order payment status transitions
  - tenant order visibility
  - auth refresh
- Add at least one smoke path per web surface
- Add a deployment smoke checklist for Coolify

Expected risk:

- Low

Benefits:

- This is what lets us keep moving without repeatedly breaking core flows.

## Suggested Fix Batches

### Batch A

- Phase 1 only

Deployment target:

- Restore buildability and URL correctness

### Batch B

- Phase 2 only

Deployment target:

- Remove dangerous production security defaults

### Batch C

- Purchasing-flow fixes from Phase 3

Deployment target:

- Make commerce recoverable and logically consistent

### Batch D

- Booking-flow fixes from Phase 4

Deployment target:

- Make appointment flow reliable and consistent

### Batch E

- Mock/UX cleanup and staff-app planning work

Deployment target:

- Finish polish after core correctness is stable

## Recommended Start Point

Start with Batch A immediately.

Reason:

- There is no value fixing deeper business logic while builds, links, media URLs, and install wiring are still unstable on the VPS deployment path.

After Batch A, move directly to Batch B before touching payment logic.

Reason:

- The current security posture should not remain in place while the system is being prepared for real redeploys.

## Definition Of Done For The Full Remediation

The system should only be considered “wired correctly” when all of the following are true:

- Every surface builds cleanly in a fresh environment
- No production surface depends on localhost URLs
- Customer booking and purchase flows complete or fail cleanly end to end
- Interrupted online payments can be recovered safely
- Spend, loyalty, and revenue reporting are accurate
- Dev credentials, fallback secrets, and debug routes are removed from production behavior
- Staff app has real stakeholder functionality or is explicitly excluded from scope
- Core flows are protected by regression tests

