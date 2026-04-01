# RifahMobile Audit

Date: 2026-03-31
Repository path: `d:\Waheed\Refah\Bookingsystem\RifahMobile`
Purpose: verify the missing native customer app package and assess deployment readiness

## Executive Summary

`RifahMobile` is the real native customer app package that was missing from the earlier repo scan.

It is a genuine Expo/React Native app and it is more advanced than a blank scaffold:

- onboarding exists
- login and registration screens exist
- home, tenant, booking, cart, purchases, profile, and payment-related screens exist
- navigation exists
- secure token storage is partially implemented with `expo-secure-store`

However, it is not ready for Expo/EAS production deployment yet.

The biggest blockers are:

1. API wiring is hardcoded to local/LAN IPs instead of environment-driven production configuration.
2. The app forcibly clears local storage on startup, which resets state every launch.
3. TypeScript currently fails.
4. Several screens still use placeholder or mock logic.
5. Some flow wiring lags behind the web fixes already completed in `client`.
6. EAS production configuration is incomplete or invalid.

## Confirmed App Identity

Evidence:

- `RifahMobile/package.json`
- `RifahMobile/app.json`
- `RifahMobile/App.tsx`

Observed:

- Expo app
- iOS bundle identifier: `com.refah.mobile`
- Android package: `com.refah.mobile`
- React Native navigation structure exists
- multiple customer screens exist

Conclusion:

- This is the native customer app.

## Build And Configuration Findings

### RM-001: TypeScript does not pass

Severity: Critical

Evidence:

- `RifahMobile/.\\node_modules\\.bin\\tsc --noEmit`

Observed:

- TypeScript fails in multiple files
- translation keys are missing
- `getImageUrl` is missing in `PurchasesScreen`
- `ThemedText` typing has spread issues
- tsconfig / Expo module settings are not currently clean

Impact:

- The app is not in a trustworthy release state.
- Future fixes are riskier until the native app is type-clean.

### RM-002: API URL is hardcoded in code

Severity: Critical

Evidence:

- `RifahMobile/src/api/client.ts`
- `SERVER_URL = 'http://192.168.0.100:5000'`

Impact:

- The native app will break outside that exact local network setup.
- This blocks real device testing on staging/production and blocks store deployment.

### RM-003: `.env` exists but is not the effective source of truth

Severity: High

Evidence:

- `RifahMobile/.env`
- `RifahMobile/src/api/client.ts`

Observed:

- `.env` uses `API_URL=http://10.0.2.2:5000/api/v1`
- runtime client ignores it and instead hardcodes a different LAN IP

Impact:

- Environment setup is misleading.
- Developers can believe they changed the API URL while the app still points elsewhere.

### RM-004: EAS configuration is incomplete

Severity: High

Evidence:

- `RifahMobile/app.json`

Observed:

- no `eas.json` file found in this app package
- `extra.eas.projectId` is `refah-mobile-app`, not a real Expo UUID-style project ID

Impact:

- Expo/EAS production build/submission setup is not ready.

## Runtime And UX Findings

### RM-005: App wipes local state on every startup

Severity: Critical

Evidence:

- `RifahMobile/App.tsx`
- `await AsyncStorage.clear();`

Impact:

- onboarding, auth, cart, language, and persisted state are reset every launch
- this makes the app behave like a development prototype, not a releasable app

### RM-006: Debug logging is still heavy in production paths

Severity: Medium

Evidence:

- `RifahMobile/App.tsx`
- `RifahMobile/src/api/client.ts`
- `RifahMobile/src/screens/LoginScreen.tsx`
- `RifahMobile/src/screens/HomeScreen.tsx`
- `RifahMobile/src/screens/TenantScreen.tsx`
- other screens/components

Impact:

- noisy logs
- production telemetry confusion
- possible leakage of sensitive request context during debugging

### RM-007: Dev bypass login exists

Severity: High

Evidence:

- `RifahMobile/src/screens/LoginScreen.tsx`

Observed:

- `__DEV__` bypass creates fake tokens and mock user session

Impact:

- acceptable for local development
- must never be allowed to leak into production assumptions or QA signoff

Note:

- because it is gated by `__DEV__`, it is lower risk than an always-on bypass, but still needs explicit release discipline

## Business Logic And Flow Findings

### RM-008: Top providers section still uses placeholder runtime data

Severity: High

Evidence:

- `RifahMobile/src/api/client.ts`
- `getTopProviders()`

Observed:

- returns hardcoded provider list
- comment explicitly says backend endpoint is not built

Impact:

- homepage contains fake runtime content
- violates the “no mock data in production logic” goal

### RM-009: Payment simulator flow still exists in live navigation

Severity: High

Evidence:

- `RifahMobile/src/navigation/RootNavigator.tsx`
- `RifahMobile/src/screens/PaymentSimulatorScreen.tsx`
- `RifahMobile/src/screens/CartScreen.tsx`

Impact:

- demo payment behavior is still structurally exposed in native flow
- this may be acceptable for current mock-payment phase, but it must be intentionally controlled and clearly aligned with the web payment strategy

### RM-010: Tenant screen still contains fallback/mock assumptions

Severity: High

Evidence:

- `RifahMobile/src/screens/TenantScreen.tsx`

Observed:

- comments reference fetching a specific tenant “otherwise mock”
- hardcoded `http://10.0.2.2:5000` media usage remains
- fallback logic appears older than the current web implementation

Impact:

- native customer experience is not yet aligned with the stabilized web customer flow

### RM-011: Native app likely lags behind recent web booking and purchase fixes

Severity: High

Evidence:

- web customer app was actively stabilized in Batches C, D, and F
- native app code still contains older mock/local assumptions

Impact:

- even where screens exist, native behavior may not match the now-correct backend contracts
- booking, purchases, payment recovery, and media rendering need fresh end-to-end validation

## Auth And Session Findings

### RM-012: Session persistence model exists, but app architecture is still screen-state driven

Severity: Medium

Evidence:

- `RifahMobile/src/api/client.ts`
- `RifahMobile/App.tsx`
- `RifahMobile/src/screens/LoginScreen.tsx`
- `RifahMobile/src/screens/RegisterScreen.tsx`

Observed:

- tokens are stored in `expo-secure-store`
- user is stored in AsyncStorage
- but top-level app flow still manually pushes between welcome/login/register/home screen state

Impact:

- auth works more like a prototype than a robust native app shell
- app boot/session restoration needs a cleaner authenticated-app vs unauthenticated-app architecture

## Deployment Conclusion

`RifahMobile` is a real native customer app, but it is not ready for store deployment yet.

## Ready enough for:

- continued local development
- focused remediation
- preview validation after fixes

## Not ready for:

- EAS production builds
- App Store Connect submission
- Google Play production submission

## Priority Fix Order

1. Remove startup state reset
2. Replace hardcoded API/server URLs with env-driven config
3. Make TypeScript pass
4. Remove or isolate runtime mock/placeholder data
5. Re-align booking and purchasing flows with the now-stabilized backend/web contracts
6. Finalize Expo/EAS production configuration

