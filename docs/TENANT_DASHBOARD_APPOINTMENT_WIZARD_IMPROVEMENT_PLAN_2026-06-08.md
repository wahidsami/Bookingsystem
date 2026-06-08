# Tenant Dashboard Appointment Wizard Improvement Plan

## Goal
Polish the new appointment wizard so it stays clean, fast, and easy to use while keeping the current booking engine, payloads, notifications, and board refresh behavior unchanged.

This plan focuses on UI/UX quality, clarity, and safety.

---

## What Must Stay Stable

The following must remain unchanged while we improve the wizard:
- booking APIs
- booking payload structure
- appointment validation rules
- customer notification flow
- email notification flow
- push notification flow
- appointment refresh logic
- appointment details behavior
- blocked-time behavior

---

## Current Wizard Shape

The drawer now works as a step-based flow:
1. Customer
2. Service & Time
3. Group
4. Payment
5. Review

It also includes:
- board prefill support
- 5-minute time precision
- walk-in shortcut
- group guest support
- free-service toggle
- existing save handler

---

## Improvement Areas

### 1) Make the Customer Step Cleaner
Current issue:
- the customer step still contains too much information and can feel dense

Improvements:
- keep the search area visually prominent
- keep `Walk In Customer` as a clear primary action
- make the customer mode toggle easier to scan
- reduce empty-state noise
- show a compact customer summary after selection

### 2) Make the Service & Time Step Easier to Read
Current issue:
- service, variant, staff, and time controls are still visually busy

Improvements:
- show service cards or more compact service selection if possible
- keep price and duration visible near the selected service
- make variant selection feel attached to the selected service
- highlight prefilled board time/staff more clearly
- add stronger guidance when a staff member is required

### 3) Make Group Booking More Intentional
Current issue:
- group booking is functional, but it can still feel like an add-on section

Improvements:
- keep group booking collapsed until enabled
- make the guest service selection visually clearer
- show guest price, free-service state, and final effect on total in one place
- make the guest summary readable in the final review step

### 4) Make Payment Selection More Focused
Current issue:
- payment options can still look like a generic list

Improvements:
- keep only valid payment options visible
- make payment chips visually consistent
- keep the final payable amount obvious in the review step
- avoid mixing payment choice with other booking decisions

### 5) Upgrade the Review Step
Current issue:
- the review step should feel like a final confirmation screen, not just another form section

Improvements:
- show a clean summary card for:
  - customer
  - service
  - schedule
  - staff
  - group guest
  - payment
  - notes
- show pricing clearly:
  - base service
  - guest service
  - total
- keep the final `Save Appointment` action only on this step

### 6) Improve Step Navigation
Current issue:
- the flow should feel guided and deliberate

Improvements:
- keep `Previous` and `Next` buttons consistent
- show step progress like `2 of 5`
- prevent advancing when the current step is incomplete
- keep the drawer state stable when moving backward

### 7) Improve Validation Feedback
Current issue:
- some validation is still only obvious later in the flow

Improvements:
- show step-specific validation as early as possible
- keep the existing validation rules unchanged
- make warnings short and direct
- keep the missing-email warning before save

### 8) Keep the UI Clean and Premium
Current issue:
- the wizard can become visually crowded if too much is shown at once

Improvements:
- show one main task per step
- avoid duplicate information
- use consistent spacing and card styles
- keep the drawer height under control
- avoid adding unnecessary visual noise

---

## Priority Order

### Phase 1 - Safety and Clarity
- keep the wizard stable
- ensure each step shows the right content
- ensure validation works per step
- ensure the final submit still uses the existing handler

### Phase 2 - Visual Polish
- tighten spacing and hierarchy
- improve summary cards
- make the review step stronger
- make group booking more readable

### Phase 3 - Workflow Enhancements
- improve walk-in behavior
- improve service selection presentation
- improve step transitions and guidance

### Phase 4 - Nice-to-Have Enhancements
- autosave draft support
- smoother animations
- quick step jump links
- richer service cards

---

## Non-Goals For Now

Do not:
- change backend APIs
- change notification behavior
- change booking payloads
- introduce a second booking flow
- touch blocked-time logic
- rewrite appointment details drawer logic

---

## Acceptance Criteria

The wizard is improved when:
- it feels clearer and easier to scan
- the customer step is less crowded
- the review step shows a clean final summary
- group booking is easy to understand
- payment selection is obvious
- the existing save behavior still works exactly as before

---

## Files Likely Involved

Primary:
- `tenant/src/components/AppointmentActionDrawer.tsx`

Related:
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`
- `tenant/src/components/AppointmentDetailsDrawer.tsx`

