# RifahMobile Fix Plan

Date: 2026-03-31
Companion report: `RIFAH_MOBILE_AUDIT_2026-03-31.md`
Goal: bring the native customer app to a safe, deployable state without breaking the now-stabilized backend and web system

## Guiding Principle

Do not treat `RifahMobile` as a greenfield build.

It already contains meaningful product work, but it must now be brought back into alignment with:

- the current backend
- the fixed booking flow
- the fixed purchasing flow
- the current environment/deployment strategy

## Phase M1: Environment And Boot Safety

Purpose:

- stop destructive/dev-only behavior and make the app environment-correct

Tasks:

- remove `AsyncStorage.clear()` from startup path
- replace hardcoded `SERVER_URL` and `API_BASE_URL`
- create a proper native env config layer
- support:
  - local emulator
  - physical device on LAN
  - VPS production API
- normalize media URL generation

Targets:

- `RifahMobile/App.tsx`
- `RifahMobile/src/api/client.ts`
- `.env` handling
- Expo config if needed

Success criteria:

- app no longer resets itself on every launch
- API base can be changed without code edits
- production build can target VPS API URL cleanly

## Phase M2: Type And Contract Cleanup

Purpose:

- make the app build-safe before feature verification

Tasks:

- fix TypeScript module/config issue
- fix `ThemedText` typing
- add missing translation keys
- fix missing imports like `getImageUrl`
- remove obviously stale type assumptions

Success criteria:

- `tsc --noEmit` passes

## Phase M3: Auth And Session Architecture

Purpose:

- make native login/session behavior reliable

Tasks:

- replace manual top-level screen switching with a real auth-state app shell
- add boot-time session restoration from `SecureStore`
- define authenticated vs guest routing explicitly
- verify logout behavior

Success criteria:

- app opens to correct screen based on persisted state
- login/register/logout flows are stable

## Phase M4: Booking Flow Re-Alignment

Purpose:

- match the fixed backend/web booking behavior

Tasks:

- audit native booking creation against current backend endpoints
- verify staff scoping, slot loading, booking creation, and booking detail rendering
- verify booking cancellation
- verify payment-state display aligns with backend statuses

Targets:

- `RifahMobile/src/screens/BookingFlow.tsx`
- `RifahMobile/src/screens/BookingsScreen.tsx`

Success criteria:

- booking flow works end to end with the same logic as the web customer app

## Phase M5: Purchasing Flow Re-Alignment

Purpose:

- match the fixed backend/web purchasing behavior

Tasks:

- audit native cart, order creation, purchases list, and order detail
- align native payment behavior with current mock-payment strategy
- decide whether `PaymentSimulatorScreen` stays temporarily or is replaced by the same mock payment contract used elsewhere
- fix any outdated order item / image / payment-state handling

Targets:

- `RifahMobile/src/screens/CartScreen.tsx`
- `RifahMobile/src/screens/PurchasesScreen.tsx`
- `RifahMobile/src/screens/PaymentScreen.tsx`
- `RifahMobile/src/screens/PaymentSimulatorScreen.tsx`

Success criteria:

- native purchases reflect current backend order behavior
- no outdated or broken recovery logic remains

## Phase M6: Remove Runtime Mock Data

Purpose:

- eliminate fake production content

Tasks:

- replace `getTopProviders()` placeholder data with real endpoint support or hide the section
- remove mock/fallback tenant assumptions
- review placeholder content across home/tenant flows

Success criteria:

- no active runtime mock data remains in native customer app

## Phase M7: Expo/EAS Release Readiness

Purpose:

- prepare the app for actual build/submission workflow

Tasks:

- add proper `eas.json`
- verify/create real Expo project linkage
- fix `projectId`
- define preview and production profiles
- wire production API env values
- verify icons, splash, fonts, bundle identifiers, versioning

Success criteria:

- preview build works
- production build config is valid

## Recommended Batch Order

### Batch RM-A

- Phase M1
- Phase M2

Goal:

- make the native app safe to work on and build-checkable

### Batch RM-B

- Phase M3

Goal:

- make auth/session behavior stable

### Batch RM-C

- Phase M4

Goal:

- align booking with fixed backend/web flow

### Batch RM-D

- Phase M5

Goal:

- align purchases/payment with fixed backend/web flow

### Batch RM-E

- Phase M6
- Phase M7

Goal:

- remove fake runtime content and make Expo/EAS release-ready

## Definition Of Done

`RifahMobile` should only be considered ready when:

- it is environment-driven
- it is type-clean
- it does not wipe state on startup
- booking works end to end
- purchases work end to end
- no live runtime mock data remains
- Expo/EAS production config is valid
- preview build succeeds against the VPS API
