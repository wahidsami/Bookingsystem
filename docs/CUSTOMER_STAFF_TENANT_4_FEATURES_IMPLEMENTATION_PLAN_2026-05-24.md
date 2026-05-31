# Refah - Customer/Staff/Tenant Feature Bundle Implementation Plan (2026-05-24)

## Scope
This plan covers 4 requested features/fixes:
1. Customer iOS employee profile navigation + dedicated employee page.
2. Post-service review/rating flow (email now, WhatsApp-ready later), dedicated review page, and Google Maps integration strategy.
3. Group booking (customer + one guest in same appointment) in both Customer App and Tenant Dashboard.
4. Staff App separation of Messages and Notifications into distinct tabs.

---

## Delivery Principles
- No breaking schema/API changes without backward-compatible fallbacks.
- Feature flags or safe defaults where applicable.
- End-to-end consistency across: `server`, `RifahMobile`, `tenant`, `RifahStaff`.
- Each phase is only marked done after code + QA checklist pass.

---

## Current-State Findings (Based on code scan)
- Customer appointment/booking and staff entities already exist in `bookingController` and mobile booking screens.
- Staff reviews already exist in backend domains (`Review`, staff review endpoints), but post-service outbound review trigger appears incomplete for new requirement.
- Email template infrastructure exists (`customer_appointment_invite.html` and mail pipelines).
- Tenant appointment creation already supports guest mode (single guest concept), but not multi-person booking tied to one appointment group.
- Staff app currently centralizes communication in `Messages`; no dedicated notifications tab split yet.

---

## Architecture Decisions

### A) Employee Profile Reconstruction (Customer App)
- Build a dedicated full page/screen: `EmployeeProfileScreen` with:
  - Back button
  - Employee identity and bio
  - Service specialties (if available)
  - Rating summary
  - Reviews list with pagination
- Replace fragile `View Profile` current route path with explicit navigation params and route guard.

### B) Review Flow After Service Ends
- Trigger review invite when appointment transitions to `completed`.
- Invite channel for now: **email only**.
- Keep domain model ready for WhatsApp channel later by storing `channel` in invite records/events.
- Add public secure review URL/token page for customer review submission.
- Google Maps integration plan:
  - Add tenant-level setting for Google Place ID.
  - Show "Review us on Google" CTA linking to place review URL.
  - Do not fake sync stars into internal reviews; maintain separate source labeling.

### C) Group Booking
- Use a **booking group** concept:
  - Primary customer (owner)
  - Secondary guest person (name + optional phone/email)
- For first release: support exactly one extra person (customer + 1 guest), as requested.
- Keep single payment pipeline but mark quantity/group size and split metadata per attendee.

### D) Staff App Notifications Split
- Keep existing message feed for admin/operational messages.
- Introduce separate notifications feed endpoint + tab.
- Notification tab for system/status alerts (appointment status, reminders, tasks), not thread messages.

---

## Phased Plan

## Phase 0 - Detailed Audit and Contract Lock
Status: `pending`

### Tasks
- Audit existing customer employee profile navigation path in iOS flow and identify root cause.
- Inventory all event points where appointment status becomes `completed`.
- Validate existing review models/tables and reuse vs extension.
- Define API contracts (request/response) for:
  - Employee profile details + reviews
  - Review invite token + submission
  - Group booking payloads
  - Staff notifications feed
- Produce migration list before coding.

### Deliverables
- API contract notes in this file (appendix section).
- Migration checklist and rollback notes.

### Acceptance Criteria
- All required endpoints, models, and screen entry points mapped.
- No ambiguous data ownership across apps.

---

## Phase 1 - Backend Foundations
Status: `pending`

### 1. Employee Profile API hardening
- Add/confirm endpoint for public/customer access to staff profile details and staff reviews.
- Include pagination and locale-aware fields.

### 2. Review Invite Domain
- Add table/model if missing: `review_invites` with:
  - `id`, `appointmentId`, `platformUserId`, `tenantId`, `staffId`
  - `tokenHash`, `expiresAt`, `channel` (`email`, `whatsapp`), `status`
  - `sentAt`, `respondedAt`
- Add service that emits invite when appointment first becomes `completed`.
- Idempotency: no duplicate active invite per appointment/channel.

### 3. Public Review Submission Endpoint
- Validate token, appointment ownership/scope, expiry.
- Allow center review and/or staff review (as requested: center or employee).
- Persist source and linkage to appointment.

### 4. Group Booking Backend
- Extend booking creation payload to include optional guest attendee.
- Save attendee metadata (either in appointment metadata JSON or dedicated attendee table).
- Ensure conflict checks, duration logic, and notifications handle group bookings.

### 5. Staff Notifications API
- Create/confirm `GET /staff/notifications` and mark-as-read endpoints.
- Keep `messages` endpoints separate.

### Deliverables
- Migrations + models + controllers + routes + tests.

### Acceptance Criteria
- API tests pass for all new/updated endpoints.
- Backward compatibility maintained for existing clients.

---

## Phase 2 - Customer App (RifahMobile)
Status: `pending`

### 1. Dedicated Employee Profile Screen
- New route/screen with reliable navigation from "View Profile".
- Include:
  - Header with back button
  - Employee avatar/name/title
  - About/details section
  - Rating summary + reviews list
- Handle empty/error/loading states.

### 2. Review Page Flow
- Deep-link/web-link path handling for review invite.
- Review form UI:
  - Rating selector
  - Comment
  - Target selector (center/employee) if required
  - Submit success/failure states
- Display optional "Review on Google" CTA when tenant has Place ID.

### 3. Group Booking UI
- In booking flow add "Add one guest" option.
- Guest form fields (minimum name; optional phone/email).
- Booking summary updates (group size, total logic clarity).

### Acceptance Criteria
- iOS "View Profile" always opens dedicated page.
- Review link opens valid review screen and submits successfully.
- Group booking creates appointment with guest metadata.

---

## Phase 3 - Tenant Dashboard
Status: `pending`

### 1. Appointment Creation (Board + New appointment)
- Add group booking controls in appointment creation drawer/form:
  - Primary customer + optional guest
- Validate guest fields and display in appointment details drawer/card.

### 2. Review Configuration
- Tenant settings area for:
  - Enable/disable post-service review invites
  - Invite expiry window
  - Google Place ID input and validation

### Acceptance Criteria
- Tenant can create appointment for customer + guest.
- Appointment details clearly show attendee count and guest identity.
- Review invite settings persist and affect backend behavior.

---

## Phase 4 - Staff App (RifahStaff)
Status: `pending`

### Tasks
- Update bottom tabs/navigation to include dedicated `Notifications` tab.
- Keep `Messages` for admin messages only.
- Add notification list screen with read/unread state and actions.
- Ensure badge counts are independent for Messages vs Notifications.

### Acceptance Criteria
- Messages and Notifications are clearly separated in UX and data source.
- Existing message features remain functional.

---

## Phase 5 - Notifications/Email Templates
Status: `pending`

### Tasks
- Create email template for review invite after completed service.
- Add localized copy (EN/AR) with secure review button link.
- Log send attempts and failures for traceability.

### Acceptance Criteria
- On completion, one invite email is sent per policy.
- Link token validates and cannot be reused improperly.

---

## Phase 6 - QA, UAT, and Hardening
Status: `pending`

### Test Matrix
- Customer App iOS:
  - View profile from booking/appointment cards
  - Review invite link and submission
  - Group booking creation and visibility
- Tenant Dashboard:
  - Create group booking
  - Review config + Google Place ID
- Staff App:
  - Messages vs Notifications separation
- Backend:
  - Contract tests for new endpoints
  - Security tests for invite token misuse/expiry

### Edge Cases
- Appointment completed multiple times (idempotent invite)
- Guest booking without customer email/phone
- Expired review token
- Deleted staff profile but pending review invite
- Tenant without Google Place ID

### Acceptance Criteria
- All regression and new feature tests pass.
- No critical console/server errors in main flows.

---

## Data & Migration Plan
Status: `pending`

### Expected Migrations (tentative)
- `review_invites` table (if not already present)
- Optional: `appointment_attendees` table or `appointments.groupMetadata` JSON extension
- Optional: `tenants.googlePlaceId`, `tenants.reviewInviteEnabled`, `tenants.reviewInviteExpiryHours`

### Rollback Strategy
- Additive migrations only.
- Keep old API fields intact.
- Guard new UI by capability checks.

---

## Execution Order (Recommended)
1. Phase 0 contract lock
2. Phase 1 backend foundations
3. Phase 2 customer app
4. Phase 3 tenant dashboard
5. Phase 4 staff app
6. Phase 5 templates/outbound communications
7. Phase 6 QA/UAT + bugfix sweep

---

## Progress Tracker
- [ ] Phase 0 - Audit and contracts
- [ ] Phase 1 - Backend foundations
- [ ] Phase 2 - Customer app
- [ ] Phase 3 - Tenant dashboard
- [ ] Phase 4 - Staff app
- [ ] Phase 5 - Templates and outbound invite flow
- [ ] Phase 6 - QA/UAT hardening

---

## Definition of Done (100%)
All of the following must be true:
- [ ] iOS customer "View Profile" opens dedicated employee page with reviews and back navigation.
- [ ] Post-service review invite email triggers exactly once per completed appointment policy.
- [ ] Dedicated review page accepts and stores center/employee review correctly.
- [ ] Google Place ID setting works and Google review CTA opens the correct Place review link.
- [ ] Group booking (customer + 1 guest) works in customer app and tenant dashboard.
- [ ] Staff app has separate Messages and Notifications tabs, each with correct data feed.
- [ ] Regression tests pass and deployment notes are documented.

---

## Notes
- WhatsApp sending is intentionally deferred; this plan keeps data model/channel support ready.
- If product decides to support more than one guest later, attendee table approach is preferred over JSON metadata.
