# Apps Deployment Readiness Audit

Date: 2026-03-31
Repository: `d:\Waheed\Refah\Bookingsystem`
Purpose: double-check the customer-facing app and the staff app before any app-store or mobile deployment work
Companion docs:

- `SYSTEM_QA_AUDIT_2026-03-31.md`
- `SYSTEM_QA_FIX_PLAN_2026-03-31.md`
- `SYSTEM_QA_EXECUTION_ROADMAP_2026-03-31.md`

## Executive Summary

The customer-facing experience and the staff app are not in the same readiness category.

- The customer-facing surface in this repo is `client`, a Next.js web app with PWA behavior.
- The only real native mobile package in this repo is `staff-app`, an Expo app.
- There is no second Expo/native customer app package in this repo today.

That means:

1. The customer-facing product is now in much better shape for web/PWA deployment after Batches A-F.
2. The staff app is still not ready for store deployment as a real business app.
3. If you want both customer and staff in Apple App Store / Google Play using Expo/EAS, the staff side can evolve from the current package, but the customer side would require a separate native app package or a deliberate wrapper strategy because `client` is not an Expo app.

## Scope Reviewed

- `client`
- `staff-app`
- `tenant-dashboard` leftover folder
- related backend staff endpoints and models
- existing QA audit/fix-plan docs

## What Is Actually In The Repo

### Customer-facing app

Path:

- `client`

Reality:

- Next.js application
- includes PWA install behavior
- includes `manifest.json`
- includes service worker registration prompt via `PWAInstaller`
- not an Expo app
- not a React Native app

Evidence:

- `client/package.json`
- `client/src/components/PWAInstaller.tsx`
- `client/public/manifest.json`

Conclusion:

- This is a web/PWA customer app, not a native store app package.

### Staff app

Path:

- `staff-app`

Reality:

- Expo app with `app.config.js`
- EAS config present
- Android/iOS identifiers already defined
- currently only a health-check shell

Evidence:

- `staff-app/package.json`
- `staff-app/app.config.js`
- `staff-app/eas.json`
- `staff-app/App.tsx`

Conclusion:

- This is the only native app package currently suitable as a base for Expo/EAS builds.

### `tenant-dashboard`

Path:

- `tenant-dashboard`

Reality:

- not a full app package
- no `package.json`
- contains only two leftover hot-deal pages

Conclusion:

- This is not a deployable app surface and should not be treated as one.

## Customer App Audit

## Current State

Status:

- Functionally improved and build-clean as a web/PWA surface

Verified:

- `client` production build passes
- booking flow was stabilized in Batch C
- purchasing flow was stabilized in Batch D
- deployment wiring and cross-surface links were normalized in Batch A/B
- final warning cleanup was done in Batch F

## What Is Good

- Real authenticated customer journeys exist:
  - login
  - registration
  - forgot password
  - dashboard
  - bookings
  - purchases
  - payment pages
- PWA behavior exists:
  - install prompt
  - manifest
  - service worker registration
- Environment-driven API wiring now exists instead of production hardcoded localhost routing

## Important Limitation

The customer app is not currently an Expo/native mobile app.

That means:

- You cannot take `client` and build it on Expo.dev as-is.
- You can deploy it as web/PWA.
- If you want App Store Connect / Play Store distribution for customers, that is a new product packaging phase, not just a deployment step.

## Remaining Customer-App Risks

### APP-001: Customer app is web/PWA only, not native

Severity: High for app-store ambition

Impact:

- Store deployment for customers is blocked by packaging, not by web feature completeness.

Needed if native customer app is required:

- create a dedicated Expo customer app
- or choose a wrapper strategy explicitly

### APP-002: Customer auth still uses browser token storage

Severity: Medium

Evidence:

- `client/src/lib/api.ts`
- `client/src/contexts/AuthContext.tsx`

Impact:

- Acceptable for current web deployment phase, but not ideal long term.
- Should remain on the hardening backlog if customer app becomes a long-lived primary surface.

### APP-003: Customer app PWA quality is stronger than before, but still web-first

Severity: Low to Medium

Evidence:

- `client/src/components/PWAInstaller.tsx`
- `client/public/manifest.json`

Impact:

- Installable web app is viable.
- This still does not equal native mobile capability such as store packaging, native notifications, or secure native auth/session patterns.

## Staff App Audit

## Current State

Status:

- Native shell exists
- business app does not yet exist

What is already present:

- Expo app config
- EAS profiles
- Android package name
- iOS bundle identifier
- API URL env support
- API health ping

What is not present:

- staff login
- staff session management
- staff home/dashboard
- today’s appointments
- shift/schedule screens
- appointment check-in/status workflow
- secure role-scoped backend API contract for staff mobile usage

## Staff App Blockers

### APP-004: Staff app is still a scaffold

Severity: Critical

Evidence:

- `staff-app/App.tsx`

Observed:

- The app only displays API URL, ping button, and placeholder copy saying login/schedules will connect later.

Impact:

- This cannot be published as a real staff app yet.

### APP-005: No real staff authentication model exists end to end

Severity: Critical

Evidence:

- `staff-app/App.tsx`
- `server/src/routes/staffRoutes.js`
- `server/src/controllers/staffController.js`
- `server/src/models/Staff.js`

Observed:

- Backend `staffRoutes` expose generic list/create/availability routes, not a staff login/session model.
- `Staff` model has profile/work data but no password, PIN, session, or auth fields.

Impact:

- A real staff mobile app cannot safely exist without first defining how staff authenticate.

### APP-006: Existing staff backend routes are not mobile-staff-safe

Severity: High

Evidence:

- `server/src/routes/staffRoutes.js`
- `server/src/controllers/staffController.js`

Observed:

- routes are public/generic
- no tenant scoping enforcement in route layer
- no staff self-service auth boundary

Impact:

- Even if mobile screens were built today, the API contract is not ready for secure production staff usage.

### APP-007: Staff app local/dev defaults still assume localhost

Severity: Medium

Evidence:

- `staff-app/src/config/env.ts`
- `staff-app/app.config.js`
- `staff-app/.env.example`

Impact:

- Fine for local development
- must be overridden in Expo/EAS env before any real build

Note:

- This is expected, but it reinforces that Expo build env setup is mandatory.

## Deployment Implications

## What can be deployed now

- `client` as a web/PWA customer app
- `admin`, `tenant`, `PublicPage`, and `server` as the current system stack

## What cannot be confidently store-deployed yet

- `staff-app` as a real production staff app
- any native customer app, because no Expo/native customer package exists in this repo

## Expo/EAS Truth

Your current Expo/EAS workflow applies to:

- `staff-app`

It does not apply to:

- `client`

unless you first create a native customer app package.

## Recommended Release Position Right Now

### Customer side

Release-ready direction:

- web deployment
- PWA install support

Not yet release-ready direction:

- native store deployment, because the native package does not exist

### Staff side

Not release-ready yet.

Reason:

- the app package exists, but the product, auth model, and backend contract are still incomplete

## Final Conclusion

After Batches A-F, the customer-facing web/PWA app is on solid enough ground to proceed toward deployment and QA testing.

The staff app is still a planned product surface rather than a finished one.

If your immediate goal is:

- deploy the full web system now: yes, that is realistic
- ship both customer and staff to app stores now: no, not yet

The next safe move is an app-specific implementation plan:

1. Decide whether customer mobile means PWA only or a real native customer app.
2. Build the missing staff auth and staff workflows end to end.
3. Only then begin Expo/EAS production build and store submission work for staff.
