# Refah Reviews End-to-End Implementation Plan

## Goal
Build a complete reviews system across:
- Customer app
- Staff app
- Tenant dashboard
- API/backend

## Product Scope
- Customer can submit a review after a completed appointment.
- Review targets tenant and (optionally) assigned staff member.
- Tenant can view/hide/reply from dashboard.
- Staff can view (and optionally reply based on permission).
- Customer tenant page shows published reviews.
- Customer can open staff profile and view staff-specific reviews.

## Phase Plan

### Phase 1: Core Reviews API + Customer Tenant Reviews Tab
- [x] Add implementation tracker document
- [x] Add backend endpoint to create review from authenticated customer
- [x] Add backend endpoint to list tenant public reviews
- [x] Wire customer app review submit API to new backend endpoint
- [x] Replace tenant page reviews placeholder with real data list
- [x] Commit + push

### Phase 2: Staff Reviews Read Model
- [x] Add backend endpoint to list public staff reviews
- [x] Add backend endpoint to list "my reviews" for customer (optional helper)
- [x] Staff app: verify/adjust reviews screen mapping and reply behavior
- [x] Push notifications on new staff review
- [x] Commit + push

### Phase 3: Customer Staff Profile + Review UX
- [x] Add customer-facing staff profile page
- [x] Show staff bio/skills/rating/reviews
- [x] Add "Write review" entry from eligible completed appointments
- [x] Add duplicate-review prevention UX
- [x] Commit + push

### Phase 4: Tenant Dashboard Improvements
- [x] Advanced filters (rating/staff/date/visibility)
- [x] Reply/edit reply UX polish
- [x] Dashboard alert on new review
- [x] Commit + push

### Phase 5: QA + Release Hardening
- [x] E2E test matrix across all apps
- [x] Rate limiting / abuse checks
- [x] Performance checks + DB indexes review
- [x] Release notes and rollout checklist
- [x] Commit + push

## Data Rules
- Only authenticated customer can submit review.
- Review requires `tenantId`, `appointmentId`, `rating`.
- Appointment must belong to authenticated user and be `completed`.
- One review per customer per appointment.
- `isVisible=false` reviews are hidden from customer-facing pages.

## Notes
- Existing tenant dashboard reviews page is already wired to:
  - `GET /api/v1/tenant/reviews`
  - `PATCH /api/v1/tenant/reviews/:id`
- Existing customer tenant reviews tab currently shows placeholder text and must be connected to API.
