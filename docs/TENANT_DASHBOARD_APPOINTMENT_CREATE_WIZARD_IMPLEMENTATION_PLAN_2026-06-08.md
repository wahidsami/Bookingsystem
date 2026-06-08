# Tenant Dashboard Appointment Creation Wizard Implementation Plan

## Goal
Refactor the tenant appointment creation drawer into a clean step-by-step wizard while keeping the current booking engine intact.

This is a UI/UX workflow improvement only.

Primary objective:
- make the appointment creation flow easier to follow
- keep the current backend payload, validation, notification, and refresh behavior unchanged
- keep the existing booking APIs and appointment board logic stable

---

## What Must Stay Unchanged

The following parts must not be rewritten:
- booking creation APIs
- booking payload structure
- customer notification flow
- email notification flow
- push notification flow
- appointment validation rules
- existing database models
- appointment board refresh logic
- existing appointment status logic

The wizard should sit on top of the existing flow, not replace it.

---

## Current Entry Point

Primary component:
- `tenant/src/components/AppointmentActionDrawer.tsx`

Page entry points:
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`

The drawer is currently a long single-page form. The new plan is to split it into logical wizard steps while preserving the same internal state and final submit handler.

---

## Proposed Wizard Structure

### Step 1 - Customer
Title:
- `Select Customer`

Purpose:
- choose who the booking is for

Inputs:
- existing customer search and picker
- new customer form
- guest customer mode

Required behavior:
- keep existing customer search flow
- keep guest/new customer flow
- keep the current optional fields behavior
- keep the missing email warning before save

Recommended clean behavior:
- if a temporary walk-in flow is needed, reuse the existing guest/new customer path unless the backend already has a dedicated placeholder customer API
- do not invent a second customer creation system just for the wizard

### Step 2 - Service
Title:
- `Select Service`

Purpose:
- choose the appointment service and its variant

Inputs:
- service cards or dropdown
- variant selector, if the service has variants

Required behavior:
- keep the current service selection rules
- keep duration, price, and allowed payment options derived from the selected service
- keep single-service selection for this booking flow

### Step 3 - Schedule
Title:
- `Appointment Schedule`

Purpose:
- choose or confirm date, time, and provider

Inputs:
- date
- time
- staff/provider

Required behavior:
- keep the current board prefill behavior
- if the appointment starts from the board slot or right-click menu, prefill date/time/staff
- keep 5-minute precision
- keep the existing availability rules

### Step 4 - Group Booking
Title:
- `Group Booking`

Purpose:
- optionally add one extra guest to the same appointment

Inputs:
- enable group booking toggle
- guest first name
- guest last name
- guest phone
- guest service selector
- free service checkbox

Required behavior:
- keep the current group guest metadata structure
- keep the current pricing behavior
- if free service is checked, guest price is zero
- if free service is unchecked, guest service price is added to the total

### Step 5 - Review and Payment
Title:
- `Review Appointment`

Purpose:
- show a read-only summary before saving
- finalize the payment method

Display:
- customer summary
- service summary
- schedule summary
- group guest summary
- financial summary
- payment options

Required behavior:
- keep the current allowed payment method filtering
- keep existing payment validation rules
- keep the current final save handler

---

## State Management Plan

The wizard should preserve a single shared state object across all steps.

Suggested state groups:
- customer state
- service state
- schedule state
- group booking state
- payment state
- notes state

Important rule:
- all steps should read and write the same source of truth
- navigation between steps must not reset selected data

---

## Navigation Behavior

Add:
- `Next`
- `Previous`
- `Cancel`

Wizard rules:
- `Next` should only move forward when the current step is valid
- `Previous` should preserve all current selections
- `Cancel` should close the drawer without creating anything

Optional enhancement:
- show a step progress indicator such as `1 of 5`

---

## Validation Plan

Keep the existing validation rules exactly as they are.

Existing rules to preserve:
- service required
- customer required depending on mode
- first and last name required for new/guest modes
- staff required when the service requires one
- payment method required
- guest service required when group booking is enabled
- missing email warning remains supported

Recommendation:
- show validation as the user moves from step to step, but do not alter the actual rule set

---

## Data Submission Plan

The final submit step should reuse the current booking save handler.

Must continue to send:
- service ID
- variant ID
- staff ID
- requested staff ID
- appointment start time
- notes
- payment method
- group guest details
- customer reference
- assignment mode

Do not change:
- request shape
- response handling
- notification triggers
- refresh behavior after save

---

## UI Cleanliness Goals

The redesigned wizard should feel cleaner than the current long form.

Design goals:
- one decision area per step
- reduce vertical scrolling
- keep the summary visible on the final step
- keep the drawer visually calm and easy to scan

The wizard should feel like:
- select customer
- choose service
- confirm schedule
- optionally add guest
- review and create

---

## Implementation Phases

### Phase 1 - Wizard Shell
- convert the drawer into multi-step layout
- add step navigation
- preserve all current state values
- keep current form fields intact

### Phase 2 - Customer Step
- move customer selection into step 1
- keep search, picker, and guest/new modes
- preserve optional field handling

### Phase 3 - Service and Schedule Steps
- move service selection into step 2
- move schedule controls into step 3
- preserve board prefills and time precision

### Phase 4 - Group Booking and Review
- move guest fields into step 4
- add a clean review summary step
- keep the same booking submit function

### Phase 5 - Cleanup and QA
- remove duplicated controls
- verify board prefill still works
- verify notifications and invoice behavior still work
- verify the drawer can still create the same bookings as before

---

## Acceptance Criteria

The redesign is complete when:
- the appointment drawer is split into clear steps
- the existing booking API still works unchanged
- the board-click and right-click prefill behavior still works
- the missing-email warning still appears before save
- group booking still supports guest service and free service
- the final created appointment appears on the board/list exactly as before
- notifications and emails still fire normally

---

## Risks To Watch

1. Duplicate state
- avoid keeping separate copies of the same booking data in multiple steps

2. Validation drift
- do not introduce new booking rules accidentally

3. Payload drift
- do not change the backend request contract

4. Walk-in implementation
- avoid inventing a new placeholder customer model unless the backend already supports it cleanly

5. Board integration
- ensure the wizard still accepts prefilled date/time/staff from the board

---

## Files To Touch

Primary:
- `tenant/src/components/AppointmentActionDrawer.tsx`

Supporting:
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`
- `tenant/src/components/AppointmentDetailsDrawer.tsx`
- `tenant/src/lib/api.ts` only if an existing API gap is discovered

