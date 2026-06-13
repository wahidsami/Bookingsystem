# Fresha-Style Booking Dashboard UX Plan

## Summary
Bring the tenant booking dashboard closer to the Fresha operating model without disturbing the current data-heavy backend. The first pass focuses on hierarchy, density, and speed:
- keep the calendar as the primary workspace
- widen and structure the appointment drawer
- make customer access feel nested inside the drawer
- add a fast search surface for bookings
- reduce clicks on the day-to-day workflow

## Key Changes
- Preserve the calendar behind every drawer state.
- Make the appointment drawer wider and more breathable.
- Present customer context as a nested panel rather than a simple mode switch.
- Add a dashboard search bar for booking/customer lookup.
- Keep existing booking/session data as the source of truth.
- Only add backend or schema work if the current model cannot support a UX requirement cleanly.

## Implementation Phases

### Phase 1: UX and layout polish
- Widen the appointment drawer and tighten spacing so the content reads more clearly.
- Keep the calendar mounted behind the drawer.
- Make the customer section feel like a nested drawer or stacked panel.
- Keep quick actions visible and easy to reach.
- Add a search box to the appointments dashboard header.

### Phase 2: Data shaping and API support
- Add a unified search path for customers and bookings.
- Ensure the appointment detail response includes everything the drawer needs in one fetch.
- Prefetch customer summary/history when opening an appointment drawer.
- Add an action timeline only if the current notes/status model is not enough.

### Phase 3: Data model only if required
- Reuse the current session/appointment model if it already supports multi-service bookings.
- Add a normalized service-item layer only if the UI needs first-class line items and the backend cannot infer them.
- Add an action log table only if we need structured operational history beyond notes and status chips.

### Phase 4: Guardrails and performance
- Preserve date, scroll position, staff filters, and calendar scope when drawers open and close.
- Use cached/preloaded payloads to keep drawer opens feeling fast.
- Keep keyboard navigation and contrast strong.
- Keep the mobile customer app unchanged in this rollout.

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
