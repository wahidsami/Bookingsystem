# Apps Deployment Fix Plan

Date: 2026-03-31
Companion report: `APPS_DEPLOYMENT_READINESS_AUDIT_2026-03-31.md`
Goal: make the customer-facing and staff-facing app surfaces deployable without destabilizing the rest of the system

## Key Principle

Do not treat the customer app and staff app as the same kind of deployment problem.

- Customer surface in this repo = web/PWA (`client`)
- Staff surface in this repo = Expo native app (`staff-app`)

That means the plan must split accordingly.

## Track 1: Customer App Decision

## Decision Required

Choose one of these release positions explicitly:

### Option A: Customer app remains web/PWA for this release

Best if:

- you want to deploy fast
- the goal is product correctness first
- store packaging is not required immediately

Effect:

- no native customer-app package work is needed now
- `client` deploys as the customer-facing product

### Option B: Customer app must also go to stores

Best if:

- app-store distribution is a launch requirement

Effect:

- this becomes a new implementation project
- the current `client` app cannot be sent through Expo/EAS as-is

Required work:

- create a new Expo customer app package
- define API/auth/session model for native usage
- recreate the customer flows in native screens

## Recommendation

For the current release program, use Option A:

- deploy `client` as web/PWA
- finish staff native app separately

This avoids mixing stable deployable work with a brand-new native customer-app build.

## Track 2: Staff App MVP

## Objective

Convert `staff-app` from an Expo shell into a minimal real employee app.

## Phase SA-1: Staff Auth Contract

Purpose:

- define how staff sign in safely

Tasks:

- choose staff credential model:
  - email/password
  - phone/password
  - staff code + PIN
- add backend staff auth endpoints
- define access token and refresh behavior for staff
- ensure staff can only access their own tenant-scoped data

Likely backend targets:

- new staff auth controller
- new staff auth routes
- new middleware for authenticated staff sessions
- `Staff` model extension or related auth storage model

Risk:

- Medium to High

## Phase SA-2: Staff App Core Screens

Purpose:

- implement the minimum real employee workflow

Minimum screens:

- login
- today overview
- today’s appointments list
- appointment detail
- schedule / shifts
- basic profile / logout

Risk:

- Medium

## Phase SA-3: Staff Actions

Purpose:

- make the app operational, not just read-only

Recommended MVP actions:

- check in customer
- mark appointment as in progress if needed
- mark completed
- view notes and service details

Optional later:

- breaks/time-off actions
- sales / upsell actions
- staff notifications

Risk:

- Medium

## Phase SA-4: Expo/EAS Production Readiness

Purpose:

- make the native package releasable

Tasks:

- finalize app name and branding
- confirm iOS/Android identifiers
- set production `EXPO_PUBLIC_API_URL`
- add production icons/splash assets if needed
- verify EAS profiles
- run preview builds
- run production builds
- prepare store metadata/submission assets

Risk:

- Low to Medium after MVP is done

## Track 3: Customer App Hardening For Web/PWA Release

## Objective

Treat `client` as the deployable customer product for now and make sure it is clean for QA and production use.

## Phase CA-1: Regression Confirmation

Tasks:

- verify login/register/forgot-password
- verify booking create/view/cancel
- verify product purchase create/view/pay in mock mode
- verify dashboard routes and payment recovery
- verify media loading and public-to-customer navigation

Status:

- mostly completed by Batches A-F, but should be re-run as a release checklist

## Phase CA-2: PWA Readiness

Tasks:

- verify service worker behavior on production domain
- verify manifest and install prompt
- verify icons and splash consistency
- verify logged-in dashboard behavior after install

Risk:

- Low

## Phase CA-3: Customer Native App Decision Gate

Tasks:

- decide whether PWA is sufficient for this release
- if not, open a separate native-customer-app implementation phase rather than overloading the current deployment effort

## Track 4: Residual Repo Cleanup

## Objective

Remove confusion before deployment work continues.

Tasks:

- archive or remove `tenant-dashboard` leftover folder if it is no longer needed
- document clearly that `staff-app` is the only Expo package in repo
- document that `client` is the customer-facing PWA/web app

Risk:

- Low

## Suggested Execution Order

1. Freeze customer app as web/PWA for this release unless you explicitly decide otherwise.
2. Run final customer app regression checklist on the deployed environment.
3. Start staff auth/backend contract work.
4. Build staff MVP screens.
5. Run Expo preview builds for staff.
6. Only after the above, prepare App Store Connect / Play submission flow for staff.

## What Is Blocked Right Now

### Blocked for immediate store deployment

- staff app
- any native customer app

### Not blocked for immediate web deployment

- customer-facing `client` web/PWA app

## Definition Of Done

This app program should be considered complete only when:

- customer app release position is explicitly chosen
- `client` passes full regression as the customer-facing product
- staff auth exists end to end
- staff app has real operational screens
- staff app is connected to secure tenant-scoped APIs
- Expo/EAS preview and production builds succeed
- deployment notes clearly distinguish web/PWA from native apps
