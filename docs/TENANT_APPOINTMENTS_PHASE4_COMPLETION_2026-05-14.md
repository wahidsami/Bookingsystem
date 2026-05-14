# Phase 4 Completion Report - Drag Provider+Time with Confirmation + Optional Customer Notify

Date: 2026-05-14
Status: Completed

## Objective
Enable board drag/drop to change provider and time together, then show confirmation when time changed with optional customer notification.

## Implemented

### 1) Frontend drag/drop payload upgraded
File: `tenant/src/components/CalendarView.tsx`

- Added optional callback prop:
  - `onDropAppointmentChange(payload)`
- Payload includes:
  - `appointmentId`
  - `staffId`
  - `startTime`
  - `endTime`
  - `changedTime`
  - `changedStaff`

### 2) Drop-time calculation from board position
File: `tenant/src/components/CalendarView.tsx`

- Drop target now uses board grid area (not full column header area).
- Drop Y-position is snapped using existing board slot logic (`getSnappedDateTimeFromPointer`).
- Duration is preserved from original appointment.

### 3) Conflict check uses target dropped time
File: `tenant/src/components/CalendarView.tsx`

- Updated overlap check to validate against **new** target start/end, not old appointment time.
- Prevents invalid drag results before submit.

### 4) Appointments page confirmation flow
File: `tenant/src/app/[locale]/dashboard/appointments/page.tsx`

- Added `pendingDropChange` modal state.
- Behavior:
  - If only provider changed and time unchanged -> immediate reassignment (existing path).
  - If time changed -> confirmation modal appears.
- Modal includes:
  - old/new provider
  - old/new time
  - checkbox: notify customer
  - Confirm/Cancel actions

### 5) New API client method
File: `tenant/src/lib/api.ts`

- Added:
  - `reassignRescheduleAppointment(id, { staffId, startTime, notifyCustomer })`

### 6) New backend endpoint for atomic update
Files:
- `server/src/controllers/tenantAppointmentController.js`
- `server/src/routes/tenantRoutes.js`

Added endpoint:
- `PATCH /api/v1/tenant/appointments/:id/reassign-reschedule`

Server behavior:
- Validates appointment exists and is not closed.
- Validates staff active and mapped to service.
- Recomputes end time from original duration.
- Checks conflict on target staff/time.
- Updates provider + start/end in one save.
- Optional customer push notification when `notifyCustomer=true`.
- Returns changed flags (`changedStaff`, `changedTime`).

## Safety Notes
- Existing endpoints unchanged and still available.
- New flow is additive and used only by new drag-drop confirmation path.
- Closed appointments are blocked from modification.

## Validation Notes
- Type check/build could not be fully run in this environment due local sandbox/tooling restrictions.
- Static integration verified across frontend + API + backend route/controller wiring.

## Next Step
Proceed to Phase 5 hardening and full QA matrix execution.
