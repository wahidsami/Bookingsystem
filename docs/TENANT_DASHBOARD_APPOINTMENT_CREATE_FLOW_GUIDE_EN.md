# Tenant Dashboard Appointment Creation Flow Guide

## Purpose
This guide explains the full tenant dashboard flow from the moment an admin clicks to add a new appointment until the appointment is successfully booked and appears back in the board or list.

Primary route:
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`

Primary drawer component:
- `tenant/src/components/AppointmentActionDrawer.tsx`

Related detail drawer:
- `tenant/src/components/AppointmentDetailsDrawer.tsx`

---

## 1) Entry Points

The tenant admin can open the appointment creation drawer from:

1. The main `New Appointment` button on the appointments page.
2. A board time slot click on the calendar view.
3. A board right-click context menu on a staff column or time cell.
4. A rebook action from an existing appointment.

In all cases, the same appointment creation drawer is used. The page may prefill staff, date, time, customer, service, or payment method depending on where the drawer was opened from.

---

## 2) What the Admin Sees on the Appointments Page

Before opening the drawer, the admin sees:

- Page title: `Appointments`
- View controls for board/list style
- Filters for date range, staff, service, status, and payment status
- Appointment cards or the calendar board
- A `New Appointment` button
- On the calendar board:
  - staff columns
  - hourly timeline
  - exact 5-minute hover slots
  - appointment cards already booked

When the admin clicks `New Appointment`, the appointment drawer slides in.

---

## 3) Appointment Drawer: Main Sections

The drawer is organized into clear sections:

### A. Customer
This section lets the admin choose who the booking is for.

Available modes:
- Existing customer
- New customer
- Guest customer

What appears on screen:
- Search box or customer picker for existing customers
- Selected customer card when a customer is chosen
- Input fields for new/guest customer data

Shown fields in the customer form:
- First name
- Last name
- Email
- Mobile number
- Gender
- Date of birth

Validation behavior:
- For a new appointment, only the customer name is required.
- Email, mobile, gender, and birthdate are optional.
- If no email is entered, the system warns the admin that the appointment confirmation email will not be sent.
- The admin must confirm before saving without email.

### B. Service and Time
This section controls the actual booking slot.

What appears on screen:
- Service dropdown
- Variant dropdown, if the service has variants
- Staff/provider dropdown, if the selected service can be assigned to specific staff
- Date picker
- Time picker
- Service price summary

Behavior:
- The selected service controls what staff, payment options, price, and duration are available.
- The time picker now supports 5-minute precision.
- If the service has assigned providers, a staff member must be selected.
- The appointment start time is saved as a full timestamp.

### C. Payment
This section controls how the appointment is marked financially.

What appears on screen:
- Payment method chips or buttons
- Allowed methods are filtered based on the selected service

Typical payment methods:
- At center
- Cash
- Card POS
- Wallet
- Bank transfer
- Booking fee

Behavior:
- The selected service determines which payment options are allowed.
- If the service only allows some methods, the drawer hides the others.
- The payment choice is saved together with the booking.

### D. Group Booking
This section appears when the admin adds an additional guest on the same booking.

What appears on screen:
- Toggle or checkbox to add a guest
- Guest first name
- Guest last name
- Guest phone
- Guest service selector
- `Free service` checkbox

Behavior:
- If `Free service` is checked, the guest service price becomes zero.
- If `Free service` is unchecked, the guest service price is added to the final total.
- The total shown in the drawer updates immediately.
- The guest service name is stored with the booking metadata and appears later in the board and details drawer.

### E. Notes
This section lets the admin add internal notes for the booking.

What appears on screen:
- Notes text area

Behavior:
- Notes are saved with the appointment.
- The system can also store structured booking metadata in the same note field.
- The UI sanitizes this metadata so the board and details views stay readable.

### F. Action Buttons
At the bottom of the drawer, the admin sees the save action.

Depending on the drawer mode, the button label may be:
- `Save Appointment`
- `Save Changes`
- `Save Blocked Time`

For appointment creation, the main action is `Save Appointment`.

---

## 4) Validation Before Save

When the admin clicks save, the drawer checks the booking before calling the backend.

Main validation rules:
- A service must be selected
- A customer must be selected for existing-customer mode
- For new customer mode, first name and last name are required
- For guest mode, guest first name and last name are required
- A date and time must be selected
- A staff member must be selected if the service requires one
- A payment method must be selected
- If group booking is enabled, the guest full name is required
- If group booking is enabled, a guest service must be selected

Email warning behavior:
- If the customer has no email, a confirmation popup appears.
- The admin can continue and save anyway.
- If the admin cancels, the booking is not saved.

---

## 5) What Gets Sent to the Backend

When the admin saves the appointment, the drawer sends a booking payload that includes:

- Service ID
- Variant ID, if selected
- Staff ID
- Requested staff ID
- Appointment start time in ISO format
- Notes
- Payment method
- Group guest details, if enabled
- Customer reference
  - existing customer ID for existing users
  - guest/new customer object for new or guest mode
- Assignment mode

Group booking metadata includes:
- guest first name
- guest last name
- guest phone
- guest service ID
- guest service name
- whether the guest service is free

---

## 6) What Happens After Save

If the backend accepts the appointment:

1. A success message is shown.
2. The drawer closes.
3. The appointments board or list reloads.
4. The new appointment appears in the schedule.

The booking is then visible with:
- customer name
- service name
- provider
- time
- payment status
- booking status
- group guest details, if any

If the appointment was created from the calendar board:
- the board refreshes and the new booking appears in the correct staff column and time slot

If the appointment was created from the list view:
- the list refreshes and the new appointment appears in the filtered results

---

## 7) What the Admin Sees After Booking

After the booking is saved, the admin typically sees:

- A success confirmation in the drawer
- The drawer closes automatically
- The calendar or list reloads
- The booked appointment card appears

The appointment card can show:
- customer name
- service name
- provider
- booking time
- payment badge
- status badge
- notes indicator
- group guest indicator, if applicable

---

## 8) Appointment Details After Booking

Once the appointment exists, the admin can open the details drawer and see:

- Customer information
- Booking status
- Payment status
- Service information
- Price
- Notes
- Group guest details
- Transaction history
- Reschedule history
- Status update actions

This details drawer is the place where the admin can later:
- reschedule
- change status
- review payment history
- inspect booking notes

---

## 9) Special Notes About Group Booking

Group booking is part of the same appointment flow, but it adds an extra guest layer.

Important behavior:
- The guest service is optional only when the guest feature is disabled.
- If it is enabled, a guest service must be selected.
- The `Free service` checkbox controls whether the guest service adds to the final price.
- The final total shown in the drawer is recalculated immediately.

This keeps the booking and billing data aligned before the appointment is saved.

---

## 10) Summary of the Full Flow

1. Admin clicks `New Appointment` or a board slot.
2. The appointment drawer opens.
3. Admin selects customer mode:
   - existing customer
   - new customer
   - guest
4. Admin chooses service, date, time, staff, and payment method.
5. Optional group guest details are added.
6. Optional notes are added.
7. The drawer validates the required fields.
8. If email is missing, the admin is warned and can still continue.
9. The admin clicks `Save Appointment`.
10. The backend creates the appointment.
11. The drawer closes and the board/list refreshes.
12. The booked appointment becomes visible in the schedule.

---

## 11) Files Involved

Primary files:
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`
- `tenant/src/components/AppointmentActionDrawer.tsx`
- `tenant/src/components/AppointmentDetailsDrawer.tsx`

Supporting files:
- `tenant/src/lib/api.ts`

