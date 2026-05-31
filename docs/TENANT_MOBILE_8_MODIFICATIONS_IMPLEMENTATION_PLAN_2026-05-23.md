# Tenant + Mobile 8-Point Modification Plan (2026-05-23)

## Goal
Deliver the 8 requested modifications safely across tenant dashboard, staff app, customer app, and backend APIs without regressions.

## Scope (Requested Items)
1. Team salaries should be calculated without VAT.
2. Time format should be 12-hour (AM/PM) across system surfaces.
3. Remove "Staff App Access Info" section from staff app.
4. Team member schedule period should support `continues` (no end date required).
5. Fix tenant top-header notifications dropdown layering (hidden behind content).
6. Appointment creation for new customer should allow `Guest` without requiring email/mobile.
7. Blocked time should support recurring with either:
   - `continues` (open-ended), or
   - `from-to` date range.
8. Customer app reschedule button should be available only when service has `allow reschedule` enabled in tenant services.

## Delivery Strategy
- Implement in phases from lowest-risk UI fixes to workflow/data-contract changes.
- After each phase:
  - run targeted checks/tests,
  - verify affected flows manually,
  - commit and push.
- Keep backward compatibility for existing records and API clients.

## Phase Plan

### Phase 0: Baseline & Safety Nets
Status: `pending`
- Map current data contracts for: salary, schedule shifts, blocked time, appointment creation payloads, service settings, reschedule permissions.
- Identify shared time-format utility points in tenant/mobile/staff.
- Add/adjust minimal guard tests for new optional fields and default behavior.

Acceptance:
- Clear list of files/endpoints to be changed with no ambiguous schema assumptions.

### Phase 1: Layering + Staff UI cleanup
Status: `pending`
Covers items: **3, 5**
- Fix notification dropdown stacking context in tenant layout so it always renders above page content and scroll containers.
- Remove "Staff App Access Info" section from staff app UI while preserving any underlying auth/account logic.

Acceptance:
- Notification panel always visible over all dashboard sections.
- Staff app no longer shows the "Staff App Access Info" section.

### Phase 2: Team salary without VAT + schedule continues
Status: `pending`
Covers items: **1, 4**
- Update salary display/calculation model to treat entered salary as final salary (no VAT addition).
- Remove/add copy and preview blocks that imply VAT is added to salary.
- In team schedule period, support open-ended (`continues`) mode by allowing null `endDate` and proper UX toggle.

Acceptance:
- Salary preview and saved values show no VAT addition.
- Schedule can be saved with start date and no end date when `continues` is selected.

### Phase 3: Appointment creation + blocked time recurrence
Status: `pending`
Covers items: **6, 7**
- Add `Guest` creation path in appointment drawer/form for new customers without mandatory email/mobile.
- Ensure backend user/customer creation path accepts guest bookings safely.
- Enhance blocked-time create/edit flow with recurrence options:
  - `continues` (no end date)
  - `from-to` range
- Validate board rendering + availability impact of recurring/open-ended blocked slots.

Acceptance:
- Admin can create appointment for guest customer without email/mobile.
- Blocked time supports one-time, recurring with date range, and recurring open-ended.

### Phase 4: Reschedule permission by service + customer app
Status: `pending`
Covers item: **8**
- Add `allowReschedule` service-level setting in tenant services CRUD.
- Persist setting in backend model/API responses.
- In customer app appointment details, show/hide reschedule button based on service setting.
- Block direct reschedule attempts when service disallows it.

Acceptance:
- Reschedule appears only for services with `allowReschedule = true`.
- API enforces same rule server-side.

### Phase 5: 12-hour time format unification
Status: `pending`
Covers item: **2**
- Standardize time rendering to 12-hour AM/PM in tenant, staff, and customer surfaces.
- Use shared formatter utility and locale-aware AM/PM labels.
- Avoid changing stored database time format; presentation-only change.

Acceptance:
- All key views (appointments board/cards/drawers, schedules, lists, details, notifications) display 12-hour format.

### Phase 6: Regression QA + Documentation
Status: `pending`
- Cross-flow QA:
  - team member create/edit
  - appointment create/edit/drag/drop
  - blocked time recurrence
  - customer confirmation/reschedule
- Update docs/changelog with behavior changes and admin usage notes.

Acceptance:
- No critical regressions in appointment and team management flows.

## Implementation Tracker
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Phase 5 complete
- [ ] Phase 6 complete

## Known Risks
- Time-format change touches many surfaces; risk of partial conversion.
- Guest appointment path can affect validation and downstream notification assumptions.
- Recurring blocked-time semantics must align with availability engine and board rendering.
- Service-level reschedule gating must be enforced both UI and backend.

## Rollback Strategy
- Keep changes isolated by phase commits.
- If regression appears, revert only affected phase commit(s) and preserve prior stable phases.
