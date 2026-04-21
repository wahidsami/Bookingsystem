# Multi-Service Booking Cart Plan

## Goal
Let a customer book more than one service in a single checkout flow, while keeping each service item independent in the database and operational flows.

We will not make variants multi-select. Variants remain a single choice inside each service item.

## Decision
Use a **booking session + linked appointments** model.

That means:
- the customer builds a cart of service items
- each item can have one variant, one provider, one date/time, and one price
- checkout creates multiple appointment rows
- all created appointments share one booking reference / session id

This is the safest path because it fits the current appointment-first backend and avoids a full booking-table redesign.

## Why This Model
- Minimal disruption to the current system
- Reuses existing availability, pricing, payment, and notification logic
- Keeps the tenant dashboard calendar and appointments list working with small changes
- Makes the customer app experience feel like one checkout without forcing a new schema shape for every downstream feature

## Scope

### Customer App
- Add a cart-style booking flow
- Allow adding multiple service items before checkout
- Keep each item configurable:
  - service
  - single variant
  - provider
  - date/time
  - payment method rules
- Show a cart summary before confirmation
- Support removing/reordering items before checkout

### Tenant Dashboard
- Show linked appointments clearly when a booking session contains multiple items
- Keep the existing appointment detail pages, but add grouping metadata
- Allow manual booking creation with multiple services if needed later

### Backend
- Add a booking session concept
- Create multiple appointments in one transaction
- Link appointments together with a shared booking reference
- Preserve per-item pricing, staff assignment, and variant snapshot data
- Emit notifications per appointment, while keeping the customer experience grouped

## Suggested Data Model

### New table: `booking_sessions`
Suggested fields:
- `id`
- `tenantId`
- `platformUserId`
- `bookingReference`
- `status`
- `subtotal`
- `taxAmount`
- `platformFee`
- `totalAmount`
- `paymentMethod`
- `createdAt`
- `updatedAt`

### Appointment updates
Add to `appointments`:
- `bookingSessionId`
- `bookingReference`
- `bookingItemIndex`

Optional later:
- `parentAppointmentId` if we want explicit tree relationships

### Booking item snapshots
Each appointment already stores important snapshots. We should continue that pattern:
- `serviceVariantId`
- `serviceVariantName`
- `serviceVariantDescription`
- `serviceVariantDuration`
- pricing breakdown
- assigned staff

## API Plan

### Customer booking
Create a booking-session endpoint that accepts an array of service items:
- service id
- variant id
- staff id / requested staff id
- date/time
- payment method
- notes

The backend should:
1. validate every item
2. calculate availability per item
3. calculate price per item
4. create one booking session
5. create the linked appointments
6. send notifications

### Tenant dashboard booking
Reuse the same booking-session backend so the dashboard can create grouped bookings later without a separate code path.

## Implementation Phases

### Phase 1
- Add backend booking session model and migrations
- Extend appointment schema with booking grouping fields
- Keep single-service booking behavior working

### Phase 2
- Build customer cart UI in the mobile app
- Support adding and removing service items
- Preserve one variant per service item

### Phase 3
- Wire checkout to create linked appointments
- Add grouped booking confirmation and notifications

### Phase 4
- Update tenant dashboard appointment views to display grouped bookings clearly
- Add small UX polish for Arabic labels and summaries

## Rules
- Do not make variants multi-select
- Do not merge service items into one fake appointment
- Keep each service item operationally independent
- Keep existing single-service booking behavior intact during rollout
- Prefer additive schema changes over destructive ones

## Risks
- Payment flow needs careful handling if the cart contains mixed payment rules
- Availability conflicts must be checked per item, not only once
- Notifications may need batching so the customer is not spammed
- Reporting needs to understand grouped appointments as one user journey, not one service row

## Acceptance Criteria
- A customer can add more than one service before checkout
- Each cart item still supports a single variant
- Checkout creates linked appointments under one booking reference
- The customer app shows the booking as one journey
- The tenant dashboard can still manage each appointment item individually
- Existing single-service booking continues to work

