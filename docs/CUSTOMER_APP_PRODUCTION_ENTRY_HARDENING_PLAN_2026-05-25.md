# Customer App Entry Flow Hardening Plan (Production Readiness)

## Objective
Refactor customer app startup and auth entry architecture to remove unstable flow behavior, reduce risk before production, and deliver a clean, predictable, premium journey from app launch to Home.

## Current Risk Summary
- App root (`App.tsx`) mixes bootstrap, onboarding, auth, deep links, session restore, and transient flow states.
- Welcome flow is inconsistent (partially reachable, not authoritative).
- Startup routing is over-conditional and hard to reason about.
- Back/forward behavior can feel unstable because routing is state-switch based.

## Target Architecture
- `BootstrapNavigator`:
  - Handles app readiness only (fonts, language hydration, onboarding flag, session check, pending deep-link payload capture).
- `OnboardingNavigator`:
  - Language + onboarding flow only.
- `AuthNavigator`:
  - Welcome, login, register, forgot/reset password, Google onboarding.
- `MainNavigator`:
  - App content (tabs + stack screens).
- `Modal/Deferred Route Handler`:
  - Processes invite/review/gift deep links only after navigator stabilization.

## Non-Goals (for this phase)
- Full redesign of all auth screens.
- Feature changes in booking/payment logic.
- New business logic for OAuth backend.

## Phase 0 - Safety Baseline
1. Create branch and tag current stable baseline.
2. Add lightweight entry-flow logging (development only) for route transitions.
3. Document current deep-link permutations for regression checks.

Exit criteria:
- Baseline reproducible.
- Existing build/test passes.

## Phase 1 - Navigation Decomposition
1. Create new navigators:
   - `src/navigation/BootstrapNavigator.tsx`
   - `src/navigation/OnboardingNavigator.tsx`
   - `src/navigation/AuthNavigator.tsx`
2. Move screen ownership out of `App.tsx` state-switch.
3. Keep `RootNavigator` as app-content stack (post-auth/guest).
4. Keep behavior parity first (no UX policy change yet).

Files expected:
- `RifahMobile/App.tsx` (major simplification)
- `RifahMobile/src/navigation/*.tsx` (new + updates)

Exit criteria:
- Same capabilities, cleaner architecture.
- No route-loss regressions.

## Phase 2 - Welcome Flow Normalization
1. Make Welcome the canonical unauthenticated gateway after onboarding.
2. Route map:
   - First install: `Splash -> Language -> Onboarding -> Welcome`
   - Returning unauthenticated: `Splash -> Welcome`
   - Returning authenticated: `Splash -> Home`
3. Remove dead-route behavior where login/register back path conflicts with startup path.
4. Keep guest access explicit and reachable from Welcome.

Exit criteria:
- Single authoritative entry point for unauthenticated users.
- Predictable back behavior.

## Phase 3 - Deep Link Stabilization
1. Split deep-link handling into two steps:
   - Capture at bootstrap.
   - Resolve after navigation container is ready and user state is known.
2. Rules:
   - Password reset token can open auth reset flow immediately.
   - Invite/review/gift routes are deferred until app shell stable.
3. Add guardrails for invalid/expired payloads with friendly fallback.

Exit criteria:
- No startup route races.
- Deterministic deep-link resolution.

## Phase 4 - Auth Friction Improvements (No Backend Breaks)
1. Keep Google flow but ensure it starts from stable Auth navigator context.
2. Validate “resume interrupted Google onboarding” behavior only inside auth flow.
3. Keep forced auth for protected actions only (booking/payment/reviews/purchases), not for passive browsing.

Exit criteria:
- Users can reach value quickly.
- Auth prompts happen contextually.

## Phase 5 - Production Hardening
1. Add route tests for core entry matrix:
   - First install/new user
   - Returning logged-in
   - Returning logged-out
   - Password reset deep link
   - Invite/review/gift deep links with and without session
2. Add smoke QA checklist for iOS + Android preview builds.
3. Validate localization direction and strings in entry screens.
4. Validate session expiry/app resume behavior.

Exit criteria:
- All critical paths pass on both platforms.
- No blocker defects in entry and auth flows.

## QA Matrix (Must Pass)
- Launch with no language preference.
- Launch with onboarding incomplete.
- Launch with expired session.
- Login email/password success/fail.
- Register success/fail validations.
- Google login success/cancel/error.
- Forgot password request success/fail.
- Reset password via deep link.
- Guest -> Home -> protected action -> auth prompt -> return.
- Deep-link deferred routing after stabilization.

## Rollout Strategy
1. Merge in phases behind safe routing toggles if needed.
2. Ship preview build for QA/UAT.
3. Validate analytics and crash-free startup.
4. Promote to production only after matrix pass.

## Risks and Mitigation
- Risk: route regressions after decomposition.
  - Mitigation: phase-by-phase parity, route matrix tests.
- Risk: deep-link behavior changes.
  - Mitigation: deferred resolver with explicit fallback paths.
- Risk: guest/auth state confusion.
  - Mitigation: single source of truth in auth/session context.

## Suggested Task Breakdown
1. Refactor architecture only (no behavior changes).
2. Normalize Welcome-first unauth flow.
3. Stabilize deep links.
4. Tighten protected-route auth prompts.
5. Execute QA matrix and release gate.

## Definition of Done
- `App.tsx` is no longer a giant screen-state router.
- Welcome is authoritative for unauthenticated users.
- Deep links resolve deterministically.
- Guest and authenticated journeys are both intentional and stable.
- Entry flow passes full QA matrix on iOS and Android preview builds.
