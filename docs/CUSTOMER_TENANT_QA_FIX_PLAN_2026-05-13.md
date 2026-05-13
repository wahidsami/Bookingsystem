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
8. Booking to cart must be blocked if selected time is less than one hour away.
9. Cart lacks edit/modify path for booked service items.
10. Login/session appears to expire too quickly after idle.
11. Returning Google users are forced through phone/OTP/name steps again.

## Phased Execution

### Phase A: Booking Integrity + Payment Consistency (Start first)
- [x] Filter same-day slots to hide past times.
- [x] Render specialist avatar image in booking specialist selection.
- [x] Harden service payment option parsing (array/string/json) to ensure app matches tenant-selected options.
- [x] Commit + push

### Phase B: Service Details UX Upgrade
- [x] Replace service details drawer with a dedicated full page.
- [x] Add back button to return to Services tab.
- [x] Ensure full vertical scrolling for long content.
- [x] Commit + push

### Phase C: Reviews Entry UX
- [x] Add "Write Review" CTA in tenant reviews tab (eligible completed bookings only).
- [x] Add "Write Review" CTA in staff profile view (eligible completed bookings only).
- [x] Reuse duplicate-review guard behavior.
- [ ] Commit + push

### Phase D: About Gallery Interaction
- [x] Add full-screen image preview modal for gallery.
- [x] Add close action and swipe-safe scrolling.
- [x] Commit + push

### Phase E: QA Validation + Release Checklist
- [ ] Validate all 7 scenarios on Android real devices.
- [ ] Validate Arabic + English labels/flows.
- [ ] Regression check bookings, payment, and reviews.
- [ ] Commit + push

### Phase F: Final Sign-off Additions
- [x] Enforce one-hour minimum lead time before adding service booking to cart.
- [x] Add edit path for service booking cart items.
- [x] Improve session resilience for idle periods (token/session handling).
- [x] Add Google returning-user fast login path (skip OTP/name when already linked and verified).
- [ ] Commit + push

## Notes
- Phase A is intentionally prioritized because it directly impacts booking correctness and payment trust.
- DB migration is not expected for Phase A.
