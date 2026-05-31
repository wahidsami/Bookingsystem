# Refah Customer App: Splash-to-Home Flow Guide (EN)

## Purpose
This document explains the full customer app entry flow from app launch (splash) until reaching Home, including login, register, Google onboarding, password reset, and the exact screen order/routing rules used by the app.

## Source of Truth
This guide is based on current implementation in:
- `RifahMobile/App.tsx`
- `RifahMobile/src/screens/SplashScreen.tsx`
- `RifahMobile/src/screens/LanguageSelection.tsx`
- `RifahMobile/src/screens/OnboardingScreens.tsx`
- `RifahMobile/src/screens/WelcomeScreen.tsx`
- `RifahMobile/src/screens/LoginScreen.tsx`
- `RifahMobile/src/screens/RegisterScreen.tsx`
- `RifahMobile/src/screens/GoogleOnboardingScreen.tsx`
- `RifahMobile/src/screens/ForgotPasswordScreen.tsx`
- `RifahMobile/src/screens/ResetPasswordScreen.tsx`
- `RifahMobile/src/navigation/RootNavigator.tsx`
- `RifahMobile/src/navigation/TabNavigator.tsx`

---

## 1) High-Level Entry Order

## 1.1 App startup sequence
1. App mounts and loads Cairo fonts.
2. App loads saved language from local storage.
3. App shows `SplashScreen` for ~2 seconds.
4. On splash finish, app decides next screen:
   - If no saved language: `LanguageSelection`
   - If language exists and onboarding not completed: `OnboardingScreens`
   - Else: session check (`api.hasActiveSession`) and route to:
     - `home` if authenticated
     - `login` if not authenticated

## 1.2 Screen states used by app
`App.tsx` controls these states:
- `splash`
- `language`
- `onboarding`
- `welcome`
- `login`
- `register`
- `googleOnboarding`
- `forgotPassword`
- `resetPassword`
- `home`

Note: `welcome` is still available and reachable from back actions in auth screens.

---

## 2) Screen-by-Screen Details

## 2.1 Splash Screen (`SplashScreen`)
### What it contains
- Purple brand background
- Refah logo image
- Tagline text: Beauty & Wellness
- Loading spinner
- Version text (`Version 1.0.0`)

### Behavior
- Auto-completes after ~2 seconds
- Calls `onFinish` to trigger routing logic

## 2.2 Language Selection (`LanguageSelection`)
### What it contains
- Logo at top
- Instruction text in English + Arabic
- Two language buttons:
  - English
  - العربية

### Behavior
- User selects language
- Saves preference
- Routes to onboarding flow

## 2.3 Onboarding (`OnboardingScreens`)
### What it contains
- 4 intro slides (`Onboarding1..4.png`)
- Slide title + description (localized)
- Top `Skip` button
- Bottom navigation:
  - Previous
  - Next
  - Final `Get Started`

### Behavior
- On `Skip` or final completion:
  - marks onboarding completed
  - routes to `login`
- `Back to language` action returns to language screen

## 2.4 Welcome (`WelcomeScreen`)
### What it contains
- Logo + headline/subtitle
- Buttons:
  - Login
  - Register
- Divider with “or”
- Continue as guest

### Behavior
- Login -> `login`
- Register -> `register`
- Guest -> `home`

## 2.5 Login (`LoginScreen`)
### What it contains
- Email input
- Password input with show/hide icon
- Forgot password link
- Primary Sign in button
- Continue with Google button
- Continue with Apple button (currently disabled)
- Link to Register
- Inline error message box

### API and outcomes
- Email/password login uses `/auth/user/login`
- Success:
  - stores access/refresh tokens
  - stores user profile
  - routes to `home`
- Failure:
  - shows API/localized error

### Navigation actions
- Back -> `welcome`
- Register link -> `register`
- Forgot password -> `forgotPassword`
- Google button -> `googleOnboarding`

## 2.6 Register (`RegisterScreen`)
### What it contains
- First name (required)
- Last name (required)
- Email (required)
- Phone (required, Saudi format)
- Password (required)
- Confirm password (required)
- Optional profile completion fields:
  - date of birth
  - gender
- Register button
- Continue with Google button
- Link to Login
- Inline error message

### Validation rules
- First/last name minimum length checks
- Email format check
- Phone format check (`+966...` or `05...`)
- Password must be at least 8 chars and include uppercase/lowercase/number
- Confirm password must match

### API and outcomes
- Register uses `/auth/user/register`
- Success:
  - stores tokens
  - optionally updates profile (DOB/gender)
  - stores user
  - routes to `home`
- Failure:
  - shows error message

### Navigation actions
- Back -> `welcome`
- Login link -> `login`
- Google button -> `googleOnboarding`

## 2.7 Google Onboarding (`GoogleOnboardingScreen`)
### What it contains
Step-based flow with progress indicator:
1. `google`
2. `phone`
3. `otp`
4. `name` (conditional when needed)

### Google setup used by app
- `webClientId`
- `androidClientId`
- `iosClientId`

### Detailed flow
1. User taps Google start.
2. App requests Google ID token.
3. App calls `api.googleStart(idToken)`.
4. If backend says existing complete account:
   - app stores tokens + user
   - routes to `home`
5. If onboarding required:
   - app collects phone
   - sends OTP
   - verifies OTP
   - may ask first/last name
   - calls `api.googleComplete(...)`
   - stores tokens + user
   - routes to `home`

### Persistence
- In-progress Google onboarding state is cached in AsyncStorage and restored if app is interrupted.

## 2.8 Forgot Password (`ForgotPasswordScreen`)
### What it contains
- Back to Sign in
- Email field
- Send reset link button
- Back to welcome button
- Error/success message boxes

### API
- Calls `api.requestPasswordReset(email)`
- Shows success message when request is accepted

## 2.9 Reset Password (`ResetPasswordScreen`)
### What it contains
- New password
- Confirm password
- Save new password button
- Back to login
- Error/success message boxes

### Validation
- Reset token must exist
- Password min length 8
- Passwords must match

### API
- Calls `api.resetPassword(token, password)`

### How screen is opened
- App deep-link parsing sets state to `resetPassword` when reset token is found in URL.

---

## 3) Deep-Link Handling During Entry

During app launch, incoming links are parsed for:
- Password reset token -> `resetPassword` screen
- Appointment invite token -> saved and opened after entering home/auth
- Review appointment id -> saved and opened after entering home/auth
- Gift claim token -> saved and opened after entering home/auth

If user is not authenticated, invite/review/gift routes wait until auth completes.

---

## 4) Session and Logout Rules

## 4.1 Session guard
- App checks active session on startup and on app resume.
- If session becomes invalid:
  - clears auth state
  - routes user to `login` (unless currently in reset-password flow)

## 4.2 Logout
- Logout clears tokens and user cache.
- App routes to `login`.

---

## 5) Home Entry and First Visible Structure

When auth/guest flow reaches `home`, app mounts `RootNavigator`.

## 5.1 Root navigator (main stack)
Initial screen: `Tabs`
Additional routes include:
- Tenant
- Booking
- MyPurchases
- Payment
- HotDealDetail
- Cart
- ServiceBookingCart
- Profile
- EditProfile
- Browse
- Settings
- Notifications
- AppointmentInvite
- EmployeeProfile
- Review
- Gifts

## 5.2 Bottom tab order (`TabNavigator`)
Tab sequence shown to customer:
1. Home
2. Appointments
3. Purchases
4. Me

## 5.3 Home tab content (`HomeScreen`)
Home sections render in this order:
1. Header
2. Hot Deals
3. New to Refah
4. Categories
5. Trending Now
6. Top Service Providers

---

## 6) Auth Flow Map (Quick Reference)

## 6.1 Normal user path (first install)
`Splash -> Language -> Onboarding -> Login/Register -> Home`

## 6.2 Returning logged-in user
`Splash -> Home`

## 6.3 Returning logged-out user
`Splash -> Login`

## 6.4 Google sign-in path
`Login/Register -> Google Onboarding (Google -> Phone -> OTP -> Name if needed) -> Home`

## 6.5 Password reset path
`Login -> Forgot Password -> Email link -> Reset Password -> Login -> Home`

---

## 7) Notes for Product/QA
- `WelcomeScreen` exists but is not default startup destination after onboarding; login is default.
- Apple sign-in button is present in UI but disabled.
- Google auth behavior depends on valid platform-specific client IDs being present in app config env.
- Invite/review/gift deep links are deferred until authenticated home context is ready.
