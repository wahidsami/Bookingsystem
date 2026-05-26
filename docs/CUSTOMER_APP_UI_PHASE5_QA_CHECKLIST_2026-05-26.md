# CUSTOMER_APP_UI_PHASE5_QA_CHECKLIST_2026-05-26

## Purpose
Final production-readiness checklist for the Customer App UI modernization.

## Build Gate
1. TypeScript check (`npm run typecheck`): `PASS` (2026-05-26)
2. Critical runtime token fix (`AppointmentInviteScreen`): `PASS` (applied and pushed)

## A) Authentication & Session
1. Splash -> onboarding first run flow: `PENDING_MANUAL`
2. Login with OTP (existing account): `PENDING_MANUAL`
3. Register + OTP + profile completion: `PENDING_MANUAL`
4. Google login (Android): `PENDING_MANUAL`
5. Google login (iOS): `PENDING_MANUAL`
6. Session expiry -> relogin behavior: `PENDING_MANUAL`

## B) Booking Core Flow
1. Browse tenant -> open service -> start booking: `PENDING_MANUAL`
2. Staff selection + date/time slot selection: `PENDING_MANUAL`
3. Review step UI + notes: `PENDING_MANUAL`
4. Group guest entry and submission: `PENDING_MANUAL`
5. Pay-at-center booking flow: `PENDING_MANUAL`
6. Online full payment handoff flow: `PENDING_MANUAL`
7. Booking-fee handoff flow: `PENDING_MANUAL`

## C) Appointments
1. Upcoming bookings list render: `PENDING_MANUAL`
2. History bookings list render: `PENDING_MANUAL`
3. Booking details modal readability/actions: `PENDING_MANUAL`
4. Cancel action behavior: `PENDING_MANUAL`
5. Reschedule action behavior: `PENDING_MANUAL`
6. Review action behavior: `PENDING_MANUAL`

## D) Notifications
1. Notification list hierarchy/readability: `PENDING_MANUAL`
2. Notification detail page hierarchy/readability: `PENDING_MANUAL`
3. Read-state handling/unread count behavior: `PENDING_MANUAL`
4. Tenant/service deep link from notification: `PENDING_MANUAL`

## E) Purchases
1. Purchases list card readability: `PENDING_MANUAL`
2. Pending payment CTA behavior: `PENDING_MANUAL`
3. Cancel purchase where allowed: `PENDING_MANUAL`

## F) Wallet & Gifts
1. Wallet/gifts home visuals and readability: `PENDING_MANUAL`
2. Package select -> action drawer UI clarity: `PENDING_MANUAL`
3. Self recharge form submission: `PENDING_MANUAL`
4. Send gift flow (email/phone recipient): `PENDING_MANUAL`
5. Claim gift token flow: `PENDING_MANUAL`
6. Tenant gift-card mode (`tenantId`) behavior: `PENDING_MANUAL`

## G) Localization & Layout
1. English LTR layout pass (primary screens): `PENDING_MANUAL`
2. Arabic RTL layout pass (primary screens): `PENDING_MANUAL`
3. Text clipping/overflow on small screens: `PENDING_MANUAL`

## H) Device Matrix
1. Android small screen: `PENDING_MANUAL`
2. Android large screen: `PENDING_MANUAL`
3. iPhone standard: `PENDING_MANUAL`
4. iPhone Plus/Max: `PENDING_MANUAL`

## I) Production Sign-Off Criteria
1. No blocking runtime errors/crashes in smoke flows: `PENDING_MANUAL`
2. No visual blocking regressions in core flows: `PENDING_MANUAL`
3. Stakeholder UAT approval: `PENDING_MANUAL`

## Current Release Recommendation (2026-05-26)
1. `Preview rebuild`: `READY`
2. `Production release`: `WAIT_FOR_MANUAL_PHASE5_SIGNOFF`
