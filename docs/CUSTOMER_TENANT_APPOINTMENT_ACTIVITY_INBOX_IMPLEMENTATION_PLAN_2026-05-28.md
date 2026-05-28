# Customer + Tenant Appointment Activity/Inbox Plan (2026-05-28)

## Objective
Make cancel/reschedule behavior impossible to miss across:
- Tenant dashboard (activity/inbox + unread badge)
- Customer app history/details (clear timeline of booking behavior)
- Appointment board/list consistency

## Product Guarantees
- If customer books a slot, that slot is blocked for active statuses.
- If customer cancels, old slot is released.
- If customer reschedules, old slot is released and new slot is blocked.
- Tenant is notified about customer-initiated cancel/reschedule.
- Customer can see lifecycle history of each appointment.

## Scope

### Tenant Side
- Add dedicated customer appointment change alerts in tenant operational alerts feed:
  - `Customer cancelled booking ...`
  - `Customer rescheduled booking ...`
- Include in existing notification unread badge flow.
- Keep deep-link to appointment details in tenant dashboard.

### Customer Side
- Add appointment timeline section in appointment details page:
  - Reschedule events (from -> to)
  - Cancellation events (reason)
- Keep premium UI style and compact layout.

### Board/List Behavior
- Board view stays active-flow only (cancelled not shown in active board lanes).
- Cancelled appointments remain available in list/history contexts.
- Rescheduled appointments move to new datetime/staff in board on reload/live fetch.

## Technical Design

### Audit Source of Truth
- Reuse structured notes markers:
  - `[RESCHEDULE_AUDIT] {...}`
  - `[CANCELLATION_AUDIT] {...}`
- Avoid immediate schema migration for speed/safety.
- Future phase can move to first-class `appointment_events` table.

### Tenant Alerts Extraction
- In `server/src/controllers/tenantPosController.js`:
  - Parse cancellation marker entries from notes.
  - Build high-severity appointment alerts for customer-origin cancellations.
  - Merge with existing reschedule alerts and other operational alerts.

### Customer Timeline Rendering
- In `RifahMobile/src/screens/AppointmentDetailsScreen.tsx`:
  - Parse notes markers for each booking item.
  - Render reverse-chronological timeline section.
  - Show localized labels and formatted timestamps.

## Phases

## Phase 0 — Planning & Alignment
- Create implementation tracker.
- Confirm expected board behavior and notification flow.
- Status: `completed`

## Phase 1 — Tenant Inbox/Badge Signals
- Add customer cancellation alerts to tenant operational feed.
- Keep existing reschedule alerts.
- Ensure both count toward unread badge in tenant notification menu.
- Status: `completed`

## Phase 2 — Customer History Visibility
- Add activity timeline in customer appointment details page.
- Show reschedule and cancellation events with reason.
- Status: `completed`

## Phase 3 — QA Hardening
- Validate EN/AR copy and no overflow.
- Validate unread badge increments/decrements.
- Validate alert ordering by event timestamp.
- Validate board behavior:
  - cancel -> removed from active board
  - reschedule -> appears at new slot
- Status: `completed`

## Phase 4 — Optional Solidification
- Move from notes markers to dedicated `appointment_events` table.
- Add filters in tenant notifications: `Appointments > Customer Changes`.
- Add mark-read persistence per alert record (server-side) instead of local-seen timestamp.
- Status: `pending`

## QA Checklist (Execution)
- Customer books appointment at 5:00 PM -> second customer cannot book same slot/staff.
- Customer cancels -> 5:00 PM slot becomes available again.
- Tenant sees cancellation alert with reason in notifications feed.
- Customer reschedules from 5:00 PM to 6:00 PM:
  - 5:00 PM released
  - 6:00 PM blocked
  - Tenant sees reschedule alert with from/to.
- Customer appointment details shows timeline entries for both events.
- Tenant board no longer shows cancelled appointment in active lanes.
- Tenant board shows rescheduled appointment at new slot/staff.

## Progress Log
- 2026-05-28: Plan created.
- 2026-05-28: Phase 1 implemented in tenant operational alerts feed.
- 2026-05-28: Phase 2 implemented in customer appointment details timeline.
- 2026-05-28: Phase 3 hardening completed (safe timestamp sorting for tenant alerts + safe timeline date rendering fallback + dedicated QA execution checklist document).
