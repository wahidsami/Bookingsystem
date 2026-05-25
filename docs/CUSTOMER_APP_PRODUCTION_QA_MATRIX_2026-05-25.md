# Customer App Production QA Matrix (Entry/Auth/Deep Links)

Date: 2026-05-25
Scope: Customer mobile app startup, onboarding, auth, guest gating, deep links, session recovery.
Related hardening work: Phase 1-4 (`114d040`, `7db5eec`, `7c22312`, `44bd094`)

## Build Under Test
- App: `RifahMobile`
- Profile: `preview`
- Platforms: Android + iOS
- API: `https://rapi.unifinitylab.com/api/v1`

## Pre-Checks
1. Confirm Google env vars are present in EAS target env:
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
2. Confirm test accounts:
   - Existing user account
   - New user account
   - Guest (no login)
3. Confirm backend has sample appointment invite/review/gift claim links.

## A) Entry Flow Matrix

### A1 First Install (no language, no onboarding, no session)
- Steps:
  1. Fresh install
  2. Launch app
- Expected:
  - Splash appears
  - Language screen appears
  - Onboarding flow appears
  - Completion routes to Welcome

### A2 Returning, onboarding complete, no session
- Steps:
  1. Install and complete onboarding
  2. Clear token/session only
  3. Relaunch app
- Expected:
  - Splash -> Welcome

### A3 Returning, active session
- Steps:
  1. Login successfully
  2. Relaunch app
- Expected:
  - Splash -> Home directly

### A4 Session expires while app in background
- Steps:
  1. Login
  2. Invalidate token server-side or wait expiry
  3. Resume app
- Expected:
  - App routes to Auth (Welcome/Login path)
  - No crash/loop

## B) Auth Flow Matrix

### B1 Email login success
- Expected: lands on Home, user data visible.

### B2 Email login invalid password
- Expected: inline error, stays on Login.

### B3 Register success
- Expected: account created, session set, Home opens.

### B4 Forgot password request
- Expected: success message appears.

### B5 Reset password deep link
- Expected:
  - App opens reset screen with token
  - Password reset succeeds
  - User can login with new password

### B6 Google sign in (existing account)
- Expected: direct success path to Home.

### B7 Google sign in (new onboarding-required account)
- Expected:
  - Google -> phone -> OTP -> name (if required)
  - Final success routes to Home

### B8 Google flow interruption recovery
- Steps:
  1. Start Google onboarding
  2. Background/kill app mid-flow
  3. Relaunch
- Expected: onboarding state restores and can continue.

## C) Guest + Protected Actions

### C1 Guest browse home
- Expected: Home/Browse content accessible.

### C2 Guest taps Profile from home header
- Expected: redirected to login flow.

### C3 Guest taps Notifications from home header
- Expected: redirected to login flow.

### C4 Guest opens Bookings tab
- Expected: guest view with login call-to-action.

### C5 Guest opens Purchases tab
- Expected: guest view with login call-to-action.

### C6 Guest attempts booking checkout
- Expected: login required prompt and route to auth.

## D) Deferred Deep-Link Handling

### D1 Invite link when logged out
- Steps:
  1. App closed/logged out
  2. Open invite link
  3. Complete login
- Expected:
  - Link action deferred
  - After auth + nav ready, appointment invite page opens

### D2 Review link when logged out
- Expected: deferred then opens review target after auth.

### D3 Gift claim link when logged out
- Expected: deferred then opens gift claim target after auth.

### D4 Invite/review/gift link while already logged in
- Expected: routes directly once app shell is ready.

### D5 Invalid/expired token payload
- Expected: graceful error message/fallback, no crash.

## E) Navigation Stability

### E1 Back navigation consistency
- Validate:
  - Login/Register/Forgot/Google onboarding back paths
  - No dead-end loops

### E2 Welcome authority
- Validate:
  - Unauthenticated startup goes through Welcome (except explicit reset-password deep link)

### E3 No flicker/race on startup
- Validate:
  - No rapid screen bouncing between auth/home

## F) Push/Session Side Effects

### F1 Login registers push
- Expected: no blocking errors, app usable.

### F2 Logout clears session state cleanly
- Expected: routes to auth and protected actions require login.

## Pass/Fail Record Template

Use this table for execution:

| Case ID | Platform | Result (Pass/Fail) | Notes | Bug ID |
|---|---|---|---|---|
| A1 | Android |  |  |  |
| A1 | iOS |  |  |  |
| ... | ... | ... | ... | ... |

## Release Gate (Must be true)
- All A/B/C/D critical cases pass on Android and iOS.
- No crash in startup/auth/deep-link paths.
- No blocker/critical defects in guest/protected gating.
- Google login validated on both Android and iOS builds.

## Suggested Execution Order
1. Android quick sweep (A->F)
2. iOS quick sweep (A->F)
3. Deep-link focused regression (D)
4. Final smoke pass (A2, A3, B1, B6, C6, D1)
