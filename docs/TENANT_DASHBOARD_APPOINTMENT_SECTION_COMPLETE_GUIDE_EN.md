# Tenant Dashboard Appointment Section Complete Guide

This document describes the appointment section as implemented in the Refah codebase. It covers the tenant dashboard UI, the related customer and staff flows, the major forms and actions, the status and payment model, and the endpoints that power the section.

## 1. Purpose

The appointment section is the operational hub for booking management in Refah.

It allows the tenant team to:

1. View appointments in list, calendar, and board formats.
2. Create new appointments for existing customers, new customers, guests, and grouped guest bookings.
3. Inspect appointment details, customer history, timeline, notes, payments, and review context.
4. Reschedule, reassign staff, update status, collect payment, and handle remainder or refund actions.
5. Manage breaks and staff schedule visibility alongside appointment operations.
6. Coordinate with the customer app and staff app through notifications and shared appointment state.

## 2. Main Screens

### 2.1 Appointments Dashboard Page

Path:

- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`

This page is the main appointment workspace. It contains:

1. Appointment list and filtering.
2. Calendar and board views.
3. Drag and drop appointment handling.
4. Staff and service filters.
5. Quick access to create appointments and manage board operations.
6. Calendar scope controls and persisted workspace state.

### 2.2 New Appointment Redirect

Path:

- `tenant/src/app/[locale]/dashboard/appointments/new/page.tsx`

This route now redirects to the main appointments board.

### 2.3 Appointment Details Page

Path:

- `tenant/src/app/[locale]/dashboard/appointments/[id]/page.tsx`

This page shows a full appointment detail view with:

1. Appointment data.
2. Payment data.
3. Reschedule controls.
4. Status controls.
5. Customer summary.
6. Transaction history.
7. Notes and audit information.

### 2.4 Appointment Drawers and Overlays

Relevant components:

- `tenant/src/components/AppointmentActionDrawer.tsx`
- `tenant/src/components/AppointmentDetailsDrawer.tsx`
- `tenant/src/components/AppointmentBoardCartDrawer.tsx`
- `tenant/src/components/EmployeeWeeklyScheduleEditor.tsx`
- `tenant/src/components/CalendarView.tsx`

These components provide the actual operational forms and actions for the section.

## 3. Data Model

### 3.1 Appointment Core Fields

The appointment section operates on records that typically include:

1. `id`
2. `bookingNumber`
3. `bookingReference`
4. `bookingSessionId`
5. `startTime`
6. `endTime`
7. `status`
8. `paymentStatus`
9. `price`
10. `rawPrice`
11. `taxAmount`
12. `platformFee`
13. `tenantRevenue`
14. `employeeCommission`
15. `totalPaid`
16. `outstandingAmount`
17. `remainderAmount`
18. `paymentMethod`
19. `notes`
20. `requestedStaffId`
21. `assignmentMode`
22. `service`
23. `staff`
24. `user`
25. `paymentTransactions`
26. `events`
27. `createdAt`
28. `updatedAt`

### 3.2 Appointment Statuses

The appointment status model used across the section is:

1. `pending`
2. `confirmed`
3. `checked_in`
4. `in_service`
5. `completed`
6. `cancelled`
7. `no_show`

Operational meaning:

1. `pending` means the appointment exists but is not yet confirmed in the operational flow.
2. `confirmed` means the booking is accepted and ready.
3. `checked_in` means the customer has arrived.
4. `in_service` means the appointment is actively being served.
5. `completed` means the service is finished.
6. `cancelled` means the booking was cancelled.
7. `no_show` means the customer did not attend.

### 3.3 Payment Statuses

The payment status model used across the section is:

1. `pending`
2. `deposit_paid`
3. `fully_paid`
4. `paid`
5. `refunded`
6. `partially_refunded`

Operational meaning:

1. `pending` means no payment has been completed.
2. `deposit_paid` means a booking fee or deposit has been paid.
3. `fully_paid` means the full amount is settled.
4. `paid` is a legacy or normalized success state in some areas.
5. `refunded` means the payment was fully refunded.
6. `partially_refunded` means part of the payment was refunded.

Recommended display mapping:

1. `pending` -> Unconfirmed / Not paid
2. `deposit_paid` -> Deposit paid / 50% paid
3. `fully_paid` -> Paid
4. `paid` -> Paid
5. `refunded` -> Refunded
6. `partially_refunded` -> Partially refunded

## 4. Workspace Behavior

The appointments page keeps a lot of state and the UI behavior is intentionally persistent.

### 4.1 Persistent Workspace State

The page stores and restores:

1. View mode.
2. Calendar scope.
3. Selected date.
4. Calendar-focused staff.
5. Start and end date filters.
6. Staff filter.
7. Service filter.
8. Status filter.
9. Payment status filter.
10. Search text.
11. Grid hour height.
12. Scroll position.

This persistence is stored under:

- `tenant-appointments-dashboard-state`

### 4.2 Main Views

The workspace supports:

1. List view.
2. Calendar view.
3. Cancelled appointments view.

The calendar supports:

1. Day scope.
2. Week scope.
3. Month scope.

## 5. Appointment Section Forms

## 5.1 Appointment Board and List Filters

These filters are part of the main appointments page:

1. Date range.
2. Staff filter.
3. Service filter.
4. Status filter.
5. Payment status filter.
6. Search query.
7. Calendar scope selector.
8. Grid hour height control.
9. Focused staff selection.

### 5.2 Create Appointment Drawer

Component:

- `tenant/src/components/AppointmentActionDrawer.tsx`

This is the main creation form.

It supports two modes:

1. Appointment mode.
2. Blocked time mode.

#### Step 1: Customer Selection

The drawer supports three customer modes:

1. Existing customer.
2. New customer.
3. Guest customer.

Customer fields include:

1. Customer search for existing customers.
2. First name.
3. Last name.
4. Email.
5. Phone.
6. Gender.
7. Date of birth.

Additional guest-related options:

1. Include group guest.
2. Guest name.
3. Guest email.
4. Guest phone.
5. Guest birth date.
6. Guest service selection.

#### Step 2: Service Selection

Service booking supports:

1. Single service selection.
2. Queued or multi-service booking.
3. Variant selection.
4. Staff selection.
5. Date selection.
6. Time selection.
7. Discount type.
8. Discount value.
9. Notes.

The drawer can stage multiple services in a queue and calculate a sequential booking flow.

#### Step 3: Payment Selection

Payment options include:

1. Single payment mode.
2. Customized split payment mode.
3. Multiple payment rows.
4. Cash.
5. Card POS.
6. Wallet.
7. Bank transfer.
8. Gift card code.

Payment collection checks:

1. Total must match the due amount in customized mode.
2. Gift card rows require a gift card code.
3. Payment allocations are normalized before submission.

#### Create Appointment Submission

The create flow can submit:

1. Single appointment.
2. Group or multi-service booking.
3. Assigned staff.
4. Requested staff.
5. Notes.
6. Payment method.
7. Payment allocations.
8. Booking session reference.
9. Assignment mode.
10. Customer creation data for new customers.

### 5.3 Blocked Time Form

The same drawer also supports blocked-time creation.

Use cases:

1. Blocking a staff slot.
2. Scheduling internal unavailability.
3. Reserving time for a break or special event.

### 5.4 Appointment Details Drawer

Component:

- `tenant/src/components/AppointmentDetailsDrawer.tsx`

This drawer is the operational detail hub for a single appointment.

It contains:

1. Appointment summary.
2. Customer workspace.
3. Status actions.
4. Payment actions.
5. Reschedule actions.
6. Rebook action.
7. Notes and audit timeline.
8. Transaction history.
9. Wallet and profile context.
10. Review context.

Customer tabs in the drawer:

1. Overview.
2. Wallet.
3. Profile.
4. Appointments.
5. Transactions.
6. Reviews.

Appointment actions in the drawer:

1. Quick status update.
2. Reschedule.
3. Rebook.
4. Open full customer workspace.
5. Open full appointment page.
6. Mark fully paid.
7. Record remainder payment.
8. Mark refunded.
9. Reassign and reschedule.

### 5.5 Appointment Board Cart Drawer

Component:

- `tenant/src/components/AppointmentBoardCartDrawer.tsx`

This drawer is used for quick booking-related commerce operations.

It supports:

1. Gift card purchase.
2. Product purchase.
3. Existing customer selection.
4. Walk-in customer selection.
5. Recipient type.
6. Payment split rows.
7. Cart quantity editing.

### 5.6 Employee Weekly Schedule Editor

Component:

- `tenant/src/components/EmployeeWeeklyScheduleEditor.tsx`

This is closely related to appointments because it affects:

1. Staff availability.
2. Time slot visibility.
3. Breaks.
4. Scheduling capacity.

## 6. Appointment Board and Calendar Behavior

### 6.1 Board View

The board is the core operational view.

It supports:

1. Per-staff columns.
2. Date-based layout.
3. Appointment cards.
4. Drag and drop.
5. Reassign and reschedule.
6. Context menus on grid slots.
7. Staff header menus.
8. Appointment settings access.
9. Break overlays.
10. Open tools action.
11. Show all providers action.
12. Active filter indicator.

### 6.2 Calendar View

Component:

- `tenant/src/components/CalendarView.tsx`

The calendar supports:

1. Day scope.
2. Week scope.
3. Month scope.
4. Staff visibility filtering.
5. Appointment position calculation.
6. Break rendering.
7. Drag and drop.
8. Slot hover preview.
9. Sticky staff headers.
10. Time-grid sizing.

Important behavior:

1. Appointments outside the visible board range are pinned or clamped instead of disappearing.
2. Local date comparison is used to reduce timezone mismatch issues.
3. The current time updates continuously for visual accuracy.

## 7. Appointment Business Rules

### 7.1 Creation Rules

1. The appointment can be created for an existing customer.
2. The appointment can be created for a new customer.
3. The appointment can be created as a guest booking.
4. Multiple services can be staged in one booking flow.
5. Staff can be assigned manually or automatically.
6. Requested staff is stored when the customer chooses a specialist.
7. Payment method is part of the create request.
8. Notify customer defaults to true.

### 7.2 Time Guard Rules

1. Same-day bookings should not offer past time slots.
2. Same-day booking should not be added to cart if it is within one hour of the current time in the customer flow.
3. Board and calendar views use local-date matching to reduce timezone issues.

### 7.3 Status Update Rules

1. Quick status updates are restricted by current appointment state.
2. `completed` should only be allowed when the appointment is paid according to the drawer rule.
3. `checked_in` means arrival and can be tied to payment rules if the business requires it.
4. `cancelled` and `no_show` are terminal operational states.

### 7.4 Payment Rules

1. A booking fee or deposit should show as `deposit_paid`.
2. Full amount should show as `fully_paid` or `paid` depending on normalization.
3. Remainder collection is supported from the drawer.
4. Refunds are supported from the drawer.
5. Payment collections can be split across multiple methods.
6. Wallet can be used as a payment source when enabled.

### 7.5 Staff Assignment Rules

1. A customer-selected provider is preserved as `requestedStaffId`.
2. Reassign staff is supported from the tenant side.
3. Reassign and reschedule can be done together.
4. The board can drag and drop appointments across staff columns.

### 7.6 Customer and Staff Effects

Customer app:

1. Receives booking notifications.
2. Sees appointment invites.
3. Can confirm or decline invite-based appointments.
4. Can view appointment history and related actions.

Staff app:

1. Receives notifications for assigned or changed appointments.
2. Sees appointments in the staff schedule.
3. Can update appointment status from the staff app route.

## 8. Dashboard Widgets and Summary

The appointment section also influences dashboard widgets.

Relevant dashboard endpoints:

1. Dashboard stats.
2. Today’s appointments.
3. Revenue chart.
4. Global dashboard search.

These widgets provide:

1. Total bookings.
2. Completed bookings.
3. Cancelled bookings.
4. No-show bookings.
5. Revenue summaries.
6. Revenue trends.

## 9. API Map

## 9.1 Tenant Dashboard Appointment Endpoints

Base path:

- `/api/v1/tenant`

### Dashboard and summary

1. `GET /dashboard/stats`
2. `GET /dashboard/todays-appointments`
3. `GET /dashboard/revenue-chart`
4. `GET /dashboard/search?search=...`

### Appointment list and board

1. `GET /appointments`
2. `POST /appointments`
3. `GET /appointments/:id`
4. `GET /appointments/calendar`
5. `GET /appointments/board`
6. `GET /appointments/stats`

### Appointment actions

1. `PATCH /appointments/:id/status`
2. `PATCH /appointments/:id/payment`
3. `PATCH /appointments/:id/reassign-staff`
4. `PATCH /appointments/:id/reschedule`
5. `PATCH /appointments/:id/reassign-reschedule`
6. `POST /appointments/:id/record-payment`

### Payment summary endpoints

1. `GET /appointments/:id/payment`
2. `POST /appointments/:id/record-payment`
3. `POST /appointments/:id/refund`

### POS and collection endpoints that overlap with appointments

1. `GET /pos/queue`
2. `GET /pos/alerts`
3. `POST /pos/alerts/:alertKey/read`
4. `POST /pos/alerts/read-all`
5. `GET /pos/transactions`
6. `GET /pos/transactions/:id/receipt-pdf`
7. `GET /pos/closing`
8. `GET /pos/closing/export`
9. `GET /pos/gift-cards/validate`
10. `POST /pos/gift-cards/redeem`

### Reviews and customer context used by the appointment drawer

1. `GET /reviews`
2. `PATCH /reviews/:id`

### Notifications and delivery logs used by appointment-related pushes

1. `GET /notifications/usage`
2. `POST /notifications/send`
3. `GET /notifications/history`
4. `GET /notifications/history/:id`
5. `GET /notifications/history/:id/recipients`
6. `GET /notifications/delivery-logs`

## 9.2 Staff App Appointment Endpoints

Base path:

- `/api/v1/staff`

1. `GET /appointments`
2. `PATCH /appointments/:id/status`
3. `GET /schedule`
4. `GET /time-off`
5. `POST /time-off`
6. `DELETE /time-off/:id`
7. `GET /me`
8. `POST /me/push-token`
9. `DELETE /me/push-token`

These endpoints are used to keep staff notifications and appointment visibility in sync.

## 9.3 Customer Booking Endpoints

Base path:

- `/api/v1/bookings`

1. `POST /search`
2. `GET /recommendations`
3. `GET /next-available`
4. `GET /invites/:token`
5. `GET /invites/:token/open`
6. `POST /invites/:token/respond`
7. `POST /create`
8. `POST /:id/respond`
9. `GET /`
10. `GET /:id`
11. `PATCH /:id/cancel`
12. `PATCH /:id/reschedule`
13. `GET /:id/review/open`

These are the customer-facing appointment endpoints that connect the customer app to the tenant dashboard booking lifecycle.

## 10. Useful Appointment Forms and Their Purpose

### 10.1 Customer Selection Form

Purpose:

1. Link the appointment to an existing account.
2. Create a new account from tenant side.
3. Create a guest appointment without a stored customer.

### 10.2 Service Queue Form

Purpose:

1. Add one or more services.
2. Select variant, staff, time, and discount per service.
3. Build a sequential booking session.

### 10.3 Payment Collection Form

Purpose:

1. Record a full payment.
2. Record a deposit.
3. Record a remainder payment.
4. Split the payment across multiple payment methods.

### 10.4 Reschedule Form

Purpose:

1. Change appointment time.
2. Keep or change staff.
3. Preserve audit history.

### 10.5 Status Form

Purpose:

1. Move appointment through operational states.
2. Record arrival.
3. Mark service progress.
4. Mark completion or cancellation.

### 10.6 Board Context Actions

Purpose:

1. Reassign staff.
2. Reschedule.
3. Open settings.
4. Open details.
5. Open customer workspace.

## 11. Notes and Audit Trail

The appointment detail view preserves:

1. Reschedule audit notes.
2. Cancellation audit notes.
3. Activity timeline events.
4. Transaction history.
5. Customer notes and extracted guest cards.

This is important for:

1. Customer disputes.
2. Payment reconciliation.
3. Staff accountability.
4. Support investigation.

## 12. Files Most Relevant To The Appointment Section

### Tenant UI

1. `tenant/src/app/[locale]/dashboard/appointments/page.tsx`
2. `tenant/src/app/[locale]/dashboard/appointments/[id]/page.tsx`
3. `tenant/src/components/AppointmentActionDrawer.tsx`
4. `tenant/src/components/AppointmentDetailsDrawer.tsx`
5. `tenant/src/components/CalendarView.tsx`
6. `tenant/src/components/AppointmentBoardCartDrawer.tsx`
7. `tenant/src/components/EmployeeWeeklyScheduleEditor.tsx`

### Tenant API

1. `tenant/src/lib/api.ts`

### Server

1. `server/src/routes/tenantRoutes.js`
2. `server/src/controllers/tenantAppointmentController.js`
3. `server/src/controllers/tenantDashboardController.js`
4. `server/src/controllers/tenantPaymentController.js`
5. `server/src/routes/bookingRoutes.js`
6. `server/src/controllers/bookingController.js`
7. `server/src/routes/staffRoutes.js`
8. `server/src/controllers/staffAppController.js`

## 13. Summary

The appointment section is not just a list of bookings. It is the complete scheduling, payment, assignment, customer-context, and staff-operation layer of Refah.

If you need to extend this section later, the safest mental model is:

1. The main appointments page is the operational workspace.
2. The create drawer is the primary booking form.
3. The details drawer is the management and settlement console.
4. The calendar board is the visual scheduling surface.
5. The customer app and staff app are the two external systems that must stay in sync with every appointment change.

