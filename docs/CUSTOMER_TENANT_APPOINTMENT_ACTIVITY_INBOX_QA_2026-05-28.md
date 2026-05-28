# Customer + Tenant Appointment Activity/Inbox QA (2026-05-28)

## Scope
- Tenant operational alerts for customer cancellation/reschedule.
- Customer appointment details timeline for cancellation/reschedule events.
- Slot release/re-block behavior after cancel/reschedule.

## Preconditions
- Tenant has at least one service and one active provider.
- Customer can book in customer app.
- Tenant dashboard board/list pages are accessible.

## Test Cases

1. Book blocks slot
- Steps: Customer books service at `5:00 PM` with provider A.
- Expected: Another customer cannot book `5:00 PM` for same provider/service duration overlap.

2. Cancel releases old slot
- Steps: Customer cancels booked appointment from appointment details.
- Expected:
  - Appointment status becomes `cancelled`.
  - Slot `5:00 PM` becomes available again in customer booking flow.
  - Tenant alert appears: customer cancelled booking.

3. Cancel reason propagation
- Steps: Cancel once with chip reason, once with `other` + custom text.
- Expected:
  - Tenant cancellation alert appears for both.
  - Custom reason is included when provided.
  - Customer timeline shows cancellation entries.

4. Reschedule reassigns slot occupancy
- Steps: Customer reschedules from `5:00 PM` to `6:00 PM`.
- Expected:
  - `5:00 PM` becomes available.
  - `6:00 PM` becomes unavailable for conflicting booking.
  - Tenant alert appears: customer rescheduled booking with from/to time.
  - Board shows appointment at new slot (after reload/live fetch).

5. Board behavior consistency
- Steps: Open tenant board before and after cancellation/reschedule.
- Expected:
  - Cancelled appointment removed from active board lanes.
  - Rescheduled appointment visible at new time lane.
  - Cancelled appointment still visible in list/history contexts (if filtered to include).

6. Unread badge behavior
- Steps: Trigger cancellation/reschedule events; open tenant notifications menu.
- Expected:
  - Unread badge increases.
  - After mark-all-read, badge decreases to expected value.

7. Customer timeline rendering safety
- Steps: Open appointment details with multiple audit entries.
- Expected:
  - Timeline renders newest first.
  - No text overflow in EN/AR.
  - No crash on malformed/old events (safe date fallback shown).

## Exit Criteria
- All 7 tests pass on staging.
- No UI overflow for EN/AR in timeline and tenant alerts.
- No regressions in appointment creation/cancel/reschedule core flow.
