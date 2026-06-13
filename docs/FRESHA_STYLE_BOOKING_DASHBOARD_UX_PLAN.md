# Fresha-Style Booking Dashboard UX Plan

## Summary
Bring the tenant booking dashboard closer to the Fresha operating model without disturbing the current data-heavy backend. The rollout is intentionally biased toward hierarchy, density, and speed:
- keep the calendar as the primary workspace
- widen and structure the appointment drawer
- make customer access feel nested inside the drawer
- add a fast search surface for bookings and customers
- reduce clicks on the day-to-day workflow

## Current Status
- Phase 1 is implemented in the tenant dashboard.
- Phase 2 is mostly implemented, with search and drawer prefetch in place.
- Structured `appointment_events` are now exposed in the drawer timeline, with note parsing as fallback.
- Phase 3 remains conditional and should only happen if the current model proves limiting.
- Phase 4 remains as the guardrail and polish pass.

## Key Changes
- Preserve the calendar behind every drawer state.
- Make the appointment drawer wider and more breathable.
- Present customer context as a nested panel rather than a simple mode switch.
- Add a dashboard search bar for booking/customer lookup.
- Keep existing booking/session data as the source of truth.
- Only add backend or schema work if the current model cannot support a UX requirement cleanly.

## Implementation Phases

### Phase 1: UX and layout polish
Completed:
- Widened the appointment drawer and tightened spacing so the content reads more clearly.
- Kept the calendar mounted behind the drawer.
- Made the customer section feel like a nested drawer or stacked panel.
- Kept quick actions visible and easy to reach.
- Added a search box to the appointments dashboard header.

### Phase 2: Data shaping and API support
Mostly complete:
- Added a unified search path for customers and bookings.
- Ensured the appointment detail response includes the drawer-critical data in one fetch.
- Prefetches customer summary/history when opening an appointment drawer.
- Added an action timeline using the current notes/status model.

Still to validate:
- Search ranking and result relevance on larger datasets.
- Whether any additional fields need to be prefetched for edge cases.

### Phase 3: Data model only if required
Pending and conditional:
- Reuse the current session/appointment model for multi-service bookings. Do not add a duplicate `appointment_services` table unless reporting needs prove it.
- Use `appointment_events` for structured appointment action history. Do not add a separate action log table unless we outgrow the current event schema.
- Add a normalized service-item layer only if the UI needs first-class line items and the backend cannot infer them from booking sessions.

### Phase 4: Guardrails and performance
Pending:
- Preserve date, scroll position, staff filters, and calendar scope when drawers open and close.
- Use cached/preloaded payloads to keep drawer opens feeling fast.
- Keep keyboard navigation and contrast strong.
- Keep the mobile customer app unchanged in this rollout.

## What Is Left
- Confirm the drawer and search experience on very large tenant datasets.
- Decide whether booking-session reporting needs any additional index or projection support.
- Add any remaining performance guardrails once real usage feedback comes in.

## Test Plan
- Open the calendar and confirm it stays visible while drawers open.
- Open an appointment and verify service, staff, payment, notes, and customer summary load correctly.
- Open customer details from inside the appointment drawer and verify the nested flow works.
- Search by name, phone, email, booking number, and reference and confirm the right record opens.
- Trigger drag-and-drop rescheduling and confirm the save flow still works.
- Verify the dashboard still handles large data sets without dropping key information.

## Assumptions
- The current booking/session model remains the source of truth unless a concrete limitation appears.
- The first rollout targets the tenant dashboard only.
- We should prefer UX simplification and information architecture improvements before schema changes.
- The current appointment and customer APIs are enough for the first pass, with targeted extensions later if needed.
