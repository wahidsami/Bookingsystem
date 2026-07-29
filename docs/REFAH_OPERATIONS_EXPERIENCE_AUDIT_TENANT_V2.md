# REFAH Operations Experience Audit (Tenant V2)

Scope:
- Tenant-v2
- Original tenant dashboard (`tenant/`)
- Backend (`server/`)

This report is documentation only.
No code was modified.
No implementation proposals are included.

---

## Executive Summary

The original tenant dashboard is still the canonical operational implementation for appointment handling.

Tenant-v2 has converged on the same backend routes in several places, but it collapses board, drawer, customer profile, and transactions into a broader workspace model:

- Original tenant: board page -> appointment drawer -> separate customer/cart drawers.
- Tenant-v2: single workspace -> board + drawer + customer profile + transaction surfaces.

The backend remains the authoritative source for:

- appointment detail payloads
- booking session membership
- payment state canonicalization
- customer history / transaction aggregation
- status transitions
- invoice generation

The main architectural risk in Tenant-v2 is client-side reconstruction:

- grouped appointment cards are assembled in the UI
- customer history cards are grouped in the UI
- transaction summaries are assembled in the UI
- guest cards may be reconstructed from booking-session appointments or notes

---

# Report A - Appointment Board Audit

## A1. Board Architecture

### Original Tenant

```text
tenant/src/app/[locale]/dashboard/appointments/page.tsx
  -> CalendarView
  -> AppointmentDetailsDrawer
  -> AppointmentActionDrawer
  -> AppointmentBoardCartDrawer
```

### Tenant-v2

```text
Tenant-v2/src/components/AppointmentWorkspace.tsx
  -> local board mapping / grouping
  -> drawer state
  -> customer profile / transaction panels
  -> payment state synthesis
```

### Backend

```text
GET /api/v1/tenant/appointments/board
  -> server/src/controllers/tenantAppointmentController.js#getAppointmentsBoard
  -> db.Appointment.findAll(...)
  -> service / staff / user joins
```

## A2. How Appointments Arrive on the Board

### Original tenant
- The appointments page loads board data from the backend.
- `CalendarView` receives appointment data and renders day / staff resource views.
- Clicking a card opens the appointment drawer.

### Tenant-v2
- `AppointmentWorkspace.tsx` calls `tenantApiAdapter.getAppointmentsBoard(...)`.
- The workspace normalizes and groups raw board rows.
- If a booking session exists, multiple appointment rows can be collapsed into one visual board item.

### Backend source
- `server/src/controllers/tenantAppointmentController.js:1450` (`getAppointmentsBoard`)
- Route binding: `server/src/routes/tenantRoutes.js:138`

## A3. Board Endpoint Mapping

| Layer | Original tenant | Tenant-v2 | Backend |
|---|---|---|---|
| Board fetch | `tenant/src/lib/api.ts#getAppointmentsBoard` | `Tenant-v2/src/lib/tenantApiAdapter.ts#getAppointmentsBoard` | `GET /api/v1/tenant/appointments/board` |
| Appointment open | `tenant/src/app/[locale]/dashboard/appointments/page.tsx#handleOpenAppointmentDetails` | `Tenant-v2/src/components/AppointmentWorkspace.tsx` board click handlers | `GET /api/v1/tenant/appointments/:id` |
| Drag / reassign / reschedule | `CalendarView` + page handlers | Workspace board handlers | `PATCH /api/v1/tenant/appointments/:id/reassign-reschedule` |

## A4. Board Data Model

### Backend tables involved
- `appointments`
- `booking_sessions`
- `services`
- `staff`
- `platform_users`
- `appointment_events`
- `payment_transactions`

### Frontend models
- Original tenant: board rows are passed into `CalendarView` and into the appointment drawer as-is.
- Tenant-v2: `AppointmentWorkspace.tsx` defines its own `Appointment` shape and normalizes:
  - booking-session grouping
  - payment state
  - line items / products
  - notes / tags
  - service name aggregation

## A5. Appointment Card Field Ownership

| Field shown on card | Source | DTO / endpoint | Backend owner | Editable? | Read only? |
|---|---|---|---|---|---|
| Customer name | `PlatformUser` / customer fallback | board DTO from `GET /appointments/board` | customer/user record | No | Yes |
| Service name | `service.name_en` / `service.name_ar` or grouped session services | board DTO | `services` | No | Yes |
| Time / date | `appointment.startTime` | board DTO | `appointments` | No | Yes |
| Duration | `service.duration` or appointment duration | board DTO | `services` / `appointments` | No | Yes |
| Staff / employee | `staff.name` | board DTO | `staff` | No | Yes |
| Status badge | `appointment.status` | board DTO | `appointments` | No | Yes |
| Payment badge | `paymentStatus` / normalized payment state | board DTO | `appointments` + payment aggregation | No | Yes |
| Booking reference / session | `bookingSession.bookingReference` / `bookingSessionId` | board DTO | `booking_sessions` | No | Yes |
| Notes / tags | appointment notes / tags | board DTO | `appointments` | No | Yes |

## A6. Board Behavior: Colors, Badges, Icons, Indicators

Observed board behavior is driven by:

- appointment status
- effective payment state
- staff / resource grouping
- time buckets
- booking-session grouping
- board scope (day / resource / calendar mode)

### Typical indicators
- **Appointment colors**: derived from status / board state.
- **Badges**: payment state, booking session grouping, service type, staff state.
- **Icons**: appointment / break / quick actions.
- **Time indicators**: start time and duration.
- **Payment indicators**: paid / partial / deposit / unpaid.
- **Employee indicators**: staff column / staff chip.
- **Customer indicators**: customer name / avatar / walk-in fallback.

## A7. Drag & Drop / Reschedule / Filters / Search / Grouping

### Board controls
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx:1087` `handleDropAppointmentChange`
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx:1124` `confirmDropAppointmentChange`
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx:1182` `handleOpenAppointmentDetails`
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx:1190` `handleRebookAppointment`
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx:1216` `handleAddServiceAppointment`
- `tenant/src/app/[locale]/dashboard/appointments/page.tsx:1241` `handleAddServicePickerContinue`

### Calendar view props
- `tenant/src/components/CalendarView.tsx` supports:
  - `onDropAppointmentChange`
  - `onAppointmentClick`
  - `onBreakClick`
  - `onAppointmentSettingsClick`

### Board grouping
- Original tenant: group/board behavior is mostly delegated to the board view and drawer helpers.
- Tenant-v2: `AppointmentWorkspace.tsx:458-575` groups by `bookingSessionId || bookingReference` and merges:
  - services
  - totals
  - payment status
  - tags
  - notes
  - products

## A8. Board Actions

| Action | Trigger | API | Backend behavior | DTO updates | UI refresh |
|---|---|---|---|---|---|
| Open appointment details | click card / settings icon | `GET /appointments/:id` | loads canonical appointment | appointment DTO | drawer opens |
| Drag and drop reassign/reschedule | board drag/drop | `PATCH /appointments/:id/reassign-reschedule` | updates staff/start time | appointment + booking session | board reload |
| Quick create appointment | quick create drawer | `POST /appointments` | creates appointment / booking session | new appointment DTO | board reload |
| Open blocked time | break item click | board/break flow | manages schedule block | break DTO / schedule DTO | board reload |
| Rebook | appointment action | booking flow | prefill based on appointment | booking prefill | navigation to booking workflow |
| Add service | appointment action | booking flow | prefill session services | booking prefill | navigation to booking workflow |

## A9. Board Limitations / Technical Debt

- Tenant-v2 reconstructs grouped appointments locally instead of relying only on a board-level canonical grouping payload.
- Tenant-v2 uses a unified workspace shell, so board behavior is coupled to customer/transaction panels.
- Board editability in V2 is controlled by a client-side Riyadh-date comparison.
- Guest / session aggregation is more heavily synthesized in V2 than in the original tenant.

---

# Report B - Appointment Drawer Audit

## B1. Drawer Architecture

### Original tenant

```text
tenant/src/app/[locale]/dashboard/appointments/page.tsx
  -> AppointmentDetailsDrawer
    -> appointmentNotes helpers
    -> customer history / customer transactions / wallet history
```

### Tenant-v2

```text
Tenant-v2/src/components/AppointmentWorkspace.tsx
  -> drawer state
  -> customer profile / customer history / customer transactions
  -> appointment detail rendering
  -> transaction details drawer
```

## B2. Drawer Data Loading

### Canonical backend endpoint

- `GET /api/v1/tenant/appointments/:id`
- Route binding: `server/src/routes/tenantRoutes.js:141`
- Controller: `server/src/controllers/tenantAppointmentController.js:1791`

### Additional customer-side endpoints used by the drawer
- `GET /api/v1/tenant/customers/:id`
- `GET /api/v1/tenant/customers/:id/history`
- `GET /api/v1/tenant/customers/:id/transactions`
- customer wallet/history endpoints are also loaded by the drawer in both stacks

### Original tenant drawer load pattern
- load appointment
- load customer
- load wallet history
- load customer transactions
- derive guest cards
- derive appointment history rows
- derive payment state

### V2 drawer load pattern
- same canonical endpoints via `Tenant-v2/src/lib/tenantApiAdapter.ts`
- much more of the visible profile / history / transaction presentation is reassembled in the component state

## B3. Appointment DTO / Drawer DTO Mapping

`server/src/controllers/tenantAppointmentController.js:getAppointment` includes:

- `service`
- `staff`
- `user`
- `paymentTransactions`
- `events`
- `bookingSession`
  - nested `appointments`
    - `service`
    - `staff`
    - `user`

After loading, the controller:

- converts the Sequelize instance to JSON
- applies `attachCanonicalFinancialState(...)`
- sorts events
- returns the canonical appointment object

## B4. Visible Drawer Sections and Field Ownership

| Section | Visible fields | Source | Backend table(s) | Editable? | Canonical owner |
|---|---|---|---|---|---|
| Header | appointment number / reference, status, payment badge, time, staff | appointment DTO | `appointments` / `booking_sessions` | mostly read-only | appointments |
| Customer | name, avatar, email, phone, loyalty tier, wallet snapshot | appointment.user + customer DTO | `platform_users`, customer profile / wallet aggregates | read-only except profile actions | customer |
| Services | service name(s), duration(s), price(s), category | appointment.service and/or bookingSession.appointments | `services`, `appointments`, `booking_sessions` | read-only | appointments/services |
| Payment | payment status, method, paid, deposit, remainder, outstanding, payment allocations | appointment DTO + canonical financial state | `appointments`, `payment_transactions`, invoices | read-only in summary | finance / appointments |
| Invoice | invoice number, amount, totals, taxes | invoice DTO / ensured invoice | `customer_invoices`, `customer_invoice_items` | read-only | finance |
| Timeline / history | reschedule / cancellation / appointment events | appointment.events | `appointment_events` | read-only | operations |
| Notes / tags | notes, internal notes, tags | appointment.notes / tags | `appointments` | notes editable in drawer flow | operations / CRM |
| Transactions | appointment payment transactions, customer transaction history | payment transaction DTO + customer transaction DTO | `payment_transactions`, order/payment ledgers | read-only | finance |
| Booking session | grouping reference, child appointments | bookingSession DTO | `booking_sessions` | read-only | booking engine |
| Customer history | grouped appointment history cards | customer DTO + history DTO | `appointments`, `booking_sessions` | read-only | CRM |
| Customer transactions | customer transaction cards | customer transaction DTO | `payment_transactions` / related ledgers | read-only | finance |

## B5. Appointment Drawer Helpers and State

### Original tenant drawer helpers
- `resolveEffectivePaymentStatus(...)`
- `extractAppointmentGuestCards(...)`
- `sanitizeAppointmentNotes(...)`
- reschedule / refund / rebook handlers

### Tenant-v2 workspace helpers
- appointment grouping and payment normalization are implemented inside `Tenant-v2/src/components/AppointmentWorkspace.tsx`
- V2 keeps local state for:
  - active appointment
  - customer profile
  - customer history
  - customer transactions
  - payment summary
  - transaction detail drawer

## B6. Guest Support Audit

Guest support is canonical in the original drawer and is reconstructed from the backend appointment payload.

### Source of guest cards
`tenant/src/lib/appointmentNotes.ts:72-165`

### Guest reconstruction rules
1. Prefer `appointment.bookingSession.appointments`
2. Identify guest rows by comparing session user IDs against the primary appointment user
3. If no session rows exist, fall back to `[GROUP_GUEST]` markers inside notes
4. Emit guest cards with:
   - id
   - fullName
   - phone
   - email
   - serviceName
   - servicePrice
   - isFree
   - staffName
   - source

### Drawer usage
- `tenant/src/components/AppointmentDetailsDrawer.tsx:973` builds `guestCards`
- `tenant/src/components/AppointmentDetailsDrawer.tsx:2449` and `:3181` render participant sections

### Guest data ownership
- canonical guest storage is not a dedicated guest table in the drawer
- guest presence is reconstructed from:
  - `booking_sessions.appointments`
  - appointment notes audit markers

## B7. Appointment Actions Inside the Drawer

| Action | Trigger | API / flow | Backend effect | DTO refresh | Notes |
|---|---|---|---|---|---|
| Check in / status change | status controls | `PATCH /appointments/:id/status` | updates appointment state | refresh appointment | status machine enforced server-side |
| Collect payment | pay now / checkout flow | `PATCH /appointments/:id/payment` | creates payment transaction(s), updates appointment/invoice/session | refresh appointment | canonical payment path |
| Collect remainder | remainder payment flow | `POST /appointments/:id/record-payment` | records remaining payment | refresh appointment | used for deposit/remainder cases |
| Mark refunded | refund action | `PATCH /appointments/:id/payment` with refunded state | marks payment refunded | refresh appointment | implemented in drawer |
| Reschedule | reschedule action | `PATCH /appointments/:id/reschedule` | changes date/time | refresh appointment | canonical schedule update |
| Rebook | rebook action | booking flow | prefill new booking | new booking DTO | navigates to booking creation |
| Add note | notes field | note update flow | persists note text | refresh appointment | ops / CRM |
| Open customer profile | customer action | customer route / profile view | no immediate mutation | customer data refresh | CRM view |
| View invoice | invoice link | invoice route / PDF | no mutation | invoice refresh | finance |
| Message customer | messaging flow | internal messaging / notification flow | sends message | no immediate appointment mutation | depends on tenant features |

### Important drawer behavior
- `tenant/src/components/AppointmentDetailsDrawer.tsx:1526` derives `currentPaymentStatus`
- `tenant/src/components/AppointmentDetailsDrawer.tsx:1531` computes `hasTrueRemainderBalance`
- `tenant/src/components/AppointmentDetailsDrawer.tsx:1299` and `:1329` refresh the appointment after payment / refund flows

## B8. Original Tenant vs Tenant-v2 Drawer Behavior

### Original tenant
- canonical appointment details drawer
- separate customer profile / cart / action drawers
- guest cards reconstructed using shared helpers
- payment state is mostly driven from the refreshed appointment DTO

### Tenant-v2
- appointment, customer profile, and transaction surfaces are embedded in one workspace
- more local grouping and normalization
- more aggressive reconstruction of history / transaction / payment cards

## B9. Drawer Limitations / Technical Debt

- Tenant-v2’s unified workspace increases coupling between appointment state and customer state.
- Guest support depends on session structure or notes reconstruction.
- Customer history / transactions are often grouped client-side rather than shown as raw canonical backend rows.
- Payment summary state can be re-derived by the UI, which increases drift risk if backend DTOs change.

---

# Report C - Operational Lifecycle Audit

## C1. Lifecycle Overview

```text
Appointment Created
  -> Board visibility
  -> Drawer open
  -> Check-in / status changes
  -> Service execution
  -> Payment / remainder / refund
  -> Invoice / receipt
  -> Customer profile + history + transactions update
  -> Completed appointment
```

## C2. Backend Execution Path

### Creation
```text
POST /api/v1/tenant/appointments
  -> tenantAppointmentController.createAppointment
  -> appointment / booking_session persistence
  -> invoice / customer insight / usage updates
```

### Board refresh
```text
GET /api/v1/tenant/appointments/board
  -> tenantAppointmentController.getAppointmentsBoard
```

### Drawer refresh
```text
GET /api/v1/tenant/appointments/:id
  -> tenantAppointmentController.getAppointment
  -> attachCanonicalFinancialState(...)
```

### Status transitions
```text
PATCH /api/v1/tenant/appointments/:id/status
  -> tenantAppointmentController.updateAppointmentStatus
  -> transition validation
  -> payment gate
  -> appointment event / audit updates
```

### Payment transitions
```text
PATCH /api/v1/tenant/appointments/:id/payment
  -> tenantAppointmentController.updatePaymentStatus
  -> payment transaction creation
  -> invoice ensure
  -> booking session totals sync
  -> customer spent / insight updates
```

### Remainder collection
```text
POST /api/v1/tenant/appointments/:id/record-payment
  -> remainder payment flow
  -> financial transaction / appointment state update
```

## C3. Status Machine

Observed appointment status machine centers on:

- `pending`
- `confirmed`
- `arrived`
- `in_service`
- `completed`
- `cancelled`
- `no_show`

Payment statuses are separate and include:

- `pending`
- `deposit_paid`
- `fully_paid`
- `refunded`
- `partially_refunded`

### Key rules observed in backend
- `updateAppointmentStatus` validates transitions server-side.
- Completing an appointment is gated by payment settlement.
- Payment updates can normalize pending appointments to confirmed.
- Booking-session payments can settle multiple child appointments in one transaction flow.

## C4. State Transition Summary

| Current state | Next state | Allowed action | Backend endpoint | Notes |
|---|---|---|---|---|
| pending | confirmed | manual confirmation / payment-related update | `PATCH /appointments/:id/status` or payment flow | controlled by backend rules |
| confirmed | arrived / check-in state | receptionist check-in | `PATCH /appointments/:id/status` | operational step |
| arrived / in_service | completed | service completion | `PATCH /appointments/:id/status` | payment gate can apply |
| confirmed / arrived / in_service | cancelled | cancellation | `PATCH /appointments/:id/status` | audit/event generated |
| confirmed / arrived | no_show | no-show | `PATCH /appointments/:id/status` | audit/event generated |
| any payable state | paid / partial / refunded | payment update | `PATCH /appointments/:id/payment` | updates invoice / totals |

## C5. Payment Lifecycle

### Canonical backend responsibilities
`server/src/controllers/tenantAppointmentController.js:2263-2558`

The payment flow:

1. Validates payment status input.
2. Loads appointment with service, booking session, nested appointments, and payment transactions.
3. Computes due amount using appointment price, paid amount, and remainder amount.
4. Supports session-level payment allocation when a booking session contains multiple payable appointments.
5. Creates payment transactions.
6. Sets appointment payment fields.
7. Syncs booking-session totals.
8. Ensures invoice generation.
9. Sends lifecycle email after invoice creation.
10. Returns the refreshed appointment payload.

### Canonical financial fields
- `paymentStatus`
- `totalPaid`
- `depositAmount`
- `depositPaid`
- `remainderAmount`
- `remainderPaid`
- `remainingBalance`
- `outstandingAmount`
- `paidAt`
- `paymentMethod`

### Finance / CRM impact
- customer total spent is incremented
- customer insight totals are incremented
- invoice is ensured / updated
- transaction records are created
- booking-session totals are synced

## C6. Notifications

Observed notification touchpoints include:

- invoice lifecycle email after payment completion
- booking status notification warning logging
- appointment event / audit traces
- internal workspace refresh after transitions

The audit did not re-implement or redesign notification policy; it only observes that notification side effects are tied to appointment and payment mutations.

## C7. CRM Lifecycle

The appointment affects:

- customer profile
- customer history
- customer transactions
- wallet balances / wallet history
- loyalty / spending totals
- future booking context
- gift-card and payment histories

### Original tenant behavior
- customer profile and history are loaded from the appointment drawer and refreshed after operational updates.

### Tenant-v2 behavior
- customer profile, history, and transactions are also shown inside the workspace, but the visible cards are reconstructed and grouped client-side.

## C8. Data Ownership Audit

| Field / group | Backend table owner | Backend model owner | DTO owner | Frontend consumer | Editable? | Canonical source |
|---|---|---|---|---|---|---|
| Appointment identity | `appointments` | `Appointment` | appointment DTO | board / drawer / workspace | read-only | appointments |
| Booking session grouping | `booking_sessions` | `BookingSession` | nested appointment DTO | board / drawer / history | read-only | booking sessions |
| Service details | `services` | `Service` | appointment DTO | board / drawer | read-only | services |
| Staff assignment | `staff` | `Staff` | appointment DTO | board / drawer | read-only | staff |
| Customer identity | `platform_users` / customer profile | `PlatformUser` / customer model | customer DTO | drawer / profile / history | read-only | customer profile |
| Payment state | `appointments` + `payment_transactions` | `Appointment` / `PaymentTransaction` | canonical financial DTO | drawer / workspace | read-only | backend payment state |
| Invoice data | `customer_invoices`, `customer_invoice_items` | invoice models | invoice DTO | drawer / finance | read-only | finance |
| Timeline / audit | `appointment_events` | `AppointmentEvent` | event DTO | drawer | read-only | operations |
| Wallet history | wallet ledger / history tables behind customer controller | customer wallet models | customer wallet DTO | drawer / profile | read-only | backend wallet history |
| Gift-card transaction history | gift-card ledger / history tables behind customer controller | gift-card models | customer transaction DTO | drawer / profile | read-only | backend transaction history |

## C9. Current Pain Points / Technical Debt

1. **Duplicated logic**
   - V2 groups appointment rows and customer history rows locally.
   - V2 normalizes payment state in the UI.

2. **Fallback normalization**
   - Appointment and payment state are normalized in multiple places.
   - Guest cards can fall back to notes markers.

3. **Frontend reconstruction**
   - V2 reconstructs customer transaction and history cards from generic payloads.
   - V2 may collapse multiple service rows into one board tile.

4. **Canonical ownership gaps**
   - The board and drawer are still split between backend truth and client-side synthesis.
   - Some guest information is not surfaced as a dedicated first-class DTO.

5. **Performance and coupling**
   - The unified workspace couples board, customer profile, and transaction rendering.
   - Board editability and grouping are controlled by local state and local date logic.

---

## Cross-System Comparison

| Topic | Original tenant | Tenant-v2 | Assessment |
|---|---|---|---|
| Board shell | page + calendar view + separate drawers | single workspace | V2 is more centralized |
| Appointment open | opens canonical drawer | opens workspace detail panel | behavior aligned, architecture differs |
| Customer profile | separate drawer / profile route | embedded in workspace | V2 is more unified |
| Customer history / transactions | loaded and rendered from drawer helpers | reconstructed in workspace | V2 is more synthetic |
| Guest support | helper-backed session/notes reconstruction | booking-session aware, more embedded in workspace | original tenant is clearer |
| Payment truth | backend canonical appointment DTO | backend canonical appointment DTO + UI normalization | both rely on backend, V2 does more local interpretation |

---

## Repository References

- `tenant/src/app/[locale]/dashboard/appointments/page.tsx`
- `tenant/src/components/CalendarView.tsx`
- `tenant/src/components/AppointmentDetailsDrawer.tsx`
- `tenant/src/components/AppointmentBoardCartDrawer.tsx`
- `tenant/src/components/AppointmentActionDrawer.tsx`
- `tenant/src/lib/api.ts`
- `tenant/src/lib/appointmentNotes.ts`
- `Tenant-v2/src/components/AppointmentWorkspace.tsx`
- `Tenant-v2/src/components/Workspace.tsx`
- `Tenant-v2/src/lib/tenantApiAdapter.ts`
- `server/src/routes/tenantRoutes.js`
- `server/src/controllers/tenantAppointmentController.js`
- `server/src/controllers/tenantCustomerController.js`
- `server/src/models/Appointment.js`
- `server/src/models/BookingSession.js`
- `server/src/models/PaymentTransaction.js`

---

## Final Note

This audit documents the current system only.
It does not propose changes.
It does not modify code.
It is intended as the foundation for the later Operations Experience redesign.
