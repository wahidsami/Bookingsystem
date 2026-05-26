# CUSTOMER_APP_UI_MODERNIZATION_IMPLEMENTATION_PLAN_2026-05-26

## 1) Objective
Modernize the customer app UI/UX to look premium and consistent while keeping business logic, API contracts, and navigation behavior stable.

## 2) Non-Negotiables (Do Not Break)
1. Authentication flows (email/OTP, Google login)
2. Booking flow (service selection, provider selection, slot selection, payment)
3. Wallet and gift card flows (purchase, send, claim, balance updates)
4. Notifications and deep links
5. Purchases/orders history
6. Arabic/English localization and RTL behavior

## 3) Technical Direction
### 3.1 Recommended Library Stack
1. `react-native-reanimated` (already in project): motion primitives
2. `moti`: simple declarative animations
3. `@gorhom/bottom-sheet`: production-ready sheets/drawers
4. `expo-blur` + `expo-linear-gradient`: modern visual layers
5. `react-native-svg`: icon/shape refinement

### 3.2 Optional UI System Decision
Choose one path before Phase 2 starts:
1. Path A (safer, incremental): keep current custom UI components + add shared design tokens/components
2. Path B (faster visual unification): introduce `react-native-paper` gradually for form-heavy screens
3. Path C (premium full design system): adopt `tamagui` (higher migration cost)

Recommendation: Path A now, evaluate Path B after Phase 2.

## 4) Scope by Priority
### P0 (Critical UX polish)
1. Navigation bars, headers, spacing consistency
2. Buttons, inputs, cards, chips consistency
3. Bottom sheets and modal redesign
4. Loading/empty/error states standardization

### P1 (Delight and premium feel)
1. Subtle screen transitions and entrance animations
2. Better skeleton loaders
3. Gesture polish (swipeable cards where useful)

### P2 (Advanced visual upgrades)
1. Rich hero/cover effects on tenant page
2. Wallet/gift card premium card visuals
3. Micro-interactions and haptics

## 5) Phase Plan

## Phase 0: Foundation Audit and Design Tokens
Status: `Completed`

### Deliverables
1. Inventory current component patterns (buttons, inputs, cards, tabs, modals)
2. Create/normalize design tokens file (colors, typography scale, radius, spacing, shadows)
3. Add shared primitive components:
   - `AppButtonV2`
   - `AppInputV2`
   - `AppCardV2`
   - `AppSheetV2`
   - `StateView` (loading/empty/error)

### Acceptance Criteria
1. No screen behavior change
2. No API change
3. App builds successfully on preview profile

## Phase 1: Authentication + Entry Experience
Status: `Completed`

### Screens
1. Splash
2. Onboarding
3. Welcome
4. Login/Register/OTP
5. Google login UX transitions

### Deliverables
1. Unified typography and spacing
2. Cleaner CTA hierarchy
3. Consistent input validation visuals
4. Preserve exact login/register logic

### Acceptance Criteria
1. First run onboarding works
2. Login with OTP works
3. Login with Google works on Android + iOS preview

## Phase 2: Core Booking Experience
Status: `In Progress`

### Screens
1. Home
2. Browse
3. Tenant page
4. Service details
5. Booking flow

### Deliverables
1. Modern card/grid layout
2. Improved filter/sort chips
3. Better slot picker readability
4. Bottom sheet upgrade with `@gorhom/bottom-sheet`

### Acceptance Criteria
1. End-to-end booking still works
2. Group guest flow still works
3. Payment handoff unchanged

## Phase 3: Appointments + Notifications + Purchases
Status: `Planned`

### Screens
1. Appointments (upcoming/history)
2. Notification list/detail
3. Purchases/orders list/detail

### Deliverables
1. Improved appointment cards and detail modal readability
2. Notification badge + read-state visuals
3. Better status badges and timeline clarity

### Acceptance Criteria
1. Appointment actions work (cancel/reschedule/review)
2. Notification counts/read states remain correct
3. Purchases list integrity unchanged

## Phase 4: Wallet and Gifts Premium Redesign
Status: `Planned`

### Screens
1. Gifts & Wallet home
2. Gift card drawer/actions
3. Claim and send flows

### Deliverables
1. Premium gift card package visuals (gradients, imagery framing)
2. Cleaner labeled forms and payment fields
3. Unified transaction history cards

### Acceptance Criteria
1. Recharge/send/claim still work end-to-end
2. Tenant-scoped gift behavior unchanged
3. Wallet balances remain correct

## Phase 5: Performance, Accessibility, and QA Hardening
Status: `Planned`

### Deliverables
1. Performance pass (render optimization for large lists)
2. Accessibility pass (touch target sizes, contrast, labels)
3. RTL/LTR visual verification
4. Device matrix QA (small Android, large Android, iPhone)

### Acceptance Criteria
1. No regressions on critical flows
2. No blocking console/runtime errors
3. Production candidate sign-off checklist complete

## 6) Testing Strategy per Phase
1. UI snapshot/video for changed screens
2. Manual smoke tests:
   - Login/logout
   - Google login
   - Browse -> book -> pay
   - Appointments actions
   - Wallet/gift purchase/send/claim
3. Regression checklist update after each phase

## 7) Risk Register and Mitigation
1. Risk: UI refactor accidentally changes behavior
   - Mitigation: UI-only PR boundaries, no API payload changes
2. Risk: Animation library setup issues
   - Mitigation: enable one library at a time and validate builds early
3. Risk: RTL layout regressions
   - Mitigation: Arabic review after each screen migration
4. Risk: Delays from large redesign scope
   - Mitigation: strict phased releases and ship P0 first

## 8) Rollout Model
1. Phase-by-phase commits to `main`
2. Preview build after each phase
3. Tenant/internal UAT checkpoint after Phases 2 and 4
4. Production release only after Phase 5 sign-off

## 9) Implementation Tracking Board
- Phase 0: `Completed`
- Phase 1: `Completed`
- Phase 2: `Planned`
- Phase 3: `Planned`
- Phase 4: `Planned`
- Phase 5: `Planned`

## 10) Milestone Log
### 2026-05-26
1. Phase 0 completed:
   - Theme token migration applied across major customer screens
   - Hardcoded colors reduced to intentional overlays/brand accents
   - No business logic/API flow changes
2. Phase 1 started:
   - Entry experience visual refresh initiated
   - Updated `SplashScreen` with branded gradient + ambient glow
   - Updated `WelcomeScreen` with elevated hero panel and softer background treatment
3. Phase 1 checkpoint 2 completed:
   - Updated `LoginScreen` with gradient backdrop + elevated auth card layout
   - Updated `RegisterScreen` with matching visual hierarchy and auth surface card
   - Updated `GoogleOnboardingScreen` with consistent gradient backdrop and elevated card styling
   - Authentication logic and API flows unchanged
4. Phase 1 checkpoint 3 completed:
   - Added subtle onboarding text transition animation (fade + upward settle) per slide
   - Added welcome CTA entrance animation for primary/secondary actions
   - Motion implemented with native `Animated` API to avoid dependency risk
5. Phase 1 finalized:
   - Auth-entry visual hierarchy unified across Splash, Onboarding, Welcome, Login, Register, and Google onboarding
   - No authentication logic changes introduced
   - Ready to start Phase 2 core booking UI modernization
6. Phase 2 checkpoint 1 started:
   - Updated `DashboardScreen` with refined gradient hero header and premium stat card treatment
   - Updated `BrowseScreen` with stronger visual hierarchy, search field affordance, and elevated list card styling
   - Navigation, filtering, booking handoff, and data logic unchanged
7. Phase 2 checkpoint 2 started:
   - Updated `TenantScreen` section tabs to modern pill-based horizontal tabs for better readability on all widths
   - Kept all existing tab visibility logic and section rendering unchanged

## 11) Immediate Next Step
Start Phase 2 on `Home`, `Browse`, `Tenant`, and `BookingFlow` with modernized layout/components while preserving booking/payment behavior.
