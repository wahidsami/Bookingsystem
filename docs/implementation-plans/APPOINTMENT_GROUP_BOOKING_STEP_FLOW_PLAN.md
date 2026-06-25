# Appointment Drawer Group Booking Plan

## Goal
Add a compact, step-based group booking flow to the tenant appointment drawer so admins can:
- build the appointment services first
- choose an existing customer or a walk-in customer
- optionally attach a guest to the same booking
- complete payment in the final step

The flow must stay compact, reuse the current booking payloads and payment stack, and avoid introducing a new modal pattern.

## Current Baseline
- The appointment drawer already contains:
  - service selection
  - customer selection
  - payment summary
  - booking session / booking reference support
  - existing group-guest payload handling
- The drawer has already been restored to a parse-safe baseline.
- We should keep the current booking backend contract intact unless a missing field is discovered during testing.

## User Flow
### Step 1: Services
- Admin selects one or more services.
- Admin can review service provider, time, duration, and discounts.
- Continue only when at least one service is queued.

### Step 2: Customer
- Admin chooses one of:
  - existing Refah customer
  - walk-in customer
- For existing Refah customers:
  - show the searchable customer list only
  - do not require name, email, phone, or birth date fields
- For walk-in customers:
  - collect the minimum required details needed by the backend
  - keep the form compact
- If a guest is included:
  - require at least a guest name
  - save the guest as a customer record so tenant admins can edit it later from Customers

### Step 3: Payment
- Show the existing payment summary and payment method controls.
- Reuse the current payment collection logic.
- Final action submits the booking.

## UI Rules
- Use a compact step indicator with `1 / 2 / 3` or equivalent labeled steps.
- Use `Next` and `Previous` actions instead of tabs.
- Keep the drawer visually dense but readable.
- Only show the fields needed for the active step.
- Avoid adding extra panels or nested navigation.

## Guest Rules
- Guest support applies to the appointment booking itself.
- A guest should be treated as a lightweight customer record.
- The guest must have at least a name.
- The guest appears later in the Customers section for tenant maintenance.
- Keep guest data minimal at booking time; allow later editing from customer management.

## Backend Expectations
- Reuse the existing appointment creation payload.
- Reuse the existing `groupGuest` handling if it already satisfies the flow.
- Reuse booking session and booking reference fields.
- Do not change the existing payment flow unless validation proves a gap.

## Implementation Tasks
### UI state
- [ ] Add an explicit appointment step state.
- [ ] Reset step state when the drawer opens.
- [ ] Block step advancement until the current step is valid.
- [ ] Keep the drawer state stable when switching between existing customer and walk-in.

### Services step
- [ ] Keep the current service queue behavior.
- [ ] Show the service picker only when the services step is active.
- [ ] Keep service editing behavior available from the summary.

### Customer step
- [ ] Show searchable existing customers.
- [ ] Show walk-in mode with minimal inputs.
- [ ] Add guest checkbox / guest entry path.
- [ ] Require guest name when guest mode is enabled.

### Payment step
- [ ] Show payment summary only on the final step.
- [ ] Keep single and split payment handling unchanged.
- [ ] Keep gift-card payment validation intact.

### Submission
- [ ] Reuse current booking submit logic.
- [ ] Preserve booking session and booking reference payloads.
- [ ] Preserve group guest payload compatibility.

## Validation Rules
- Services step cannot continue with an empty queue.
- Customer step cannot continue if the required customer data is missing.
- Guest step cannot continue without a guest name.
- Payment step cannot submit without a selected payment method.
- Split payment total must still match the booking total.

## Empty and Error States
- If there are no services, the drawer should show a clear empty state.
- If there are no customers available, show a compact empty state.
- If validation fails, show one inline message per step, not a long stack of errors.
- Keep the current backend error messages visible in the debug block when needed.

## Compactness Rules
- Prefer one-line labels.
- Keep helper text short.
- Use minimal spacing between controls.
- Do not add explanatory copy beyond what is needed to make the flow understandable.

## Testing Checklist
- [ ] Services step works with one and multiple queued services.
- [ ] Existing customer search works.
- [ ] Walk-in customer flow works.
- [ ] Guest checkbox and guest name validation work.
- [ ] Payment step submits successfully.
- [ ] Existing split payment flow still works.
- [ ] The drawer remains parse-safe and builds successfully.

## Out of Scope
- Do not redesign the broader appointment board.
- Do not change unrelated billing or reporting modules.
- Do not introduce a new drawer type for this flow.

