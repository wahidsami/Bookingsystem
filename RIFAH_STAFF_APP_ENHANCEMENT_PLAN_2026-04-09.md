# RifahStaff Enhancement Plan

Date: 2026-04-09
Owner: Refah product + engineering
Scope: `RifahStaff` mobile app, supporting backend APIs, tenant dashboard controls, and package/permission gating

## Vision

Build `RifahStaff` into a reliable, fast, role-aware mobile operating system for salon, spa, clinic, and wellness staff.

The app should help a staff member:

- start the day quickly
- see only the features they are allowed to use
- complete appointments smoothly
- manage schedule and time off confidently
- respond to customers professionally
- understand earnings and performance clearly
- stay connected to the tenant business through notifications and messaging

## Current State

### Live and usable now

- Staff login/logout
- Session restore
- Today appointments
- Appointment status updates
- Schedule view
- Profile
- Change password
- Push token registration

### Stored in tenant/admin systems but not fully consumed by mobile yet

- Mobile app access toggle
- Staff invite flow
- Staff password reset request
- Staff permission record:
  - `view_earnings`
  - `view_reviews`
  - `reply_reviews`
  - `view_clients`

### Present in app code but not truly live

- Messages
- Earnings
- Reviews
- Time off request flow
- Explore tab

### Main architectural gap

The tenant dashboard can manage staff app access and staff permissions, but `RifahStaff` does not yet consume those permissions end to end. Hidden sections are mostly hidden by code, not by real tenant policy or subscription gating.

## Product Principles

- Permission-aware: staff only sees what their tenant allowed
- Package-aware: features can be unlocked by subscription when needed
- Fast at shift time: common actions should be 1-2 taps
- Honest UX: unsupported features should not appear
- Mobile-first: strong offline tolerance, smooth refresh, clear loading states
- Operationally safe: auditability for sensitive actions

## Permission and Feature Model

`RifahStaff` should use two layers of gating.

### Layer 1: Employee permissions set by tenant

- `view_earnings`
- `view_reviews`
- `reply_reviews`
- `view_clients`

These should be stored in `staff_permissions` and returned in staff auth/profile payloads.

### Layer 2: Tenant package feature entitlements

Recommended staff-app feature flags:

- `staffApp`
- `staffReviews`
- `staffEarnings`
- `staffMessaging`
- `staffTimeOff`
- `staffClientNotes`
- `staffPushNotifications`

Each visible section in the staff app should require:

- app access enabled
- employee permission if applicable
- package entitlement if applicable

### Recommended visibility rules

- `Today` tab:
  always visible when staff app access exists
- private client notes:
  `view_clients && staffClientNotes`
- `Schedule` tab:
  visible when staff app access exists
- request time off:
  `staffTimeOff`
- `Reviews` tab:
  `view_reviews && staffReviews`
- reply action:
  `reply_reviews && view_reviews && staffReviews`
- `Earnings` tab:
  `view_earnings && staffEarnings`
- `Messages` tab:
  `staffMessaging`

## Phase Plan

## Phase 1: Foundation and Permission Wiring

Goal: make the staff app truly tenant-aware and permission-aware.

### Backend

- Extend staff auth payload in `staffAppController` to include:
  - `permissions`
  - `features`
  - `appAccessEnabled`
- Load `StaffPermission` for the authenticated staff member
- Resolve package entitlements for the staff member's tenant
- Add a shared helper that produces a normalized staff-app capability object

### Mobile

- Update `AuthContext` user model to persist:
  - permissions
  - features
  - capability booleans
- Update tab visibility based on live capability checks
- Remove unconditional hidden-tab behavior where the feature is actually available
- Add a lightweight debug view in profile:
  - tenant name
  - permission flags
  - feature flags

### Tenant dashboard

- Keep the existing App Access and Staff Permissions section
- Add short helper text explaining what each permission unlocks in the staff app

### Success criteria

- Tenant changes a permission
- staff logs in again or refreshes profile
- app shows or hides the related section correctly

## Phase 2: Core Daily Operations

Goal: make `Today` and `Schedule` strong enough for real daily usage.

### Today tab improvements

- Better appointment card design
- Customer avatar/initials
- Payment state badge
- Service duration and amount
- Booking notes visibility only with `view_clients`
- Quick actions:
  - start service
  - complete service
  - no-show
- Pull to refresh
- Empty state with date awareness

### Schedule improvements

- Week view with clear day selector
- Shift blocks
- Break blocks
- Time-off overlays
- Better handling for recurring versus specific shifts

### Backend

- Ensure appointment payload includes all fields needed by mobile
- Ensure schedule response is stable and normalized

### Success criteria

- Staff can run the day from `Today`
- Schedule is trusted by staff without needing tenant dashboard backup

## Phase 3: Reviews and Customer Context

Goal: launch a proper reviews workflow tied to tenant permission settings.

### Backend

- Add staff reviews endpoints, or a filtered tenant review endpoint for staff app
- Return only reviews relevant to the staff member
- Allow reply only if `reply_reviews = true`
- Audit reply actions

### Mobile

- Enable `Reviews` tab only when allowed
- Reviews summary:
  - average rating
  - total count
  - recent reviews
- Reply modal
- Reply history/state

### Tenant/Admin alignment

- Tenant can choose who may view reviews
- Tenant can separately choose who may publicly reply

### Success criteria

- A permitted staff member can view and reply
- A non-permitted staff member never sees the tab or action

## Phase 4: Earnings and Payroll Visibility

Goal: give staff transparent earnings only when tenant allows it.

### Backend

- Add staff payroll/earnings endpoint
- Support:
  - current period summary
  - payroll history
  - base salary
  - commission
  - tips
  - bonuses
  - deductions
  - net total

### Mobile

- Enable `Earnings` tab when `view_earnings && staffEarnings`
- Add current month card
- Payroll history list
- Paid/unpaid/draft states

### Tenant/Admin alignment

- Respect tenant permission first
- Optionally gate by subscription package if payroll is premium

### Success criteria

- Only authorized staff can see earnings
- Numbers match tenant payroll records

## Phase 5: Messaging and Notifications

Goal: make staff communication useful and dependable.

### Backend

- Add staff messages endpoints
- Define sender/recipient rules
- Add read state and pinned state support if desired
- Confirm push notification payloads for staff app

### Mobile

- Restore `Messages` tab when backend is real
- Inbox list
- Message detail
- Unread indicator
- Notification deep links

### Product rules

- Start with tenant-to-staff broadcast or 1:1 operational messages
- Avoid building a full chat product too early

### Success criteria

- Staff receives message notification
- Tapping notification opens the relevant message screen

## Phase 6: Time Off and Availability Management

Goal: complete the schedule lifecycle from staff side.

### Backend

- Add create/list/cancel staff time-off endpoints
- Enforce approval workflow
- Return time-off state in staff schedule feed

### Mobile

- Request time off form
- Time off history
- Pending/approved/rejected states
- Cancellation when allowed

### Tenant dashboard

- Managers approve/reject requests
- Requests affect schedule visibility

### Success criteria

- Staff can submit a request
- Manager can review it
- Approved time off appears correctly in schedule

## Phase 7: Quality, Reliability, and Device UX

Goal: make the app feel polished and trustworthy.

### Technical work

- Global request error normalization
- Retry affordances
- Better offline and token-expiry handling
- Safer image fallbacks
- Stronger safe-area handling on all screens
- Better boot/loading transitions

### UX work

- Better skeleton/loading states
- Strong empty states
- Consistent button language
- Cleaner Arabic/English typography and spacing

### Success criteria

- No hidden dead sections
- Low crash rate
- Low confusion rate during daily use

## Phase 8: Analytics, Operations, and Release Readiness

Goal: treat the staff app like a real product, not just a companion app.

### Instrumentation

- Login success/failure analytics
- Appointment action analytics
- Permission mismatch alerts
- Push registration health

### Operational readiness

- QA checklist per feature
- Staging tenant for staff-app testing
- Release notes and smoke tests

### Success criteria

- We know what is broken before staff tells us
- Every release has a repeatable test plan

## Recommended Build Order

### Wave 1

- Phase 1
- Phase 2

This gets us to a clean, honest, dependable core app.

### Wave 2

- Phase 3
- Phase 4

This adds reviews and earnings with real permission value.

### Wave 3

- Phase 5
- Phase 6

This brings team communication and full schedule lifecycle.

### Wave 4

- Phase 7
- Phase 8

This makes the app premium, resilient, and release-ready.

## Immediate Next Implementation Recommendation

Start with `Phase 1` only.

### Concrete first tasks

1. Add `permissions` and `features` to staff auth/profile payloads
2. Make `RifahStaff` tabs permission-aware
3. Keep `Earnings` hidden until backend is real
4. Enable `Reviews` only when:
   - backend exists
   - tenant allowed it
   - package allows it
5. Make `Today` respect `view_clients` for notes and private client details
6. Add a profile debug section for current capability flags

## Definition of "Best Staff App"

The best version of `RifahStaff` is not the one with the most tabs.
It is the one where:

- every visible feature works
- every hidden feature is hidden for a clear reason
- permissions are respected exactly
- the app helps staff move faster during real work
- tenants trust it enough to run daily operations through it

