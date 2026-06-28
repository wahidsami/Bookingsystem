# Tenant Dashboard Appointment Section Handoff Checklist

Use this as a short implementation and QA handoff for the appointment section.

## 1. Core Screens

1. Main appointments board:
   - `tenant/src/app/[locale]/dashboard/appointments/page.tsx`
2. Appointment detail page:
   - `tenant/src/app/[locale]/dashboard/appointments/[id]/page.tsx`
3. Legacy new appointment redirect:
   - `tenant/src/app/[locale]/dashboard/appointments/new/page.tsx`
4. Appointment action drawer:
   - `tenant/src/components/AppointmentActionDrawer.tsx`
5. Appointment details drawer:
   - `tenant/src/components/AppointmentDetailsDrawer.tsx`
6. Calendar board:
   - `tenant/src/components/CalendarView.tsx`
7. Board cart drawer:
   - `tenant/src/components/AppointmentBoardCartDrawer.tsx`

## 2. Main User Flows

1. View appointments in list, calendar, or board mode.
2. Create appointment for:
   - existing customer
   - new customer
   - guest customer
   - group guest / multi-service booking
3. Inspect appointment details and history.
4. Update status.
5. Update payment.
6. Reschedule.
7. Reassign staff.
8. Reassign and reschedule in one step.
9. Record remainder payment.
10. Mark refunded when needed.

## 3. Forms to Verify

### Create Appointment Drawer

1. Customer selection step.
2. Service selection step.
3. Payment step.
4. Optional blocked-time mode.
5. Notes input.
6. Guest group flow.
7. Split payment flow.

### Appointment Details Drawer

1. Status selector.
2. Payment action buttons.
3. Reschedule action.
4. Rebook action.
5. Customer workspace tabs.
6. Timeline and notes.
7. Customer wallet / transactions / reviews panels.

### Board Cart Drawer

1. Gift card purchase flow.
2. Product purchase flow.
3. Existing customer / walk-in selection.
4. Quantity editing.
5. Payment split rows.

## 4. Status Rules

1. Status values:
   - `pending`
   - `confirmed`
   - `checked_in`
   - `in_service`
   - `completed`
   - `cancelled`
   - `no_show`
2. Payment values:
   - `pending`
   - `deposit_paid`
   - `fully_paid`
   - `paid`
   - `refunded`
   - `partially_refunded`
3. A deposit / booking-fee appointment should not be displayed as fully paid.
4. `completed` should require the appointment amount to be paid.
5. `checked_in` should be the arrival state.

## 5. Appointment Board Behavior

1. Drag and drop supported.
2. Staff columns are visible in board mode.
3. Breaks and blocked times are visible.
4. Past same-day slots should be hidden in customer booking flow.
5. Board must keep appointments visible even near hour boundaries.
6. Sticky headers must not overlap cards.

## 6. Cross-App Effects

1. Customer app receives booking and invite notifications.
2. Staff app receives appointment and status notifications.
3. Appointment updates should reflect in:
   - staff schedule
   - customer history
   - tenant drawer
   - POS if payment-related

## 7. Key Endpoints

### Tenant appointment APIs

1. `GET /api/v1/tenant/appointments`
2. `POST /api/v1/tenant/appointments`
3. `GET /api/v1/tenant/appointments/:id`
4. `GET /api/v1/tenant/appointments/calendar`
5. `GET /api/v1/tenant/appointments/board`
6. `GET /api/v1/tenant/appointments/stats`
7. `PATCH /api/v1/tenant/appointments/:id/status`
8. `PATCH /api/v1/tenant/appointments/:id/payment`
9. `PATCH /api/v1/tenant/appointments/:id/reassign-staff`
10. `PATCH /api/v1/tenant/appointments/:id/reschedule`
11. `PATCH /api/v1/tenant/appointments/:id/reassign-reschedule`
12. `POST /api/v1/tenant/appointments/:id/record-payment`
13. `GET /api/v1/tenant/appointments/:id/payment`

### Supporting tenant APIs

1. `GET /api/v1/tenant/dashboard/stats`
2. `GET /api/v1/tenant/dashboard/todays-appointments`
3. `GET /api/v1/tenant/dashboard/revenue-chart`
4. `GET /api/v1/tenant/dashboard/search`
5. `GET /api/v1/tenant/pos/queue`
6. `GET /api/v1/tenant/pos/alerts`
7. `GET /api/v1/tenant/notifications/delivery-logs`

### Customer booking APIs

1. `POST /api/v1/bookings/search`
2. `GET /api/v1/bookings/next-available`
3. `GET /api/v1/bookings/invites/:token`
4. `GET /api/v1/bookings/invites/:token/open`
5. `POST /api/v1/bookings/invites/:token/respond`
6. `POST /api/v1/bookings/create`
7. `PATCH /api/v1/bookings/:id/reschedule`
8. `PATCH /api/v1/bookings/:id/cancel`

### Staff APIs

1. `GET /api/v1/staff/appointments`
2. `PATCH /api/v1/staff/appointments/:id/status`
3. `GET /api/v1/staff/schedule`
4. `POST /api/v1/staff/me/push-token`
5. `DELETE /api/v1/staff/me/push-token`

## 8. QA Checklist

1. Create appointment for existing customer.
2. Create appointment for new customer.
3. Create guest appointment.
4. Create multi-service booking.
5. Verify customer notification is sent.
6. Verify staff notification is sent when assigned.
7. Verify appointment appears in board and list.
8. Verify appointment details drawer actions work.
9. Verify status update works.
10. Verify payment update works.
11. Verify remainder payment works.
12. Verify reschedule works.
13. Verify reassign staff works.
14. Verify reassign + reschedule works.
15. Verify calendar and board do not hide cards near header/time boundaries.
16. Verify no-show / cancelled history is visible in reports where applicable.

