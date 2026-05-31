# Refah Partners - Tenant Mobile App Clone Implementation Plan (2026-05-30)

## App Identity
- Product name: `Refah Partners`
- App type: Tenant operations mobile app
- Primary audience: Tenant owners, managers, front desk, and operational staff

## Goal
Build a mobile app version of the current tenant dashboard with strong parity, prioritizing:
- authentication and secure session handling
- appointments section parity (especially board view behavior)
- operational notifications (cancel/reschedule visibility)

This plan tracks execution in phases with clear acceptance criteria.

---

## Scope
## In Scope (V1)
- Login/auth/session lifecycle
- Tenant selection/switching for multi-tenant users
- Dashboard home (operational summary)
- Appointments module (list + board-style mobile flow + details + actions)
- Notifications/Inbox (cancel, reschedule, operational alerts)
- Core operational sections needed daily by center staff
- Arabic/English with RTL/LTR layout parity

## Out of Scope (V1)
- Full desktop-equivalent deep analytics complexity
- Advanced report builders
- Non-essential admin-only setup flows

---

## Current Web Sections Inventory (Source of Truth)
Based on `tenant/src/components/TenantLayout.tsx`, current tenant dashboard sections are:
- Dashboard
- Catalog: Services, Products, Orders
- Teams (Employees)
- Appointments
- POS / Collections
- Messages
- Customers
- Marketing: Hot Deals, Customer Push, Gift Cards, Reviews, Page Setup
- Billing & Finance: My Bills, My Subscription, Financial
- Payroll
- Reports
- Settings
- QA Checklist

Note:
- Some sections are entitlement/permission-based and may be hidden for specific tenants.

---

## Mobile App Information Architecture (V1)
## Primary Navigation (Bottom Tabs)
- Home
- Appointments
- POS
- Customers
- More

## More Stack
- Employees
- Orders
- Services
- Products
- Messages
- Marketing
- Billing & Finance
- Reports
- Settings
- QA Checklist (internal/admin toggle)

## Dedicated System Areas
- Notifications/Inbox (global bell access)
- Tenant switcher (header-level action)

---

## Architecture and Tech
- React Native + Expo + TypeScript
- React Navigation (tabs + stacks)
- TanStack Query for server state
- Shared API contract reuse from existing backend
- `expo-secure-store` for token/session secrets
- Central i18n + runtime RTL/LTR handling

## Codebase Bootstrap Decision
- Selected base app: `RifahStaff/`
- Reason:
  - already tenant/staff oriented
  - already includes secure-store, i18n, Expo Router patterns
  - faster path to appointments and operations parity than starting greenfield
- Execution path:
  - cloned into dedicated app folder: `RefahPartners/`
  - no further feature implementation should occur inside `RifahStaff/`

---

## Authentication and Session Plan
## Requirements
- Email/phone + password/OTP flow (based on existing backend contract)
- Access token + refresh token lifecycle
- Silent refresh at app bootstrap
- Forced logout when refresh fails
- Secure storage only (no plaintext token persistence)

## Implementation Tasks
- [ ] Add auth module (`login`, `refresh`, `logout`, `me/session`)
- [ ] Add secure token storage service
- [ ] Add auth bootstrap gate screen
- [ ] Add route protection (unauth/auth stacks)
- [ ] Add multi-tenant chooser for users linked to multiple tenants
- [ ] Add logout + token wipe + cache clear

## Acceptance Criteria
- [ ] App restores valid session after restart
- [ ] Expired access token auto-refreshes without user interruption
- [ ] Invalid refresh token redirects to login safely

---

## Appointments Parity Plan (Highest Priority)
## Target
Match current web appointments behavior with mobile-optimized board/list UX.

## Core Features
- Upcoming/day-based appointments
- Status-aware rendering
- Open full appointment details page
- Reschedule/cancel/confirm/check-in/complete actions (as allowed by rules)
- Visible change history indicators (rescheduled/cancelled events)

## Board View Mobile Strategy
Desktop board cannot be copied 1:1 on small screens, so V1 board parity will be:
- provider lane selector (segmented control)
- timeline rows by time
- appointment cards positioned by slot
- quick filters (date, status, provider)
- board/list switch toggle

## Implementation Tasks
- [ ] Build appointments list screen (default)
- [ ] Build board screen with provider lanes and time axis
- [ ] Add filters and sort behavior matching backend capabilities
- [ ] Build appointment details page (not drawer)
- [ ] Wire actions (cancel/reschedule/etc.) to current APIs
- [ ] Show cancellation reason/reschedule metadata in details history

## Acceptance Criteria
- [ ] Staff can identify and act on appointments as fast as web flow
- [ ] Board and list reflect same dataset and status state
- [ ] Action results update UI without stale state

---

## Notifications and Alerting Plan
## Objective
Ensure tenant never misses customer cancellation/reschedule.

## Behavior
- Pull unread operational alerts on app open + interval
- Show badge count in app shell
- Show event cards in inbox feed
- Tap takes user to appointment details
- Mark read per alert and mark-all support

## Implementation Tasks
- [ ] Build notifications inbox screen
- [ ] Connect alert APIs and unread counters
- [ ] Add deep links to appointment detail
- [ ] Add read/unread state handling
- [ ] Add fallback polling if realtime channel is unavailable

## Acceptance Criteria
- [ ] Customer cancel/reschedule appears in tenant app inbox
- [ ] Badge count decreases correctly after read
- [ ] Notification opens the correct appointment record

---

## POS Mobile Plan (Operational Subset in V1)
## V1 Features
- Due now KPI
- Collection queue list
- Open collection flow
- Basic recent transactions

## Later (Phase extension)
- Full closing summary drilldown
- Advanced filters/tabs parity

---

## Localization, RTL/LTR, and Currency
## Required
- True layout mirroring between Arabic and English
- No mixed-direction cards/components
- Unified currency symbol rendering consistent with tenant dashboard

## Implementation Tasks
- [ ] Add global direction manager that reacts to locale changes at runtime
- [ ] Audit card layouts for mirrored alignment
- [ ] Reuse shared currency formatter and enforce Riyal symbol usage
- [ ] Add snapshot tests/checklist for key bilingual screens

## Acceptance Criteria
- [ ] Switching app language updates both text and layout direction
- [ ] Currency is displayed consistently across screens

---

## Security, Logging, and Reliability
- [ ] API error mapping to human-safe operational messages
- [ ] Retry/backoff for transient network issues
- [ ] Client-side event logging for critical auth/appointment actions
- [ ] PII-safe logging rules (no token/secret leak)

---

## Phase Plan and Progress Tracker
## Phase 0 - Foundation
- [x] App identity confirmed (`Refah Partners`)
- [x] App shell and navigation skeleton (Home, Appointments, POS, Customers, More)
- [ ] Theme token refinement and section-level UI system
- [x] Auth bootstrap + secure token storage baseline (existing `AuthContext` + `SecureStore`)

## Phase 1 - Auth and Tenant Context
- [ ] Login/logout/session refresh
- [ ] Tenant selection and tenant-scoped API headers/context

## Phase 2 - Appointments Core
- [ ] Appointments list
- [ ] Appointment details page with actions
- [ ] History badges (rescheduled/cancelled)

## Phase 3 - Appointments Board Parity
- [ ] Board view mobile lanes + timeline
- [ ] Filters/sorting parity
- [ ] Action flow from board cards

## Phase 4 - Notifications and Alerts
- [ ] Inbox feed + unread badge
- [ ] Cancel/reschedule operational alerts with deep links

## Phase 5 - POS + Customers Essentials
- [ ] POS queue basics
- [ ] Customers list/detail essentials

## Phase 6 - Localization, Currency, and QA Hardening
- [ ] RTL/LTR runtime switching verification
- [ ] Currency consistency audit
- [ ] Regression pass and release checklist

---

## Backend/API Validation Checklist
Run and confirm before each dependent phase:
- [ ] Auth endpoints and refresh behavior stable for mobile
- [ ] Appointments board/list endpoints expose needed filters
- [ ] Alert/inbox endpoints return cancel/reschedule events reliably
- [ ] Permission/entitlement payload available for feature gating
- [ ] Tenant-scoped access control is enforced server-side

---

## DB/Migration Notes
For this mobile app clone plan itself:
- No new SQL migration is required immediately.

Already relevant existing foundation (from prior work):
- `appointment_events`
- `tenant_operational_alert_reads`

If future features require richer mobile-specific audit/read models, add migrations in a separate phase document.

---

## Release Readiness Checklist
- [ ] Production build succeeds (Android/iOS)
- [ ] Auth/session stress test completed
- [ ] Appointments actions validated against live staging data
- [ ] Notifications verified for cancel/reschedule events
- [ ] RTL/LTR and currency checks passed
- [ ] Crash-free smoke run and sign-off complete

---

## Notes
- Keep parity with current web behavior first; avoid introducing behavior drift.
- Optimize for operational speed and clarity over decorative UI.
- Any endpoint gaps discovered during implementation should be logged and resolved in backend parity sub-tasks.
