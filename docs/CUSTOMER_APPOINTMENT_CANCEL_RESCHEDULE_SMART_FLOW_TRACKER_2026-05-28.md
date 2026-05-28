# Customer App — Appointment Cancel/Reschedule Smart Flow Tracker (2026-05-28)

## Objective
Upgrade appointment actions in customer app to:
- premium themed cancel popup with cancellation reason
- smart reschedule flow based on real availability slots (not free-text datetime)

## UX Direction
- Must follow existing Refah premium visual language.
- Compact layout, no overflow, clear button labeling.
- No Android-native plain dialogs for these flows.

## Current Backend Reality
- `cancelBooking(id)` exists.
- `rescheduleBooking(id, { startTime, staffId? })` exists.
- Booking flow already loads available slots from backend for service/provider/date.

## Target Flow

## Cancel
1. Customer taps `Cancel`.
2. Premium popup opens with required reason:
- Reason chips (`time_conflict`, `changed_mind`, `provider_pref`, `other`).
- If `other`, free-text reason required.
3. Confirm cancellation.
4. Success message and return to appointments list/details.

## Reschedule
1. Customer taps `Reschedule`.
2. Premium popup asks:
- Keep same provider?
- Change provider?
3. Route customer into slot-based booking flow to choose real available time.
4. Confirm new slot.

## Phases

## Phase A — UI Foundations
- Add premium cancel reason popup.
- Add premium reschedule options popup.
- Status: `completed`

## Phase B — Slot-Based Reschedule Integration
- Route reschedule action into booking flow with prefilled context.
- Reuse existing slot-loading logic to avoid free-text datetime.
- Status: `completed`

## Phase C — Backend Metadata Extension (Optional but Recommended)
- Extend cancel endpoint payload with reason code/text.
- Persist cancellation reason for tenant/admin visibility.
- Status: `pending`

## Phase D — QA and Edge Cases
- Validate no overflows in EN/AR.
- Validate cancellation flow for each reason chip.
- Validate reschedule with no slots available.
- Status: `pending`

## Progress Log
- 2026-05-28: Created tracker file.
- 2026-05-28: Implemented premium cancel reason popup in `AppointmentDetailsScreen`.
- 2026-05-28: Implemented premium reschedule options popup and start of routing into booking flow.
- 2026-05-28: Replaced free-text reschedule with real slot picker based on `/bookings/search` and confirmed via `rescheduleBooking`.
