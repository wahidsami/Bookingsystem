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
- [ ] Commit + push

### Phase 2: Staff Reviews Read Model
- [ ] Add backend endpoint to list public staff reviews
- [ ] Add backend endpoint to list "my reviews" for customer (optional helper)
- [ ] Staff app: verify/adjust reviews screen mapping and reply behavior
- [ ] Push notifications on new staff review
- [ ] Commit + push

### Phase 3: Customer Staff Profile + Review UX
- [ ] Add customer-facing staff profile page
- [ ] Show staff bio/skills/rating/reviews
- [ ] Add "Write review" entry from eligible completed appointments
- [ ] Add duplicate-review prevention UX
- [ ] Commit + push

### Phase 4: Tenant Dashboard Improvements
- [ ] Advanced filters (rating/staff/date/visibility)
- [ ] Reply/edit reply UX polish
- [ ] Dashboard alert on new review
- [ ] Commit + push

### Phase 5: QA + Release Hardening
- [ ] E2E test matrix across all apps
- [ ] Rate limiting / abuse checks
- [ ] Performance checks + DB indexes review
- [ ] Release notes and rollout checklist
- [ ] Commit + push

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
