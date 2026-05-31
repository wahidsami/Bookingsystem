# Customer App Surgical Remediation Plan (2026-05-31)

## Objective
Stabilize and harden customer app critical flows without breaking production behavior:
- Auth and login
- Booking and payment
- Purchases and payment
- Notifications and push notifications
- Gift cards (general + tenant-scoped)

This plan prioritizes financial correctness, consistency, observability, and rollback safety while following high engineering standards.

---

## Engineering Standards We Will Enforce
1. Backward-compatible first: no breaking API contract changes without versioning.
2. Financial operations must be idempotent and traceable.
3. Every state-changing endpoint must have explicit validation, structured errors, and audit events.
4. Feature flags for high-risk behavior changes.
5. Contract tests between mobile and backend for all critical flows.
6. Mandatory observability for payment/booking/auth paths (metrics + logs + alert thresholds).
7. Safe rollout: canary + rollback procedure documented before release.

---

## Current Risk Map (From Audit)

### Critical
1. Multi-item service booking payments are not session-atomic.
2. Payment API processes one appointment/order, not full booking session.
3. Booking session reference generation had null constraint timing issue (patched locally, needs validation rollout).

### High
1. Two-cart model (product vs booking cart) is valid but prone to user confusion.
2. Checkout/payment entry points are split.
3. Session/refresh behavior needs stronger reliability guarantees under network instability.

### Medium
1. Google onboarding has many branches and edge states.
2. Notification read/unread state can drift under concurrent updates.
3. Gift flows are dual-system (general + tenant) and need stricter flow contracts.

---

## Phased Surgical Execution

## Phase 0: Safety Baseline and Freeze
Goal: prevent further risk while remediation is in progress.

Actions:
1. Create remediation branch and lock risky feature merges.
2. Record current production behavior with baseline E2E captures.
3. Add temporary runtime guards where null/invalid state can crash critical paths.
4. Confirm DB/model patch for booking reference is deployed and monitored.

Exit criteria:
1. Baseline regression suite recorded.
2. No open P0 crash in booking/payment path.

---

## Phase 1: Payment and Booking Transaction Integrity (Highest Priority)
Goal: make service booking payment flow financially correct and robust.

Actions:
1. Introduce booking-session payment capability in backend:
- New endpoint for booking-session settlement (single operation over payable items).
- Idempotency key required.
- Server-side recomputation of payable totals (never trust client totals).
2. Keep existing appointment-level payment endpoint for compatibility.
3. Add transactional guarantees:
- Payment intent state machine (`initiated -> authorized -> captured/failed`).
- Prevent double-capture with unique constraints and idempotency index.
4. Mobile integration:
- If session has payable amount, route through session payment flow.
- Clear user messaging for partial/non-payable items.
5. Reconciliation hooks:
- Store session-level and item-level payment ledger entries.

Tests:
1. Unit tests for amount calculation and idempotency.
2. Integration tests for partial failures and retries.
3. E2E tests:
- One payable item
- Multiple payable items
- Mixed pay-at-center + payable now
- Retry after timeout

Exit criteria:
1. No payment duplication in tests.
2. Session-level payment works for all supported scenarios.
3. Financial ledger matches expected totals in audit test data.

---

## Phase 2: Auth and Session Hardening
Goal: make login persistence deterministic and resilient.

Actions:
1. Define canonical auth state machine in client (`anonymous`, `token_refreshing`, `authenticated`, `expired`).
2. Single refresh coordinator (avoid parallel refresh races).
3. Token lifecycle hardening:
- Strict token expiry handling
- Refresh backoff and retry policy
- Forced logout only on authoritative invalid-token response
4. Google flow simplification:
- Normalize token extraction paths
- Single completion handler with explicit failure reasons
5. Add session diagnostics telemetry (refresh attempts, refresh failures, token age buckets).

Tests:
1. Deterministic tests for refresh race and app foreground/background transitions.
2. E2E for login, app restart, offline recovery, and google onboarding completion.

Exit criteria:
1. No random logout under normal network fluctuation.
2. Reproducible auth behavior across cold start and resume.

---

## Phase 3: Cart Architecture and UX Contract Clarity
Goal: preserve two-cart architecture while removing ambiguity.

Actions:
1. Define explicit cart taxonomy:
- Product Cart (orders)
- Booking Cart (services)
2. UI contract:
- Dedicated entry points and badges everywhere relevant.
- Never show a badge count on an entry that opens a different cart type.
3. Cross-cart guardrails:
- Clear notices when user attempts mixed expectations.
4. Checkout guard pages:
- Before payment, display exact transaction scope and cart type.

Tests:
1. Navigation matrix tests for all cart entry points.
2. State sync tests across tabs/screens.

Exit criteria:
1. Users can always predict where each cart action leads.
2. No badge-to-destination mismatch remains.

---

## Phase 4: Notifications and Push Reliability
Goal: ensure notification delivery, registration, and read state consistency.

Actions:
1. Introduce unified notification state reducer in app.
2. De-duplicate read-mark operations with optimistic updates + server reconciliation.
3. Push token lifecycle hardening:
- Rotate token handling
- Re-register on auth transitions
- Handle stale tokens cleanly
4. Add delivery and open-rate telemetry for campaign and transactional notifications.

Tests:
1. E2E for foreground, background, cold-start notification opens.
2. Read/unread consistency tests across list/detail.

Exit criteria:
1. Consistent unread counters.
2. No duplicate read events for same notification action.

---

## Phase 5: Gift Card Domain Hardening
Goal: make general and tenant gift flows unambiguous and safe.

Actions:
1. Define domain contract:
- Gift token type, scope, and origin metadata
- Tenant-scoped wallet vs global wallet boundaries
2. Input and route hardening:
- Token format validation before API call
- Explicit endpoint routing by token type
3. Add anti-replay checks and claim idempotency.
4. Improve user feedback for claim/purchase/send failures with actionable reasons.

Tests:
1. Claim flow matrix (general token, tenant token, invalid token, replay).
2. Wallet balance consistency tests before/after each operation.

Exit criteria:
1. No ambiguous gift-token handling path.
2. Deterministic wallet updates across flows.

---

## Cross-Cutting Quality Gates (All Phases)
1. Code quality:
- Lint clean
- Type safety clean
- No TODO shipping in critical modules
2. Testing:
- Unit + integration + E2E mandatory for touched critical paths
3. Security:
- Input validation
- AuthZ checks
- Sensitive data not logged
4. Observability:
- Structured logs with correlation IDs
- Dashboard panels for error rates and payment success
5. Documentation:
- API contract docs updated
- Runbook + rollback steps updated

---

## Rollout Strategy
1. Feature flags for each high-risk change:
- `booking_session_payment_enabled`
- `auth_refresh_coordinator_enabled`
- `notification_state_reducer_enabled`
- `gift_token_typed_routing_enabled`
2. Deploy sequence:
1. Backend dark release
2. Mobile release with flags off
3. Enable for internal tenants
4. Enable for 5%, then 25%, then 100%
3. Monitoring windows:
- 24h per stage with go/no-go review

Rollback:
1. Disable feature flags immediately.
2. Revert to previous endpoint path if needed.
3. Use incident runbook with severity matrix.

---

## Ownership and Delivery Cadence
1. Workstream A: Payments and Booking Integrity (Backend + Mobile)
2. Workstream B: Auth/Session
3. Workstream C: Cart UX contract
4. Workstream D: Notifications
5. Workstream E: Gift cards

Recommended cadence:
1. Daily triage on P0/P1.
2. Twice-weekly architecture checkpoint.
3. Weekly release gate review with QA sign-off.

---

## Definition of Done (Program-Level)
1. No unresolved P0/P1 in audited domains.
2. Payment/booking/gift operations are idempotent and fully traceable.
3. Auth sessions stable across lifecycle transitions.
4. Notification counters and read-state consistent.
5. Production monitoring shows stable or improved success/error KPIs for 2 full release cycles.

---

## Immediate Next Step
Execute Phase 1 first (session-level payment integrity), then Phase 2 (auth hardening), before broader UX refinements.
