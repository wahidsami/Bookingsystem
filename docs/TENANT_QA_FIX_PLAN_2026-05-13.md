# Tenant + Mobile QA Fix Plan (2026-05-13)

## Scope
- Tenant dashboard (`tenant`)
- Customer app (`RifahMobile`)
- Staff app (`RifahStaff`)
- API/backend (`server`)

## QA Items and Implementation Phases

### Phase 1: Page Setup / About Data Rendering
- [x] Audit why gallery images saved in tenant page setup are not visible in customer app.
- [x] Audit why map preview does not render in customer app.
- [x] Ensure gallery state is reloaded correctly in tenant page setup after save.
- [x] Render gallery images in customer app About tab.
- [x] Add map visual preview in customer app About tab while keeping tap-to-open map.
- [x] Verify `aboutUs.facilitiesImages` + `generalSettings.pageSetup.googleMapLink` are end-to-end.

### Phase 2: Staff Permission Controls for Appointment Actions
- [x] Add new staff permission flags in backend (`staff_permissions`) for action visibility:
  - `can_start_service`
  - `can_mark_no_show`
- [x] Expose these toggles in tenant employee permissions UI.
- [x] Enforce in staff app appointment card action rendering.
- [x] Keep tenant admin appointment drawer action controls independent (admin always allowed).
- [x] DB migration script for new permission keys default values.

### Phase 3: Booking Confirmation Semantics by Payment Choice
- [x] Define status behavior:
  - online full / 50% -> `confirmed`
  - pay at center -> `pending` (English label: **Unconfirmed**, Arabic: **غير مؤكد**)
- [x] Apply consistent labels in tenant dashboard, customer app, staff app.
- [x] Ensure manual booking and customer booking use same logic.

### Phase 4: Arrived Flow + Staff Notification
- [x] Add clear status-change action in tenant appointment drawer to set `checked_in` (Arrived).
- [x] Trigger staff push notification when status becomes `checked_in`.
- [x] Ensure staff schedule cards reflect `Arrived` state in real-time/refresh cycle.

### Phase 5: Payment Lifecycle + POS Alignment
- [x] Verify appointment payment states:
  - `pending`
  - `deposit_paid` (50%)
  - `fully_paid` / `paid`
- [x] Ensure tenant dashboard notification entries for payment state changes.
- [x] Ensure cashier/POS action can finalize pending/deposit to fully paid.
- [x] Ensure POS transaction history references appointment payment transitions.

### Phase 6: Cancelled Appointments Visibility Rules
- [x] Remove cancelled appointments from board active columns.
- [x] Add dedicated cancelled view/list with complete historical details:
  - payment status
  - paid amount
  - cancellation source and timestamps

## Validation Checklist
- [x] Tenant save -> immediate page setup reflects gallery.
- [x] Customer tenant About -> gallery images visible.
- [x] Customer tenant About -> map preview visible and tappable.
- [x] Staff action buttons obey permissions.
- [x] Arrived status sync + notification to staff works.
- [x] POS and appointment payment state stay consistent.
- [x] Cancelled appointments removed from active board and available in archive list.

## Deployment Notes
- Backend redeploy required for Phases 2–6.
- Customer app rebuild required for Phase 1 UI updates and later status-label/action updates.
- Staff app rebuild required for Phase 2/4 action + notification UX updates.
- SQL migration required in Phase 2.

## SQL Status
- [x] Executed on `rifah_shared`:
  - Added `can_start_service` to `staff_permissions.permissions` where missing.
  - Added `can_mark_no_show` to `staff_permissions.permissions` where missing.
