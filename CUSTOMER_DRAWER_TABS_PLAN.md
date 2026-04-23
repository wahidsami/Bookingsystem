# Customer Drawer Tabs Plan

## Goal
Turn the appointment side drawer into a wider in-place customer workspace.

Instead of sending the admin to the full customer page from `Open profile`, the drawer should:
- stay on the appointment context
- show a back button to return to appointment details
- load the customer inside the same drawer
- split the drawer into tabs for the customer record

## Why This Matters
The current drawer already shows appointment details and a small customer preview. That is useful, but it still forces a page jump when the admin wants deeper customer context.

This enhancement keeps the workflow inside the appointment board, which is faster for front-desk work and better for live service handling.

## Current State
What already exists:
- `AppointmentDetailsDrawer` loads the appointment and can expand a small customer preview.
- `Open profile` currently routes to the full customer page.
- `tenantApi.getCustomer(id)` already returns a rich customer payload with:
  - profile data
  - total bookings
  - total spent
  - first/last visit
  - all appointments
  - all orders
  - recent activity
- `tenantApi.getCustomerHistory(id)` already exists for appointments/orders history.
- POS and payment transaction data already exists in the backend, but it is not yet exposed as a customer-scoped drawer tab.

## Proposed UX
The drawer becomes a two-level workspace:

### Level 1
Appointment details, as it exists today.

### Level 2
Customer workspace, opened from `Open profile`.

This second level should include:
- a back button to return to appointment details
- a wider drawer width, around `max-w-5xl`
- tabs across the top or just under the header

Suggested tabs:
- `Overview`
- `Appointments`
- `Transactions`
- `Notes` or `Activity`

## Suggested Data Per Tab
### Overview
Show the customer identity and summary data:
- avatar
- full name
- phone
- email
- gender
- loyalty tier / points
- total bookings
- total spent
- first visit
- last visit
- customer notes

### Appointments
Show a customer booking timeline:
- appointment date/time
- service
- provider
- status
- payment status
- price
- booking reference when available

This tab can reuse the existing `allAppointments` / `recentAppointments` shape from `getCustomer`.

### Transactions
Show payment activity:
- transaction date
- source type
- appointment or order reference
- amount
- status
- payment method
- receipt / invoice reference if available

This likely needs a dedicated customer-scoped endpoint, because the current customer payload does not include payment transaction rows.

### Notes or Activity
Show optional operational context:
- customer notes
- appointment notes
- cancellations
- no-shows
- recent admin actions if available later

## Backend Work Needed
We should keep the backend additions small and reuse current controllers where possible.

### Option A: Extend the existing customer payload
Add a `transactions` array to `GET /tenant/customers/:id` so the drawer can load everything in one call.

This is best if:
- transaction count is small per customer
- we want a single request for the drawer
- we want a simpler frontend

### Option B: Add a separate customer transactions endpoint
Add something like:
- `GET /tenant/customers/:id/transactions`

This is better if:
- transaction history grows large
- we want lazy loading for the transactions tab
- we want to keep the customer overview response lighter

Recommended path:
- use `GET /tenant/customers/:id` for overview + appointments
- add `GET /tenant/customers/:id/transactions` for the Transactions tab

That keeps the first draw fast and makes the payments tab load only when needed.

## Frontend Work Needed
The drawer component should be refactored into a small internal state machine.

Suggested state:
- `viewMode: 'appointment' | 'customer'`
- `customerTab: 'overview' | 'appointments' | 'transactions' | 'notes'`

Suggested component behavior:
- clicking `Open profile` switches `viewMode` to `customer`
- back button returns to `appointment`
- customer data loads when the customer view opens
- transactions load only when the transactions tab opens

Suggested drawer layout:
- wider shell
- sticky header with title, back button, and close button
- tab row below the header
- scrollable content area for the active tab

## Implementation Phases
### Phase 1
Create the drawer shell and internal navigation:
- add `viewMode`
- add `customerTab`
- widen the drawer
- add back button
- keep appointment details working exactly as-is

### Phase 2
Load customer overview data inside the drawer:
- reuse `tenantApi.getCustomer(id)`
- render the overview tab
- move `Open profile` into the drawer workspace instead of routing away

### Phase 3
Add the customer tabs:
- appointments tab using existing customer appointment data
- transactions tab using new or extended backend data
- notes/activity tab if we can source useful data without extra complexity

### Phase 4
Polish the experience:
- better empty states
- loading skeletons per tab
- better RTL spacing and alignment
- ensure the drawer behaves well on smaller screens

## Acceptance Criteria
We can call the feature done when:
- `Open profile` no longer navigates away
- the appointment drawer can switch to a customer view
- the customer view has a back button to return to appointment details
- the drawer contains tabbed customer information
- the customer `Transactions` tab shows payment history
- the drawer remains stable in both English and Arabic

## Risks / Notes
- The drawer may become crowded if we try to show too much in one tab, so keep each tab focused.
- Transactions may need a dedicated backend endpoint for performance and clarity.
- The drawer width should grow a bit, but not so much that it feels like a full page.
- We should preserve the appointment drawer's current rebook and reschedule actions.

## Recommended First Slice
Start with:
1. drawer view switching
2. back button
3. customer overview tab
4. transaction endpoint or transaction tab stub

That gives us the new navigation shape early, then we can fill the tabs incrementally.
