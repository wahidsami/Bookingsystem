# Tenant Appointment Create Flow Plan

## Goal
Add a tenant dashboard flow for creating appointments manually on behalf of a customer.

The flow should:
- let the tenant admin search for an existing customer first
- create a new customer inline if the customer does not already exist
- select service, variant, provider, date, time, and payment method
- save into the same appointments table used by the customer app
- notify the customer app user when the appointment is created

## Desired User Flow
1. Tenant admin opens `Appointments` in the dashboard.
2. Admin clicks `New Appointment`.
3. Admin searches for an existing customer.
4. If the customer exists, admin selects them and continues.
5. If the customer does not exist, admin opens `Add Customer` and completes the form.
6. Admin selects:
   - service
   - service variant, if any
   - service provider
   - date
   - time
   - payment method
   - notes
7. Admin saves the appointment.
8. The appointment appears in:
   - tenant dashboard appointments
   - customer mobile app appointments, if the customer has a platform account

## Rules
- Reuse the existing appointment model and availability logic.
- Do not create a separate appointment system for admin bookings.
- Reuse the same customer form fields wherever possible.
- If the customer already has a mobile app account, send notification after booking.
- If the customer does not have a mobile app account, create the customer record during the booking flow so the appointment can still be associated cleanly.

## What Already Exists
- Tenant appointments list, calendar, board, and detail pages already exist.
- Backend appointment read and update endpoints already exist.
- Customer mobile app already reads appointments from the booking backend.
- Booking availability logic already exists for the customer booking flow.
- Service variants are already supported in the booking data model and customer flow.

## New Backend Work

### 1. Add Tenant Create Appointment API
Add a new authenticated tenant endpoint, likely:
- `POST /api/v1/tenant/appointments`

Responsibilities:
- validate tenant ownership
- validate customer selection or customer creation payload
- validate selected service and variant
- validate selected provider
- validate requested date and time against availability
- create the appointment
- create or link the customer record when needed
- trigger notification delivery

### 2. Add Customer Lookup and Creation Support
Support searching tenant customers by:
- name
- phone
- email

If no customer is found:
- create customer from the booking form
- reuse the same core customer fields used by mobile registration

### 3. Notify Customer After Booking
If the customer has a mobile app account:
- create an in-app notification
- send push notification if a token exists

If the customer does not have a mobile app account:
- create the customer record
- optionally keep the appointment internal until the customer signs in later

### 4. Ensure Appointment Appears in Customer App
The created appointment should use the same appointment tables and relations already consumed by the customer mobile app.

## New Dashboard UI Work

### 1. Appointments Page Entry Point
Add a `New Appointment` button to the tenant appointments page.

### 2. New Appointment Screen
Create a new dashboard page, likely:
- `/[locale]/dashboard/appointments/new`

Recommended layout:
- customer section
- service section
- provider section
- schedule section
- payment section
- notes section
- top action bar with `Save` and `Cancel`

### 3. Customer Selection UX
Recommended interaction:
- search existing customer first
- show results in dropdown or searchable list
- allow `Add Customer` inline if no match exists

### 4. Add Customer Form
The add-customer form should reuse the same data shape as mobile registration as much as possible.

## Suggested Implementation Order
1. Add the backend create-appointment endpoint.
2. Add customer search / create support.
3. Add notification dispatch after booking.
4. Build the dashboard `New Appointment` screen.
5. Wire the form to the new backend endpoint.
6. Verify the appointment appears in:
   - dashboard appointments list
   - customer mobile app bookings list
7. Polish Arabic labels and RTL layout.

## Open Questions
- Should admin-created appointments always create a platform customer account if one does not exist?
- Should the new appointment form support service variants from day one?
- Should the admin be allowed to override the assigned provider after selecting a service?
- Should appointment creation support split payments and deposit payments immediately?

## Notes
- This feature should stay aligned with the existing customer booking rules so the dashboard and mobile app do not drift.
- If we keep the customer form shared, it will reduce duplication and lower the chance of inconsistent validation later.
