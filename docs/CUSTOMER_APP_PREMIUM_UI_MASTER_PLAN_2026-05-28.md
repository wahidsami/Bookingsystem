# Customer App Premium UI Master Plan (2026-05-28)

## Goal
Upgrade the customer app to a unified premium visual system (luxury wellness feel) across all high-impact user journeys without breaking business logic.

## Design Principles
- Premium, calm, emotionally warm
- High conversion clarity (book/buy/pay actions always obvious)
- Strong visual hierarchy with consistent cards/chips/buttons
- Full RTL/LTR parity
- Safe-area aware sticky actions on mobile

## Global Rules
- Keep business flows unchanged first, improve UI shell/UX hierarchy
- Reuse centralized tokens from `RifahMobile/src/theme/colors.ts`
- Validate each phase with `npm run typecheck`
- After each phase: commit + push + mark milestone status

## Implementation Order

### Phase 0: Foundation and Standards
Status: `Completed`
- [x] Single source of truth tokens confirmed in `colors.ts`
- [x] Premium direction finalized for tenant pages
- [x] Baseline for tab/page hierarchy established

### Phase 1: Discovery and Booking Entry (Highest Conversion)
Status: `In Progress`
Scope:
- `HomeScreen`
- `HomeHeader`
- `SectionHeader`
- `BrowseScreen`
- `BookingFlow`

Targets:
- Premium first impression
- Better section hierarchy and hero storytelling
- Clear “start booking” cues

### Phase 2: Tenant Experience (In-center Brand Space)
Status: `Completed`
Scope:
- `TenantScreen` tabs (`Services`, `Gift Cards`, `Reviews`, `About`, `Products`)
- `ServiceDetailsScreen` (dedicated)
- `ProductDetailsScreen` (dedicated)
- `EmployeeProfileScreen` (premium)

### Phase 3: Conversion to Payment
Status: `Pending`
Scope:
- `CartScreen`
- `PaymentScreen`
- `PaymentSimulatorScreen`
- `GiftsScreen` purchase/send drawers

Targets:
- Reduce payment friction
- Improve form usability and trust cues

### Phase 4: Post-Purchase and Retention
Status: `In Progress`
Scope:
- `BookingsScreen`
- `PurchasesScreen`
- `NotificationsScreen`
- `NotificationDetailScreen`

Targets:
- Better status readability
- Premium timeline/cards for history and tracking

### Phase 5: Account and Settings
Status: `Pending`
Scope:
- `MoreScreen`
- `ProfileScreen`
- `EditProfileScreen`
- `SettingsScreen`

Targets:
- Premium identity and account management experience

### Phase 6: Auth and Onboarding
Status: `Pending`
Scope:
- `SplashScreen`
- `OnboardingScreens`
- `WelcomeScreen`
- `LoginScreen`
- `RegisterScreen`
- `GoogleOnboardingScreen`
- `ForgotPasswordScreen`
- `ResetPasswordScreen`

Targets:
- Trust-first onboarding and login journey
- Reduced auth confusion

## Acceptance Criteria Per Phase
- Visual style aligned with premium system
- No break in navigation/business logic
- RTL/LTR verified
- TypeScript check passes
- Commit pushed and phase checklist updated

## Progress Tracker
- Phase 0: `100%`
- Phase 1: `70%` (Home + Browse + BookingFlow premium shell upgraded)
- Phase 2: `100%`
- Phase 3: `100%` (CartScreen + PaymentScreen + PaymentSimulatorScreen + GiftsScreen drawers premium shell completed)
- Phase 4: `75%` (Bookings + Purchases + Notifications screens premium shell upgraded)
- Phase 5: `0%`
- Phase 6: `0%`

## Current Step
Continue Phase 3 with `PaymentScreen`, then `PaymentSimulatorScreen`, then `GiftsScreen` drawers.
