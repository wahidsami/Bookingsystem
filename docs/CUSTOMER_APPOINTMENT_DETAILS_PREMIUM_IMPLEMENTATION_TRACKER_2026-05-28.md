# Customer App — Appointment Details Premium Implementation Tracker (2026-05-28)

## Objective
Replace the current appointment details drawer/modal in customer app with a full page (with back button), using premium compact UI and existing data only.

## Non-Negotiable UX Rules
- Compact layout with clear hierarchy.
- No labels floating away from their related controls.
- No text/content overflow.
- Vertical rhythm and thumb-friendly spacing.
- No crowded horizontal rows for dense data.

## Data Scope (Current Available)
- Booking number / reference.
- Tenant name.
- Appointment status.
- Payment status.
- Group totals: services count, total amount, payable now, first appointment time.
- Per-service details: service name, variant, provider, datetime, status, amount, payment method, notes.
- Guest info (when embedded marker exists in notes).

## Data Not Guaranteed (Fallback Required)
- Tenant/center hero image in appointment payload.
- Tenant location in booking payload.
- Masked card info (Visa ****).
- Contact-center direct action target.

## Hero Strategy
- If tenant image exists in payload/context: use it.
- Else: use Refah branded gradient hero background.

## Booking Integrity Rule (Must Hold)
- Customer may add multiple services in one booking cart only if all are from the same tenant center.
- Cross-tenant service mixing must be blocked in:
1. add flow
2. update/edit flow
3. checkout flow guard

## Current Rule Status
- Add flow restriction: implemented.
- Update flow tenant mutation protection: implemented.
- Checkout tenant consistency guard: implemented.

## Implementation Phases

## Phase 1 — Navigation and Structure
- Add `AppointmentDetails` page route.
- Replace drawer opening from appointments card with page navigation.
- Pass selected booking group payload safely.
- Status: `completed`

## Phase 2 — Premium Header and Summary
- Hero with back/share actions.
- Title/subtitle block.
- Booking summary card with number + status pills + center/date basics.
- Status: `completed`

## Phase 3 — Metrics and Services
- Metrics 2x2 block (services/total/payable/first time).
- Vertical service cards (compact, no overflow).
- Service metadata and status/payment chips.
- Status: `completed`

## Phase 4 — Guest, Payment, Actions
- Guest info card (conditional).
- Payment summary block.
- Action area: pay now, reschedule, cancel.
- Optional contact center button as placeholder until target action is available.
- Status: `completed`

## Phase 5 — Robustness and Polish
- Empty/error/loading states.
- Arabic/English text fit checks.
- Overflow checks for long service/provider names.
- QA pass on small and large phones.
- Status: `pending`

## Compact Design Constraints Checklist
- [ ] Header title max lines = 1 with ellipsis.
- [ ] Booking number max lines = 1 with truncation strategy.
- [ ] Status pills wrap without clipping.
- [ ] Service title max lines = 2.
- [ ] Variant/provider/date rows never overflow container width.
- [ ] Action buttons preserve text inside bounds in EN/AR.
- [ ] Notes block clamps or scrolls safely when long.

## QA Acceptance Criteria
- Tapping appointment card opens full page (not drawer).
- No overlap or clipped text in EN and AR.
- All existing actions still work from details page.
- Booking cart still enforces single-tenant rule end-to-end.

## Progress Log
- 2026-05-28: Created tracker and finalized phase plan.
- 2026-05-28: Enforced extra code-level single-tenant safeguards (update + checkout guard).
- 2026-05-28: Added `AppointmentDetails` screen and wired appointment cards to open full page.
- 2026-05-28: Removed legacy appointment details drawer from `BookingsScreen`.
- 2026-05-28: Completed premium header/summary hero pass in `AppointmentDetails` with tenant image fallback to Refah gradient.
- 2026-05-28: Completed metrics/services compact pass with overflow hardening in `AppointmentDetails`.
- 2026-05-28: Completed guest/payment/actions pass including contact-center placeholder action.
