# Tenant Appointments Audit & Implementation Plan (100% Completion)

Date: 2026-05-14
Owner: Tenant Dashboard Team
Scope: `tenant/src/app/[locale]/dashboard/appointments`, `tenant/src/components/CalendarView.tsx`, `tenant/src/components/AppointmentDetailsDrawer.tsx`, `tenant/src/components/EmployeeWeeklyScheduleEditor.tsx`, `tenant/src/lib/api.ts`, `server/src/controllers/tenantCustomerController.js`, `server/src/controllers/tenantAppointmentController.js`, `server/src/routes/tenantRoutes.js`

## 1) Goal
Deliver a complete, production-safe implementation for the appointments-board and customer-profile drawer issues/features below:

1. Fix payment-status inconsistency between Customer Profile tabs (Appointments vs Transactions).
2. Add per-provider action menu from board header avatar area with full shortcut actions.
3. Add a multi-users icon in board header to reset/toggle to “all providers” default board.
4. Upgrade board drag/drop to support provider + time reassignment with confirmation modal and customer notification option.

Success target: all points implemented end-to-end (UI, API, validation, persistence, notifications, telemetry, QA).

## 2) Current-State Audit Summary

### 2.1 Customer Profile Drawer: Payment Data Sources
- Drawer file: `tenant/src/components/AppointmentDetailsDrawer.tsx`.
- Appointments tab uses `customerProfile.allAppointments` from `tenantApi.getCustomerHistory(...)`.
- Transactions tab uses `tenantApi.getCustomerTransactions(...)`.
- Drawer computes display payment status with `resolveEffectivePaymentStatus(...)` (client-side normalization).
- Snapshot cards combine appointment outstanding totals with transaction records.

### 2.2 Backend Customer Transactions Logic
- Endpoint: `GET /tenant/customers/:id/transactions` in `server/src/controllers/tenantCustomerController.js`.
- Transactions are merged from:
1. `Transaction` table (gateway records)
2. `PaymentTransaction` table (at-center ledger records)
3. Synthetic appointment-derived records when appointment is paid but no tx found
- Risk: mixed-source dedupe can still create semantic mismatch with appointment tab status/outstanding values.

### 2.3 Board View Menu / Shortcuts
- Existing board context menu in `appointments/page.tsx` has only:
1. Add new appointment
2. Add blocked time
- No quick entry for shift editor or provider-specific day/week/month filters.

### 2.4 Board Header Controls
- `CalendarView.tsx` currently has:
1. provider visibility chips (toggle each provider)
2. tools button
- Missing dedicated “multi users” quick action to restore default all-provider board view.

### 2.5 Drag/Drop Behavior
- Current drag logic in `CalendarView.tsx` supports horizontal reassignment (same time, different provider).
- Backend API used: `PATCH /tenant/appointments/:id/reassign-staff`.
- Missing capability: drag to another provider/time and post-drop confirmation modal to notify customer.

## 3) Root-Cause Hypotheses for Payment Mismatch

### H1
Appointments tab relies on appointment-level payment fields (`paymentStatus`, `totalPaid`, `outstandingAmount`, `remainderAmount`) while Transactions tab aggregates payment events from multiple sources and synthetic rows.

### H2
Transaction rows may be incomplete or duplicated by source-layer dedupe keys, causing status to appear pending/completed inconsistently for the same appointment.

### H3
Client-side normalization in drawer (`resolveEffectivePaymentStatus`) may mask backend data issues and diverge from transaction-record semantics.

### H4
Some update flows modify appointment status/payment fields without reliably creating or reconciling matching transaction records.

## 4) Implementation Strategy (Phased)

## Phase 0: Baseline, Logging, and Data Contract Freeze
Objective: lock baseline behavior before changes.

Deliverables:
- Add temporary audit logs (server-side) for appointment/payment updates and customer-transaction response composition.
- Capture 10 representative appointments covering:
1. pending
2. deposit_paid
3. fully_paid/paid
4. refunded/partially_refunded
5. mixed online + POS payments
- Define canonical mapping doc: appointment payment status ↔ transaction event states.

Acceptance Criteria:
- A reproducible mismatch dataset exists with appointment IDs and expected truth state.
- Team agrees on canonical truth rules used by both tabs.

## Phase 1: Payment Status Accuracy & Wiring Fix (Request #1)
Objective: ensure Overview/Appointments/Transactions all show consistent payment truth.

Frontend Tasks:
- Refactor `AppointmentDetailsDrawer.tsx` to consume a unified payment summary shape per appointment.
- Remove ambiguous client-only correction logic where backend can provide authoritative normalized fields.
- Add explicit badge copy for:
1. Pending
2. Deposit paid
3. Paid in full
4. Refunded
5. Partially refunded
- Add tooltip/help text for edge states (e.g., paid + refund).

Backend Tasks:
- Add normalized payment projection in `getCustomerHistory` and `getCustomerTransactions` for each appointment row:
1. `normalizedPaymentStatus`
2. `paidAmount`
3. `outstandingAmount`
4. `lastPaymentAt`
5. `paymentEvidenceSource` (`transaction`, `ledger`, `appointment_derived`)
- Harden dedupe keys in `getCustomerTransactions` and return linkage fields:
1. `appointmentId`
2. `transactionFamilyId` (deterministic key)
- Ensure appointment payment update endpoints always trigger transaction reconciliation.

Data Integrity Tasks:
- Add reconciliation utility script for historical mismatches (dry-run + apply mode).
- Add safety checks so `appointment.paymentStatus=paid/fully_paid` cannot coexist with positive outstanding amount unless flagged partial/refund scenario.

Acceptance Criteria:
- For any appointment in drawer, status and outstanding are identical across Overview, Appointments tab, Transactions tab summary.
- No false “paid” badge when transactions indicate pending/unpaid balance.
- Regression tests pass for all payment statuses.

## Phase 2: Provider Avatar Action Menu Expansion (Request #2)
Objective: full provider-specific action menu from board header.

UI/UX Tasks:
- Add arrow action button on each provider header in `CalendarView.tsx`.
- Open provider menu with items:
1. Add appointment
2. Add blocked time
3. Edit shift
4. Day view
5. Week view
6. Month view
- Preserve RTL, keyboard accessibility, and click-outside close behavior.

Action Wiring Tasks:
- Add appointment: reuse existing quick drawer prefilled with selected provider + selected date/time.
- Add blocked time: reuse existing blocked-time drawer prefilled with selected provider + selected date/time.
- Edit shift: open modal containing `EmployeeWeeklyScheduleEditor` configured for selected provider.
- Day/week/month view:
1. Day = current existing board behavior
2. Week = provider weekly grid/list grouped by day
3. Month = provider monthly calendar density view

Schedule Modal Tasks:
- Build modal shell in `appointments/page.tsx` (or shared component) with:
1. Save button
2. Discard button
- Use existing `EmployeeWeeklyScheduleEditor` save/flush behavior for consistency.
- Add unsaved-changes guard on close.

Backend/API Tasks:
- Reuse existing shift APIs in `tenant/src/lib/api.ts` and routes under `/tenant/employees/:id/shifts`.
- If needed, add bulk update endpoint for efficient weekly updates from modal save.

Acceptance Criteria:
- All 6 menu actions work for each provider without leaving appointments page.
- Shift edits persist and reflect immediately in board availability behavior.
- Day/week/month provider filter state is stable across refresh and navigation.

## Phase 3: Multi-Users Header Toggle (Request #3)
Objective: one-click restore to all-provider board (default state).

Tasks:
- Add “multi users” icon button near Schedule Team / Tools in board header.
- Button behavior:
1. If any provider filter is active, restore all providers visible.
2. If already all visible, keep default and provide subtle active state.
- Add localized tooltip/aria label.

Acceptance Criteria:
- One click always returns board to default all-providers view.
- Works correctly with day/week/month provider modes introduced in Phase 2.

## Phase 4: Advanced Drag/Drop Reassign + Reschedule Confirmation (Request #4)
Objective: drag card to provider/time and complete controlled reschedule flow.

UX Behavior:
- Drag target determines:
1. New provider
2. New start time (if vertical move)
- On drop:
1. If provider changed only and time unchanged, fast path allowed.
2. If time changed, open confirmation modal with notification option.

Modal Requirements:
- Show old vs new date/time/provider.
- Toggle: “Notify customer about schedule change”.
- Actions:
1. Confirm and update
2. Cancel and revert

Frontend Tasks:
- Extend `CalendarView.tsx` drag model to compute drop time from y-position.
- Pass structured payload to page handler: `{ appointmentId, newStaffId, newStartTime, changedTime }`.
- Add reschedule confirm modal in `appointments/page.tsx`.

Backend Tasks:
- Add endpoint that atomically handles provider + time change in one operation (recommended new endpoint):
1. `PATCH /tenant/appointments/:id/reassign-reschedule`
2. Input: `staffId`, `startTime`, `notifyCustomer`, optional note
- Reuse/extend conflict detection + service capability checks.
- Persist update to appointment and dependent fields.
- Trigger notification pipeline when `notifyCustomer=true`.

Consistency Tasks:
- Ensure updated time/provider appears in:
1. Board card immediately
2. Appointment details drawer
3. Customer app appointment card/detail
- Ensure history/audit trail entry is created for operational traceability.

Acceptance Criteria:
- Drag/drop supports provider-time moves with proper validation.
- Confirmation modal appears only when time changed.
- Customer notification optional and verifiably delivered when selected.
- No stale time values in any tenant/mobile view after update.

## Phase 5: QA, Hardening, and Rollout
Objective: ship safely with measurable confidence.

Test Matrix:
- Payment consistency tests:
1. all payment statuses
2. partial payments
3. refunds
4. mixed source transactions
- Board action menu tests:
1. all menu actions per provider
2. RTL and mobile responsive behavior
3. keyboard navigation
- Drag/drop tests:
1. provider-only change
2. provider+time change
3. conflict rejection
4. unauthorized service provider rejection
5. customer notify true/false

Automation:
- Add backend integration tests for customer transactions normalization and reassign-reschedule endpoint.
- Add frontend component tests for drawer status rendering and drag-drop modal flow.

Observability:
- Add structured logs for payment mismatch detection and reschedule operations.
- Add counters/metrics:
1. reschedule confirmations
2. notify-customer selections
3. rejected drag operations

Rollout Plan:
- Feature flag for advanced drag/reschedule flow.
- Staged rollout to internal tenant first.
- Monitor logs and mismatch dashboards for 48 hours.
- Full rollout after validation.

## 5) File-Level Change Plan

Frontend Primary Files:
- `tenant/src/components/AppointmentDetailsDrawer.tsx`
- `tenant/src/components/CalendarView.tsx`
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`
- `tenant/src/components/EmployeeWeeklyScheduleEditor.tsx` (reuse/embed)
- `tenant/src/lib/api.ts`

Backend Primary Files:
- `server/src/controllers/tenantCustomerController.js`
- `server/src/controllers/tenantAppointmentController.js`
- `server/src/routes/tenantRoutes.js`
- Optional: new service file for payment normalization + reconciliation

Optional Data/Migration:
- Reconciliation script for historical appointment/transaction consistency.

## 6) Definition of Done (100%)
A point is considered 100% done only if all are true:
- Functional behavior implemented and accepted by product owner.
- API and UI are consistent across tenant dashboard and customer app surfaces.
- Tests added and passing (unit/integration/critical UI flows).
- No known P1/P2 issues in payment accuracy or board scheduling flows.
- Documentation updated with final behavior and support runbook.
- Feature flags removed or set to default-on after stable rollout window.

## 7) Risks and Mitigations
- Risk: Hidden legacy payment flows bypass new normalization.
Mitigation: centralize payment-state projection in shared backend helper and enforce in all customer-facing endpoints.

- Risk: Drag/drop complexity causes accidental reschedules.
Mitigation: explicit confirmation modal for time changes + undo action in toast.

- Risk: Shift editor popup creates conflicting schedule writes.
Mitigation: optimistic lock/version check and clear merge messaging on conflict.

- Risk: Performance regressions in board week/month provider views.
Mitigation: server pagination/windowing + memoized client rendering and virtualization where needed.

## 8) Execution Order Recommendation
1. Phase 0 baseline
2. Phase 1 payment truth and wiring
3. Phase 2 provider menu + shift modal + day/week/month provider modes
4. Phase 3 multi-users toggle
5. Phase 4 advanced drag/drop + reschedule notification flow
6. Phase 5 QA hardening + staged rollout

## 9) Immediate Next Action
Start Phase 0 by collecting mismatch fixtures and adding temporary audit logging in `tenantCustomerController.getCustomerTransactions` and appointment payment update paths, then produce a short findings report before coding Phase 1 fixes.
