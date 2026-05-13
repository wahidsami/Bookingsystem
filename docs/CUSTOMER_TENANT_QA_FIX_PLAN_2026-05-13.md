# Customer App Tenant Page QA Fix Plan (2026-05-13)

## Scope
This plan covers the reported QA issues for tenant pages and booking flow in the customer app.

## Reported Issues
1. Service details open as bottom drawer and hide content (no proper vertical scroll UX).
2. Same-day booking shows time slots in the past.
3. No visible "add review" path in tenant reviews tab.
4. No visible "add review" path in service provider page.
5. About tab gallery images cannot be enlarged.
6. Specialist buttons in booking flow do not show employee avatars.
7. Service payment option mismatch: customer app shows all 3 options even when tenant chose one.

## Phased Execution

### Phase A: Booking Integrity + Payment Consistency (Start first)
- [x] Filter same-day slots to hide past times.
- [x] Render specialist avatar image in booking specialist selection.
- [x] Harden service payment option parsing (array/string/json) to ensure app matches tenant-selected options.
- [ ] Commit + push

### Phase B: Service Details UX Upgrade
- [ ] Replace service details drawer with a dedicated full page.
- [ ] Add back button to return to Services tab.
- [ ] Ensure full vertical scrolling for long content.
- [ ] Commit + push

### Phase C: Reviews Entry UX
- [ ] Add "Write Review" CTA in tenant reviews tab (eligible completed bookings only).
- [ ] Add "Write Review" CTA in staff profile view (eligible completed bookings only).
- [ ] Reuse duplicate-review guard behavior.
- [ ] Commit + push

### Phase D: About Gallery Interaction
- [ ] Add full-screen image preview modal for gallery.
- [ ] Add close action and swipe-safe scrolling.
- [ ] Commit + push

### Phase E: QA Validation + Release Checklist
- [ ] Validate all 7 scenarios on Android real devices.
- [ ] Validate Arabic + English labels/flows.
- [ ] Regression check bookings, payment, and reviews.
- [ ] Commit + push

## Notes
- Phase A is intentionally prioritized because it directly impacts booking correctness and payment trust.
- DB migration is not expected for Phase A.
